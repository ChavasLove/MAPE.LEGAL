// lib/certificados/publico.ts — VERIFICACIÓN PÚBLICA MÍNIMA del sello.
//
// La respuesta pública es exactamente { numero, estado }. Nada más: sin datos
// personales, sin nombres de minero u organización, sin mina, sin peso, sin
// fechas de tránsito, sin huellas, sin documentos. Ampliarla es una decisión
// de Willis ([POR CONFIRMAR]); aquí no se agrega nada.
//
// La proyección se hace EN CÓDIGO con lista cerrada: aunque la vista
// `certificados_origen_publicos` tenga (o gane) más columnas, no salen.

export const ESTADOS_VERIFICACION = ['vigente', 'revocado', 'vencido', 'suspendido', 'no_encontrado'] as const;
export type EstadoVerificacion = (typeof ESTADOS_VERIFICACION)[number];

export interface VerificacionPublica {
  numero: string;
  estado: EstadoVerificacion;
}

/** Claves exactas de la respuesta pública. */
export const CLAVES_VERIFICACION_PUBLICA = ['numero', 'estado'] as const;

const MAX_NUMERO = 64;

/** Número consultado en forma canónica, o null si no es consultable. */
export function normalizarNumero(crudo: unknown): string | null {
  if (typeof crudo !== 'string') return null;
  let v = crudo;
  try { v = decodeURIComponent(crudo); } catch { /* se usa tal cual */ }
  v = v.trim();
  if (!v || v.length > MAX_NUMERO || /[\u0000-\u001f<>]/.test(v)) return null;
  return v;
}

/** YYYY-MM-DD de hoy en Honduras (UTC−6, sin horario de verano). */
export function hoyHonduras(ahora: Date = new Date()): string {
  return new Date(ahora.getTime() - 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Proyecta una fila de la vista (con las columnas que tenga) a la forma
 * pública. `null` → no encontrado. El número devuelto es el del sello.
 */
export function proyectarVerificacionPublica(
  fila: Record<string, unknown> | null | undefined, numeroConsultado: string, hoy: string = hoyHonduras(),
): VerificacionPublica {
  if (!fila) return { numero: numeroConsultado, estado: 'no_encontrado' };
  const sello = typeof fila.numero_sello === 'string' && fila.numero_sello.trim() ? fila.numero_sello.trim() : null;
  const certificado = typeof fila.numero_certificado === 'string' && fila.numero_certificado.trim() ? fila.numero_certificado.trim() : null;
  const numero = sello ?? certificado ?? numeroConsultado;
  return { numero, estado: estadoPublico(fila.estado, fila.valido_hasta, hoy) };
}

function estadoPublico(estado: unknown, validoHasta: unknown, hoy: string): EstadoVerificacion {
  if (estado === 'revocado') return 'revocado';
  if (estado === 'suspendido') return 'suspendido';
  if (estado === 'expirado') return 'vencido';
  if (estado === 'vigente') {
    // Un sello "vigente" cuya fecha de validez ya pasó se informa como vencido.
    if (typeof validoHasta === 'string' && /^\d{4}-\d{2}-\d{2}/.test(validoHasta) && validoHasta.slice(0, 10) < hoy) return 'vencido';
    return 'vigente';
  }
  // Estado desconocido: nunca se informa como vigente.
  return 'no_encontrado';
}

export type Buscador = (numero: string) => Promise<{ fila: Record<string, unknown> | null; error: boolean }>;

export interface RespuestaVerificacion {
  status: 200 | 400 | 404 | 500;
  body: VerificacionPublica | { error: string };
}

/**
 * Lógica completa del endpoint, sin Next ni Supabase (se prueba con un
 * buscador falso). 404 UNIFORME: un número inexistente y uno con estado
 * desconocido responden igual, con la misma forma que un acierto.
 */
export async function responderVerificacion(numeroCrudo: unknown, buscar: Buscador, hoy: string = hoyHonduras()): Promise<RespuestaVerificacion> {
  const numero = normalizarNumero(numeroCrudo);
  if (!numero) return { status: 400, body: { error: 'numero_invalido' } };
  const { fila, error } = await buscar(numero);
  if (error) return { status: 500, body: { error: 'consulta_no_disponible' } };
  const publico = proyectarVerificacionPublica(fila, numero, hoy);
  if (publico.estado === 'no_encontrado') return { status: 404, body: { numero, estado: 'no_encontrado' } };
  return { status: 200, body: publico };
}

export const ESTADO_VERIFICACION_ETIQUETA: Record<EstadoVerificacion, string> = {
  vigente: 'Vigente',
  revocado: 'Revocado',
  vencido: 'Vencido',
  suspendido: 'Suspendido',
  no_encontrado: 'No encontrado',
};

/** Límite de consultas por IP (anti-enumeración). */
export const VERIFICAR_LIMITE = 20;
export const VERIFICAR_VENTANA_MS = 60_000;
