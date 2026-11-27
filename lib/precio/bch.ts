// lib/precio/bch.ts
// ---------------------------------------------------------------------------
// Tipo de cambio de COMPRA de dólares del Banco Central de Honduras (BCH) —
// adaptador dedicado (DEC-2026-11-26-1 / DEC-2026-11-27-2).
//
// Reglas:
//  - Lo público usa ÚNICAMENTE el tipo de cambio de compra del BCH. Ninguna
//    otra fuente de tipo de cambio se muestra ni se etiqueta como "BCH".
//  - Cadena de obtención: caché en memoria → BCH en vivo → último valor
//    registrado como BCH en `precios_diarios` (marcador fx:bch de la ventana
//    actual) → último `tipo_cambio_bch` válido de `precios_referencia` (con su
//    fecha y hora_fijacion) → `null`.
//  - Con `null`, la UI, las APIs y María dicen "dato no disponible". NUNCA se
//    inventa ni se estima una cifra.
//  - Timeout acotado (BCH_FETCH_TIMEOUT_MS = 8 s, alineado con
//    FETCH_TIMEOUT_MS de services/pricingService.ts). Caché de 1 h por
//    instancia para no martillar al BCH en cada request.
//
// Fuente oficial (verificada el 27-nov-2026): el BCH NO expone un web service
// documentado. Publica la serie diaria "Tipo de Cambio de Compra y Venta" como
// archivos Excel servidos por GET simple (sin JS ni autenticación) desde sus
// bibliotecas públicas; su nota al pie dice "Compra 1/ = Tipo de Cambio de
// Referencia (TCR)". El TCR es, según el Reglamento para la Negociación en el
// Mercado Organizado de Divisas (Acuerdo 1/2026 del BCH), el tipo de cambio
// promedio ponderado de la Subasta de Divisas, vigente para el día siguiente;
// la venta es el TCR más la comisión cambiaria. Por eso el adaptador lee ese
// archivo (ruta de biblioteca estable desde hace años, sin SLA contractual —
// riesgo declarado en el PR), con parser XLSX propio y conservador, y toma la
// última fila cuya fecha sea ≤ hoy (Honduras). La URL puede sobreescribirse
// con BCH_TIPO_CAMBIO_URL (acepta XLSX, JSON o texto/HTML con "Compra"/"Venta");
// `BCH_TIPO_CAMBIO_URL=off` desactiva la lectura en vivo y deja solo respaldos.
// [POR CONFIRMAR por Willis] qué serie oficial usar: la serie diaria de
// compra/venta (por defecto aquí) o la serie "Tipo de Cambio de Referencia".
// ---------------------------------------------------------------------------

import { leerPrimeraHoja, pareceXlsx, serialExcelAFecha, type CeldaXlsx } from './xlsxMinimo';
import { DATO_NO_DISPONIBLE, ETIQUETA_TIPO_CAMBIO } from '@/lib/content/copy-legal';

export const BCH_NOMBRE = 'Banco Central de Honduras (BCH)';
/** Página oficial donde el BCH publica el tipo de cambio de compra y venta. */
export const BCH_URL_PUBLICACION =
  'https://www.bch.hn/estadisticas-y-publicaciones-economicas/tipo-de-cambio-nominal';
/** Serie diaria oficial (Fecha · Tipo de Precio Compra/Venta · Precio), 2000 → hoy. */
export const BCH_URL_SERIE_DIARIA_XLSX =
  'https://www.bch.hn/estadisticos/GIE/Series%20pblicas/Precio%20Diario%20del%20D%C3%B3lar-EUA.xlsx';
export const BCH_FETCH_TIMEOUT_MS = 8000;
export const BCH_CACHE_TTL_MS = 60 * 60 * 1000;

/** Identificador de la única fuente pública admitida para el tipo de cambio. */
export const FUENTE_TIPO_CAMBIO_ID = 'bch' as const;

export type OrigenTipoCambio = 'vivo' | 'respaldo';

