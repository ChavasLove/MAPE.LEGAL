// tests/precio-vivo.test.ts — fórmula pública del precio informativo
// (DEC-2026-11-26-1 / DEC-2026-11-27-2):
//
//   L/g fino = (USD/oz) × (tipo de COMPRA del BCH, L por USD) ÷ 31.1034768
//
// Fija con números conocidos: (1) la fórmula exacta y el redondeo de la UI;
// (2) los kilates = ley/24 del L/g fino, SIN multiplicar por 0,75, 0,80 ni
// 0,90; (3) insumos null / 0 / no finitos → null ("dato no disponible"), nunca
// una cifra inventada; (4) la etiqueta de la fuente del oro no dice "LBMA
// oficial" para goldapi/Yahoo; (5) la procedencia compuesta del FX.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  TROY_OUNCE_GRAMS,
  GOLD_KARATS,
  PENNYWEIGHT_GRAMS,
  oroLpsPorGramoFino,
  oroLpsPorOnza,
  buildKaratPrices,
  etiquetaFuenteOro,
  componerFuente,
  parseFuente,
  FX_MARCADOR_BCH,
  FUENTES_ORO,
  FUENTE_ORO_LBMA_OFICIAL,
} from '@/services/pricingService';
import {
  GRAMOS_POR_ONZA_TROY,
  calcularPrecioLempirasGramoFino,
  redondearPresentacion,
  redondearAlmacenamiento,
  FACTOR_SIN_RECORTE,
} from '@/lib/precio/calculo';
import { recalcularLpsGramoFino } from '@/lib/precio/consulta';
import {
  AVISO_PRECIO_INFORMATIVO,
  FORMULA_PRECIO_INFORMATIVO,
  FUENTE_TIPO_CAMBIO,
  ETIQUETA_TIPO_CAMBIO,
  ROTULO_PRECIO_INFORMATIVO,
} from '@/lib/content/copy-legal';

const ORO = 4000; // USD/oz
const TC = 26.5; // L por USD (tipo de compra del BCH)
const ESPERADO = (ORO * TC) / 31.1034768; // 3407.9791...

describe('fórmula canónica L/g fino = USD/oz × tipo de compra BCH ÷ 31.1034768', () => {
  test('la constante de la onza troy es 31.1034768 en todo el código público', () => {
    assert.equal(TROY_OUNCE_GRAMS, 31.1034768);
    assert.equal(GRAMOS_POR_ONZA_TROY, 31.1034768);
    assert.equal(PENNYWEIGHT_GRAMS, 31.1034768 / 20);
  });

  test('caso exacto: 4000 USD/oz × L 26.5 ÷ 31.1034768', () => {
    const v = oroLpsPorGramoFino(ORO, TC);
    assert.ok(v != null);
    assert.ok(Math.abs(v - ESPERADO) < 1e-9);
    assert.ok(Math.abs(v - 3407.98) < 0.01);
    // El mismo número por las dos vías (snapshot vivo y fijación manual).
    assert.equal(calcularPrecioLempirasGramoFino(ORO, TC), v);
    assert.equal(recalcularLpsGramoFino({ referencia_lbma_usd_oz: ORO, tipo_cambio_bch: TC }), v);
  });

  test('redondeo de la UI (2 decimales) y de almacenamiento (4 decimales)', () => {
    assert.equal(redondearPresentacion(ESPERADO), 3407.98);
    assert.equal(redondearAlmacenamiento(ESPERADO), 3407.9791);
    assert.equal(redondearPresentacion(1.005), 1.01);
    assert.equal(redondearPresentacion(2.3449, 2), 2.34);
  });

  test('onza en lempiras = USD/oz × tipo de compra', () => {
    assert.equal(oroLpsPorOnza(ORO, TC), ORO * TC);
  });

  test('sin factor de compra: el resultado no equivale a ningún 75/80/90 %', () => {
    const v = oroLpsPorGramoFino(ORO, TC)!;
    for (const f of [0.75, 0.8, 0.9]) {
      assert.ok(Math.abs(v - ESPERADO * f) > 1, `no debe ser el ${f * 100} %`);
    }
    assert.equal(FACTOR_SIN_RECORTE, 1);
  });
});

describe('kilates = ley/24 aplicada al L/g fino, sin factor', () => {
  test('16/18/20/22 k en lempiras y USD, por gramo y por penique', () => {
    const k = buildKaratPrices(ORO, TC);
    assert.ok(k);
    assert.deepEqual(k.map((x) => x.kilates), [...GOLD_KARATS]);
    const usdPorGramoFino = ORO / 31.1034768;
    for (const fila of k) {
      const ley = fila.kilates / 24;
      assert.equal(fila.ley, ley);
      assert.ok(Math.abs(fila.oro_lps_g - ESPERADO * ley) < 1e-9, `${fila.kilates}k L/g`);
      assert.ok(Math.abs(fila.oro_usd_g - usdPorGramoFino * ley) < 1e-9, `${fila.kilates}k USD/g`);
      assert.ok(Math.abs(fila.oro_lps_dwt - fila.oro_lps_g * PENNYWEIGHT_GRAMS) < 1e-9);
      assert.ok(Math.abs(fila.oro_usd_dwt - fila.oro_usd_g * PENNYWEIGHT_GRAMS) < 1e-9);
      // Nunca multiplicado por 0,75 / 0,80 / 0,90.
      for (const f of [0.75, 0.8, 0.9]) {
        assert.ok(Math.abs(fila.oro_lps_g - ESPERADO * ley * f) > 1, `${fila.kilates}k no lleva factor ${f}`);
      }
      // Ninguna fila expone un campo "referencia_*" (el antiguo 75 %).
      assert.ok(!('referencia_lps_g' in fila));
      assert.ok(!('referencia_lps_dwt' in fila));
    }
    // 18 k = 75 % de oro FINO como ley nominal (eso sí es correcto y se queda).
    assert.equal(k[1].kilates, 18);
    assert.equal(k[1].ley, 0.75);
  });
});

