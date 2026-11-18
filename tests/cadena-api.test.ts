// tests/cadena-api.test.ts — RBAC puro y validadores de body de /api/cadena/*
// (sin BD, sin Supabase simulado).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  alcanceLista,
  filtrarPagosVisibles,
  filtroLotes,
  puedeEscribirLote,
  puedeRegistrarPago,
  puedeSolicitarExpediente,
  puedeVerLote,
  puedeVerPagos,
  esMigracionPendiente,
  type ContextoCadena,
} from '@/lib/cadena/acceso';
import {
  generarCodigoLote,
  isFechaYmd,
  isUuid,
  redactarPagoParaAuditor,
  tiposEventoPermitidos,
  validarBodyConsentimiento,
  validarBodyEvento,
  validarBodyFuente,
  validarBodyLote,
  validarBodyOrganizacion,
  validarBodyPago,
  validarBodyRevocacion,
} from '@/lib/cadena/validacion';
import { validarPago } from '@/lib/cadena/reglas';
import { TIPOS_EVENTO } from '@/lib/cadena/types';

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const PLANTA_P = '33333333-3333-4333-8333-333333333333';
const CLI_1 = '44444444-4444-4444-8444-444444444444';
const CLI_2 = '55555555-5555-4555-8555-555555555555';
const USER = '66666666-6666-4666-8666-666666666666';

function ctx(rol: ContextoCadena['rol'], extra: Partial<ContextoCadena> = {}): ContextoCadena {
  return { rol, userId: USER, email: 'x@example.test', organizacionId: null, clienteId: null, ...extra };
}

const lote = { cliente_id: CLI_1, comercializador_org_id: ORG_A, planta_org_id: PLANTA_P };
const loteSinPlanta = { cliente_id: CLI_1, comercializador_org_id: ORG_A, planta_org_id: null };

describe('acceso — puedeVerLote', () => {
  test('staff y auditor ven cualquier lote', () => {
    for (const r of ['admin', 'abogado', 'tecnico_ambiental', 'auditor'] as const) {
      assert.equal(puedeVerLote(ctx(r), lote), true, r);
    }
  });
  test('comercializador solo su organización', () => {
    assert.equal(puedeVerLote(ctx('comercializador', { organizacionId: ORG_A }), lote), true);
    assert.equal(puedeVerLote(ctx('comercializador', { organizacionId: ORG_B }), lote), false);
    assert.equal(puedeVerLote(ctx('comercializador'), lote), false, 'sin organización no ve nada');
  });
  test('planta solo los lotes que la nombran', () => {
    assert.equal(puedeVerLote(ctx('planta', { organizacionId: PLANTA_P }), lote), true);
    assert.equal(puedeVerLote(ctx('planta', { organizacionId: PLANTA_P }), loteSinPlanta), false);
    assert.equal(puedeVerLote(ctx('planta', { organizacionId: ORG_A }), lote), false, 'ser la comercializadora no da acceso de planta');
  });
  test('cliente solo los suyos', () => {
    assert.equal(puedeVerLote(ctx('cliente', { clienteId: CLI_1 }), lote), true);
    assert.equal(puedeVerLote(ctx('cliente', { clienteId: CLI_2 }), lote), false);
    assert.equal(puedeVerLote(ctx('cliente'), lote), false);
  });
});