export interface TipoCambioBch {
  /** Tipo de cambio de COMPRA de dólares (lempiras por USD). El que usa lo público. */
  compra: number;
  /** Tipo de cambio de venta, si la fuente lo trae. No se usa en el precio. */
  venta: number | null;
  fuente: typeof FUENTE_TIPO_CAMBIO_ID;
  fuenteNombre: string;
  /** Fecha de vigencia del dato (YYYY-MM-DD) tal como la publica o registra la fuente. */
  fecha: string;
  /** Momento en que se obtuvo/registró (ISO 8601). */
  obtenidoEn: string;
  /** 'vivo' = leído del BCH en esta ventana; 'respaldo' = último valor guardado. */
  origen: OrigenTipoCambio;
  /** Detalle legible de la procedencia (URL o tabla de respaldo). */
  detalle: string;
}

/* ── Validación y clasificación de respuestas ───────────────────────── */

// Cota de sanidad: un tipo de cambio HNL/USD fuera de (1, 1000) no es un dato,
// es un error de parseo. No es un valor de negocio, solo un filtro de basura.
const TC_MIN = 1;
const TC_MAX = 1000;

/** `true` si `n` es un número finito y plausible como lempiras por USD. */
export function esTipoCambioValido(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > TC_MIN && n < TC_MAX;
}

/** Convierte "26.1234", "26,1234" o 26.1234 a número; null si no es numérico. */
export function aNumero(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const limpio = v.trim().replace(/\s/g, '').replace(/^L\.?\s*/i, '');
  if (!limpio) return null;
  // Formato hondureño "26,1234" → "26.1234"; miles con punto solo cuando es
  // inequívoco ("1.234.567" o "1.234,56"): un tipo de cambio "26.923" es un
  // decimal de 3 cifras, no veintiséis mil.
  const normalizado =
    /^\d{1,3}(\.\d{3}){2,}(,\d+)?$/.test(limpio) || /^\d{1,3}(\.\d{3})+,\d+$/.test(limpio)
      ? limpio.replace(/\./g, '').replace(',', '.')
      : /^\d+,\d+$/.test(limpio)
        ? limpio.replace(',', '.')
        : limpio.replace(/,/g, '');
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

/** Normaliza una fecha "dd/mm/yyyy", "yyyy-mm-dd", serial Excel o Date a YYYY-MM-DD; null si no se puede. */
export function aFechaIso(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') return serialExcelAFecha(v);
  if (typeof v !== 'string') return null;
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

export type ClasificacionBch =
  | { ok: true; compra: number; venta: number | null; fecha: string | null }
  | { ok: false; motivo: string };

const CLAVES_COMPRA = ['compra', 'precio_compra', 'precioCompra', 'tipo_cambio_compra', 'Compra', 'PrecioCompra', 'TipoCambioCompra', 'tcr', 'TCR', 'buy'];
const CLAVES_VENTA = ['venta', 'precio_venta', 'precioVenta', 'tipo_cambio_venta', 'Venta', 'PrecioVenta', 'TipoCambioVenta', 'sell'];
const CLAVES_FECHA = ['fecha', 'Fecha', 'date', 'Date', 'fecha_publicacion', 'FechaPublicacion'];

function primeraClave(obj: Record<string, unknown>, claves: readonly string[]): unknown {
  for (const k of claves) if (k in obj) return obj[k];
  return undefined;
}

/**
 * Clasifica una respuesta JSON (objeto, o arreglo cuyo ÚLTIMO elemento es el
 * dato más reciente) como válida o inválida. Nunca "corrige" un valor: si
 * falta la compra o no es plausible, la respuesta es inválida.
 */
export function clasificarRespuestaBch(input: unknown): ClasificacionBch {
  let obj: unknown = input;
  if (Array.isArray(obj)) {
    if (obj.length === 0) return { ok: false, motivo: 'arreglo vacío' };
    obj = obj[obj.length - 1];
  }
  if (obj == null || typeof obj !== 'object') return { ok: false, motivo: 'respuesta no es un objeto' };
  const rec = obj as Record<string, unknown>;
  const compra = aNumero(primeraClave(rec, CLAVES_COMPRA));
  if (!esTipoCambioValido(compra)) return { ok: false, motivo: 'sin tipo de cambio de compra válido' };
  const ventaRaw = aNumero(primeraClave(rec, CLAVES_VENTA));
  const venta = esTipoCambioValido(ventaRaw) ? ventaRaw : null;
  const fecha = aFechaIso(primeraClave(rec, CLAVES_FECHA));
  return { ok: true, compra, venta, fecha };
}

/**
 * Parseo conservador de texto/HTML: busca "Compra" y "Venta" seguidos de un
 * número, y una fecha dd/mm/yyyy o yyyy-mm-dd. Si no encuentra la compra,
 * la respuesta es inválida (nunca adivina).
 */
export function parsearTextoBch(texto: string): ClasificacionBch {
  if (typeof texto !== 'string' || !texto) return { ok: false, motivo: 'texto vacío' };
  const plano = texto
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/\s+/g, ' ');
  const num = String.raw`L?\.?\s*(\d+(?:[.,]\d+)*)`;
  const mCompra = plano.match(new RegExp(String.raw`compra[^0-9]{0,40}?${num}`, 'i'));
  const compra = mCompra ? aNumero(mCompra[1]) : null;
  if (!esTipoCambioValido(compra)) return { ok: false, motivo: 'no se encontró el valor de compra en el texto' };
  const mVenta = plano.match(new RegExp(String.raw`venta[^0-9]{0,40}?${num}`, 'i'));
  const ventaRaw = mVenta ? aNumero(mVenta[1]) : null;
  const venta = esTipoCambioValido(ventaRaw) ? ventaRaw : null;
  const mFecha = plano.match(/\b(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})\b/);
  const fecha = mFecha ? aFechaIso(mFecha[1]) : null;
  return { ok: true, compra, venta, fecha };
}

