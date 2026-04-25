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

export async function transitionToNextPhase(
  expedienteId: string,
  userId?: string
): Promise<Expediente> {
  const { data: expediente, error: expError } = await supabase
    .from('expedientes')
    .select('*')
    .eq('id', expedienteId)
    .single();

  if (expError || !expediente) throw new Error('Expediente not found');

  let currentOrderIndex = 0;

  if (expediente.current_phase_id) {
    const { data: currentPhase, error: phaseError } = await supabase
      .from('phases')
      .select('id, order_index')
      .eq('id', expediente.current_phase_id)
      .single();

    if (phaseError || !currentPhase) throw new Error('Current phase not found');

    currentOrderIndex = currentPhase.order_index;

    // Payment required to leave the current phase
    const isPaid = await validatePaymentForPhase(expedienteId, expediente.current_phase_id);
    if (!isPaid) {
      throw new Error(`Payment not completed for phase "${currentPhase.order_index}"`);
    }
  }

  const { data: nextPhase, error: nextError } = await supabase
    .from('phases')
    .select('*')
    .eq('order_index', currentOrderIndex + 1)
    .single();

  if (nextError || !nextPhase) {
    throw new Error('No next phase — expediente has completed all phases');
  }

  const { data: updated, error: updateError } = await supabase
    .from('expedientes')
    .update({ current_phase_id: nextPhase.id })
    .eq('id', expedienteId)
    .select()
    .single();

  if (updateError || !updated) throw updateError ?? new Error('Update failed');

  await logAction(
    expedienteId,
    'PHASE_TRANSITION',
    {
      from_phase_id: expediente.current_phase_id,
      to_phase_id: nextPhase.id,
      to_phase_name: nextPhase.name,
    },
    userId
  );

  return updated;
}
