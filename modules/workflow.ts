import { supabase } from '@/services/supabase';
import { validatePaymentForPhase } from '@/modules/expedientes';
import type {
  BlockingReason,
  CondicionTransicion,
  NextActionsResult,
  TransicionFase,
} from '@/modules/types';

export async function getAvailableTransitions(
  faseOrigenId: string
): Promise<TransicionFase[]> {
  const { data, error } = await supabase
    .from('transiciones_fase')
    .select(
      'id, fase_origen_id, fase_destino_id, condicion, fase_destino:fases!fase_destino_id(id, nombre, orden)'
    )
    .eq('fase_origen_id', faseOrigenId);

  if (error) throw error;

  return (data ?? []) as TransicionFase[];
}

export async function getBlockingReasons(
  expedienteId: string,
  faseId: string,
  condicion: CondicionTransicion
): Promise<BlockingReason[]> {
  const reasons: BlockingReason[] = [];

  if (condicion.requiere_pago) {
    const isPaid = await validatePaymentForPhase(expedienteId, faseId);
    if (!isPaid) {
      reasons.push({ type: 'pago', status: 'missing' });
    }
  }

  if (condicion.requiere_documentos?.length) {
    // Stub: document check will be filled when the documentos table is ready.
    for (const docNombre of condicion.requiere_documentos) {
      reasons.push({ type: 'documento', name: docNombre, status: 'pending' });
    }
  }

  return reasons;
}

export async function getNextActions(
  expedienteId: string
): Promise<NextActionsResult> {
  const { data: expediente, error } = await supabase
    .from('expedientes')
    .select('id, fase_actual_id')
    .eq('id', expedienteId)
    .single();

  if (error || !expediente) throw new Error('Expediente not found');

  // Expediente has not yet entered any fase — find entry point
  if (!expediente.fase_actual_id) {
    const { data: primeraFase } = await supabase
      .from('fases')
      .select('id, nombre, orden')
      .eq('orden', 1)
      .single();

    return {
      can_advance: primeraFase !== null,
      blocking: [],
      available_transitions: primeraFase
        ? [{ transition_id: 'entry', fase: primeraFase }]
        : [],
    };
  }

  const transitions = await getAvailableTransitions(expediente.fase_actual_id);

  if (transitions.length === 0) {
    return { can_advance: false, blocking: [], available_transitions: [] };
  }

  const available: NextActionsResult['available_transitions'] = [];
  const allBlocking: BlockingReason[] = [];

  for (const t of transitions) {
    if (!t.fase_destino) continue;

    const blocking = await getBlockingReasons(
      expedienteId,
      expediente.fase_actual_id,
      t.condicion
    );

    if (blocking.length === 0) {
      available.push({ transition_id: t.id, fase: t.fase_destino });
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