/* ── Parseo de los Excel oficiales del BCH ──────────────────────────── */

export interface FilaTipoCambio {
  fecha: string;
  compra: number | null;
  venta: number | null;
}

function norm(s: CeldaXlsx): string {
  return typeof s === 'string' ? s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase() : '';
}

/**
 * Convierte las filas de la primera hoja de un Excel del BCH en una serie
 * diaria (fecha, compra, venta). Reconoce tres disposiciones oficiales:
 *  - larga:  Fecha · Tipo de Precio ("Compra"/"Venta") · Precio
 *  - ancha:  Fecha · Compra (1/) · Venta   (con filas de promedio mensual, que se descartan)
 *  - TCR:    Fecha · TCR                     (solo compra)
 * Las filas cuya fecha no es un serial Excel o cuyo valor no es plausible se
 * descartan. Si no reconoce el encabezado, devuelve [].
 */
export function filasATipoCambio(filas: CeldaXlsx[][]): FilaTipoCambio[] {
  // Encabezado: primera fila con una celda "fecha".
  let iHeader = -1;
  for (let i = 0; i < Math.min(filas.length, 40); i++) {
    if (filas[i].some((c) => norm(c) === 'fecha')) {
      iHeader = i;
      break;
    }
  }
  if (iHeader < 0) return [];
  const header = filas[iHeader].map(norm);
  const colFecha = header.findIndex((h) => h === 'fecha');
  const colTipo = header.findIndex((h) => h.startsWith('tipo de precio'));
  const colPrecio = header.findIndex((h) => h === 'precio' || h === 'valor');
  const colCompra = header.findIndex((h) => h.startsWith('compra') || h === 'tcr');
  const colVenta = header.findIndex((h) => h.startsWith('venta'));

  const porFecha = new Map<string, FilaTipoCambio>();
  const registrar = (fecha: string, campo: 'compra' | 'venta', valor: CeldaXlsx) => {
    const n = aNumero(valor);
    if (!esTipoCambioValido(n)) return;
    const fila = porFecha.get(fecha) ?? { fecha, compra: null, venta: null };
    fila[campo] = n;
    porFecha.set(fecha, fila);
  };

  for (let i = iHeader + 1; i < filas.length; i++) {
    const f = filas[i];
    const fecha = aFechaIso(f[colFecha]);
    if (!fecha) continue; // filas de promedio mensual, notas al pie, vacías
    if (colTipo >= 0 && colPrecio >= 0) {
      const tipo = norm(f[colTipo]);
      if (tipo.startsWith('compra')) registrar(fecha, 'compra', f[colPrecio]);
      else if (tipo.startsWith('venta')) registrar(fecha, 'venta', f[colPrecio]);
    } else if (colCompra >= 0) {
      registrar(fecha, 'compra', f[colCompra]);
      if (colVenta >= 0) registrar(fecha, 'venta', f[colVenta]);
    }
  }
  return [...porFecha.values()].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
}

