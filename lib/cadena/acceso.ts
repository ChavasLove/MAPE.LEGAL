// lib/cadena/acceso.ts — RBAC EN CÓDIGO del estándar privado (brief v2.1 Etapa 2).
//
// La API usa el cliente service-role (la RLS de la 043 le da policy `for all`),
// así que la autorización vive aquí: `requireRole()` fija el rol y este módulo
// fija el ALCANCE (organización del comercializador/planta, cliente del minero).
// La RLS queda como defensa en profundidad para accesos directos a PostgREST.
//
// Reparto de visibilidad (quién ve qué):
//   admin / abogado / tecnico_ambiental (CHT, titular y operadora; no compra)
//     → todo.
//   auditor → lectura de todo + exportación; pagos SIN monto (decisión
//     documentada, pendiente de Willis).
//   comercializador → fuentes, lotes, eventos y pagos de SU organización.
//   planta → lotes donde planta_org_id = su organización; NUNCA pagos ni
//     márgenes; expediente del minero solo con consentimiento vigente.
//   cliente (minero) → sus lotes y SOLO los pagos cuyo beneficiario es él.
//
// Los predicados son puros (testeables sin BD); getContextoCadena es la única
// función que toca Supabase.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Role } from '@/lib/userRoleLookup';
import type { AuthContext } from '@/lib/serverAuth';
import { getAdminClient } from '@/services/adminSupabase';

export interface ContextoCadena {
  rol: Role;
  userId: string;
  /** Correo del usuario — se guarda como actor_nombre en los eventos. */
  email: string | null;
  /** user_roles.organizacion_id (comercializador / planta / auditor). */
  organizacionId: string | null;
  /** clientes.id cuyo user_id = userId (solo rol cliente). */
  clienteId: string | null;
}

/** Forma mínima de lote que necesitan los predicados (subset de Lote). */
export interface LoteParaAcceso {
  cliente_id: string;
  comercializador_org_id: string;
  planta_org_id: string | null;
}

export interface PagoParaAcceso {
  beneficiario_cliente_id: string;
  pagado_por_org_id: string;
}

const STAFF = new Set<Role>(['admin', 'abogado', 'tecnico_ambiental']);

export function esStaff(rol: Role): boolean {
  return STAFF.has(rol);
}

/** Staff + auditor: ven todo (el auditor solo lee). */
export function veTodo(rol: Role): boolean {
  return esStaff(rol) || rol === 'auditor';
}

export function puedeVerLote(ctx: ContextoCadena, lote: LoteParaAcceso): boolean {
  if (veTodo(ctx.rol)) return true;
  switch (ctx.rol) {
    case 'comercializador':
      return ctx.organizacionId !== null && lote.comercializador_org_id === ctx.organizacionId;
    case 'planta':
      return ctx.organizacionId !== null && lote.planta_org_id !== null && lote.planta_org_id === ctx.organizacionId;
    case 'cliente':
      return ctx.clienteId !== null && lote.cliente_id === ctx.clienteId;
    default:
      return false;
  }
}

/**
 * ¿Puede registrar eventos sobre el lote? admin (CHT) siempre; comercializador
 * y planta solo sobre lotes PROPIOS. Qué TIPOS de evento puede cada rol lo
 * decide tiposEventoPermitidos() en lib/cadena/validacion.ts. abogado /
 * tecnico_ambiental / auditor / cliente no escriben en la cadena.
 */
export function puedeEscribirLote(ctx: ContextoCadena, lote: LoteParaAcceso): boolean {
  if (ctx.rol === 'admin') return true;
  if (ctx.rol === 'comercializador') {
    return ctx.organizacionId !== null && lote.comercializador_org_id === ctx.organizacionId;
  }
  if (ctx.rol === 'planta') {
    return ctx.organizacionId !== null && lote.planta_org_id !== null && lote.planta_org_id === ctx.organizacionId;
  }
  return false;
}

/** Pagos y conciliación: solo el comercializador dueño del lote o admin. */
export function puedeRegistrarPago(ctx: ContextoCadena, lote: LoteParaAcceso): boolean {
  if (ctx.rol === 'admin') return true;
  return ctx.rol === 'comercializador' && ctx.organizacionId !== null && lote.comercializador_org_id === ctx.organizacionId;
}

/**
 * ¿Puede ver la sección de pagos de un lote? Staff, auditor (sin monto),
 * comercializador propio y cliente propio. NUNCA planta — ni siquiera la
 * existencia de la clave `pagos` en la respuesta.
 */
export function puedeVerPagos(ctx: ContextoCadena, lote: LoteParaAcceso): boolean {
  if (ctx.rol === 'planta') return false;
  if (veTodo(ctx.rol)) return true;
  if (ctx.rol === 'comercializador') {
    return ctx.organizacionId !== null && lote.comercializador_org_id === ctx.organizacionId;
  }
  if (ctx.rol === 'cliente') return ctx.clienteId !== null && lote.cliente_id === ctx.clienteId;
  return false;
}

/**
 * Filtra la lista de pagos ya cargada según el rol: planta → []; cliente →
 * solo los pagos cuyo beneficiario es él; el resto ve todos. (El redactado del
 * monto para auditor lo aplica la ruta con redactarPagoParaAuditor.)
 */
