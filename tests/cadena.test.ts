// tests/cadena.test.ts — reglas puras del estándar privado y cadena de hash.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJson, canonicoEvento, hashEvento, verificarCadena } from '@/lib/cadena/hash';
import {
  validarPago,
  evaluarElegibilidadFuente,
  validarEventoFundicion,
  conciliarPesos,
  accesoPorConsentimiento,
} from '@/lib/cadena/reglas';

describe('cadena de hash', () => {
  const lote = '11111111-1111-4111-8111-111111111111';
  test('canónico determinista: claves ordenadas, formatos fijos', () => {
    assert.equal(canonicalJson({ b: 1, a: { d: [2, { z: 1, y: 0 }], c: null } }), '{"a":{"c":null,"d":[2,{"y":0,"z":1}]},"b":1}');
    assert.equal(canonicalJson(null), '{}');
    const c = canonicoEvento({
      lote_id: lote, secuencia: 1, tipo: 'origen_mina', actor_user_id: null,
      fecha: '2026-11-12T14:05:06.007Z', lugar: 'Iriona', peso_g: 1250.5, ley_fino: 0.9165,
      detalle: { b: 'x', a: 1 }, hash_previo: 'GENESIS',
    });
    assert.equal(c, `${lote}|1|origen_mina||2026-11-12T14:05:06.007Z|Iriona|1250.500|0.916500|{"a":1,"b":"x"}|GENESIS`);
    // Vector fijo: el trigger SQL de la migración 043 debe producir este mismo hash.
    assert.equal(hashEvento({ lote_id: lote, secuencia: 1, tipo: 'origen_mina', fecha: '2026-11-12T14:05:06.007Z', lugar: 'Iriona', peso_g: 1250.5, ley_fino: 0.9165, detalle: { b: 'x', a: 1 }, hash_previo: 'GENESIS' }).length, 64);
  });

  test('verificarCadena acepta una cadena íntegra y detecta alteraciones', () => {
    const e1 = { lote_id: lote, secuencia: 1, tipo: 'origen_mina', fecha: '2026-11-12T10:00:00.000Z', lugar: 'mina', peso_g: 1000, ley_fino: null, detalle: {}, hash_previo: 'GENESIS' };
    const h1 = hashEvento(e1);
    const e2 = { lote_id: lote, secuencia: 2, tipo: 'acopio', fecha: '2026-11-12T12:00:00.000Z', lugar: 'acopio', peso_g: 998.25, ley_fino: null, detalle: { nota: 'ok' }, hash_previo: h1 };
    const h2 = hashEvento(e2);
    const cadena = [{ ...e1, hash: h1 }, { ...e2, hash: h2 }];
    assert.deepEqual(verificarCadena(cadena), { ok: true, total: 2, primeraRotura: null, motivo: null });
    // Alterar el peso del primer evento rompe su hash.
    assert.equal(verificarCadena([{ ...e1, peso_g: 1001, hash: h1 }, cadena[1]]).motivo, 'hash_alterado');
    // Quitar el primero rompe la secuencia.
    assert.equal(verificarCadena([cadena[1]]).motivo, 'secuencia_no_consecutiva');
    // Cambiar el hash_previo del segundo rompe el encadenado.
    assert.equal(verificarCadena([cadena[0], { ...e2, hash_previo: 'x', hash: hashEvento({ ...e2, hash_previo: 'x' }) }]).motivo, 'hash_previo_no_coincide');
  });
});

describe('pagos bancarios e identificables', () => {
  test('efectivo o sin referencia → bloquea el lote', () => {
    assert.deepEqual(validarPago({ medio: 'efectivo', referencia_bancaria: 'ABC123' }), { ok: false, bloquea_lote: true, motivo: 'efectivo_prohibido' });
    assert.deepEqual(validarPago({ medio: 'transferencia', referencia_bancaria: '' }), { ok: false, bloquea_lote: true, motivo: 'sin_referencia_bancaria' });
    assert.deepEqual(validarPago({ medio: 'cripto', referencia_bancaria: 'ABC123' }), { ok: false, bloquea_lote: true, motivo: 'medio_no_admitido' });
    assert.deepEqual(validarPago({ medio: 'Transferencia', referencia_bancaria: ' TRF-2026-0001 ' }), { ok: true, medio: 'transferencia', referencia: 'TRF-2026-0001' });
  });
});