/**
 * Última fila con compra válida cuya fecha sea ≤ `hoy` (YYYY-MM-DD, Honduras).
 * El BCH publica la tarde del día D-1 el TCR vigente para D; hasta que D
 * llegue, lo público sigue mostrando el vigente de hoy con su fecha.
 */
export function seleccionarVigente(serie: FilaTipoCambio[], hoy: string): FilaTipoCambio | null {
  let elegida: FilaTipoCambio | null = null;
  for (const f of serie) {
    if (f.fecha <= hoy && esTipoCambioValido(f.compra)) elegida = f;
  }
  return elegida;
}

/** Clasifica un Excel del BCH: parsea, arma la serie y elige el vigente ≤ hoy. */
export function parsearXlsxBch(bytes: Uint8Array, hoy: string): ClasificacionBch {
  let filas: CeldaXlsx[][];
  try {
    filas = leerPrimeraHoja(bytes);
  } catch (e) {
    return { ok: false, motivo: `xlsx ilegible: ${(e as Error)?.message}` };
  }
  const serie = filasATipoCambio(filas);
  if (serie.length === 0) return { ok: false, motivo: 'el Excel no tiene la disposición esperada (Fecha / Compra / Venta)' };
  const vigente = seleccionarVigente(serie, hoy);
  if (!vigente || !esTipoCambioValido(vigente.compra)) return { ok: false, motivo: `sin fila vigente con compra válida hasta ${hoy}` };
  return { ok: true, compra: vigente.compra, venta: vigente.venta, fecha: vigente.fecha };
}

/* ── Etiquetas públicas ─────────────────────────────────────────────── */

// Etiquetas canónicas: viven en lib/content/copy-legal.ts (fuente única de
// copy, importable desde client components); aquí se re-exportan.
export const ETIQUETA_TC_COMPRA_BCH = ETIQUETA_TIPO_CAMBIO;
export { DATO_NO_DISPONIBLE };

/**
 * Etiqueta pública del tipo de cambio. Solo se predica "BCH" de un dato que
 * proviene del BCH (este tipo lo garantiza). Con respaldo, declara la fecha
 * del último valor registrado.
 */
export function etiquetaTipoCambio(tc: TipoCambioBch | null): string {
  if (!tc) return `${ETIQUETA_TC_COMPRA_BCH}: ${DATO_NO_DISPONIBLE}`;
  return tc.origen === 'respaldo'
    ? `${ETIQUETA_TC_COMPRA_BCH} (último valor registrado, ${tc.fecha})`
    : ETIQUETA_TC_COMPRA_BCH;
}

/* ── Obtención con caché, timeout y respaldos ───────────────────────── */

export interface LectorRespaldo {
  /** Último TC registrado como BCH en la ventana diaria actual (precios_diarios con marcador fx:bch). */
  snapshotHoy?: () => Promise<TipoCambioBch | null>;
  /** Último tipo_cambio_bch válido de precios_referencia (fecha + hora_fijacion). */
  ultimoGuardado?: () => Promise<TipoCambioBch | null>;
}

export interface DepsTipoCambioBch extends LectorRespaldo {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  /** URL del recurso oficial. `null` desactiva la lectura en vivo. Por defecto: env BCH_TIPO_CAMBIO_URL o la serie diaria oficial. */
  urlVivo?: string | null;
  timeoutMs?: number;
  /** Desactiva la caché en memoria (tests). */
  sinCache?: boolean;
}

let cache: { valor: TipoCambioBch; expira: number } | null = null;

/** Vacía la caché en memoria (tests). */
export function limpiarCacheBch(): void {
  cache = null;
}