describe('insumo null, 0 o no finito → null (dato no disponible)', () => {
  const casos: Array<[number | null | undefined, number | null | undefined]> = [
    [null, TC], [undefined, TC], [0, TC], [-1, TC], [NaN, TC], [Infinity, TC],
    [ORO, null], [ORO, undefined], [ORO, 0], [ORO, -26.5], [ORO, NaN], [ORO, Infinity],
    [null, null], [0, 0],
  ];
  for (const [oro, tc] of casos) {
    test(`oro=${String(oro)} tc=${String(tc)}`, () => {
      assert.equal(oroLpsPorGramoFino(oro, tc), null);
      assert.equal(oroLpsPorOnza(oro, tc), null);
      assert.equal(buildKaratPrices(oro, tc), null);
      assert.equal(calcularPrecioLempirasGramoFino(oro, tc), null);
    });
  }
  test('fila histórica con insumo no positivo → null, nunca el factor registrado', () => {
    assert.equal(recalcularLpsGramoFino({ referencia_lbma_usd_oz: 0, tipo_cambio_bch: TC }), null);
    assert.equal(recalcularLpsGramoFino({ referencia_lbma_usd_oz: ORO, tipo_cambio_bch: NaN }), null);
  });
});

describe('etiquetas honestas de fuente', () => {
  test('goldapi / Yahoo nunca se etiquetan como LBMA oficial', () => {
    for (const f of ['goldapi.io', 'yahoo-finance', 'goldapi.io, yahoo-finance', 'goldapi.io | fx:bch']) {
      const e = etiquetaFuenteOro(f);
      assert.ok(!/lbma/i.test(e), `${f} → ${e}`);
      assert.ok(/precio internacional del oro/i.test(e));
    }
    assert.ok(!/lbma/i.test(etiquetaFuenteOro(null)));
    assert.ok(!/lbma/i.test(etiquetaFuenteOro('desconocida')));
  });

  test('las fuentes en rotación son goldapi + yahoo; el puerto LBMA oficial está fuera y devuelve null', async () => {
    assert.deepEqual(FUENTES_ORO.map((f) => f.id), ['goldapi.io', 'yahoo-finance']);
    assert.ok(!FUENTES_ORO.some((f) => f.id === 'lbma-oficial'));
    assert.equal(await FUENTE_ORO_LBMA_OFICIAL.obtener(), null);
    assert.match(FUENTE_ORO_LBMA_OFICIAL.etiqueta, /pendiente/i);
  });

  test('procedencia compuesta del FX en precios_diarios.fuente', () => {
    assert.equal(componerFuente('goldapi.io', true), `goldapi.io | ${FX_MARCADOR_BCH}`);
    assert.equal(componerFuente('yahoo-finance', false), 'yahoo-finance');
    assert.deepEqual(parseFuente('goldapi.io | fx:bch'), { oro: 'goldapi.io', fxBch: true });
    assert.deepEqual(parseFuente('yahoo-finance'), { oro: 'yahoo-finance', fxBch: false });
    assert.deepEqual(parseFuente(null), { oro: '', fxBch: false });
    // Una fila legacy (exchangerate) NUNCA se interpreta como BCH.
    assert.equal(parseFuente('goldapi.io').fxBch, false);
  });

  test('copy público: sin porcentajes, con BCH y "solo informativo"', () => {
    for (const texto of [AVISO_PRECIO_INFORMATIVO, FORMULA_PRECIO_INFORMATIVO, ROTULO_PRECIO_INFORMATIVO]) {
      assert.ok(!/\b(75|80|90)\s?%|0[.,]75|×\s*0[.,]\d/.test(texto), texto);
      assert.ok(!/referencial/i.test(texto), texto);
    }
    assert.match(AVISO_PRECIO_INFORMATIVO, /Banco Central de Honduras \(BCH\)/);
    assert.match(AVISO_PRECIO_INFORMATIVO, /solo informativo/i);
    assert.match(AVISO_PRECIO_INFORMATIVO, /no administra fondos/);
    assert.match(FORMULA_PRECIO_INFORMATIVO, /31\.1034768/);
    assert.match(FORMULA_PRECIO_INFORMATIVO, /compra del BCH/);
    assert.equal(FUENTE_TIPO_CAMBIO, 'Banco Central de Honduras (BCH)');
    assert.equal(ETIQUETA_TIPO_CAMBIO, 'Tipo de cambio de compra del BCH');
  });
});
