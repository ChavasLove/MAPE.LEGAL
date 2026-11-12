// lib/cadena/reglas.ts — reglas puras del estándar privado (sin BD, sin red).
// Las mismas reglas viven en la migración 043 (RPCs/triggers) para que la API
// y la base de datos coincidan; estas funciones alimentan la UI, la API y los
// tests unitarios. Artículos citados con [VERIFICAR LEGAL MINERO] hasta que el
// equipo legal los confirme contra La Gaceta.

import {
  MEDIOS_PAGO,
  PUNTOS_CONCILIACION,
  type EstadoClpi,
  type MedioPago,
  type PuntoConciliacion,
} from './types';

/* ── Pagos: bancarios e identificables; el efectivo bloquea el lote ─────── */

export type ResultadoPago =
  | { ok: true; medio: MedioPago; referencia: string }
  | { ok: false; bloquea_lote: true; motivo: 'efectivo_prohibido' | 'sin_referencia_bancaria' | 'medio_no_admitido' };

export function validarPago(input: { medio: unknown; referencia_bancaria: unknown }): ResultadoPago {
  const medio = typeof input.medio === 'string' ? input.medio.trim().toLowerCase() : '';
  const referencia = typeof input.referencia_bancaria === 'string' ? input.referencia_bancaria.trim() : '';
  if (medio === 'efectivo' || medio === 'cash') {
    return { ok: false, bloquea_lote: true, motivo: 'efectivo_prohibido' };
  }
  if (!(MEDIOS_PAGO as readonly string[]).includes(medio)) {
    return { ok: false, bloquea_lote: true, motivo: 'medio_no_admitido' };
  }
  if (referencia.length < 4) {
    return { ok: false, bloquea_lote: true, motivo: 'sin_referencia_bancaria' };
  }
  return { ok: true, medio: medio as MedioPago, referencia };
}

/* ── Elegibilidad de la fuente (Art. 90 LGM [VERIFICAR LEGAL MINERO]; CLPI) ─ */

export interface FuenteParaElegibilidad {
  permiso_vigente_hasta: string | null; // YYYY-MM-DD
  dentro_area_inhgeomin: boolean | null;
  clpi_estado: EstadoClpi;
  declaracion_mercurio_cero: boolean | null;
}

export interface ResultadoElegibilidad {
  elegible: boolean;
  /** Motivos que BLOQUEAN el lote. */
  bloqueos: Array<'permiso_municipal_no_vigente' | 'fuera_de_area_inhgeomin' | 'clpi_pendiente'>;
  /** Alertas que NO bloquean (orientación: mercurio cero). */
  alertas: Array<'sin_declaracion_mercurio_cero'>;
}

export function evaluarElegibilidadFuente(
  f: FuenteParaElegibilidad,
  hoy: string = new Date().toISOString().slice(0, 10),
): ResultadoElegibilidad {
  const bloqueos: ResultadoElegibilidad['bloqueos'] = [];
  const alertas: ResultadoElegibilidad['alertas'] = [];
  // Permiso municipal vigente (Art. 90 LGM — [VERIFICAR LEGAL MINERO]).
  if (!f.permiso_vigente_hasta || f.permiso_vigente_hasta < hoy) bloqueos.push('permiso_municipal_no_vigente');
  // Dentro de un área delimitada por INHGEOMIN (Art. 90 LGM — [VERIFICAR LEGAL MINERO]).
  if (f.dentro_area_inhgeomin !== true) bloqueos.push('fuera_de_area_inhgeomin');
  // Exclusión de oro de territorios sin CLPI: si la consulta era exigible y no
  // consta documento, el origen no es elegible.
  if (f.clpi_estado === 'pendiente') bloqueos.push('clpi_pendiente');
  if (f.declaracion_mercurio_cero !== true) alertas.push('sin_declaracion_mercurio_cero');
  return { elegible: bloqueos.length === 0, bloqueos, alertas };
}

/* ── Fundición: solo por titular de beneficio, nunca el comercializador ──── */

export type ResultadoFundicion =
  | { ok: true }
  | { ok: false; motivo: 'fundicion_por_comercializador' | 'sin_titular_de_beneficio' };

