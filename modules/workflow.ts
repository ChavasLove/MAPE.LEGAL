import { supabase } from '@/services/supabase';
import { validatePaymentForPhase } from '@/modules/expedientes';
import type {
  BlockingReason,
  NextActionsResult,
  PhaseTransition,
  TransitionCondition,
} from '@/modules/types';

export async function getAvailableTransitions(
  fromPhaseId: string
): Promise<PhaseTransition[]> {
  const { data, error } = await supabase
    .from('phase_transitions')
    .select('id, from_phase_id, to_phase_id, condition, to_phase:to_phase_id(id, name, order_index)')
    .eq('from_phase_id', fromPhaseId);

  if (error) throw error;

  return (data ?? []) as PhaseTransition[];
}

export async function getBlockingReasons(
  expedienteId: string,
  phaseId: string,
  condition: TransitionCondition
): Promise<BlockingReason[]> {
  const reasons: BlockingReason[] = [];

  if (condition.requires_payment) {
    const isPaid = await validatePaymentForPhase(expedienteId, phaseId);
    if (!isPaid) {
      reasons.push({ type: 'payment', status: 'missing' });
    }
  }

  if (condition.requires_documents?.length) {
    // Placeholder: document check will be implemented when the documents table is ready.
    // Until then every required document is reported as pending.
    for (const docName of condition.requires_documents) {
      reasons.push({ type: 'document', name: docName, status: 'pending' });
    }
  }

  return reasons;
}

export async function getNextActions(expedienteId: string): Promise<NextActionsResult> {
  const { data: expediente, error } = await supabase
    .from('expedientes')
    .select('id, current_phase_id')
    .eq('id', expedienteId)
    .single();

  if (error || !expediente) throw new Error('Expediente not found');

  // Expediente not yet in any phase — find the entry point
  if (!expediente.current_phase_id) {
    const { data: firstPhase } = await supabase
      .from('phases')
      .select('id, name, order_index')
      .eq('order_index', 1)
      .single();

    return {
      can_advance: firstPhase !== null,
      blocking: [],
      available_transitions: firstPhase
        ? [{ transition_id: 'entry', to_phase: firstPhase }]
        : [],
    };
  }

  const transitions = await getAvailableTransitions(expediente.current_phase_id);

  if (transitions.length === 0) {
    return { can_advance: false, blocking: [], available_transitions: [] };
  }

  const available: NextActionsResult['available_transitions'] = [];
  const allBlocking: BlockingReason[] = [];

  for (const t of transitions) {
    if (!t.to_phase) continue;

    const blocking = await getBlockingReasons(
      expedienteId,
      expediente.current_phase_id,
      t.condition
    );

    if (blocking.length === 0) {
      available.push({ transition_id: t.id, to_phase: t.to_phase });
    } else {
      allBlocking.push(...blocking);
    }
  }

  return {
    can_advance: available.length > 0,
    blocking: allBlocking,
    available_transitions: available,
  };
}