export function filtrarPagosVisibles<T extends PagoParaAcceso>(ctx: ContextoCadena, pagos: ReadonlyArray<T>): T[] {
  if (ctx.rol === 'planta') return [];
  if (ctx.rol === 'cliente') {
    if (ctx.clienteId === null) return [];
    return pagos.filter((p) => p.beneficiario_cliente_id === ctx.clienteId);
  }
  if (ctx.rol === 'comercializador') {
    if (ctx.organizacionId === null) return [];
    return pagos.filter((p) => p.pagado_por_org_id === ctx.organizacionId);
  }
  return [...pagos];
}

/** ¿Puede leer el expediente del minero dueño del lote? (planta: además exige consentimiento vigente — lo valida la ruta). */
export function puedeSolicitarExpediente(ctx: ContextoCadena, lote: LoteParaAcceso): boolean {
  if (esStaff(ctx.rol)) return true;
  if (ctx.rol === 'planta') return puedeVerLote(ctx, lote);
  if (ctx.rol === 'cliente') return ctx.clienteId !== null && lote.cliente_id === ctx.clienteId;
  return false; // comercializador y auditor: no ven el expediente del minero
}

/* ── Alcance de listados ────────────────────────────────────────────────── */

export type AlcanceLista =
  | { tipo: 'todos' }
  | { tipo: 'comercializador'; organizacionId: string }
  | { tipo: 'planta'; organizacionId: string }
  | { tipo: 'cliente'; clienteId: string }
  /** Rol con alcance acotado pero sin organización/cliente vinculado: no ve nada. */
  | { tipo: 'nada' };

export function alcanceLista(ctx: ContextoCadena): AlcanceLista {
  if (veTodo(ctx.rol)) return { tipo: 'todos' };
  if (ctx.rol === 'comercializador') {
    return ctx.organizacionId ? { tipo: 'comercializador', organizacionId: ctx.organizacionId } : { tipo: 'nada' };
  }
  if (ctx.rol === 'planta') {
    return ctx.organizacionId ? { tipo: 'planta', organizacionId: ctx.organizacionId } : { tipo: 'nada' };
  }
  if (ctx.rol === 'cliente') {
    return ctx.clienteId ? { tipo: 'cliente', clienteId: ctx.clienteId } : { tipo: 'nada' };
  }
  return { tipo: 'nada' };
}

/** Columna + valor de filtro sobre `lotes` para un alcance; null = sin filtro (todos). */
export function filtroLotes(alcance: AlcanceLista): { columna: 'comercializador_org_id' | 'planta_org_id' | 'cliente_id'; valor: string } | null {
  switch (alcance.tipo) {
    case 'comercializador': return { columna: 'comercializador_org_id', valor: alcance.organizacionId };
    case 'planta':          return { columna: 'planta_org_id', valor: alcance.organizacionId };
    case 'cliente':         return { columna: 'cliente_id', valor: alcance.clienteId };
    default:                return null;
  }
}

/* ── Resolución del contexto (única función con BD) ─────────────────────── */

/** Códigos que indican que la migración 043 (u otra tabla/RPC) no está aplicada. */
export function esMigracionPendiente(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const code = error.code ?? '';
  // 42P01 undefined_table · 42883 undefined_function · 42703 undefined_column ·
  // PGRST202 RPC fuera del schema cache · PGRST205 tabla fuera del schema cache.
  return code === '42P01' || code === '42883' || code === '42703' || code === 'PGRST202' || code === 'PGRST205';
}

export class MigracionPendienteError extends Error {
  readonly code = 'MIGRATION_PENDING';
  constructor(detalle: string) {
    super(`La migración 043 (estándar privado) no está aplicada: ${detalle}`);
  }
}

/**
 * Resuelve organización y cliente del usuario autenticado. Lecturas con el
 * cliente service-role (lazy; nunca a nivel de módulo). Lanza
 * MigracionPendienteError si user_roles.organizacion_id no existe todavía
 * (solo relevante para roles de cadena — para staff/cliente se degrada a null).
 */
export async function getContextoCadena(auth: AuthContext, admin: SupabaseClient = getAdminClient()): Promise<ContextoCadena> {
  const base: ContextoCadena = {
    rol: auth.role,
    userId: auth.user.id,
    email: auth.user.email ?? null,
    organizacionId: null,
    clienteId: null,
  };

  const necesitaOrg = auth.role === 'comercializador' || auth.role === 'planta' || auth.role === 'auditor';
  const necesitaCliente = auth.role === 'cliente';

  const [orgRes, cliRes] = await Promise.all([
    necesitaOrg
      ? admin.from('user_roles').select('organizacion_id').eq('user_id', auth.user.id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    necesitaCliente
      ? admin.from('clientes').select('id').eq('user_id', auth.user.id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (orgRes.error) {
    if (esMigracionPendiente(orgRes.error)) throw new MigracionPendienteError('user_roles.organizacion_id');
    console.error('[cadena/acceso] organizacion lookup failed:', orgRes.error);
    throw new Error('No se pudo resolver la organización del usuario.');
  }
  if (cliRes.error) {
    console.error('[cadena/acceso] cliente lookup failed:', cliRes.error);
    throw new Error('No se pudo resolver el cliente del usuario.');
  }

  const org = (orgRes.data as { organizacion_id?: string | null } | null)?.organizacion_id ?? null;
  const cli = (cliRes.data as { id?: string } | null)?.id ?? null;
  return { ...base, organizacionId: org, clienteId: cli };
}
