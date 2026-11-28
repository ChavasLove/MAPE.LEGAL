// lib/recepcion/reglas.ts — reglas PURAS de la recepción física y la custodia
// hasta el laboratorio. Réplica de los triggers y funciones de la migración
// 047 (la base es la defensa final; esto da el mensaje antes de llegar a ella).
//
//   (a) un sobre pertenece a UNA mina, la de su recepción
//   (b) una caja contiene sobres de UN solo titular de origen
//   (c) no se cierra una caja sin manifiesto
//   (d) no se cierra ni se envía una caja con sobres sin pesar o sin etiquetar
//   (e) un titular sin perfil aprobado no origina recepción
//   (f) nada se borra: la anulación es un evento de corrección

import { puedeOriginarLote, type EstadoPerfil } from '@/lib/perfiles/estados';
import type { EstadoCaja, EstadoConciliacionLab, EstadoSobre } from './types';

export type Regla = { ok: true } | { ok: false; motivo: string };
const OK: Regla = { ok: true };
const no = (motivo: string): Regla => ({ ok: false, motivo });

/** (e) + coherencia titular / mina / lote de una recepción nueva. */
export function recepcionAdmisible(input: {
  perfil: { estado: EstadoPerfil } | null;
  lote: { cliente_id: string; estado: string };
  mina: { cliente_id: string | null };
  punto: { activo: boolean };
  titularId?: string | null;
}): Regla {
  if (input.lote.estado === 'bloqueado' || input.lote.estado === 'cerrado') return no('lote_no_disponible');
  if (input.titularId && input.titularId !== input.lote.cliente_id) return no('titular_no_coincide');
  const perfil = puedeOriginarLote(input.perfil);
  if (!perfil.ok) return no(perfil.motivo);
  if (input.mina.cliente_id !== input.lote.cliente_id) return no('mina_de_otro_titular');
  if (!input.punto.activo) return no('punto_inactivo');
  return OK;
}

/** (a) el sobre es de la mina de su recepción. */
export function sobreAdmisible(recepcion: { mina_id: string; estado: string }, minaId?: string | null): Regla {
  if (recepcion.estado !== 'registrada') return no('recepcion_anulada');
  if (minaId && minaId !== recepcion.mina_id) return no('sobre_de_otra_mina');
  return OK;
}

export interface SobreParaCaja {
  titular_cliente_id: string;
  peso_neto_g: number | string | null;
  etiqueta: string | null;
  numero_sello: string | null;
  estado: EstadoSobre;
  caja_id: string | null;
}

export function sobreCompleto(s: Pick<SobreParaCaja, 'peso_neto_g' | 'etiqueta' | 'numero_sello'>): Regla {
  if (s.peso_neto_g === null || s.peso_neto_g === '') return no('sobre_sin_pesar');
  if (!s.etiqueta?.trim() || !s.numero_sello?.trim()) return no('sobre_sin_etiquetar');
  return OK;
}

/** (b) y (d) al meter un sobre en una caja. */
export function puedeEmpacar(sobre: SobreParaCaja, caja: { titular_cliente_id: string; estado: EstadoCaja }): Regla {
  if (sobre.estado === 'anulado') return no('sobre_anulado');
  if (sobre.caja_id !== null) return no('sobre_ya_empacado');
  if (caja.estado !== 'abierta') return no('caja_no_abierta');
  if (sobre.titular_cliente_id !== caja.titular_cliente_id) return no('mezcla_de_titulares');
  return sobreCompleto(sobre);
}

/** (c) y (d) al cerrar. */
export function puedeCerrarCaja(
  caja: { estado: EstadoCaja; titular_cliente_id: string },
  sobres: ReadonlyArray<SobreParaCaja>,
  cierre: { precinto: string | null; manifiestoHash: string | null },
): Regla {
  if (caja.estado !== 'abierta') return no('caja_no_abierta');
  if (!cierre.precinto?.trim()) return no('sin_precinto');
  if (sobres.length === 0) return no('caja_vacia');
  if (sobres.some((s) => s.titular_cliente_id !== caja.titular_cliente_id)) return no('mezcla_de_titulares');
  if (sobres.some((s) => !sobreCompleto(s).ok)) return no('sobres_incompletos');
  if (!cierre.manifiestoHash) return no('sin_manifiesto');
  return OK;
}

