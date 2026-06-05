import { supabase } from '@/services/supabase';
import { notifyPhaseAdvance } from '@/modules/notifications';
import type { Expediente } from '@/modules/types';

export async function validatePaymentForPhase(
  expedienteId: string,
  faseId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('pagos')
    .select('id')
    .eq('expediente_id', expedienteId)
    .eq('fase_id', faseId)
    .eq('estado', 'completado');

  return data !== null && data.length > 0;
}

export async function logAction(
  expedienteId: string,
  accion: string,
  metadata: Record<string, unknown> = {},
  userId?: string
): Promise<void> {
  await supabase.from('registro_auditoria').insert({
    expediente_id: expedienteId,
    accion,
    metadata,
    user_id: userId ?? null,
  });
}

// Dynamic import breaks the circular dep: workflow.ts → expedientes.ts → workflow.ts
async function resolveNextActions(expedienteId: string) {
  const { getNextActions } = await import('@/modules/workflow');
  return getNextActions(expedienteId);
}

export async function advancePhase(
  expedienteId: string,
  userId?: string,
  transitionId?: string
): Promise<Expediente> {
  const nextActions = await resolveNextActions(expedienteId);

  if (nextActions.is_final) {
    throw new Error('Expediente ya se encuentra en la fase final');
  }

  if (!nextActions.can_advance) {
    const reasons = nextActions.blocking.map((b) => b.name ?? b.type).join(', ');
    throw new Error(`No es posible avanzar: ${reasons}`);
  }

  // Require explicit transition_id when multiple paths are available
  if (nextActions.available_transitions.length > 1 && !transitionId) {
    const options = nextActions.available_transitions
      .map((t) => `${t.transition_id} → ${t.fase.nombre}`)
      .join('; ');
    throw new Error(`Hay múltiples transiciones disponibles — especifica transition_id: ${options}`);
  }

  const chosen = transitionId
    ? nextActions.available_transitions.find((t) => t.transition_id === transitionId)
    : nextActions.available_transitions[0];

  if (!chosen) throw new Error('Transición no encontrada o no disponible');

  const { data: expediente } = await supabase
    .from('expedientes')
    .select('fase_actual_id, fase_numero')
    .eq('id', expedienteId)
    .single();

  const faseAnteriorId     = expediente?.fase_actual_id ?? null;
  const faseAnteriorNumero = expediente?.fase_numero ?? null;

  // Advance the expediente with an optimistic-concurrency guard: the UPDATE only
  // matches while fase_actual_id is still what we just read. Two concurrent
  // /transition calls therefore cannot both win — the loser matches 0 rows and
  // aborts cleanly instead of corrupting fase_actual_id / fase_numero /
  // expediente_fases. Keep the dashboard column fase_numero in sync by mirroring
  // the destination fase.orden.
  let advanceQuery = supabase
    .from('expedientes')
    .update({ fase_actual_id: chosen.fase.id, fase_numero: chosen.fase.orden })
    .eq('id', expedienteId);
  advanceQuery = faseAnteriorId === null
    ? advanceQuery.is('fase_actual_id', null)
    : advanceQuery.eq('fase_actual_id', faseAnteriorId);

  const { data: updated, error } = await advanceQuery.select().maybeSingle();

  if (error) throw error;
  if (!updated) {
    // 0 rows matched: another transition advanced this expediente between our
    // read and our write. Abort rather than double-advance.
    throw new Error('El expediente fue modificado por otra operación. Recargá y reintentá.');
  }

  // We own the advance now — close the previous fase's open history record.
  if (faseAnteriorId) {
    await supabase
      .from('expediente_fases')
      .update({ salida_en: new Date().toISOString() })
      .eq('expediente_id', expedienteId)
      .eq('fase_id', faseAnteriorId)
      .is('salida_en', null);
  }

  // Open new fase history record — revert expediente update if this fails
  const { error: historyError } = await supabase.from('expediente_fases').insert({
    expediente_id: expedienteId,
    fase_id: chosen.fase.id,
    ingresado_por: userId ?? null,
  });

  if (historyError) {
    // Restore both columns to keep fase_numero ↔ fase_actual_id in sync. Guard
    // on the fase we just set so we don't clobber a newer concurrent advance.
    await supabase
      .from('expedientes')
      .update({ fase_actual_id: faseAnteriorId, fase_numero: faseAnteriorNumero })
      .eq('id', expedienteId)
      .eq('fase_actual_id', chosen.fase.id);
    throw new Error('Error al registrar historial de fase — operación revertida');
  }

  await logAction(
    expedienteId,
    'TRANSICION_FASE',
    {
      fase_anterior_id: faseAnteriorId,
      fase_nueva_id: chosen.fase.id,
      fase_nueva_nombre: chosen.fase.nombre,
    },
    userId
  );

  // Fire notifications without blocking the response. Inner errors are logged
  // by notifyPhaseAdvance; the outer catch only fires if the promise itself
  // rejects synchronously (e.g. missing env vars in getAdminClient).
  notifyPhaseAdvance(expedienteId, chosen.fase.nombre)
    .catch(err => console.error('[expedientes] notifyPhaseAdvance crashed:', err));

  return updated;
}
