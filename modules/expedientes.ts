import { supabase } from '@/services/supabase';
import type { Expediente } from '@/modules/types';

export async function validatePaymentForPhase(
  expedienteId: string,
  phaseId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('payments')
    .select('id')
    .eq('expediente_id', expedienteId)
    .eq('phase_id', phaseId)
    .eq('status', 'completed');

  return data !== null && data.length > 0;
}

export async function logAction(
  expedienteId: string,
  action: string,
  metadata: Record<string, unknown> = {},
  userId?: string
): Promise<void> {
  await supabase.from('audit_logs').insert({
    expediente_id: expedienteId,
    action,
    metadata,
    user_id: userId ?? null,
  });
}

// Imported lazily to avoid circular dep (workflow.ts → expedientes.ts → workflow.ts)
async function resolveNextActions(expedienteId: string) {
  const { getNextActions } = await import('@/modules/workflow');
  return getNextActions(expedienteId);
}

export async function transitionToNextPhase(
  expedienteId: string,
  userId?: string,
  transitionId?: string
): Promise<Expediente> {
  const nextActions = await resolveNextActions(expedienteId);

  if (!nextActions.can_advance) {
    const reasons = nextActions.blocking.map((b) => b.name ?? b.type).join(', ');
    throw new Error(`Cannot advance: ${reasons}`);
  }

  const chosen = transitionId
    ? nextActions.available_transitions.find((t) => t.transition_id === transitionId)
    : nextActions.available_transitions[0];

  if (!chosen) throw new Error('Transition not found or not available');

  const { data: expediente } = await supabase
    .from('expedientes')
    .select('current_phase_id')
    .eq('id', expedienteId)
    .single();

  const previousPhaseId = expediente?.current_phase_id ?? null;

  // Close the current phase record in history
  if (previousPhaseId) {
    await supabase
      .from('expediente_phases')
      .update({ exited_at: new Date().toISOString() })
      .eq('expediente_id', expedienteId)
      .eq('phase_id', previousPhaseId)
      .is('exited_at', null);
  }

  // Advance expediente
  const { data: updated, error } = await supabase
    .from('expedientes')
    .update({ current_phase_id: chosen.to_phase.id })
    .eq('id', expedienteId)
    .select()
    .single();

  if (error || !updated) throw error ?? new Error('Update failed');

  // Open a new phase history record
  await supabase.from('expediente_phases').insert({
    expediente_id: expedienteId,
    phase_id: chosen.to_phase.id,
    entered_by: userId ?? null,
  });

  await logAction(
    expedienteId,
    'PHASE_TRANSITION',
    {
      from_phase_id: previousPhaseId,
      to_phase_id: chosen.to_phase.id,
      to_phase_name: chosen.to_phase.name,
    },
    userId
  );

  return updated;
}
