// tests/recepcion.test.ts — Fase 4: reglas puras de la recepción física y la
// custodia hasta el laboratorio, manifiesto determinista, conciliación,
// validadores (sin campos de pago), matriz de permisos y migración 047.
// Las mismas reglas se prueban contra PostgreSQL en tests/rls-reestructura.test.ts.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { TIPOS_EVENTO, TIPOS_EVENTO_RECEPCION, TIPOS_EVENTO_TODOS } from '@/lib/cadena/types';
import { canonicoEvento, hashEvento, verificarCadena } from '@/lib/cadena/hash';
import { puedeRegistrarTipoEvento, tiposEventoPermitidos, validarBodyEvento } from '@/lib/cadena/validacion';
import { construirManifiesto, hashManifiesto, verificarManifiesto } from '@/lib/recepcion/manifiesto';
import {
  conciliarManifiesto, puedeAnularRecepcion, puedeCerrarCaja, puedeEmpacar, puedeEnviarCaja, puedeRecibirEnLaboratorio,
  recepcionAdmisible, sobreAdmisible, type SobreParaCaja,
} from '@/lib/recepcion/reglas';
import {
  generarCodigo, validarCaja, validarCierre, validarEnvio, validarParte, validarRecepcion, validarRecepcionLaboratorio, validarSobre,
} from '@/lib/recepcion/validacion';
import { PAPELES_FLUJO } from '@/lib/recepcion/types';
import { puede } from '@/lib/acceso/personal';
import { leerMigracion, sinComentarios, verificarMigracion } from '@/tests/migraciones-estaticas';
import { guardasDeRuta, ROLES_EXTERNOS } from '@/tests/guardas-rutas';
import { ROOT } from '@/tests/pg-efimero';

