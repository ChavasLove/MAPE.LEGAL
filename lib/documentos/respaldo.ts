// lib/documentos/respaldo.ts — RESPALDO DIGITAL de documentos: interfaz y
// adaptadores. SERVER-ONLY para el adaptador real; la interfaz y el adaptador
// en memoria son puros.
//
// ESTADO: "en implementación". Se entrega la interfaz, el contrato, el
// adaptador en memoria (para pruebas) y el ESQUELETO del adaptador de Google
// Drive, apagado por defecto. La integración real necesita una cuenta de
// servicio que no existe en el repositorio ni en el entorno de desarrollo.
//
// SIN CREDENCIALES EN CÓDIGO: el adaptador de Drive lee únicamente NOMBRES de
// variables de entorno. Sus valores no están en el repositorio, en las pruebas
// ni en el PR. [POR CONFIRMAR — WILLIS] carpeta, propietario, política de
// retención, cuenta de servicio y alcance.
//
// Los archivos respaldados NO son públicos. El enlace nunca se construye en el
// navegador: lo entrega la API tras comprobar el acceso (lib/documentos/acl.ts)
// y dejar constancia de la lectura en la bitácora.

import { createHash } from 'node:crypto';

export const NIVELES_ACCESO = ['personal', 'titular', 'organizacion'] as const;
export type NivelAcceso = (typeof NIVELES_ACCESO)[number];

/** Nombres (solo nombres) de las variables de entorno del respaldo en Drive. */
export const RESPALDO_ENV = {
  /** 'true' enciende el adaptador de Drive. Cualquier otro valor: apagado. */
  habilitado: 'RESPALDO_DRIVE_HABILITADO',
  carpeta: 'GOOGLE_DRIVE_RESPALDO_FOLDER_ID',
  cuentaServicio: 'GOOGLE_SERVICE_ACCOUNT_JSON_B64',
} as const;

/** Alcance mínimo previsto para la cuenta de servicio: solo archivos creados por ella. */
export const DRIVE_ALCANCE_MINIMO = 'https://www.googleapis.com/auth/drive.file';

export interface DocumentoParaRespaldo {
  documento_id: string;
  expediente_id: string;
  mina_id: string | null;
  nivel_acceso: NivelAcceso;
  organizacion_id?: string | null;
  subido_por: string;
  nombre: string;
  tipo_mime: string;
  contenido: Uint8Array;
}

export interface ReferenciaRespaldo {
  documento_id: string;
  expediente_id: string;
  mina_id: string | null;
  /** Identificador del archivo en el almacén. Referencia, no contenido. */
  referencia_externa: string;
  almacen: 'google_drive' | 'memoria';
  sha256: string;
  tamano_bytes: number;
  nivel_acceso: NivelAcceso;
  organizacion_id: string | null;
  subido_por: string;
  fecha: string;
  version: number;
  vigente: boolean;
}

export interface EnlaceTemporal { url: string; expira_en: string }

export interface RespaldoDocumentos {
  readonly almacen: ReferenciaRespaldo['almacen'];
  /** Guarda una versión nueva del documento y devuelve su referencia. */
  subir(doc: DocumentoParaRespaldo): Promise<ReferenciaRespaldo>;
  /** Referencia de la versión vigente (o de una versión concreta). null si no existe. */
  obtenerReferencia(documentoId: string, version?: number): Promise<ReferenciaRespaldo | null>;
  /** Versiones vigentes de los documentos de un expediente. */
  listarPorExpediente(expedienteId: string): Promise<ReferenciaRespaldo[]>;
  /** Recalcula la huella del archivo guardado y la compara con la registrada. */
  verificarIntegridad(ref: Pick<ReferenciaRespaldo, 'referencia_externa' | 'sha256'>): Promise<{ integro: boolean; sha256_actual: string | null }>;
  /** Enlace de vida corta para una lectura ya autorizada por la API. */
  enlaceTemporal(ref: Pick<ReferenciaRespaldo, 'referencia_externa'>, segundos: number): Promise<EnlaceTemporal>;
}

export function sha256Bytes(contenido: Uint8Array): string {
  return createHash('sha256').update(contenido).digest('hex');
}

export class RespaldoNoDisponibleError extends Error {
  readonly code = 'RESPALDO_EN_IMPLEMENTACION';
  constructor(detalle = 'El respaldo digital de documentos está en implementación.') {
    super(detalle);
  }
}

/** Adaptador en memoria — SOLO pruebas. Cumple el contrato completo. */
export class RespaldoEnMemoria implements RespaldoDocumentos {
  readonly almacen = 'memoria' as const;
  private archivos = new Map<string, Uint8Array>();
  private refs: ReferenciaRespaldo[] = [];
  private secuencia = 0;
  private reloj: () => Date;
  constructor(reloj: () => Date = () => new Date()) {
    this.reloj = reloj;
  }