describe('acceso — escritura y pagos', () => {
  test('puedeEscribirLote: admin, comercializador propio, planta propia', () => {
    assert.equal(puedeEscribirLote(ctx('admin'), lote), true);
    assert.equal(puedeEscribirLote(ctx('abogado'), lote), false);
    assert.equal(puedeEscribirLote(ctx('auditor'), lote), false);
    assert.equal(puedeEscribirLote(ctx('cliente', { clienteId: CLI_1 }), lote), false);
    assert.equal(puedeEscribirLote(ctx('comercializador', { organizacionId: ORG_A }), lote), true);
    assert.equal(puedeEscribirLote(ctx('comercializador', { organizacionId: ORG_B }), lote), false);
    assert.equal(puedeEscribirLote(ctx('planta', { organizacionId: PLANTA_P }), lote), true);
    assert.equal(puedeEscribirLote(ctx('planta', { organizacionId: ORG_B }), lote), false);
  });
  test('puedeRegistrarPago: solo comercializador dueño o admin (nunca planta)', () => {
    assert.equal(puedeRegistrarPago(ctx('admin'), lote), true);
    assert.equal(puedeRegistrarPago(ctx('comercializador', { organizacionId: ORG_A }), lote), true);
    assert.equal(puedeRegistrarPago(ctx('comercializador', { organizacionId: ORG_B }), lote), false);
    assert.equal(puedeRegistrarPago(ctx('planta', { organizacionId: PLANTA_P }), lote), false);
    assert.equal(puedeRegistrarPago(ctx('abogado'), lote), false);
  });
  test('puedeVerPagos: NUNCA planta; staff, auditor, comercializador propio y cliente propio sí', () => {
    assert.equal(puedeVerPagos(ctx('planta', { organizacionId: PLANTA_P }), lote), false);
    assert.equal(puedeVerPagos(ctx('admin'), lote), true);
    assert.equal(puedeVerPagos(ctx('auditor'), lote), true);
    assert.equal(puedeVerPagos(ctx('comercializador', { organizacionId: ORG_A }), lote), true);
    assert.equal(puedeVerPagos(ctx('comercializador', { organizacionId: ORG_B }), lote), false);
    assert.equal(puedeVerPagos(ctx('cliente', { clienteId: CLI_1 }), lote), true);
    assert.equal(puedeVerPagos(ctx('cliente', { clienteId: CLI_2 }), lote), false);
  });
  test('filtrarPagosVisibles: planta [], cliente solo beneficiario, comercializador solo pagador', () => {
    const pagos = [
      { id: 'p1', beneficiario_cliente_id: CLI_1, pagado_por_org_id: ORG_A },
      { id: 'p2', beneficiario_cliente_id: CLI_2, pagado_por_org_id: ORG_B },
    ];
    assert.deepEqual(filtrarPagosVisibles(ctx('planta', { organizacionId: PLANTA_P }), pagos), []);
    assert.deepEqual(filtrarPagosVisibles(ctx('cliente', { clienteId: CLI_1 }), pagos).map((p) => p.id), ['p1']);
    assert.deepEqual(filtrarPagosVisibles(ctx('comercializador', { organizacionId: ORG_B }), pagos).map((p) => p.id), ['p2']);
    assert.equal(filtrarPagosVisibles(ctx('admin'), pagos).length, 2);
    assert.equal(filtrarPagosVisibles(ctx('auditor'), pagos).length, 2);
  });
  test('redactarPagoParaAuditor quita monto_lps y lo marca', () => {
    const r = redactarPagoParaAuditor({ id: 'p', monto_lps: '1000.00', medio: 'transferencia' });
    assert.equal('monto_lps' in r, false);
    assert.equal(r.monto_lps_omitido, true);
    assert.equal(r.medio, 'transferencia');
  });
  test('puedeSolicitarExpediente: staff, planta del lote, cliente dueño; no comercializador ni auditor', () => {
    assert.equal(puedeSolicitarExpediente(ctx('admin'), lote), true);
    assert.equal(puedeSolicitarExpediente(ctx('planta', { organizacionId: PLANTA_P }), lote), true);
    assert.equal(puedeSolicitarExpediente(ctx('planta', { organizacionId: ORG_B }), lote), false);
    assert.equal(puedeSolicitarExpediente(ctx('cliente', { clienteId: CLI_1 }), lote), true);
    assert.equal(puedeSolicitarExpediente(ctx('comercializador', { organizacionId: ORG_A }), lote), false);
    assert.equal(puedeSolicitarExpediente(ctx('auditor'), lote), false);
  });
});

describe('acceso — alcance de listados', () => {
  test('alcanceLista y filtroLotes por rol', () => {
    assert.deepEqual(alcanceLista(ctx('admin')), { tipo: 'todos' });
    assert.deepEqual(alcanceLista(ctx('auditor')), { tipo: 'todos' });
    assert.equal(filtroLotes(alcanceLista(ctx('abogado'))), null);
    assert.deepEqual(filtroLotes(alcanceLista(ctx('comercializador', { organizacionId: ORG_A }))), { columna: 'comercializador_org_id', valor: ORG_A });
    assert.deepEqual(filtroLotes(alcanceLista(ctx('planta', { organizacionId: PLANTA_P }))), { columna: 'planta_org_id', valor: PLANTA_P });
    assert.deepEqual(filtroLotes(alcanceLista(ctx('cliente', { clienteId: CLI_1 }))), { columna: 'cliente_id', valor: CLI_1 });
    assert.deepEqual(alcanceLista(ctx('comercializador')), { tipo: 'nada' });
    assert.deepEqual(alcanceLista(ctx('planta')), { tipo: 'nada' });
    assert.deepEqual(alcanceLista(ctx('cliente')), { tipo: 'nada' });
  });
  test('esMigracionPendiente reconoce los códigos de PostgREST', () => {
    for (const code of ['42P01', '42883', '42703', 'PGRST202', 'PGRST205']) assert.equal(esMigracionPendiente({ code }), true, code);
    assert.equal(esMigracionPendiente({ code: '23505' }), false);
    assert.equal(esMigracionPendiente(null), false);
  });
});