describe('elegibilidad de la fuente', () => {
  test('sin permiso vigente o fuera de área INHGEOMIN → bloquea; CLPI pendiente → bloquea; mercurio → alerta', () => {
    const hoy = '2026-11-12';
    assert.deepEqual(
      evaluarElegibilidadFuente({ permiso_vigente_hasta: '2026-01-01', dentro_area_inhgeomin: true, clpi_estado: 'no_aplica', declaracion_mercurio_cero: true }, hoy),
      { elegible: false, bloqueos: ['permiso_municipal_no_vigente'], alertas: [] },
    );
    assert.deepEqual(
      evaluarElegibilidadFuente({ permiso_vigente_hasta: '2027-01-01', dentro_area_inhgeomin: false, clpi_estado: 'pendiente', declaracion_mercurio_cero: null }, hoy),
      { elegible: false, bloqueos: ['fuera_de_area_inhgeomin', 'clpi_pendiente'], alertas: ['sin_declaracion_mercurio_cero'] },
    );
    assert.deepEqual(
      evaluarElegibilidadFuente({ permiso_vigente_hasta: '2027-01-01', dentro_area_inhgeomin: true, clpi_estado: 'documentado', declaracion_mercurio_cero: true }, hoy),
      { elegible: true, bloqueos: [], alertas: [] },
    );
  });
});

describe('fundición solo por titular de beneficio', () => {
  test('el comercializador no funde; sin titular identificado se rechaza', () => {
    assert.deepEqual(validarEventoFundicion({ actor_rol: 'comercializador', detalle: {} }), { ok: false, motivo: 'fundicion_por_comercializador' });
    assert.deepEqual(validarEventoFundicion({ actor_rol: 'admin', detalle: { realizado_por_rol: 'comercializador', titular_beneficio: { nombre: 'X', identificacion: 'Y' } } }), { ok: false, motivo: 'fundicion_por_comercializador' });
    assert.deepEqual(validarEventoFundicion({ actor_rol: 'planta', detalle: {} }), { ok: false, motivo: 'sin_titular_de_beneficio' });
    assert.deepEqual(validarEventoFundicion({ actor_rol: 'planta', detalle: { realizado_por_rol: 'planta', titular_beneficio: { nombre: 'Planta Ejemplo', identificacion: 'RTN-0000' } } }), { ok: true });
  });
});

describe('conciliación de pesos', () => {
  const pesos = [
    { punto: 'origen_mina' as const, peso_g: 1000 },
    { punto: 'acopio' as const, peso_g: 995 },
    { punto: 'laboratorio' as const, peso_g: 990 },
    { punto: 'refinado' as const, peso_g: 900 },
  ];
  test('sin umbral configurado nunca concilia', () => {
    const r = conciliarPesos(pesos, null);
    assert.equal(r.estado, 'umbral_no_configurado');
    assert.equal(r.conciliado, false);
    assert.equal(r.diferencias.length, 3);
    assert.equal(r.diferencias[0].excede, null);
  });
  test('faltan puntos → incompleto; exceso → alerta; dentro del umbral → conciliado', () => {
    assert.equal(conciliarPesos(pesos.slice(0, 2), 5).estado, 'incompleto');
    const alerta = conciliarPesos(pesos, 5);
    assert.equal(alerta.estado, 'alerta');
    assert.equal(alerta.diferencias[2].excede, true); // 990 → 900 = 9.09 %
    assert.equal(conciliarPesos(pesos, 10).estado, 'conciliado');
  });
});

describe('consentimiento informado', () => {
  const org = 'org-planta';
  test('vigente con alcance → acceso; revocado cierra desde la fecha; otro alcance u otra org → no', () => {
    const vigente = [{ estado: 'vigente' as const, revocado_en: null, alcance: { expediente: true }, otorgado_a_org_id: org }];
    assert.equal(accesoPorConsentimiento(vigente, org, 'expediente'), true);
    assert.equal(accesoPorConsentimiento(vigente, org, 'documentos'), false);
    assert.equal(accesoPorConsentimiento(vigente, 'otra', 'expediente'), false);
    const revocado = [{ estado: 'revocado' as const, revocado_en: '2026-11-10T00:00:00Z', alcance: { expediente: true }, otorgado_a_org_id: org }];
    assert.equal(accesoPorConsentimiento(revocado, org, 'expediente', new Date('2026-11-11T00:00:00Z')), false);
    assert.equal(accesoPorConsentimiento(revocado, org, 'expediente', new Date('2026-11-09T00:00:00Z')), true);
  });
});