/** (c) y (d) al enviar: solo una caja cerrada (con manifiesto) y completa. */
export function puedeEnviarCaja(
  caja: { estado: EstadoCaja; manifiesto_hash: string | null },
  sobres: ReadonlyArray<Pick<SobreParaCaja, 'peso_neto_g' | 'etiqueta' | 'numero_sello'>>,
): Regla {
  if (caja.estado !== 'cerrada') return no('caja_no_cerrada');
  if (!caja.manifiesto_hash) return no('sin_manifiesto');
  if (sobres.length === 0) return no('caja_vacia');
  if (sobres.some((s) => !sobreCompleto(s).ok)) return no('sobres_incompletos');
  return OK;
}

export function puedeRecibirEnLaboratorio(caja: { estado: EstadoCaja }): Regla {
  return caja.estado === 'enviada' ? OK : no('caja_no_enviada');
}

/** (f) la anulación exige motivo y no alcanza lo que ya salió en una caja cerrada. */
export function puedeAnularRecepcion(
  recepcion: { estado: string },
  sobres: ReadonlyArray<{ caja_estado: EstadoCaja | null }>,
  motivo: unknown,
): Regla {
  if (recepcion.estado === 'anulada') return no('ya_anulada');
  if (typeof motivo !== 'string' || motivo.trim().length < 5) return no('motivo_obligatorio');
  if (sobres.some((s) => s.caja_estado !== null && s.caja_estado !== 'abierta')) return no('sobres_en_caja_cerrada');
  return OK;
}

/* ── Conciliación manifiesto ↔ recepción en laboratorio ─────────────────── */

export interface DiferenciaSobre {
  sobre_id: string;
  peso_manifiesto_g: number;
  peso_recibido_g: number;
  diferencia_pct: number;      // |recibido − manifiesto| / manifiesto × 100
  excede: boolean | null;      // null cuando no hay umbral
}

export interface ResultadoConciliacionLab {
  estado: EstadoConciliacionLab;
  conciliada: boolean;
  diferencias: DiferenciaSobre[];
  faltan: string[];
}

/**
 * Misma regla que conciliarPesos() de lib/cadena/reglas.ts y que
 * conciliar_lote() de la 043, aplicada sobre por sobre contra el manifiesto.
 * `umbralPct` es configuracion_sistema[umbral_conciliacion_peso_pct]: NO tiene
 * valor por defecto. Mientras sea null, nada se da por conciliado.
 */
export function conciliarManifiesto(
  manifiesto: ReadonlyArray<{ id: string; peso_neto_g: number | string }>,
  recibidos: ReadonlyArray<{ sobre_id: string; peso_g: number | string }>,
  umbralPct: number | null,
  precintoIntegro = true,
): ResultadoConciliacionLab {
  const umbralValido = typeof umbralPct === 'number' && Number.isFinite(umbralPct) && umbralPct >= 0;
  const porSobre = new Map<string, number>();
  for (const r of recibidos) {
    const n = Number(r.peso_g);
    if (Number.isFinite(n) && n >= 0) porSobre.set(r.sobre_id, n);
  }
  const diferencias: DiferenciaSobre[] = [];
  const faltan: string[] = [];
  for (const s of [...manifiesto].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const recibido = porSobre.get(s.id);
    if (recibido === undefined) {
      faltan.push(s.id);
      continue;
    }
    const a = Number(s.peso_neto_g);
    const pct = a > 0 ? (Math.abs(recibido - a) / a) * 100 : recibido === 0 ? 0 : Infinity;
    diferencias.push({ sobre_id: s.id, peso_manifiesto_g: a, peso_recibido_g: recibido, diferencia_pct: pct, excede: umbralValido ? pct > umbralPct : null });
  }
  let estado: EstadoConciliacionLab;
  if (!umbralValido) estado = 'umbral_no_configurado';
  else if (faltan.length > 0) estado = 'incompleto';
  else if (diferencias.some((d) => d.excede) || !precintoIntegro) estado = 'discrepancia';
  else estado = 'conciliada';
  return { estado, conciliada: estado === 'conciliada', diferencias, faltan };
}