describe('validacion — eventos por rol', () => {
  test('matriz rol × tipo', () => {
    assert.deepEqual([...tiposEventoPermitidos('comercializador')], ['origen_mina', 'acopio', 'transporte', 'correccion', 'nota']);
    assert.deepEqual([...tiposEventoPermitidos('planta')], ['recepcion_planta', 'laboratorio', 'fundicion', 'refinado', 'nota']);
    assert.deepEqual([...tiposEventoPermitidos('admin')], [...TIPOS_EVENTO]);
    assert.deepEqual([...tiposEventoPermitidos('auditor')], []);
    assert.deepEqual([...tiposEventoPermitidos('cliente')], []);
  });
  test('comercializador + fundicion → 403; tipo desconocido → 400', () => {
    const r = validarBodyEvento({ tipo: 'fundicion' }, 'comercializador');
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.status, 403);
    const r2 = validarBodyEvento({ tipo: 'teletransporte' }, 'admin');
    assert.equal(r2.ok, false);
    if (!r2.ok) assert.equal(r2.status, 400);
  });
  test('campos: fecha default ahora, peso ≥ 0, ley 0–1, detalle objeto', () => {
    const ahora = new Date('2026-11-12T12:00:00.000Z');
    const ok = validarBodyEvento({ tipo: 'origen_mina', peso_g: '1250.5', ley_fino: 0.9, lugar: ' Iriona ', detalle: { b: 1 } }, 'comercializador', ahora);
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.data.fecha, '2026-11-12T12:00:00.000Z');
      assert.equal(ok.data.peso_g, 1250.5);
      assert.equal(ok.data.ley_fino, 0.9);
      assert.equal(ok.data.lugar, 'Iriona');
      assert.deepEqual(ok.data.detalle, { b: 1 });
    }
    assert.equal(validarBodyEvento({ tipo: 'acopio', peso_g: -1 }, 'comercializador').ok, false);
    assert.equal(validarBodyEvento({ tipo: 'laboratorio', ley_fino: 1.5 }, 'planta').ok, false);
    assert.equal(validarBodyEvento({ tipo: 'nota', detalle: [1] }, 'planta').ok, false);
    assert.equal(validarBodyEvento({ tipo: 'nota', fecha: '2027-01-01T00:00:00Z' }, 'planta', ahora).ok, false, 'fecha futura');
    assert.equal(validarBodyEvento({ tipo: 'nota', fecha: 'ayer' }, 'planta', ahora).ok, false);
  });
});

describe('validacion — pagos', () => {
  test('forma del body: monto > 0 y fecha YYYY-MM-DD obligatorios', () => {
    assert.equal(validarBodyPago({ medio: 'transferencia', referencia_bancaria: 'ABC123', monto_lps: 0, fecha_pago: '2026-11-12' }).ok, false);
    assert.equal(validarBodyPago({ medio: 'transferencia', referencia_bancaria: 'ABC123', monto_lps: 100, fecha_pago: '2026-02-30' }).ok, false);
    assert.equal(validarBodyPago({ referencia_bancaria: 'ABC123', monto_lps: 100, fecha_pago: '2026-11-12' }).ok, false, 'sin medio');
    const ok = validarBodyPago({ medio: ' Transferencia ', referencia_bancaria: ' ABC123 ', monto_lps: '1500.50', fecha_pago: '2026-11-12' });
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.data.medio, 'transferencia');
      assert.equal(ok.data.referencia_bancaria, 'ABC123');
      assert.equal(ok.data.monto_lps, 1500.5);
      assert.equal(ok.data.banco, null);
    }
  });
  test('efectivo pasa la forma pero la regla lo bloquea (el RPC debe recibirlo) → shape 422', () => {
    const forma = validarBodyPago({ medio: 'efectivo', referencia_bancaria: '', monto_lps: 100, fecha_pago: '2026-11-12' });
    assert.equal(forma.ok, true, 'la forma no decide la regla de negocio');
    if (forma.ok) {
      const regla = validarPago({ medio: forma.data.medio, referencia_bancaria: forma.data.referencia_bancaria });
      assert.equal(regla.ok, false);
      if (!regla.ok) {
        const respuesta422 = { error: 'pago_invalido', motivo: regla.motivo, lote_bloqueado: true };
        assert.deepEqual(respuesta422, { error: 'pago_invalido', motivo: 'efectivo_prohibido', lote_bloqueado: true });
      }
    }
  });
});

