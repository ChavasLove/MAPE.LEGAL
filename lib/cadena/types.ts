// lib/cadena/types.ts — CONTRATO compartido del estándar privado de debida
// diligencia (Etapa 2, brief v2.1, 11-nov-2026). Fuente única de nombres de
// roles, estados, tipos de evento y formas de fila. La migración 043, las rutas
// /api/cadena/*, la UI privada y los tests consumen estos nombres: no renombrar
// sin tocar los cuatro.
//
// Identidad pública: Corporación Hondureña Tenka, S.A. (CHT) es desarrolladora
// y titular de la plataforma y del estándar. En el código NO se nombra a ningún
// comercializador ni a ninguna planta: las organizaciones viven en la tabla
// `organizaciones` y se identifican por rol (`comercializador`, `planta`,
// `auditor`). La cadena se describe públicamente como "la cadena de suministro
// de la planta de beneficio participante".

/** Roles de aplicación (user_roles.rol). Los 4 primeros ya existían. */
export const ROLES_CADENA = ['comercializador', 'planta', 'auditor'] as const;
export type RolCadena = (typeof ROLES_CADENA)[number];

/** Tipo de organización (tabla organizaciones.tipo). */
export const TIPOS_ORGANIZACION = ['comercializador', 'planta', 'auditor'] as const;
export type TipoOrganizacion = (typeof TIPOS_ORGANIZACION)[number];

/** Estados de un lote. */
export const ESTADOS_LOTE = ['abierto', 'bloqueado', 'conciliado', 'cerrado'] as const;
export type EstadoLote = (typeof ESTADOS_LOTE)[number];

/**
 * Tipos de evento de la cadena de custodia. Los cuatro "puntos de pesaje" de
 * la conciliación son origen_mina, acopio, laboratorio y refinado.
 */
export const TIPOS_EVENTO = [
  'origen_mina',
  'acopio',
  'transporte',
  'recepcion_planta',
  'laboratorio',
  'fundicion',
  'refinado',
  'pago',
  'correccion',
  'nota',
] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

/** Puntos de la conciliación de pesos, en orden de la cadena. */
export const PUNTOS_CONCILIACION = ['origen_mina', 'acopio', 'laboratorio', 'refinado'] as const;
export type PuntoConciliacion = (typeof PUNTOS_CONCILIACION)[number];

/** Medios de pago admitidos. El efectivo NO existe como opción: bloquea el lote. */
export const MEDIOS_PAGO = ['transferencia', 'deposito', 'cheque_bancario'] as const;
export type MedioPago = (typeof MEDIOS_PAGO)[number];

/** Estado CLPI (consulta libre, previa e informada) de una fuente. */
export const ESTADOS_CLPI = ['no_aplica', 'documentado', 'pendiente'] as const;
export type EstadoClpi = (typeof ESTADOS_CLPI)[number];

export const ESTADOS_CONSENTIMIENTO = ['vigente', 'revocado'] as const;
export type EstadoConsentimiento = (typeof ESTADOS_CONSENTIMIENTO)[number];

/** Alcances de un consentimiento informado (claves del jsonb `alcance`). */
export const ALCANCES_CONSENTIMIENTO = ['expediente', 'documentos', 'lotes'] as const;
export type AlcanceConsentimiento = (typeof ALCANCES_CONSENTIMIENTO)[number];

export const TIPOS_ALERTA = [
  'conciliacion_peso',
  'umbral_no_configurado',
  'pago_invalido',
  'fuente_no_elegible',
  'mercurio',
  'clpi',
  'fundicion_rechazada',
] as const;
export type TipoAlerta = (typeof TIPOS_ALERTA)[number];

export const ACCIONES_BITACORA = ['lectura', 'exportacion'] as const;
export type AccionBitacora = (typeof ACCIONES_BITACORA)[number];

/**
 * Clave de configuracion_sistema con el umbral (en %) de diferencia de peso
 * tolerada entre puntos de la cadena. SIN VALOR por defecto: [POR DEFINIR —
 * WILLIS / LEGAL MINERO]. Mientras sea NULL, ningún lote se da por conciliado
 * y se registra la alerta `umbral_no_configurado`.
 */
export const CONFIG_UMBRAL_CONCILIACION = 'umbral_conciliacion_peso_pct';

/** Centinela del primer eslabón de la cadena de hash. */
export const HASH_GENESIS = 'GENESIS';

/* ── Formas de fila (post-migración 043) ─────────────────────────────── */

export interface Organizacion {
  id: string;
  tipo: TipoOrganizacion;
  nombre: string;
  activo: boolean;
}

export interface FuenteComercializador {
  id: string;
  organizacion_id: string;
  cliente_id: string;
  mina_id: string | null;
  permiso_municipal_numero: string | null;
  permiso_vigente_hasta: string | null; // YYYY-MM-DD
  dentro_area_inhgeomin: boolean | null;
  declaracion_mercurio_cero: boolean | null;
  clpi_estado: EstadoClpi;
  documentos: Record<string, unknown>;
  registrado_por: string | null;
  created_at: string;
}

export interface Lote {
  id: string;
  codigo: string;
  fuente_id: string;
  cliente_id: string;
  comercializador_org_id: string;
  planta_org_id: string | null;
  estado: EstadoLote;
  bloqueo_motivo: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoteEvento {
  id: string;
  lote_id: string;
  secuencia: number;
  tipo: TipoEvento;
  actor_user_id: string | null;
  actor_rol: string | null;
  actor_nombre: string | null;
  fecha: string; // ISO timestamptz
  lugar: string | null;
  peso_g: string | null;      // numeric(14,3) como texto (PostgREST)
  ley_fino: string | null;    // numeric(7,6) como texto, fracción 0–1
  detalle: Record<string, unknown>;
  detalle_canonico: string;   // JSON canónico (claves ordenadas) usado en el hash
  hash_previo: string;
  hash: string;
  created_at: string;
}

export interface PagoLote {
  id: string;
  lote_id: string;
  monto_lps: string;
  medio: MedioPago;
  referencia_bancaria: string;
  banco: string | null;
  fecha_pago: string;
  beneficiario_cliente_id: string;
  pagado_por_org_id: string;
  registrado_por: string | null;
  created_at: string;
}

export interface Consentimiento {
  id: string;
  cliente_id: string;
  otorgado_a_org_id: string;
  documento_path: string;
  hash_sha256: string;
  fecha_firma: string;
  alcance: Partial<Record<AlcanceConsentimiento, boolean>>;
  estado: EstadoConsentimiento;
  revocado_en: string | null;
  revocacion_constancia_path: string | null;
  revocacion_motivo: string | null;
  registrado_por: string | null;
  created_at: string;
}

export interface AlertaLote {
  id: string;
  lote_id: string;
  tipo: TipoAlerta;
  detalle: Record<string, unknown>;
  resuelta: boolean;
  created_at: string;
}

export interface BitacoraAcceso {
  id: string;
  user_id: string | null;
  rol: string | null;
  organizacion_id: string | null;
  accion: AccionBitacora;
  recurso_tipo: string;
  recurso_id: string | null;
  detalle: Record<string, unknown>;
  created_at: string;
}
