// tests/verificacion-publica.test.ts — Fase 7: verificación pública mínima.
// Respuesta = { numero, estado }. Sin datos personales ni nada más.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CLAVES_VERIFICACION_PUBLICA, ESTADOS_VERIFICACION, VERIFICAR_LIMITE, VERIFICAR_VENTANA_MS, hoyHonduras, normalizarNumero,
  proyectarVerificacionPublica, responderVerificacion, type Buscador,
} from '@/lib/certificados/publico';
import { VERIFICAR_ALCANCE_MINIMO, VERIFICAR_NO_CONSTA, VERIFICAR_SELLO_AVISO } from '@/lib/content/copy-legal';
import { ROOT } from '@/tests/pg-efimero';

// Fila "ancha": todo lo que la vista tiene hoy, más columnas sensibles que
// NUNCA deberían salir aunque alguien las agregara a la vista.
const FILA_ANCHA = {
  numero_certificado: 'CO-2026-0007',
  numero_sello: 'SELLO-2026-0007',
  estado: 'vigente',
  valido_hasta: '2027-06-30',
  fecha_emision: '2026-06-30',
  peso_oro_g: 1250.5,
  hash_verificacion: 'abc123',
  hash_sha256: 'f'.repeat(64),
  certificado_id: '11111111-1111-4111-8111-111111111111',
  mina_nombre: 'Mina de prueba',
  mina_codigo: 'MINA-2026-001',
  mina_municipio: 'Iriona',
  mina_departamento: 'Colón',
  copia_minero_estado: 'entregada',
  // Columnas hipotéticas de una vista más ancha:
  productor_nombre: 'Nombre Completo',
  productor_dpi: '0801-1990-12345',
  organizacion_nombre: 'Organización X',
  telefono: '+504 9988-7766',
  monto_lps: 99999,
  fecha_transito: '2026-07-01',
  documento_path: 'privado/escaneo.pdf',
};
const HOY = '2026-11-28';
const buscador = (filas: Record<string, Record<string, unknown>>, error = false): Buscador =>
  async (numero) => ({ fila: filas[numero] ?? null, error });

describe('respuesta pública = { numero, estado }', () => {
  test('instantánea del JSON: claves exactas y nada más', async () => {
    const r = await responderVerificacion('CO-2026-0007', buscador({ 'CO-2026-0007': FILA_ANCHA }), HOY);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { numero: 'SELLO-2026-0007', estado: 'vigente' });
    assert.deepEqual(Object.keys(r.body), [...CLAVES_VERIFICACION_PUBLICA]);
    assert.equal(JSON.stringify(r.body), '{"numero":"SELLO-2026-0007","estado":"vigente"}');
  });

  test('ningún campo sensible sale aunque la vista tenga más columnas', async () => {
    const r = await responderVerificacion('CO-2026-0007', buscador({ 'CO-2026-0007': FILA_ANCHA }), HOY);
    const json = JSON.stringify(r.body);
    for (const [clave, valor] of Object.entries(FILA_ANCHA)) {
      if (clave === 'numero_sello' || clave === 'estado') continue;
      assert.ok(!json.includes(`"${clave}"`), `salió la clave ${clave}`);
      if (typeof valor === 'string' && valor !== 'vigente') assert.ok(!json.includes(valor), `salió el valor de ${clave}`);
    }
    for (const prohibido of ['mina', 'peso', 'fecha', 'hash', 'nombre', 'dpi', 'municipio', 'documento', 'monto', 'certificado_id']) {
      assert.ok(!json.toLowerCase().includes(prohibido), prohibido);
    }
  });

  test('sin numero_sello (antes de la 042) se informa el número de registro', () => {
    const { numero_sello: _omitido, ...sinSello } = FILA_ANCHA;
    void _omitido;
    assert.deepEqual(proyectarVerificacionPublica(sinSello, 'CO-2026-0007', HOY), { numero: 'CO-2026-0007', estado: 'vigente' });
  });

  test('estados: vigente / revocado / vencido / suspendido', () => {
    const con = (extra: Record<string, unknown>) => proyectarVerificacionPublica({ ...FILA_ANCHA, ...extra }, 'x', HOY).estado;
    assert.equal(con({}), 'vigente');
    assert.equal(con({ estado: 'revocado' }), 'revocado');
    assert.equal(con({ estado: 'suspendido' }), 'suspendido');
    assert.equal(con({ estado: 'expirado' }), 'vencido');
    assert.equal(con({ valido_hasta: '2026-11-27' }), 'vencido');   // "vigente" pero ya pasó su validez
    assert.equal(con({ valido_hasta: '2026-11-28' }), 'vigente');   // vence hoy: aún vigente
    assert.equal(con({ estado: 'algo_nuevo' }), 'no_encontrado');   // un estado desconocido jamás se informa vigente
    assert.deepEqual([...ESTADOS_VERIFICACION], ['vigente', 'revocado', 'vencido', 'suspendido', 'no_encontrado']);
    assert.equal(hoyHonduras(new Date('2026-11-29T03:00:00Z')), '2026-11-28'); // 21:00 en Honduras del día anterior
  });
});

