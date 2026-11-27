// tests/check-copy-reglas.test.ts — los gates check:copy y check:neutralidad
// FALLAN ante las formulaciones prohibidas por DEC-2026-11-26-1 /
// DEC-2026-11-27-2 y PASAN con la redacción permitida. Corre cada script en un
// árbol temporal con la misma estructura de carpetas que escanea (app/,
// components/, lib/content/, lib/maria/), así el test no depende del contenido
// real del repo ni lo modifica.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK_COPY = join(ROOT, 'scripts', 'check-copy-compliance.mjs');
const CHECK_NEUTRALIDAD = join(ROOT, 'scripts', 'check-neutralidad-politica.mjs');

// Identidad mínima que checkIdentidad exige en lib/content/copy-legal.ts.
const COPY_LEGAL_OK = `
export const ROL_CHT = 'no compra ni vende mineral, no administra fondos y cobra tarifas fijas o por servicio, nunca ligadas al valor ni al volumen del oro.'
export const IDENTIDAD_FONDOS_TARIFAS = ROL_CHT
`;

interface Arbol {
  [ruta: string]: string;
}

function correr(script: string, archivos: Arbol): { status: number; out: string } {
  const dir = mkdtempSync(join(tmpdir(), 'mape-check-'));
  try {
    for (const [ruta, contenido] of Object.entries(archivos)) {
      const abs = join(dir, ruta);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, contenido);
    }
    const r = spawnSync('node', [script], { cwd: dir, encoding: 'utf8' });
    return { status: r.status ?? 1, out: `${r.stdout}\n${r.stderr}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const BASE_OK: Arbol = {
  'lib/content/copy-legal.ts': COPY_LEGAL_OK,
  'app/quienes-somos/page.tsx': `import { IDENTIDAD_FONDOS_TARIFAS } from '@/lib/content/copy-legal'\nexport default () => IDENTIDAD_FONDOS_TARIFAS`,
  'app/page.tsx': `import { ROL_CHT } from '@/lib/content/copy-legal'\nexport default () => ROL_CHT`,
  'app/aviso-legal/page.tsx': `import { IDENTIDAD_FONDOS_TARIFAS } from '@/lib/content/copy-legal'\nexport default () => IDENTIDAD_FONDOS_TARIFAS`,
};

function fallaCon(archivos: Arbol, esperado: RegExp, script = CHECK_COPY) {
  const r = correr(script, { ...BASE_OK, ...archivos });
  assert.equal(r.status, 1, `debía fallar:\n${r.out}`);
  assert.match(r.out, esperado);
}

function pasa(archivos: Arbol, script = CHECK_COPY) {
  const r = correr(script, { ...BASE_OK, ...archivos });
  assert.equal(r.status, 0, `debía pasar:\n${r.out}`);
}

describe('check:copy — árbol limpio con la redacción permitida pasa', () => {
  test('identidad, alianzas calificadas, fórmula sin factor, negaciones', () => {
    pasa({
      'app/x/page.tsx': [
        'Finacop: carta de intención enviada; MOU en proceso; crédito para el minero en evaluación.',
        'planetGOLD (PNUD): carta de intención en preparación.',
        'Lempiras por gramo de oro fino = precio internacional del oro × tipo de cambio de compra del BCH ÷ 31.1034768.',
        'El estándar está alineado con la Guía OCDE y la LBMA Responsible Gold Guidance; no implica certificación, membresía ni aval.',
        'Marketplace abierto, sin exclusividad de compra ni un destino único.',
        'Cada participante publica su producción estimada y sus precios de compra y venta.',
        'MAPE.LEGAL no compra, no vende ni intermedia oro y no administra fondos.',
        'La ley nominal es kilates ÷ 24 (18k = 75 % de oro fino).',
        'Verificar certificado · Certificado de Origen oficial · Certificación de Procedencia.',
        "['≥ 80 %', 'Recuperación objetivo']",
        'style={{ width: "75%" }}',
      ].join('\n'),
    });
  });
});

describe('check:copy — falla ante lo prohibido', () => {
  test('"precio referencial (75 %)"', () => {
    fallaCon({ 'app/x/page.tsx': 'Precio referencial (75%): L 3,000 por gramo de oro fino' }, /precio referencial \(NN %\)|factor de precio/i);
  });
  test('"75 % del LBMA" y "× 0,75"', () => {
    fallaCon({ 'app/x/page.tsx': 'Pagamos el 75 % del LBMA.' }, /factor de precio/i);
    fallaCon({ 'lib/maria/systemPrompt.ts': 'La fórmula: oro × tipo de cambio × 0.75 en lempiras.' }, /factor de compra en una fórmula/i);
    fallaCon({ 'app/x/page.tsx': 'Se paga el 80 % de la referencia internacional del oro.' }, /factor de precio/i);
  });
  test('"certificado por la LBMA" / "estándar certificado"', () => {
    fallaCon({ 'app/x/page.tsx': 'El estándar MAPE.LEGAL está certificado por la LBMA.' }, /certificado\/reconocido\/acreditado por OCDE\/LBMA|certificado\|reconocido\|acreditado/i);
    fallaCon({ 'app/x/page.tsx': 'Un sello reconocido por INHGEOMIN.' }, /ALINEADO con esas guías/i);
  });
  test('"convenio firmado con Finacop" y Finacop sin calificar', () => {
    fallaCon({ 'app/x/page.tsx': 'Convenio firmado con Finacop para crédito al minero.' }, /firmada\/vigente/i);
    fallaCon({ 'app/x/page.tsx': 'Trabajamos con Finacop.' }, /fuera de la redacción calificada/i);
    fallaCon({ 'docs/nota.md': 'Alianza vigente con planetGOLD (PNUD).' }, /firmada\/vigente/i);
  });
  test('"tipo de cambio del BCH (exchangerate-api.com)" y "LBMA oficial" para goldapi', () => {
    fallaCon({ 'app/x/page.tsx': 'Tipo de cambio del BCH (exchangerate-api.com): L 26.50' }, /etiqueta "BCH" \/ "LBMA oficial" junto a exchangerate-api|exchangerate-api como fuente/i);
    fallaCon({ 'services/x.ts': "const etiqueta = 'LBMA oficial (goldapi.io)'" }, /etiqueta "BCH" \/ "LBMA oficial"/i);
    fallaCon({ 'lib/x.ts': 'El tipo de cambio se toma de exchangerate-api.com cada día.' }, /exchangerate-api como fuente del tipo de cambio/i);
  });
  test('exclusividad, comprador nombrado, CKI y 90 kg', () => {
    fallaCon({ 'app/x/page.tsx': 'MAPE.LEGAL es el comprador exclusivo de la zona.' }, /comprador exclusivo/i);
    fallaCon({ 'app/x/page.tsx': 'Toda la producción va a un único destino.' }, /destino único/i);
    fallaCon({ 'lib/x.ts': "const socio = 'Inversiones CKI'" }, /Inversiones CKI/);
    fallaCon({ 'app/x/page.tsx': 'Capacidad de 90 kg/mes.' }, /90 kg/);
  });
  test('identidad incompleta en la fuente única o superficie que no la importa', () => {
    const r = correr(CHECK_COPY, { ...BASE_OK, 'lib/content/copy-legal.ts': "export const ROL_CHT = 'no compra ni vende mineral.'" });
    assert.equal(r.status, 1);
    assert.match(r.out, /falta la frase de identidad obligatoria/);
    const r2 = correr(CHECK_COPY, { ...BASE_OK, 'app/aviso-legal/page.tsx': 'export default () => "sin importar la identidad"' });
    assert.equal(r2.status, 1);
    assert.match(r2.out, /superficie de identidad sin IDENTIDAD_FONDOS_TARIFAS/);
  });
});

describe('check:neutralidad — cerebro de María', () => {
  test('pasa con el precio informativo y la ley nominal; falla con porcentajes como precio y con CKI', () => {
    const limpio = correr(CHECK_NEUTRALIDAD, {
      'lib/maria/systemPrompt.ts': [
        'Oro en lempiras por gramo de oro fino (solo informativo): usa el valor del bloque.',
        'La ley nominal es kilates ÷ 24 (18k = 75 % de oro fino).',
        'NUNCA cites el 75 % del LBMA como precio.',
      ].join('\n'),
    });
    assert.equal(limpio.status, 0, limpio.out);
    const sucio = correr(CHECK_NEUTRALIDAD, { 'lib/maria/systemPrompt.ts': 'Precio referencial (75%): L [valor] por gramo de oro fino' });
    assert.equal(sucio.status, 1);
    assert.match(sucio.out, /porcentaje de la referencia internacional como precio/);
    const sucio2 = correr(CHECK_NEUTRALIDAD, { 'docs/rag-maria/ficha.md': 'El comprador paga el 80 % de la referencia.' });
    assert.equal(sucio2.status, 1);
    const cki = correr(CHECK_NEUTRALIDAD, { 'lib/maria/systemPrompt.ts': 'El socio es Inversiones CKI.' });
    assert.equal(cki.status, 1);
    assert.match(cki.out, /comprador nombrado/);
  });
});