// Dos titulares de origen GENÉRICOS (A y B). En el código no se nombra a nadie.
const TITULAR_A = 'c0000000-0000-4000-8000-00000000000a';
const TITULAR_B = 'c0000000-0000-4000-8000-00000000000b';
const u = (n: number) => `50000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const sobre = (n: number, titular = TITULAR_A, extra: Partial<SobreParaCaja> = {}): SobreParaCaja & { id: string; mina_id: string; lote_id: string } => ({
  id: u(n), mina_id: u(900), lote_id: u(800), titular_cliente_id: titular, peso_neto_g: 100 + n, etiqueta: `ETQ-${n}`, numero_sello: `SELLO-${n}`,
  estado: 'abierto', caja_id: null, ...extra,
});
const CAJA = { codigo: 'CAJA-2026-0001', precinto: 'PRE-1', punto_id: u(1), laboratorio_org_id: u(2), titular_cliente_id: TITULAR_A };

describe('tipos de evento de recepción', () => {
  test('se agregan 8 tipos sin tocar los 10 existentes', () => {
    assert.deepEqual([...TIPOS_EVENTO], ['origen_mina', 'acopio', 'transporte', 'recepcion_planta', 'laboratorio', 'fundicion', 'refinado', 'pago', 'correccion', 'nota']);
    assert.deepEqual([...TIPOS_EVENTO_RECEPCION], ['recepcion', 'pesaje', 'analisis', 'etiquetado', 'empaque_sobre', 'empaque_caja', 'envio_laboratorio', 'recepcion_laboratorio']);
    assert.equal(TIPOS_EVENTO_TODOS.length, 18);
    assert.equal(new Set(TIPOS_EVENTO_TODOS).size, 18);
  });

  test('el canónico del hash no cambió (vector fijo de la 043) y sirve igual para los tipos nuevos', () => {
    const lote = '11111111-1111-4111-8111-111111111111';
    assert.equal(
      hashEvento({ lote_id: lote, secuencia: 1, tipo: 'origen_mina', actor_user_id: null, fecha: '2026-11-12T14:05:06.007Z', lugar: 'Iriona', peso_g: 1250.5, ley_fino: 0.9165, detalle: { b: 'x', a: 1 }, hash_previo: 'GENESIS' }),
      'a2e60d8d5871069087b5bda166e719a73303777c81a04436633e1938944f09b8');
    // Cadena completa del flujo nuevo, verificada en TS.
    let previo = 'GENESIS';
    const cadena = TIPOS_EVENTO_RECEPCION.map((tipo, i) => {
      const e = { lote_id: lote, secuencia: i + 1, tipo, actor_user_id: u(7), fecha: `2026-11-28T15:0${i}:00.000Z`, lugar: null, peso_g: tipo === 'pesaje' ? 100.25 : null, ley_fino: tipo === 'analisis' ? 0.9 : null, detalle: { sobre_id: u(i), recepcion_id: u(50) }, hash_previo: previo };
      const hash = hashEvento(e);
      previo = hash;
      return { ...e, hash };
    });
    assert.deepEqual(verificarCadena(cadena), { ok: true, total: 8, primeraRotura: null, motivo: null });
    assert.match(canonicoEvento(cadena[1]), /\|pesaje\|.*\|100\.250\|\|\{"recepcion_id":/);
    assert.equal(verificarCadena([cadena[0], { ...cadena[1], peso_g: 100.26 }, ...cadena.slice(2)]).motivo, 'hash_alterado');
  });

  test('el registro manual de eventos NO acepta los tipos de recepción (ni siquiera admin)', () => {
    for (const rol of ['admin', 'comercializador', 'planta', 'recepcion', 'verificador', 'cliente']) {
      for (const t of TIPOS_EVENTO_RECEPCION) {
        assert.equal(puedeRegistrarTipoEvento(rol, t), false, `${rol}/${t}`);
        assert.equal(validarBodyEvento({ tipo: t }, rol).ok, false);
      }
    }
    assert.deepEqual([...tiposEventoPermitidos('recepcion')], []);
    assert.deepEqual([...tiposEventoPermitidos('verificador')], []);
  });
});

describe('reglas de integridad (a)–(f)', () => {
  const base = { perfil: { estado: 'aprobado' as const }, lote: { cliente_id: TITULAR_A, estado: 'abierto' }, mina: { cliente_id: TITULAR_A }, punto: { activo: true } };

  test('(e) un perfil no aprobado no origina recepción', () => {
    assert.deepEqual(recepcionAdmisible(base), { ok: true });
    assert.deepEqual(recepcionAdmisible({ ...base, perfil: null }), { ok: false, motivo: 'sin_perfil' });
    for (const estado of ['borrador', 'pendiente', 'rechazado', 'suspendido'] as const) {
      assert.deepEqual(recepcionAdmisible({ ...base, perfil: { estado } }), { ok: false, motivo: 'perfil_no_aprobado' });
    }
  });

  test('cada mina con su expediente: la mina debe ser del titular del lote', () => {
    assert.deepEqual(recepcionAdmisible({ ...base, mina: { cliente_id: TITULAR_B } }), { ok: false, motivo: 'mina_de_otro_titular' });
    assert.deepEqual(recepcionAdmisible({ ...base, titularId: TITULAR_B }), { ok: false, motivo: 'titular_no_coincide' });
    assert.deepEqual(recepcionAdmisible({ ...base, lote: { cliente_id: TITULAR_A, estado: 'bloqueado' } }), { ok: false, motivo: 'lote_no_disponible' });
    assert.deepEqual(recepcionAdmisible({ ...base, punto: { activo: false } }), { ok: false, motivo: 'punto_inactivo' });
  });

  test('(a) un sobre pertenece a la mina de su recepción', () => {
    assert.deepEqual(sobreAdmisible({ mina_id: u(900), estado: 'registrada' }, u(900)), { ok: true });
    assert.deepEqual(sobreAdmisible({ mina_id: u(900), estado: 'registrada' }, u(901)), { ok: false, motivo: 'sobre_de_otra_mina' });
    assert.deepEqual(sobreAdmisible({ mina_id: u(900), estado: 'anulada' }), { ok: false, motivo: 'recepcion_anulada' });
  });

  test('(b) caja mono-titular: se rechaza la mezcla de los titulares A y B', () => {
    const caja = { titular_cliente_id: TITULAR_A, estado: 'abierta' as const };
    assert.deepEqual(puedeEmpacar(sobre(1, TITULAR_A), caja), { ok: true });
    assert.deepEqual(puedeEmpacar(sobre(2, TITULAR_B), caja), { ok: false, motivo: 'mezcla_de_titulares' });
    assert.deepEqual(puedeCerrarCaja(caja, [sobre(1), sobre(2, TITULAR_B)], { precinto: 'P', manifiestoHash: 'h' }), { ok: false, motivo: 'mezcla_de_titulares' });
    const m = construirManifiesto(CAJA, [sobre(1), sobre(2, TITULAR_B)]);
    assert.deepEqual(m, { ok: false, motivo: 'mezcla_de_titulares', sobres: [u(2)] });
  });

  test('(d) solo entra a una caja un sobre pesado y etiquetado', () => {
    const caja = { titular_cliente_id: TITULAR_A, estado: 'abierta' as const };
    assert.deepEqual(puedeEmpacar(sobre(1, TITULAR_A, { peso_neto_g: null }), caja), { ok: false, motivo: 'sobre_sin_pesar' });
    assert.deepEqual(puedeEmpacar(sobre(1, TITULAR_A, { etiqueta: null }), caja), { ok: false, motivo: 'sobre_sin_etiquetar' });
    assert.deepEqual(puedeEmpacar(sobre(1, TITULAR_A, { numero_sello: ' ' }), caja), { ok: false, motivo: 'sobre_sin_etiquetar' });
    assert.deepEqual(puedeEmpacar(sobre(1, TITULAR_A, { estado: 'anulado' }), caja), { ok: false, motivo: 'sobre_anulado' });
    assert.deepEqual(puedeEmpacar(sobre(1, TITULAR_A, { caja_id: u(3) }), caja), { ok: false, motivo: 'sobre_ya_empacado' });
    assert.deepEqual(puedeEmpacar(sobre(1), { ...caja, estado: 'cerrada' }), { ok: false, motivo: 'caja_no_abierta' });
  });

  test('(c) no se cierra sin manifiesto; (d) ni con sobres incompletos, ni vacía, ni sin precinto', () => {
    const caja = { titular_cliente_id: TITULAR_A, estado: 'abierta' as const };
    assert.deepEqual(puedeCerrarCaja(caja, [sobre(1)], { precinto: 'P', manifiestoHash: null }), { ok: false, motivo: 'sin_manifiesto' });
    assert.deepEqual(puedeCerrarCaja(caja, [sobre(1), sobre(2, TITULAR_A, { peso_neto_g: null })], { precinto: 'P', manifiestoHash: 'h' }), { ok: false, motivo: 'sobres_incompletos' });
    assert.deepEqual(puedeCerrarCaja(caja, [], { precinto: 'P', manifiestoHash: 'h' }), { ok: false, motivo: 'caja_vacia' });
    assert.deepEqual(puedeCerrarCaja(caja, [sobre(1)], { precinto: ' ', manifiestoHash: 'h' }), { ok: false, motivo: 'sin_precinto' });
    assert.deepEqual(puedeCerrarCaja(caja, [sobre(1)], { precinto: 'P', manifiestoHash: 'h' }), { ok: true });
  });

  test('no se envía una caja incompleta: abierta, sin manifiesto o con sobres sin pesar/etiquetar', () => {
    assert.deepEqual(puedeEnviarCaja({ estado: 'abierta', manifiesto_hash: null }, [sobre(1)]), { ok: false, motivo: 'caja_no_cerrada' });
    assert.deepEqual(puedeEnviarCaja({ estado: 'cerrada', manifiesto_hash: null }, [sobre(1)]), { ok: false, motivo: 'sin_manifiesto' });
    assert.deepEqual(puedeEnviarCaja({ estado: 'cerrada', manifiesto_hash: 'h' }, [sobre(1, TITULAR_A, { etiqueta: null })]), { ok: false, motivo: 'sobres_incompletos' });
    assert.deepEqual(puedeEnviarCaja({ estado: 'cerrada', manifiesto_hash: 'h' }, []), { ok: false, motivo: 'caja_vacia' });
    assert.deepEqual(puedeEnviarCaja({ estado: 'cerrada', manifiesto_hash: 'h' }, [sobre(1)]), { ok: true });
    assert.deepEqual(puedeRecibirEnLaboratorio({ estado: 'cerrada' }), { ok: false, motivo: 'caja_no_enviada' });
    assert.deepEqual(puedeRecibirEnLaboratorio({ estado: 'enviada' }), { ok: true });
  });

  test('(f) anulación: exige motivo y no alcanza lo que ya salió en una caja cerrada', () => {
    assert.deepEqual(puedeAnularRecepcion({ estado: 'registrada' }, [{ caja_estado: null }, { caja_estado: 'abierta' }], 'guía equivocada'), { ok: true });
    assert.deepEqual(puedeAnularRecepcion({ estado: 'registrada' }, [], 'no'), { ok: false, motivo: 'motivo_obligatorio' });
    assert.deepEqual(puedeAnularRecepcion({ estado: 'anulada' }, [], 'motivo válido'), { ok: false, motivo: 'ya_anulada' });
    assert.deepEqual(puedeAnularRecepcion({ estado: 'registrada' }, [{ caja_estado: 'enviada' }], 'motivo válido'), { ok: false, motivo: 'sobres_en_caja_cerrada' });
  });
});

describe('manifiesto determinista', () => {
  test('mismo contenido → mismo hash, sin importar el orden ni el formato de los pesos', () => {
    const a = construirManifiesto(CAJA, [sobre(1), sobre(2), sobre(3)]);
    const b = construirManifiesto(CAJA, [sobre(3), sobre(1), sobre(2)]);
    const c = construirManifiesto(CAJA, [sobre(1, TITULAR_A, { peso_neto_g: '101.0' }), sobre(2, TITULAR_A, { peso_neto_g: '102.000' }), sobre(3)]);
    assert.ok(a.ok && b.ok && c.ok);
    if (!(a.ok && b.ok && c.ok)) return;
    assert.equal(a.hash, b.hash);
    assert.equal(a.hash, c.hash);
    assert.equal(a.canonico, b.canonico);
    assert.match(a.hash, /^[0-9a-f]{64}$/);
    assert.equal(a.hash, hashManifiesto(a.canonico));
    assert.equal(a.manifiesto.total_sobres, 3);
    assert.equal(a.manifiesto.peso_total_g, '306.000');
    assert.deepEqual(a.manifiesto.sobres.map((s) => s.peso_neto_g), ['101.000', '102.000', '103.000']);
  });

  test('cualquier cambio de contenido cambia el hash', () => {
    const base = construirManifiesto(CAJA, [sobre(1), sobre(2)]);
    assert.ok(base.ok);
    if (!base.ok) return;
    const variantes = [
      construirManifiesto(CAJA, [sobre(1), sobre(2, TITULAR_A, { peso_neto_g: 102.001 })]),
      construirManifiesto({ ...CAJA, precinto: 'PRE-2' }, [sobre(1), sobre(2)]),
      construirManifiesto(CAJA, [sobre(1)]),
      construirManifiesto(CAJA, [sobre(1), sobre(2, TITULAR_A, { numero_sello: 'SELLO-X' })]),
    ];
    for (const v of variantes) {
      assert.ok(v.ok);
      if (v.ok) assert.notEqual(v.hash, base.hash);
    }
    assert.equal(verificarManifiesto(base.canonico, base.hash), true);
    assert.equal(verificarManifiesto(base.canonico.replace('PRE-1', 'PRE-9'), base.hash), false);
    assert.equal(verificarManifiesto(null, base.hash), false);
  });

  test('suma exacta de pesos (sin error de coma flotante)', () => {
    const m = construirManifiesto(CAJA, [sobre(1, TITULAR_A, { peso_neto_g: 0.1 }), sobre(2, TITULAR_A, { peso_neto_g: 0.2 }), sobre(3, TITULAR_A, { peso_neto_g: '1000000.005' })]);
    assert.ok(m.ok && m.manifiesto.peso_total_g === '1000000.305');
  });

  test('sin precios, montos ni datos personales; rechaza caja vacía, sin precinto o incompleta', () => {
    const m = construirManifiesto(CAJA, [sobre(1)]);
    assert.ok(m.ok);
    if (m.ok) {
      assert.doesNotMatch(m.canonico, /precio|monto|pago|recibo|lempira|nombre|dpi|telefono/i);
      assert.deepEqual(Object.keys(m.manifiesto).sort(), ['caja', 'peso_total_g', 'sobres', 'total_sobres', 'version']);
    }
    assert.deepEqual(construirManifiesto(CAJA, []), { ok: false, motivo: 'caja_vacia' });
    assert.deepEqual(construirManifiesto({ ...CAJA, precinto: ' ' }, [sobre(1)]), { ok: false, motivo: 'sin_precinto' });
    assert.deepEqual(construirManifiesto(CAJA, [sobre(1), sobre(2, TITULAR_A, { peso_neto_g: null })]), { ok: false, motivo: 'sobres_incompletos', sobres: [u(2)] });
  });
});

describe('conciliación contra el manifiesto', () => {
  const man = [{ id: u(1), peso_neto_g: '100.000' }, { id: u(2), peso_neto_g: '200.000' }];
  const rec = (a: string, b?: string) => [{ sobre_id: u(1), peso_g: a }, ...(b === undefined ? [] : [{ sobre_id: u(2), peso_g: b }])];

  test('umbral NULL → nada conciliado, aunque los pesos coincidan exactamente', () => {
    for (const umbral of [null, Number.NaN, -1]) {
      const r = conciliarManifiesto(man, rec('100.000', '200.000'), umbral);
      assert.equal(r.estado, 'umbral_no_configurado');
      assert.equal(r.conciliada, false);
      assert.deepEqual(r.diferencias.map((d) => d.excede), [null, null]);
    }
  });

  test('con un umbral de PRUEBA: conciliada / discrepancia / incompleto', () => {
    assert.equal(conciliarManifiesto(man, rec('99.000', '201.000'), 2).estado, 'conciliada');
    const d = conciliarManifiesto(man, rec('99.000', '190.000'), 2);
    assert.equal(d.estado, 'discrepancia');
    assert.deepEqual(d.diferencias.map((x) => x.excede), [false, true]);
    assert.equal(d.diferencias[1].diferencia_pct, 5);
    const inc = conciliarManifiesto(man, rec('100.000'), 2);
    assert.equal(inc.estado, 'incompleto');
    assert.deepEqual(inc.faltan, [u(2)]);
    // En el límite exacto no excede; el precinto roto es discrepancia aunque los pesos cuadren.
    assert.equal(conciliarManifiesto(man, rec('98.000', '204.000'), 2).estado, 'conciliada');
    assert.equal(conciliarManifiesto(man, rec('100.000', '200.000'), 2, false).estado, 'discrepancia');
  });
});

describe('validadores: lista cerrada, sin pagos ni recibos', () => {
  const recepcion = { punto_id: u(1), lote_id: u(2), mina_id: u(3), modo_entrega: 'dhl', guia: 'GUIA-1' };

  test('modos de entrega y embalaje', () => {
    const ahora = new Date('2026-11-28T16:00:00Z');
    for (const m of ['en_persona', 'encargo_expreso', 'dhl', 'otro']) assert.equal(validarRecepcion({ ...recepcion, modo_entrega: m }, ahora).ok, true);
    assert.equal(validarRecepcion({ ...recepcion, modo_entrega: 'correo' }, ahora).ok, false);
    assert.equal(validarRecepcion({ ...recepcion, estado_embalaje: 'roto' }, ahora).ok, false);
    assert.equal(validarRecepcion({ ...recepcion, fecha_llegada: '2026-11-28T18:00:00Z' }, ahora).ok, false); // futura
    assert.equal(validarRecepcion({ ...recepcion, lote_id: 'x' }, ahora).ok, false);
  });

  test('ningún cuerpo admite campos de monto, medio de pago, precio ni comprobante', () => {
    const prohibidos = ['monto', 'monto_pagado', 'medio_pago', 'precio', 'precio_pagado', 'recibo', 'recibo_compra', 'comprobante', 'factura', 'referencia_bancaria'];
    for (const campo of prohibidos) {
      assert.equal(validarRecepcion({ ...recepcion, [campo]: 1 }).ok, false, `recepción/${campo}`);
      assert.equal(validarSobre({ peso_neto_g: 1, [campo]: 1 }, { permitirCaja: true }).ok, false, `sobre/${campo}`);
      assert.equal(validarCaja({ punto_id: u(1), titular_cliente_id: u(2), laboratorio_org_id: u(3), [campo]: 1 }).ok, false, `caja/${campo}`);
      assert.equal(validarCierre({ precinto: 'P', [campo]: 1 }).ok, false, `cierre/${campo}`);
      assert.equal(validarEnvio({ medio: 'dhl', [campo]: 1 }).ok, false, `envío/${campo}`);
      assert.equal(validarRecepcionLaboratorio({ precinto_integro: true, pesos: [], [campo]: 1 }).ok, false, `laboratorio/${campo}`);
      assert.equal(validarParte({ papel: 'parte_compradora', organizacion_id: u(1), punto_id: u(2), [campo]: 1 }).ok, false, `parte/${campo}`);
    }
  });

  test('sobre: neto ≤ bruto, ley 0–1, etiqueta sin caracteres raros', () => {
    assert.equal(validarSobre({ peso_bruto_g: '10', peso_neto_g: '11' }, { permitirCaja: false }).ok, false);
    assert.equal(validarSobre({ ley_fino: 1.2 }, { permitirCaja: false }).ok, false);
    assert.equal(validarSobre({ etiqueta: 'ETQ 1; drop' }, { permitirCaja: false }).ok, false);
    assert.equal(validarSobre({ caja_id: u(1) }, { permitirCaja: false }).ok, false);
    const ok = validarSobre({ peso_bruto_g: '10.5', peso_neto_g: '10.25', ley_fino: '0.9', etiqueta: 'ETQ-1', numero_sello: 'SELLO-1', caja_id: u(1) }, { permitirCaja: true });
    assert.ok(ok.ok && ok.data.peso_neto_g === 10.25 && ok.data.caja_id === u(1));
  });

  test('recepción en laboratorio: pesos normalizados, sin sobres repetidos', () => {
    const ok = validarRecepcionLaboratorio({ precinto_integro: true, pesos: [{ sobre_id: u(1), peso_g: '100.2' }] });
    assert.ok(ok.ok && ok.data.pesos[0].peso_g === '100.200');
    assert.equal(validarRecepcionLaboratorio({ precinto_integro: true, pesos: [{ sobre_id: u(1), peso_g: 1 }, { sobre_id: u(1), peso_g: 2 }] }).ok, false);
    assert.equal(validarRecepcionLaboratorio({ precinto_integro: 'si', pesos: [] }).ok, false);
    assert.equal(validarRecepcionLaboratorio({ precinto_integro: true, pesos: [{ sobre_id: u(1), peso_g: -1 }] }).ok, false);
  });

  test('partes del flujo: papeles configurables, por lote o por punto (uno solo)', () => {
    assert.deepEqual([...PAPELES_FLUJO], ['operador_recepcion', 'parte_compradora', 'laboratorio_destino']);
    assert.equal(validarParte({ papel: 'operador_recepcion', organizacion_id: u(1), punto_id: u(2) }).ok, true);
    assert.equal(validarParte({ papel: 'parte_compradora', organizacion_id: u(1), lote_id: u(2) }).ok, true);
    assert.equal(validarParte({ papel: 'parte_compradora', organizacion_id: u(1), lote_id: u(2), punto_id: u(3) }).ok, false);
    assert.equal(validarParte({ papel: 'parte_compradora', organizacion_id: u(1) }).ok, false);
    assert.equal(validarParte({ papel: 'pagador', organizacion_id: u(1), punto_id: u(2) }).ok, false);
  });

  test('códigos correlativos', () => {
    assert.equal(generarCodigo('REC', [], 2026), 'REC-2026-0001');
    assert.equal(generarCodigo('REC', ['REC-2026-0009', 'REC-2026-0999', 'REC-2025-5000', null], 2026), 'REC-2026-1000');
  });
});

describe('matriz de permisos: recepción / verificador / cliente', () => {
  const RUTAS: Array<[string, string, string[]]> = [
    ['app/api/recepcion/recepciones/route.ts', 'POST', ['admin', 'recepcion']],
    ['app/api/recepcion/recepciones/[id]/sobres/route.ts', 'POST', ['admin', 'recepcion']],
    ['app/api/recepcion/recepciones/[id]/anular/route.ts', 'POST', ['admin', 'recepcion']],
    ['app/api/recepcion/sobres/[id]/route.ts', 'PATCH', ['admin', 'recepcion']],
    ['app/api/recepcion/cajas/route.ts', 'POST', ['admin', 'recepcion']],
    ['app/api/recepcion/cajas/[id]/cerrar/route.ts', 'POST', ['admin', 'recepcion']],
    ['app/api/recepcion/cajas/[id]/envio/route.ts', 'POST', ['admin', 'recepcion']],
    ['app/api/recepcion/cajas/[id]/laboratorio/route.ts', 'POST', ['admin', 'recepcion']],
    ['app/api/recepcion/puntos/route.ts', 'POST', ['admin']],
    ['app/api/recepcion/partes/route.ts', 'POST', ['admin']],
  ];

  test('escritura: solo recepcion y admin; el verificador y los externos no', () => {
    for (const [ruta, metodo, esperado] of RUTAS) {
      const g = guardasDeRuta(ruta).find((x) => x.metodo === metodo);
      assert.ok(g?.encontrada, `${ruta} ${metodo}: sin guarda`);
      assert.deepEqual(g!.roles, [...esperado].sort(), `${ruta} ${metodo}`);
    }
  });

  test('lectura: todo el personal; ningún usuario externo', () => {
    for (const ruta of ['app/api/recepcion/recepciones/route.ts', 'app/api/recepcion/recepciones/[id]/route.ts', 'app/api/recepcion/cajas/route.ts', 'app/api/recepcion/cajas/[id]/route.ts', 'app/api/recepcion/puntos/route.ts', 'app/api/recepcion/partes/route.ts']) {
      const g = guardasDeRuta(ruta).find((x) => x.metodo === 'GET');
      assert.deepEqual(g?.roles, ['abogado', 'admin', 'recepcion', 'tecnico_ambiental', 'verificador'], ruta);
      for (const r of ROLES_EXTERNOS) assert.ok(!g!.roles.includes(r));
    }
  });

  test('predicados', () => {
    assert.equal(puede('recepcion', 'recepcion:registrar'), true);
    assert.equal(puede('verificador', 'recepcion:registrar'), false);
    assert.equal(puede('verificador', 'recepcion:ver'), true);
    assert.equal(puede('cliente', 'recepcion:ver'), false);
    assert.equal(puede('comercializador', 'recepcion:registrar'), false);
    assert.equal(puede('planta', 'laboratorio:recibir'), false);
  });
});

describe('alcance: sin pagos, sin fundición, sin nombres de empresas', () => {
  const archivos = (dir: string): string[] => readdirSync(join(ROOT, dir)).flatMap((n) => {
    const rel = join(dir, n);
    return statSync(join(ROOT, rel)).isDirectory() ? archivos(rel) : [rel];
  });
  const NUEVOS = [...archivos('lib/recepcion'), ...archivos('app/api/recepcion'), ...archivos('app/dashboard/recepcion'), ...archivos('components/recepcion')];

  test('el flujo nuevo no usa pagos_lote, registrar_pago_lote, MEDIOS_PAGO ni los eventos pago/fundicion/refinado', () => {
    assert.ok(NUEVOS.length >= 20);
    for (const f of NUEVOS) {
      const src = readFileSync(join(ROOT, f), 'utf8');
      assert.doesNotMatch(src, /pagos_lote|registrar_pago_lote|MEDIOS_PAGO|MedioPago|monto_lps|fmtLps/, f);
      assert.doesNotMatch(src, /'(pago|fundicion|refinado)'/, f);
    }
  });

  test('ningún texto dice que CHT compra, vende, paga o recibe en propiedad; ninguna empresa nombrada', () => {
    for (const f of NUEVOS) {
      const src = readFileSync(join(ROOT, f), 'utf8');
      assert.doesNotMatch(src, /\bCHT\s+(compra|vende|paga|recibe)|recibe en propiedad|precio pagado|recibo de compra/i, f);
      assert.doesNotMatch(src, /zekaii|chiopa|liopa|alfilo|\bCKI\b/i, f);
    }
  });

  test('migración 047: sin tablas ni columnas de pago; no toca pagos_lote, fundicion ni refinado', () => {
    // Se quitan los `comment on …` (que dicen justamente "sin montos") para
    // mirar solo definiciones: tablas, columnas, funciones y policies.
    const sql = sinComentarios(leerMigracion('047_recepcion_custodia.sql')).replace(/comment on (table|column|function)[\s\S]*?';/g, '');
    assert.doesNotMatch(sql, /monto|precio|recibo|medio_pago|lempira/i);
    assert.doesNotMatch(sql, /pagos_lote|registrar_pago_lote|margenes_comercializador/);
    assert.doesNotMatch(sql, /zekaii|chiopa|liopa|alfilo/i);
    // Los tres tipos de la 043 siguen en el CHECK (no se retiran) y nada más los menciona.
    assert.equal((sql.match(/'fundicion'/g) ?? []).length, 1);
    assert.equal((sql.match(/'refinado'/g) ?? []).length, 1);
    assert.equal((sql.match(/'pago'/g) ?? []).length, 1);
    // El canónico y el trigger de encadenado de la 043 no se redefinen.
    assert.doesNotMatch(sql, /function public\.(canonico_evento|fn_lote_evento_encadenar|jsonb_canonico|sha256_hex)\b/);
  });
});

describe('migración 047 (estática)', () => {
  test('cabecera, RLS, search_path y append-only', () => {
    verificarMigracion('047_recepcion_custodia.sql', { appendOnly: ['envios_laboratorio', 'recepciones_laboratorio'] });
  });

  test('ningún rol autenticado recibe INSERT/UPDATE: toda la carga pasa por la API', () => {
    const sql = sinComentarios(leerMigracion('047_recepcion_custodia.sql'));
    assert.doesNotMatch(sql, /grant [a-z, ]*(insert|update|delete)[a-z, ]* on table public\.[a-z_]+ to authenticated/);
    assert.doesNotMatch(sql, /for (insert|update|delete|all) to authenticated/);
    for (const t of ['recepciones', 'sobres', 'cajas', 'puntos_recepcion', 'partes_flujo']) {
      assert.match(sql, new RegExp(`revoke delete, truncate on table public\\.${t} from anon, authenticated, service_role`), t);
    }
    for (const f of ['cerrar_caja', 'registrar_envio_laboratorio', 'registrar_recepcion_laboratorio', 'anular_recepcion']) {
      assert.match(sql, new RegExp(`grant execute on function public\\.${f}\\([^)]*\\) to service_role`), f);
    }
  });
});
