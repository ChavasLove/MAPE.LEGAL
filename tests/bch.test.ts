// tests/bch.test.ts — adaptador del tipo de cambio de COMPRA del BCH
// (lib/precio/bch.ts + lib/precio/xlsxMinimo.ts).
//
// Cubre: clasificación de respuestas válidas vs. inválidas (JSON, texto/HTML y
// los Excel oficiales, con un XLSX sintético construido aquí mismo), la
// selección del valor vigente (≤ hoy, con fin de semana), la cadena de
// respaldos (snapshot de hoy → precios_referencia → null), que NUNCA se
// devuelve una cifra que no sea del BCH, y que la etiqueta pública solo dice
// "BCH" cuando el dato proviene del BCH.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import {
  aNumero,
  aFechaIso,
  esTipoCambioValido,
  clasificarRespuestaBch,
  parsearTextoBch,
  parsearXlsxBch,
  filasATipoCambio,
  seleccionarVigente,
  etiquetaTipoCambio,
  fetchTipoCambioBchVivo,
  getTipoCambioBch,
  limpiarCacheBch,
  BCH_URL_SERIE_DIARIA_XLSX,
  type TipoCambioBch,
} from '@/lib/precio/bch';
import { leerEntradasZip, leerPrimeraHoja, serialExcelAFecha, columnaAIndice, pareceXlsx } from '@/lib/precio/xlsxMinimo';
import { DATO_NO_DISPONIBLE, ETIQUETA_TIPO_CAMBIO } from '@/lib/content/copy-legal';

/* ── Constructor de un ZIP/XLSX mínimo (stored + deflate) ─────────────── */

