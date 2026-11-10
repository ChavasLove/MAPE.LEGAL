// Certificado de Origen — tipos y helpers del SELLO complementario MAPE.LEGAL
// (migración 042, brief 10-nov-2026 §2.4).
//
// Marco: el Certificado de Origen / Certificación de Procedencia OFICIAL lo
// emite el TITULAR del derecho minero y lo autentica la Autoridad Minera o
// Municipal (Art. 35 Regl. Especial MAPE, Acuerdo 088-B-2018; art. 43.e Regl.
// 042-2013). La plataforma NO emite: REGISTRA y DIGITALIZA el documento
// oficial y lleva un sello/registro complementario voluntario (número de
// sello, folio de talonario, QR que enlaza el papel con el asiento digital,
// huella SHA-256 del ejemplar). /verificar consulta solo el sello.
//
// Este módulo es puro (sin dependencias, sin Supabase) — importable desde
// server y client. El cálculo de hashes vive en lib/certificados/hash.ts
// (server-only, node:crypto).
//
// QR: aquí SOLO se construye la URL que el QR codifica. La imagen QR y el
// diseño gráfico del ejemplar NO existen todavía — ver
// docs/certificado-oficial-y-sello.md §Pendientes. No instalar librerías de QR
// sin decisión expresa (el ejemplar impreso requiere diseño aprobado).

export const COPIA_MINERO_ESTADOS = ['pendiente', 'entregada', 'constancia_firmada'] as const;
export type CopiaMineroEstado = (typeof COPIA_MINERO_ESTADOS)[number];

export const COPIA_MINERO_LABELS: Record<CopiaMineroEstado, string> = {
  pendiente:          'Pendiente',
  entregada:          'Entregada',
  constancia_firmada: 'Constancia firmada',
};

export const EMISOR_TITULAR_TIPOS = ['natural', 'juridica', 'grupo_organizado'] as const;
export type EmisorTitularTipo = (typeof EMISOR_TITULAR_TIPOS)[number];

export const EMISOR_TITULAR_LABELS: Record<EmisorTitularTipo, string> = {
  natural:          'Persona natural',
  juridica:         'Persona jurídica',
  grupo_organizado: 'Grupo organizado',
};

export const CERTIFICADO_ESTADOS = ['vigente', 'revocado', 'expirado', 'suspendido'] as const;
export type CertificadoEstado = (typeof CERTIFICADO_ESTADOS)[number];

/** Fila completa de `certificados_origen` tras la 042 (lectura interna, service role). */
export interface CertificadoRegistro {
  id: string;
  // ── Núcleo 020 ───────────────────────────────────────────────────────────
  numero_certificado: string;
  mina_id: string | null;
  expediente_id: string | null;
  fecha_emision: string;            // date (YYYY-MM-DD) — fecha en que el titular emite
  peso_oro_g: number;
  ley_oro_kt: number | null;
  precio_lbma_usd: number | null;
  estado: CertificadoEstado;
  valido_hasta: string;             // date
  hash_verificacion: string;
  /** LEGACY (020): la plataforma no emite. El flujo nuevo escribe registrado_por. */
  emitido_por: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
  // ── 036 ──────────────────────────────────────────────────────────────────
  /** SHA-256 hex del archivo digital del EJEMPLAR CON SELLO. Indeleble una vez escrito. */
  hash_sha256: string | null;
  // ── 042 · Documento oficial (lo emite el titular, lo autentica la autoridad) ─
  /** Nombre del titular del derecho minero que emite y firma. Dato personal — nunca público. */
  emisor_titular: string | null;
  emisor_titular_tipo: EmisorTitularTipo | null;
  autoridad_autentica: string | null;
  autoridad_autentica_fecha: string | null;   // date
  numero_documento_oficial: string | null;
  escaneo_documento_oficial_path: string | null;
  /** SHA-256 hex del escaneo del documento oficial. Indeleble una vez escrito. */
  escaneo_documento_oficial_hash_sha256: string | null;
  // ── 042 · Sello complementario MAPE.LEGAL ─────────────────────────────────
  /** Número de registro del sello. Hoy = numero_certificado (backfill 042). Público. */
  numero_sello: string | null;
  folio_talonario: string | null;
  /** URL codificada en el QR: <site>/verificar/<numero>. */
  qr_url: string | null;
  ejemplar_sello_escaneo_path: string | null;
  // ── 042 · Copia al minero ─────────────────────────────────────────────────
  copia_minero_estado: CopiaMineroEstado;
  copia_minero_fecha: string | null;          // date
  copia_minero_constancia_path: string | null;
  // ── 042 · Trazabilidad del asiento ────────────────────────────────────────
  /** Usuario de la plataforma que registró y digitalizó. NO es el emisor. */
  registrado_por: string | null;
}