  async subir(doc: DocumentoParaRespaldo): Promise<ReferenciaRespaldo> {
    if (doc.contenido.byteLength === 0) throw new Error('El documento está vacío.');
    if (doc.nivel_acceso === 'organizacion' && !doc.organizacion_id) throw new Error('El nivel de acceso "organizacion" exige organizacion_id.');
    const version = this.refs.filter((r) => r.documento_id === doc.documento_id).length + 1;
    // Una versión nueva deja sin vigencia a la anterior.
    for (const r of this.refs) if (r.documento_id === doc.documento_id) r.vigente = false;
    const referencia_externa = `mem-${++this.secuencia}`;
    this.archivos.set(referencia_externa, doc.contenido.slice());
    const ref: ReferenciaRespaldo = {
      documento_id: doc.documento_id, expediente_id: doc.expediente_id, mina_id: doc.mina_id,
      referencia_externa, almacen: 'memoria', sha256: sha256Bytes(doc.contenido), tamano_bytes: doc.contenido.byteLength,
      nivel_acceso: doc.nivel_acceso, organizacion_id: doc.organizacion_id ?? null, subido_por: doc.subido_por,
      fecha: this.reloj().toISOString(), version, vigente: true,
    };
    this.refs.push(ref);
    return { ...ref };
  }

  async obtenerReferencia(documentoId: string, version?: number): Promise<ReferenciaRespaldo | null> {
    const r = this.refs.find((x) => x.documento_id === documentoId && (version === undefined ? x.vigente : x.version === version));
    return r ? { ...r } : null;
  }

  async listarPorExpediente(expedienteId: string): Promise<ReferenciaRespaldo[]> {
    return this.refs.filter((r) => r.expediente_id === expedienteId && r.vigente).map((r) => ({ ...r }));
  }

  async verificarIntegridad(ref: Pick<ReferenciaRespaldo, 'referencia_externa' | 'sha256'>) {
    const archivo = this.archivos.get(ref.referencia_externa);
    if (!archivo) return { integro: false, sha256_actual: null };
    const actual = sha256Bytes(archivo);
    return { integro: actual === ref.sha256, sha256_actual: actual };
  }

  async enlaceTemporal(ref: Pick<ReferenciaRespaldo, 'referencia_externa'>, segundos: number): Promise<EnlaceTemporal> {
    if (!this.archivos.has(ref.referencia_externa)) throw new Error('Archivo inexistente.');
    return { url: `memoria://${ref.referencia_externa}`, expira_en: new Date(this.reloj().getTime() + segundos * 1000).toISOString() };
  }

  /** Solo pruebas: marca un respaldo como revocado. */
  revocar(documentoId: string): void {
    for (const r of this.refs) if (r.documento_id === documentoId) r.vigente = false;
  }

  /** Solo pruebas: altera el archivo guardado para simular una corrupción. */
  corromper(referencia: string): void {
    const a = this.archivos.get(referencia);
    if (a) a[0] = a[0] ^ 0xff;
  }
}

export interface ConfigDrive { carpetaId: string; cuentaServicioB64: string }

/**
 * Adaptador de Google Drive — ESQUELETO. Tipado y con el contrato definido,
 * sin llamadas reales: cada operación lanza RespaldoNoDisponibleError. No se
 * instancia mientras la bandera esté apagada (ver obtenerRespaldo()).
 *
 * Para completarlo: cliente de Drive con la cuenta de servicio (alcance
 * DRIVE_ALCANCE_MINIMO), subida a la carpeta configurada SIN permisos de
 * "cualquiera con el enlace", huella calculada antes de subir y verificada con
 * el `sha256Checksum` que reporta Drive, y enlaces de vida corta por la API.
 */
export class RespaldoGoogleDrive implements RespaldoDocumentos {
  readonly almacen = 'google_drive' as const;
  static instancias = 0;
  private readonly config: ConfigDrive;
  constructor(config: ConfigDrive) {
    this.config = config;
    if (!config.carpetaId || !config.cuentaServicioB64) throw new RespaldoNoDisponibleError('Falta la configuración del respaldo en Drive.');
    RespaldoGoogleDrive.instancias++;
  }
  async subir(): Promise<ReferenciaRespaldo> { throw new RespaldoNoDisponibleError(); }
  async obtenerReferencia(): Promise<ReferenciaRespaldo | null> { throw new RespaldoNoDisponibleError(); }
  async listarPorExpediente(): Promise<ReferenciaRespaldo[]> { throw new RespaldoNoDisponibleError(); }
  async verificarIntegridad(): Promise<{ integro: boolean; sha256_actual: string | null }> { throw new RespaldoNoDisponibleError(); }
  async enlaceTemporal(): Promise<EnlaceTemporal> { throw new RespaldoNoDisponibleError(); }
  /** Para diagnóstico: confirma que hay configuración, sin revelarla. */
  configurado(): boolean { return this.config.carpetaId.length > 0; }
}

export type EstadoRespaldo =
  | { disponible: true; adaptador: RespaldoDocumentos }
  | { disponible: false; motivo: 'apagado' | 'sin_configuracion' };

/**
 * Único punto de entrada. Con la bandera apagada (valor por defecto) NO se
 * crea ni se invoca el adaptador de Drive.
 */
export function obtenerRespaldo(env: Record<string, string | undefined> = process.env): EstadoRespaldo {
  if (env[RESPALDO_ENV.habilitado] !== 'true') return { disponible: false, motivo: 'apagado' };
  const carpetaId = env[RESPALDO_ENV.carpeta]?.trim();
  const cuentaServicioB64 = env[RESPALDO_ENV.cuentaServicio]?.trim();
  if (!carpetaId || !cuentaServicioB64) return { disponible: false, motivo: 'sin_configuracion' };
  return { disponible: true, adaptador: new RespaldoGoogleDrive({ carpetaId, cuentaServicioB64 }) };
}

/** Texto que se muestra mientras el respaldo no esté conectado. */
export const RESPALDO_PENDIENTE = 'Respaldo en implementación';