export function validarEventoFundicion(input: {
  actor_rol: string | null | undefined;
  detalle: Record<string, unknown> | null | undefined;
}): ResultadoFundicion {
  const d = input.detalle ?? {};
  const realizadoPorRol = typeof d.realizado_por_rol === 'string' ? d.realizado_por_rol : input.actor_rol ?? '';
  if (realizadoPorRol === 'comercializador') return { ok: false, motivo: 'fundicion_por_comercializador' };
  const titular = d.titular_beneficio;
  const ok =
    titular &&
    typeof titular === 'object' &&
    typeof (titular as Record<string, unknown>).nombre === 'string' &&
    ((titular as Record<string, unknown>).nombre as string).trim().length > 0 &&
    typeof (titular as Record<string, unknown>).identificacion === 'string' &&
    ((titular as Record<string, unknown>).identificacion as string).trim().length > 0;
  return ok ? { ok: true } : { ok: false, motivo: 'sin_titular_de_beneficio' };
}

/* ── Conciliación de pesos entre puntos de la cadena ─────────────────────── */

export interface PesoPunto {
  punto: PuntoConciliacion;
  peso_g: number;
}

export interface DiferenciaPeso {
  desde: PuntoConciliacion;
  hasta: PuntoConciliacion;
  peso_desde: number;
  peso_hasta: number;
  diferencia_pct: number; // |hasta - desde| / desde × 100
  excede: boolean | null; // null cuando no hay umbral
}

export type ResultadoConciliacion =
  | { estado: 'umbral_no_configurado'; conciliado: false; diferencias: DiferenciaPeso[]; faltan: PuntoConciliacion[] }
  | { estado: 'incompleto'; conciliado: false; diferencias: DiferenciaPeso[]; faltan: PuntoConciliacion[] }
  | { estado: 'alerta'; conciliado: false; diferencias: DiferenciaPeso[]; faltan: [] }
  | { estado: 'conciliado'; conciliado: true; diferencias: DiferenciaPeso[]; faltan: [] };

/**
 * `umbralPct` viene de configuracion_sistema[umbral_conciliacion_peso_pct].
 * NULL = no definido → nunca se concilia (el número lo pone Willis / LEGAL
 * MINERO; aquí no se inventa). Se comparan puntos consecutivos presentes.
 */
export function conciliarPesos(pesos: ReadonlyArray<PesoPunto>, umbralPct: number | null): ResultadoConciliacion {
  const porPunto = new Map<PuntoConciliacion, number>();
  for (const p of pesos) porPunto.set(p.punto, p.peso_g); // el último registrado por punto gana
  const presentes = PUNTOS_CONCILIACION.filter((p) => porPunto.has(p));
  const faltan = PUNTOS_CONCILIACION.filter((p) => !porPunto.has(p));

  const umbralValido = typeof umbralPct === 'number' && Number.isFinite(umbralPct) && umbralPct >= 0;
  const diferencias: DiferenciaPeso[] = [];
  for (let i = 1; i < presentes.length; i++) {
    const desde = presentes[i - 1];
    const hasta = presentes[i];
    const a = porPunto.get(desde)!;
    const b = porPunto.get(hasta)!;
    const pct = a > 0 ? (Math.abs(b - a) / a) * 100 : b === 0 ? 0 : Infinity;
    diferencias.push({ desde, hasta, peso_desde: a, peso_hasta: b, diferencia_pct: pct, excede: umbralValido ? pct > umbralPct : null });
  }

  if (!umbralValido) return { estado: 'umbral_no_configurado', conciliado: false, diferencias, faltan };
  if (faltan.length > 0) return { estado: 'incompleto', conciliado: false, diferencias, faltan };
  if (diferencias.some((d) => d.excede)) return { estado: 'alerta', conciliado: false, diferencias, faltan: [] };
  return { estado: 'conciliado', conciliado: true, diferencias, faltan: [] };
}

/* ── Consentimiento informado (planta ↔ expediente del minero) ───────────── */

export interface ConsentimientoParaAcceso {
  estado: 'vigente' | 'revocado';
  revocado_en: string | null;
  alcance: Partial<Record<string, boolean>>;
  otorgado_a_org_id: string;
}

/**
 * ¿Puede la organización `orgId` ver `alcance` del minero en el instante
 * `enFecha`? Un consentimiento revocado cierra el acceso desde `revocado_en`;
 * las lecturas anteriores quedan en la bitácora (no se reescriben).
 */
export function accesoPorConsentimiento(
  consentimientos: ReadonlyArray<ConsentimientoParaAcceso>,
  orgId: string,
  alcance: string,
  enFecha: Date = new Date(),
): boolean {
  return consentimientos.some((c) => {
    if (c.otorgado_a_org_id !== orgId) return false;
    if (c.alcance?.[alcance] !== true) return false;
    if (c.estado === 'vigente') return true;
    return c.revocado_en !== null && new Date(c.revocado_en).getTime() > enFecha.getTime();
  });
}