/** Fecha de hoy (YYYY-MM-DD) en hora de Honduras. */
export function fechaHondurasBch(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Tegucigalpa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** URL en vivo efectiva: env (con `off` para desactivar) o la serie diaria oficial. */
export function urlVivoPorDefecto(): string | null {
  const env = process.env.BCH_TIPO_CAMBIO_URL?.trim();
  if (env === undefined || env === '') return BCH_URL_SERIE_DIARIA_XLSX;
  if (/^(off|0|false|none)$/i.test(env)) return null;
  return env;
}

/** Lee el BCH en vivo. Devuelve null ante cualquier fallo (red, timeout, parseo). */
export async function fetchTipoCambioBchVivo(
  url: string,
  deps: Pick<DepsTipoCambioBch, 'fetchImpl' | 'now' | 'timeoutMs'> = {},
): Promise<TipoCambioBch | null> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? (() => new Date());
  const timeoutMs = deps.timeoutMs ?? BCH_FETCH_TIMEOUT_MS;
  try {
    const res = await fetchImpl(url, {
      headers: {
        Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/json, text/plain, text/html;q=0.9',
        'User-Agent': 'Mozilla/5.0 (compatible; mape.legal precio informativo)',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`BCH respondió ${res.status}`);
    const ahora = now();
    const hoy = fechaHondurasBch(ahora);
    const bytes = new Uint8Array(await res.arrayBuffer());
    let clasif: ClasificacionBch;
    if (pareceXlsx(bytes)) {
      clasif = parsearXlsxBch(bytes, hoy);
    } else {
      const cuerpo = new TextDecoder('utf-8').decode(bytes);
      const tipo = res.headers.get('content-type') ?? '';
      if (tipo.includes('json') || /^\s*[[{]/.test(cuerpo)) {
        let json: unknown = null;
        try {
          json = JSON.parse(cuerpo);
        } catch {
          json = null;
        }
        clasif = json == null ? parsearTextoBch(cuerpo) : clasificarRespuestaBch(json);
      } else {
        clasif = parsearTextoBch(cuerpo);
      }
    }
    if (!clasif.ok) {
      console.error('[bch] respuesta inválida:', clasif.motivo);
      return null;
    }
    return {
      compra: clasif.compra,
      venta: clasif.venta,
      fuente: FUENTE_TIPO_CAMBIO_ID,
      fuenteNombre: BCH_NOMBRE,
      fecha: clasif.fecha ?? hoy,
      obtenidoEn: ahora.toISOString(),
      origen: 'vivo',
      detalle: url,
    };
  } catch (e) {
    console.error('[bch] lectura en vivo falló:', (e as Error)?.message);
    return null;
  }
}

/**
 * Tipo de cambio de compra del BCH para lo público. Orden: caché → vivo →
 * snapshot de hoy registrado como BCH → último guardado en precios_referencia
 * → null ("dato no disponible"). Nunca devuelve una cifra que no sea del BCH.
 */
export async function getTipoCambioBch(deps: DepsTipoCambioBch = {}): Promise<TipoCambioBch | null> {
  const now = deps.now ?? (() => new Date());
  const t = now().getTime();
  if (!deps.sinCache && cache && cache.expira > t) return cache.valor;

  const url = deps.urlVivo === undefined ? urlVivoPorDefecto() : deps.urlVivo;
  if (url) {
    const vivo = await fetchTipoCambioBchVivo(url, deps);
    if (vivo) {
      if (!deps.sinCache) cache = { valor: vivo, expira: t + BCH_CACHE_TTL_MS };
      return vivo;
    }
  }

  const snapshot = deps.snapshotHoy ?? defaultSnapshotHoy;
  try {
    const s = await snapshot();
    if (s && esTipoCambioValido(s.compra)) {
      if (!deps.sinCache) cache = { valor: s, expira: t + BCH_CACHE_TTL_MS };
      return s;
    }
  } catch (e) {
    console.error('[bch] respaldo snapshot falló:', (e as Error)?.message);
  }

  const ultimo = deps.ultimoGuardado ?? defaultUltimoGuardado;
  try {
    const u = await ultimo();
    if (u && esTipoCambioValido(u.compra)) return u; // sin caché: respaldo, se re-evalúa
  } catch (e) {
    console.error('[bch] respaldo precios_referencia falló:', (e as Error)?.message);
  }

  return null;
}

// Respaldos por defecto — importan los módulos de datos de forma perezosa
// para que este archivo sea importable en tests sin variables de entorno.
async function defaultSnapshotHoy(): Promise<TipoCambioBch | null> {
  const { leerTipoCambioBchSnapshotHoy } = await import('@/services/pricingService');
  return leerTipoCambioBchSnapshotHoy();
}

async function defaultUltimoGuardado(): Promise<TipoCambioBch | null> {
  const { getUltimoTipoCambioBchGuardado } = await import('@/lib/precio/consulta');
  return getUltimoTipoCambioBchGuardado();
}
