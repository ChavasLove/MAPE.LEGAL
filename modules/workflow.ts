import { getAdminClient } from '@/services/adminSupabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import { validatePaymentForPhase } from '@/modules/expedientes';
import type {
  BlockingReason,
  CondicionTransicion,
  NextActionsResult,
  TransicionFase,
} from '@/modules/types';

// Server-only. Este módulo usa el cliente service-role (getAdminClient) y no
// debe importarse desde client components salvo con `import type`. Sus callers
// son rutas server-side ya protegidas por requireRole(). La instanciación es
// lazy — nunca a nivel de módulo (regla §Framework de CLAUDE.md). Desde la
// migración 041 estas tablas tienen RLS y la anon key no las ve.
let _db: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (!_db) _db = getAdminClient();
  return _db;
}

export async function getAvailableTransitions(
  faseOrigenId: string
): Promise<TransicionFase[]> {
  const { data, error } = await db()
    .from('transiciones_fase')
    .select(
      'id, fase_origen_id, fase_destino_id, condicion, fase_destino:fases!fase_destino_id(id, nombre, orden)'
    )
    .eq('fase_origen_id', faseOrigenId);

  if (error) throw error;

  // Supabase infers forward-reference joins as arrays; at runtime they are
  // single objects. Normalize defensively then cast.
  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    fase_destino: Array.isArray(row.fase_destino)
      ? (row.fase_destino as unknown[])[0]
      : row.fase_destino,
  })) as unknown as TransicionFase[];
}

async function checkDocumentos(
  expedienteId: string,
  nombresRequeridos: string[]
): Promise<BlockingReason[]> {
  if (!nombresRequeridos.length) return [];

  const { data, error } = await db()
    .from('documentos')
    .select('nombre, estado')
    .eq('expediente_id', expedienteId)
    .in('nombre', nombresRequeridos);

  if (error) throw error;

  const verificados = new Set(
    (data ?? [])
      .filter((d: { nombre: string; estado: string }) => d.estado === 'verificado')
      .map((d: { nombre: string; estado: string }) => d.nombre)
  );

  return nombresRequeridos
    .filter((nombre) => !verificados.has(nombre))
    .map((nombre) => ({ type: 'documento' as const, name: nombre, status: 'pending' as const }));
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
    const docBlocking = await checkDocumentos(expedienteId, condicion.requiere_documentos);
    reasons.push(...docBlocking);
  }

  return reasons;
}

export async function getNextActions(
  expedienteId: string
): Promise<NextActionsResult> {
  const { data: expediente, error } = await db()
    .from('expedientes')
    .select('id, fase_actual_id')
    .eq('id', expedienteId)
    .single();

  if (error || !expediente) throw new Error('Expediente not found');

  // Expediente has not yet entered any fase — find entry point
  if (!expediente.fase_actual_id) {
    const { data: primeraFase } = await db()
      .from('fases')
      .select('id, nombre, orden')
      .eq('orden', 1)
      .single();

    return {
      can_advance: primeraFase !== null,
      is_final: false,
      blocking: [],
      available_transitions: primeraFase
        ? [{ transition_id: 'entry', fase: primeraFase }]
        : [],
    };
  }

  const transitions = await getAvailableTransitions(expediente.fase_actual_id);

  // No outgoing transitions — this is the final phase
  if (transitions.length === 0) {
    return { can_advance: false, is_final: true, blocking: [], available_transitions: [] };
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
    is_final: false,
    blocking: allBlocking,
    available_transitions: available,
  };
}