/** Vista pública `certificados_origen_publicos` tras la 042 (lo que ve /verificar). */
export interface CertificadoPublico {
  numero_certificado: string;
  fecha_emision: string;
  peso_oro_g: number;
  estado: CertificadoEstado;
  valido_hasta: string;
  hash_verificacion: string;
  mina_nombre: string | null;
  mina_codigo: string | null;
  mina_municipio: string | null;
  mina_departamento: string | null;
  hash_sha256: string | null;
  certificado_id: string | null;
  /** Presentes solo cuando la 042 está aplicada. */
  numero_sello?: string | null;
  copia_minero_estado?: CopiaMineroEstado | null;
}

/**
 * Campos de la vista pública que /api/verificar/[numero] devuelve. Lista
 * cerrada: si una migración futura ensancha la vista, el JSON público no
 * cambia hasta que alguien agregue el campo aquí a propósito.
 */
export const CERTIFICADO_PUBLICO_FIELDS: ReadonlyArray<keyof CertificadoPublico> = [
  'numero_certificado',
  'fecha_emision',
  'peso_oro_g',
  'estado',
  'valido_hasta',
  'hash_verificacion',
  'mina_nombre',
  'mina_codigo',
  'mina_municipio',
  'mina_departamento',
  'hash_sha256',
  'certificado_id',
  'numero_sello',
  'copia_minero_estado',
];

/** Proyecta una fila (posiblemente con columnas extra) a la forma pública. Omite claves ausentes. */
export function pickCertificadoPublico(row: Record<string, unknown>): Partial<CertificadoPublico> {
  const out: Record<string, unknown> = {};
  for (const k of CERTIFICADO_PUBLICO_FIELDS) {
    if (k in row) out[k] = row[k];
  }
  return out as Partial<CertificadoPublico>;
}

const SHA256_HEX_RE = /^[0-9a-f]{64}$/;

/** true si `value` es un SHA-256 en hex minúsculas de 64 caracteres (formato que exige el CHECK de la 042). */
export function isSha256Hex(value: unknown): value is string {
  return typeof value === 'string' && SHA256_HEX_RE.test(value);
}

/**
 * URL que codifica el QR impreso en el ejemplar con sello. Enlaza el papel con
 * el asiento digital: la verificación pública resuelve por numero_certificado
 * (= numero_sello mientras compartan serie, backfill 042).
 *
 * `siteUrl` normalmente es NEXT_PUBLIC_SITE_URL; sin él, cae a https://mape.legal
 * (mismo fallback que metadataBase en app/layout.tsx).
 */
export function buildQrUrl(numeroSello: string, siteUrl?: string | null): string {
  const base = (siteUrl?.trim() || 'https://mape.legal').replace(/\/+$/, '');
  return `${base}/verificar/${encodeURIComponent(numeroSello.trim())}`;
}

/**
 * Validación de una ruta de Storage registrada como texto (sin subida aún):
 * relativa, corta, sin `..`, sin esquema, sin barra inicial, caracteres seguros.
 */
export function isStoragePathSafe(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (v.length === 0 || v.length > 240) return false;
  if (v.includes('..') || v.startsWith('/') || v.includes('\\') || /^[a-z]+:/i.test(v)) return false;
  return /^[A-Za-z0-9._\-\/ ]+$/.test(v);
}