describe('validacion — fuentes, lotes, organizaciones, consentimientos', () => {
  test('fuente: cliente_id uuid, fechas, clpi default pendiente', () => {
    const r = validarBodyFuente({ cliente_id: CLI_1, permiso_vigente_hasta: '2027-01-31', dentro_area_inhgeomin: true });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.data.clpi_estado, 'pendiente');
      assert.equal(r.data.mina_id, null);
      assert.equal('organizacion_id' in r.data, false);
    }
    assert.equal(validarBodyFuente({ cliente_id: 'x' }).ok, false);
    assert.equal(validarBodyFuente({ cliente_id: CLI_1, permiso_vigente_hasta: '31/01/2027' }).ok, false);
    assert.equal(validarBodyFuente({ cliente_id: CLI_1, clpi_estado: 'aprobado' }).ok, false);
    assert.equal(validarBodyFuente({ cliente_id: CLI_1, dentro_area_inhgeomin: 'si' }).ok, false);
  });
  test('lote: fuente_id obligatorio, codigo opcional validado', () => {
    assert.equal(validarBodyLote({}).ok, false);
    assert.equal(validarBodyLote({ fuente_id: ORG_A, codigo: 'a b' }).ok, false);
    const r = validarBodyLote({ fuente_id: ORG_A, planta_org_id: PLANTA_P });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.data.codigo, null);
  });
  test('generarCodigoLote: máximo entero del año + 1, sin orden lexicográfico', () => {
    assert.equal(generarCodigoLote([], 2026), 'LOTE-2026-0001');
    assert.equal(generarCodigoLote(['LOTE-2026-0999', 'LOTE-2026-1000', 'LOTE-2025-5000', null, 'EXT-1'], 2026), 'LOTE-2026-1001');
  });
  test('organización: tipo cerrado, nombre obligatorio, rtn con forma', () => {
    assert.equal(validarBodyOrganizacion({ tipo: 'banco', nombre: 'X' }).ok, false);
    assert.equal(validarBodyOrganizacion({ tipo: 'planta', nombre: '' }).ok, false);
    assert.equal(validarBodyOrganizacion({ tipo: 'planta', nombre: 'Planta Norte', rtn: 'abc' }).ok, false);
    const r = validarBodyOrganizacion({ tipo: 'comercializador', nombre: ' Acopiadora Sur ', rtn: '0801-1990-12345' });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.data.nombre, 'Acopiadora Sur');
  });
  test('consentimiento: hash 64 hex, ruta segura, alcance con al menos un ámbito', () => {
    const hash = 'a'.repeat(64);
    const base = { cliente_id: CLI_1, otorgado_a_org_id: PLANTA_P, documento_path: 'consentimientos/2026/c1.pdf', hash_sha256: hash, fecha_firma: '2026-11-10' };
    assert.equal(validarBodyConsentimiento({ ...base, alcance: { expediente: true } }).ok, true);
    assert.equal(validarBodyConsentimiento({ ...base, alcance: {} }).ok, false, 'alcance vacío');
    assert.equal(validarBodyConsentimiento({ ...base, alcance: { expediente: true, pagos: true } }).ok, false, 'alcance desconocido');
    assert.equal(validarBodyConsentimiento({ ...base, hash_sha256: 'zz', alcance: { expediente: true } }).ok, false);
    assert.equal(validarBodyConsentimiento({ ...base, documento_path: '../etc/passwd', alcance: { expediente: true } }).ok, false);
    const mayus = validarBodyConsentimiento({ ...base, hash_sha256: hash.toUpperCase(), alcance: { lotes: true } });
    assert.equal(mayus.ok, true, 'el hash se normaliza a minúsculas');
    if (mayus.ok) assert.equal(mayus.data.hash_sha256, hash);
  });
  test('revocación: body vacío válido; constancia_path segura', () => {
    assert.equal(validarBodyRevocacion(undefined).ok, true);
    assert.equal(validarBodyRevocacion({ motivo: 'El minero lo solicitó' }).ok, true);
    assert.equal(validarBodyRevocacion({ constancia_path: 'http://x/y.pdf' }).ok, false);
  });
  test('primitivas', () => {
    assert.equal(isUuid(CLI_1), true);
    assert.equal(isUuid('nope'), false);
    assert.equal(isFechaYmd('2026-11-12'), true);
    assert.equal(isFechaYmd('2026-13-01'), false);
  });
});