describe('404 uniforme (sin enumeración)', () => {
  test('lo que no consta responde igual: misma forma, mismo estado, solo cambia el número consultado', async () => {
    const b = buscador({ 'CO-RARO': { ...FILA_ANCHA, estado: 'estado_desconocido' } });
    const a = await responderVerificacion('NO-EXISTE-1', b, HOY);
    const c = await responderVerificacion('NO-EXISTE-2', b, HOY);
    const d = await responderVerificacion('CO-RARO', b, HOY);
    for (const r of [a, c, d]) {
      assert.equal(r.status, 404);
      assert.deepEqual(Object.keys(r.body), ['numero', 'estado']);
      assert.equal((r.body as { estado: string }).estado, 'no_encontrado');
    }
    assert.deepEqual(a.body, { numero: 'NO-EXISTE-1', estado: 'no_encontrado' });
    // Mismas claves que un acierto: el cuerpo no delata nada más que el estado.
    const ok = await responderVerificacion('CO-2026-0007', buscador({ 'CO-2026-0007': FILA_ANCHA }), HOY);
    assert.deepEqual(Object.keys(ok.body), Object.keys(a.body));
  });

  test('número inválido → 400; fallo de la consulta → 500 sin detalles', async () => {
    const b = buscador({});
    for (const malo of ['', '   ', 'x'.repeat(65), '<script>', 42, null]) {
      assert.deepEqual(await responderVerificacion(malo, b, HOY), { status: 400, body: { error: 'numero_invalido' } });
    }
    assert.deepEqual(await responderVerificacion('CO-1', buscador({}, true), HOY), { status: 500, body: { error: 'consulta_no_disponible' } });
    assert.equal(normalizarNumero('  CO%2D2026  '), 'CO-2026');
    assert.equal(normalizarNumero('%E0%A4%A'), '%E0%A4%A'); // codificación rota: se usa tal cual, sin lanzar
  });
});

describe('ruta GET /api/verificar/[numero]', () => {
  test('límite de 20 consultas por minuto por IP → 429 con Retry-After', async () => {
    assert.equal(VERIFICAR_LIMITE, 20);
    assert.equal(VERIFICAR_VENTANA_MS, 60_000);
    const { GET } = await import('@/app/api/verificar/[numero]/route');
    const llamar = () => GET(new Request('https://mape.legal/api/verificar/CO-1'), { params: Promise.resolve({ numero: 'CO-1' }) });
    const estados: number[] = [];
    for (let i = 0; i < 21; i++) estados.push((await llamar()).status);
    // Sin variables de entorno de Supabase en pruebas, las 20 primeras responden 500 (consulta no disponible);
    // lo que se verifica es que la número 21 queda limitada ANTES de consultar.
    assert.ok(estados.slice(0, 20).every((s) => s !== 429));
    assert.equal(estados[20], 429);
    const limitada = await llamar();
    assert.equal(limitada.status, 429);
    assert.ok(Number(limitada.headers.get('Retry-After')) > 0);
    assert.deepEqual(Object.keys(await limitada.json()), ['error']);
  });

  test('la ruta y la página usan la proyección mínima y no leen nada más', () => {
    const ruta = readFileSync(join(ROOT, 'app/api/verificar/[numero]/route.ts'), 'utf8');
    const pagina = readFileSync(join(ROOT, 'app/verificar/[numero]/page.tsx'), 'utf8');
    for (const [nombre, src] of [['ruta', ruta], ['página', pagina]] as const) {
      assert.match(src, /responderVerificacion\(/, nombre);
      assert.match(src, /checkRateLimit\(`verificar:/, nombre);
      assert.doesNotMatch(src, /pickCertificadoPublico|verificaciones_fuente|getAdminClient|peso_oro_g|mina_nombre|mina_municipio|fecha_emision|hash_sha256|hash_verificacion/, nombre);
    }
    // No se agregó un QR nuevo: el del sello existente sigue en lib/certificados/sello.ts.
    assert.doesNotMatch(pagina + ruta, /qrcode|QRCode|buildQrUrl/);
  });
});

describe('texto público', () => {
  test('aviso del sello: literal, "alineado con OCDE/LBMA", nunca "certificado" aplicado al estándar', () => {
    assert.equal(VERIFICAR_SELLO_AVISO, 'Registro de sello MAPE.LEGAL, alineado con OCDE/LBMA; no es un certificado oficial ni sustituye el documento de la autoridad.');
    for (const t of [VERIFICAR_SELLO_AVISO, VERIFICAR_ALCANCE_MINIMO, VERIFICAR_NO_CONSTA]) {
      assert.doesNotMatch(t, /(est[áa]ndar|sello|plataforma)\s+(est[áa]\s+|es\s+)?(certificad|reconocid|acreditad)[oa]/i);
      assert.doesNotMatch(t, /(certificad|reconocid|acreditad|avalad)[oa]s?\s+por\s+(la\s+)?(OCDE|LBMA|INHGEOMIN)/i);
    }
    assert.match(VERIFICAR_ALCANCE_MINIMO, /únicamente\s+el número de sello y su estado/);
  });
});