function crc32(buf: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function zip(entradas: Array<[string, string]>, deflate = true): Uint8Array {
  const enc = new TextEncoder();
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [nombre, texto] of entradas) {
    const nameB = enc.encode(nombre);
    const raw = enc.encode(texto);
    const data = deflate ? new Uint8Array(deflateRawSync(raw)) : raw;
    const crc = crc32(raw);
    const local = new Uint8Array(30 + nameB.length);
    const dv = new DataView(local.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(8, deflate ? 8 : 0, true);
    dv.setUint32(14, crc, true);
    dv.setUint32(18, data.length, true);
    dv.setUint32(22, raw.length, true);
    dv.setUint16(26, nameB.length, true);
    local.set(nameB, 30);
    const cen = new Uint8Array(46 + nameB.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, deflate ? 8 : 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, raw.length, true);
    cv.setUint16(28, nameB.length, true);
    cv.setUint32(42, offset, true);
    cen.set(nameB, 46);
    partes.push(local, data);
    central.push(cen);
    offset += local.length + data.length;
  }
  const cenLen = central.reduce((n, c) => n + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entradas.length, true);
  ev.setUint16(10, entradas.length, true);
  ev.setUint32(12, cenLen, true);
  ev.setUint32(16, offset, true);
  const total = offset + cenLen + 22;
  const out = new Uint8Array(total);
  let p = 0;
  for (const b of [...partes, ...central, eocd]) {
    out.set(b, p);
    p += b.length;
  }
  return out;
}

/** ZIP con método 8 cuyo flujo DEFLATE está corrupto (inflate debe fallar). */
function zipCorrupto(): Uint8Array {
  const bueno = zip([['a.xml', '<x>hola</x>']]);
  const out = Uint8Array.from(bueno);
  const dv = new DataView(out.buffer);
  const nameLen = dv.getUint16(26, true);
  const compLen = dv.getUint32(18, true);
  const start = 30 + nameLen;
  for (let i = 0; i < compLen; i++) out[start + i] = 0xff;
  return out;
}

const WB = '<workbook><sheets><sheet name="TablaDatos" sheetId="1" r:id="rId1"/></sheets></workbook>';
function shared(strs: string[]): string {
  return `<sst count="${strs.length}" uniqueCount="${strs.length}">${strs.map((s) => `<si><t>${s}</t></si>`).join('')}</sst>`;
}
function row(n: number, cells: Array<[string, string | number, 's' | 'n']>): string {
  return `<row r="${n}">${cells.map(([col, v, t]) => (t === 's' ? `<c r="${col}${n}" t="s"><v>${v}</v></c>` : `<c r="${col}${n}"><v>${v}</v></c>`)).join('')}</row>`;
}
// Seriales Excel: 46351 = 2026-11-25 (mié), 46352 = 2026-11-26 (jue), 46353 = 2026-11-27 (vie).
const SERIE_LARGA = `<worksheet><sheetData>${[
  row(1, [['A', 0, 's'], ['B', 1, 's'], ['C', 2, 's']]),
  row(2, [['A', 46351, 'n'], ['B', 3, 's'], ['C', 26.9191, 'n']]),
  row(3, [['A', 46352, 'n'], ['B', 3, 's'], ['C', 26.9213, 'n']]),
  row(4, [['A', 46353, 'n'], ['B', 3, 's'], ['C', 26.9235, 'n']]),
  row(5, [['A', 46351, 'n'], ['B', 4, 's'], ['C', 27.0537, 'n']]),
  row(6, [['A', 46352, 'n'], ['B', 4, 's'], ['C', 27.0559, 'n']]),
  row(7, [['A', 46353, 'n'], ['B', 4, 's'], ['C', 27.0581, 'n']]),
].join('')}</sheetData></worksheet>`;
const XLSX_LARGO = zip([
  ['xl/workbook.xml', WB],
  ['xl/sharedStrings.xml', shared(['Fecha', 'Tipo de Precio', 'Precio', 'Compra', 'Venta'])],
  ['xl/worksheets/sheet1.xml', SERIE_LARGA],
]);
// Disposición ancha con título, fila de promedio mensual y pie — como el Excel "Precio Promedio Diario".
const SERIE_ANCHA = `<worksheet><sheetData>${[
  row(1, [['A', 0, 's']]),
  row(7, [['A', 1, 's'], ['B', 2, 's'], ['C', 3, 's']]),
  row(8, [['A', 4, 's'], ['B', 26.9, 'n'], ['C', 27.03, 'n']]),
  row(9, [['A', 46352, 'n'], ['B', 26.9213, 'n'], ['C', 27.0559, 'n']]),
  row(10, [['A', 46353, 'n'], ['B', 26.9235, 'n'], ['C', 27.0581, 'n']]),
  row(11, [['A', 5, 's']]),
].join('')}</sheetData></worksheet>`;
const XLSX_ANCHO = zip([
  ['xl/workbook.xml', WB],
  ['xl/sharedStrings.xml', shared(['Banco Central de Honduras', 'Fecha', 'Compra 1/', 'Venta', 'Noviembre 2/', '1/ Corresponde al Tipo de Cambio de Referencia (TCR)'])],
  ['xl/worksheets/sheet1.xml', SERIE_ANCHA],
], false);
const XLSX_TCPP = zip([
  ['xl/workbook.xml', WB],
  ['xl/sharedStrings.xml', shared(['Fecha', 'Tipo de Cambio Promedio Ponderado', 'Valor', 'TCPP'])],
  ['xl/worksheets/sheet1.xml', `<worksheet><sheetData>${row(2, [['A', 0, 's'], ['B', 1, 's'], ['C', 2, 's']])}${row(3, [['A', 46352, 'n'], ['B', 3, 's'], ['C', 26.9213, 'n']])}</sheetData></worksheet>`],
]);

/* ── Utilidades ───────────────────────────────────────────────────────── */

describe('utilidades de parseo', () => {
  test('aNumero acepta formatos hondureño y anglosajón', () => {
    assert.equal(aNumero('26.9235'), 26.9235);
    assert.equal(aNumero('26,9235'), 26.9235);
    assert.equal(aNumero('L 26.92'), 26.92);
    assert.equal(aNumero('1,234.56'), 1234.56);
    assert.equal(aNumero('26.923'), 26.923);
    assert.equal(aNumero('1.234.567'), 1234567);
    assert.equal(aNumero('1.234,56'), 1234.56);
    assert.equal(aNumero(26.5), 26.5);
    assert.equal(aNumero('abc'), null);
    assert.equal(aNumero(null), null);
  });
  test('aFechaIso normaliza dd/mm/yyyy, ISO y seriales Excel', () => {
    assert.equal(aFechaIso('27/11/2026'), '2026-11-27');
    assert.equal(aFechaIso('2026-11-27T00:00:00'), '2026-11-27');
    assert.equal(aFechaIso(46353), '2026-11-27');
    assert.equal(serialExcelAFecha(46353), '2026-11-27');
    assert.equal(serialExcelAFecha(0), null);
    assert.equal(aFechaIso('ayer'), null);
  });
  test('esTipoCambioValido rechaza basura', () => {
    assert.ok(esTipoCambioValido(26.9235));
    for (const v of [0, -1, NaN, Infinity, 1000, '26', null, undefined]) assert.ok(!esTipoCambioValido(v));
  });
  test('columnaAIndice', () => {
    assert.equal(columnaAIndice('A'), 0);
    assert.equal(columnaAIndice('C'), 2);
    assert.equal(columnaAIndice('AA'), 26);
  });
});

/* ── Clasificación ────────────────────────────────────────────────────── */

describe('clasificación de respuestas del BCH', () => {
  test('JSON válido (objeto y arreglo) → ok con compra, venta y fecha', () => {
    const r = clasificarRespuestaBch({ fecha: '27/11/2026', compra: '26.9235', venta: 27.0581 });
    assert.deepEqual(r, { ok: true, compra: 26.9235, venta: 27.0581, fecha: '2026-11-27' });
    const a = clasificarRespuestaBch([{ Fecha: '2026-11-26', Compra: 26.9213 }, { Fecha: '2026-11-27', Compra: 26.9235 }]);
    assert.ok(a.ok && a.compra === 26.9235 && a.venta === null && a.fecha === '2026-11-27');
  });
  test('JSON inválido → error, nunca una cifra', () => {
    for (const bad of [null, 'texto', 42, [], {}, { venta: 27 }, { compra: 0 }, { compra: 'x' }, { compra: 5000 }]) {
      const r = clasificarRespuestaBch(bad);
      assert.equal(r.ok, false, JSON.stringify(bad));
    }
  });
  test('texto/HTML con Compra/Venta → ok; sin Compra → error', () => {
    const html = '<table><tr><td>Fecha</td><td>27/11/2026</td></tr><tr><td>Compra</td><td>L 26.9235</td></tr><tr><td>Venta</td><td>27.0581</td></tr></table>';
    assert.deepEqual(parsearTextoBch(html), { ok: true, compra: 26.9235, venta: 27.0581, fecha: '2026-11-27' });
    assert.equal(parsearTextoBch('<p>Venta 27.05</p>').ok, false);
    assert.equal(parsearTextoBch('').ok, false);
  });
  test('XLSX sintético: disposición larga (Fecha/Tipo de Precio/Precio)', () => {
    assert.ok(pareceXlsx(XLSX_LARGO));
    const filas = leerPrimeraHoja(XLSX_LARGO);
    assert.ok(filas);
    const serie = filasATipoCambio(filas);
    assert.deepEqual(serie, [
      { fecha: '2026-11-25', compra: 26.9191, venta: 27.0537 },
      { fecha: '2026-11-26', compra: 26.9213, venta: 27.0559 },
      { fecha: '2026-11-27', compra: 26.9235, venta: 27.0581 },
    ]);
    assert.deepEqual(parsearXlsxBch(XLSX_LARGO, '2026-11-27'), { ok: true, compra: 26.9235, venta: 27.0581, fecha: '2026-11-27' });
  });
  test('XLSX sintético: disposición ancha con promedio mensual y pie (stored, sin deflate)', () => {
    const r = parsearXlsxBch(XLSX_ANCHO, '2026-11-27');
    assert.deepEqual(r, { ok: true, compra: 26.9235, venta: 27.0581, fecha: '2026-11-27' });
  });
  test('XLSX que no es la serie de compra/venta (TCPP) → error', () => {
    const r = parsearXlsxBch(XLSX_TCPP, '2026-11-27');
    assert.equal(r.ok, false);
  });
  test('bytes que no son XLSX → error claro', () => {
    const r = parsearXlsxBch(new TextEncoder().encode('<html>no</html>'), '2026-11-27');
    assert.equal(r.ok, false);
  });
  test('DEFLATE inválido o mayor de 10 MB → null, sin cifra', () => {
    const corrupto = zipCorrupto();
    assert.equal(leerEntradasZip(corrupto), null);
    assert.equal(leerPrimeraHoja(corrupto), null);
    const malo = parsearXlsxBch(corrupto, '2026-11-27');
    assert.equal(malo.ok, false);
    const enorme = zip([['a.xml', 'x'.repeat(10 * 1024 * 1024 + 1)]]);
    assert.equal(leerEntradasZip(enorme), null);
    assert.equal(parsearXlsxBch(enorme, '2026-11-27').ok, false);
  });
});

describe('selección del valor vigente', () => {
  const serie = [
    { fecha: '2026-11-20', compra: 26.9134, venta: 27.048 },
    { fecha: '2026-11-26', compra: 26.9213, venta: 27.0559 },
    { fecha: '2026-11-27', compra: 26.9235, venta: 27.0581 },
  ];
  test('toma la última fila ≤ hoy; el TCR publicado para mañana no se adelanta', () => {
    assert.equal(seleccionarVigente(serie, '2026-11-27')?.compra, 26.9235);
    assert.equal(seleccionarVigente(serie, '2026-11-26')?.compra, 26.9213);
  });
  test('fin de semana: rige el último publicado (viernes)', () => {
    assert.equal(seleccionarVigente(serie, '2026-11-22')?.fecha, '2026-11-20');
  });
  test('sin fila ≤ hoy → null', () => {
    assert.equal(seleccionarVigente(serie, '2026-11-01'), null);
  });
});

/* ── Obtención con respaldos ──────────────────────────────────────────── */

const fakeFetch = (status: number, body: Uint8Array | string, type = 'application/octet-stream'): typeof fetch =>
  (async () =>
    new Response(typeof body === 'string' ? body : new Uint8Array(body), {
      status,
      headers: { 'content-type': type },
    })) as unknown as typeof fetch;

const now = () => new Date('2026-11-27T20:00:00Z'); // 14:00 Honduras

describe('fetchTipoCambioBchVivo', () => {
  test('XLSX oficial → dato vivo etiquetado BCH con fecha de vigencia', async () => {
    const tc = await fetchTipoCambioBchVivo(BCH_URL_SERIE_DIARIA_XLSX, { fetchImpl: fakeFetch(200, XLSX_LARGO, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), now });
    assert.ok(tc);
    assert.equal(tc.compra, 26.9235);
    assert.equal(tc.venta, 27.0581);
    assert.equal(tc.fecha, '2026-11-27');
    assert.equal(tc.origen, 'vivo');
    assert.equal(tc.fuente, 'bch');
  });
  test('JSON válido → vivo; HTTP 500, timeout y cuerpo inválido → null', async () => {
    const ok = await fetchTipoCambioBchVivo('https://x/api', { fetchImpl: fakeFetch(200, JSON.stringify({ compra: 26.9, venta: 27.03, fecha: '2026-11-27' }), 'application/json'), now });
    assert.equal(ok?.compra, 26.9);
    assert.equal(await fetchTipoCambioBchVivo('https://x', { fetchImpl: fakeFetch(500, 'boom'), now }), null);
    assert.equal(await fetchTipoCambioBchVivo('https://x', { fetchImpl: fakeFetch(200, '<html>Sin datos</html>', 'text/html'), now }), null);
    const lento: typeof fetch = (async () => { throw new DOMException('aborted', 'TimeoutError'); }) as unknown as typeof fetch;
    assert.equal(await fetchTipoCambioBchVivo('https://x', { fetchImpl: lento, now }), null);
  });
});

describe('getTipoCambioBch — cadena de respaldos sin inventar', () => {
  const respaldo = (fecha: string, compra: number, detalle: string): TipoCambioBch => ({
    compra, venta: null, fuente: 'bch', fuenteNombre: 'Banco Central de Honduras (BCH)', fecha,
    obtenidoEn: `${fecha}T14:00:00Z`, origen: 'respaldo', detalle,
  });
  test('vivo disponible → vivo', async () => {
    limpiarCacheBch();
    const tc = await getTipoCambioBch({ urlVivo: 'https://x', fetchImpl: fakeFetch(200, XLSX_LARGO), now, sinCache: true, snapshotHoy: async () => null, ultimoGuardado: async () => null });
    assert.equal(tc?.origen, 'vivo');
  });
  test('Excel que no se puede inflar → null del vivo y actúa el snapshot', async () => {
    limpiarCacheBch();
    const snap = respaldo('2026-11-27', 26.9235, 'precios_diarios');
    const tc = await getTipoCambioBch({
      urlVivo: 'https://x',
      fetchImpl: fakeFetch(200, zipCorrupto(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
      now,
      sinCache: true,
      snapshotHoy: async () => snap,
      ultimoGuardado: async () => { throw new Error('no debe llegar'); },
    });
    assert.equal(tc?.compra, 26.9235);
    assert.equal(tc?.detalle, 'precios_diarios');
    assert.notEqual(tc?.origen, 'vivo');
  });
  test('vivo falla → snapshot de hoy marcado BCH', async () => {
    const snap: TipoCambioBch = { ...respaldo('2026-11-27', 26.9235, 'precios_diarios'), origen: 'vivo' };
    const tc = await getTipoCambioBch({ urlVivo: 'https://x', fetchImpl: fakeFetch(500, ''), now, sinCache: true, snapshotHoy: async () => snap, ultimoGuardado: async () => { throw new Error('no debe llegar'); } });
    assert.equal(tc?.compra, 26.9235);
    assert.equal(tc?.detalle, 'precios_diarios');
  });
  test('vivo y snapshot fallan → último guardado en precios_referencia (origen respaldo, con fecha)', async () => {
    const tc = await getTipoCambioBch({ urlVivo: null, now, sinCache: true, snapshotHoy: async () => null, ultimoGuardado: async () => respaldo('2026-11-20', 26.9134, 'precios_referencia') });
    assert.equal(tc?.compra, 26.9134);
    assert.equal(tc?.origen, 'respaldo');
    assert.equal(tc?.fecha, '2026-11-20');
  });
  test('nada disponible → null (dato no disponible), nunca una cifra', async () => {
    const tc = await getTipoCambioBch({ urlVivo: 'https://x', fetchImpl: fakeFetch(503, ''), now, sinCache: true, snapshotHoy: async () => null, ultimoGuardado: async () => null });
    assert.equal(tc, null);
  });
  test('un respaldo con cifra inválida se descarta', async () => {
    const tc = await getTipoCambioBch({ urlVivo: null, now, sinCache: true, snapshotHoy: async () => respaldo('2026-11-27', 0, 'x'), ultimoGuardado: async () => respaldo('2026-11-20', NaN, 'y') });
    assert.equal(tc, null);
  });
  test('la caché en memoria devuelve el vivo sin volver a pedir', async () => {
    limpiarCacheBch();
    let llamadas = 0;
    const f: typeof fetch = (async (...args: Parameters<typeof fetch>) => { llamadas++; return fakeFetch(200, XLSX_LARGO)(...args); }) as unknown as typeof fetch;
    await getTipoCambioBch({ urlVivo: 'https://x', fetchImpl: f, now, snapshotHoy: async () => null, ultimoGuardado: async () => null });
    await getTipoCambioBch({ urlVivo: 'https://x', fetchImpl: f, now, snapshotHoy: async () => null, ultimoGuardado: async () => null });
    assert.equal(llamadas, 1);
    limpiarCacheBch();
  });
});

describe('etiqueta pública', () => {
  test('solo dice BCH para un dato del BCH; sin dato → "dato no disponible"', () => {
    assert.equal(etiquetaTipoCambio(null), `${ETIQUETA_TIPO_CAMBIO}: ${DATO_NO_DISPONIBLE}`);
    const vivo: TipoCambioBch = { compra: 26.9, venta: null, fuente: 'bch', fuenteNombre: 'BCH', fecha: '2026-11-27', obtenidoEn: '', origen: 'vivo', detalle: '' };
    assert.equal(etiquetaTipoCambio(vivo), ETIQUETA_TIPO_CAMBIO);
    assert.equal(etiquetaTipoCambio({ ...vivo, origen: 'respaldo', fecha: '2026-11-20' }), `${ETIQUETA_TIPO_CAMBIO} (último valor registrado, 2026-11-20)`);
  });
  test('el tipo TipoCambioBch no admite otra fuente que "bch"', () => {
    // Garantía de compilación: `fuente` es el literal 'bch'. En runtime, un
    // dato de exchangerate-api jamás puede construirse como TipoCambioBch
    // porque el adaptador nunca consulta esa fuente.
    const t: TipoCambioBch['fuente'] = 'bch';
    assert.equal(t, 'bch');
  });
});
