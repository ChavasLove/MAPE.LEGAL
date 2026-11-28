// tests/perfiles.test.ts — Fase 3: estados del perfil, validación de carga,
// expediente de solo lectura, cierre de escritura para usuarios externos y
// verificación estática de la migración 046.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  ESTADOS_PERFIL, estadoInicial, estadoTrasEdicion, hashContenidoPerfil, perfilHabilitado, puedeOriginarLote,
  puedeTransicionarCarga, validarDecision, type EstadoPerfil,
} from '@/lib/perfiles/estados';
import { validarPerfilCrear, validarPerfilEditar } from '@/lib/perfiles/validacion';
import { armarVistaExpediente, type VistaExpediente } from '@/lib/expediente/vista';
import { leerMigracion, verificarMigracion } from '@/tests/migraciones-estaticas';
import { guardasDeRuta, ROLES_EXTERNOS } from '@/tests/guardas-rutas';

const UUID_A = 'c0000000-0000-4000-8000-000000000001';
const UUID_B = 'c0000000-0000-4000-8000-000000000002';

describe('máquina de estados del perfil', () => {
  test('nace pendiente (o borrador); nunca aprobado', () => {
    assert.equal(estadoInicial(undefined), 'pendiente');
    assert.equal(estadoInicial('borrador'), 'borrador');
    for (const pedido of ['aprobado', 'rechazado', 'suspendido', 'cualquiera', 42]) assert.equal(estadoInicial(pedido), 'pendiente');
  });

  test('decisiones válidas e inválidas', () => {
    assert.deepEqual(validarDecision('pendiente', 'aprobado', null), { ok: true, estado: 'aprobado' });
    assert.deepEqual(validarDecision('pendiente', 'rechazado', 'falta el documento X'), { ok: true, estado: 'rechazado' });
    assert.deepEqual(validarDecision('aprobado', 'suspendido', 'permiso vencido'), { ok: true, estado: 'suspendido' });
    assert.deepEqual(validarDecision('pendiente', 'rechazado', ''), { ok: false, motivo: 'motivo_obligatorio' });
    assert.deepEqual(validarDecision('pendiente', 'rechazado', 'no'), { ok: false, motivo: 'motivo_obligatorio' });
    assert.deepEqual(validarDecision('aprobado', 'suspendido', null), { ok: false, motivo: 'motivo_obligatorio' });
    assert.deepEqual(validarDecision('pendiente', 'publicado', null), { ok: false, motivo: 'decision_invalida' });
    const invalidas: Array<[EstadoPerfil, string]> = [
      ['borrador', 'aprobado'], ['borrador', 'rechazado'], ['aprobado', 'aprobado'], ['aprobado', 'rechazado'],
      ['rechazado', 'aprobado'], ['suspendido', 'aprobado'], ['pendiente', 'suspendido'], ['rechazado', 'suspendido'],
    ];
    for (const [de, a] of invalidas) assert.deepEqual(validarDecision(de, a, 'motivo suficiente'), { ok: false, motivo: 'transicion_invalida' }, `${de}→${a}`);
  });

  test('transiciones de carga: solo hacia pendiente; nadie se auto-aprueba', () => {
    assert.equal(puedeTransicionarCarga('borrador', 'pendiente'), true);
    assert.equal(puedeTransicionarCarga('rechazado', 'pendiente'), true);
    assert.equal(puedeTransicionarCarga('suspendido', 'pendiente'), true);
    for (const de of ESTADOS_PERFIL) {
      for (const a of ['aprobado', 'rechazado', 'suspendido'] as EstadoPerfil[]) assert.equal(puedeTransicionarCarga(de, a), false, `${de}→${a}`);
    }
  });

  test('editar lo decidido lo devuelve a pendiente', () => {
    assert.equal(estadoTrasEdicion('aprobado'), 'pendiente');
    assert.equal(estadoTrasEdicion('rechazado'), 'pendiente');
    assert.equal(estadoTrasEdicion('suspendido'), 'pendiente');
    assert.equal(estadoTrasEdicion('borrador'), 'borrador');
  });

  test('solo un perfil aprobado origina un lote', () => {
    assert.deepEqual(puedeOriginarLote(null), { ok: false, motivo: 'sin_perfil' });
    for (const e of ESTADOS_PERFIL) {
      const r = puedeOriginarLote({ estado: e });
      assert.equal(r.ok, e === 'aprobado', e);
      assert.equal(perfilHabilitado({ estado: e }), e === 'aprobado');
    }
  });

  test('huella de la versión: determinista e independiente del orden de las claves', () => {
    const a = hashContenidoPerfil({ municipio: 'Iriona', nombre_legal: 'Titular A' });
    assert.match(a, /^[0-9a-f]{64}$/);
    assert.equal(a, hashContenidoPerfil({ nombre_legal: 'Titular A', municipio: 'Iriona' }));
    assert.notEqual(a, hashContenidoPerfil({ nombre_legal: 'Titular A', municipio: 'Iriona ' }));
  });
});

describe('validación de la carga de perfiles', () => {
  test('lista cerrada de campos; sin datos de pago ni identidad', () => {
    const ok = validarPerfilCrear({ tipo: 'minero', cliente_id: UUID_A, contenido: { nombre_legal: ' Titular A ', municipio: 'Iriona' } });
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.deepEqual(ok.data.contenido, { nombre_legal: 'Titular A', municipio: 'Iriona' });
      assert.equal(ok.data.estado, 'pendiente');
    }
    for (const campo of ['monto_pagado', 'medio_pago', 'recibo', 'precio', 'dpi', 'telefono', 'cuenta_bancaria']) {
      const r = validarPerfilCrear({ tipo: 'minero', cliente_id: UUID_A, contenido: { [campo]: 'x' } });
      assert.equal(r.ok, false, campo);
    }
  });

  test('el estado del body nunca produce un perfil aprobado', () => {
    const r = validarPerfilCrear({ tipo: 'minero', cliente_id: UUID_A, estado: 'aprobado' });
    assert.ok(r.ok && r.data.estado === 'pendiente');
  });

  test('sujeto coherente con el tipo', () => {
    assert.equal(validarPerfilCrear({ tipo: 'minero', organizacion_id: UUID_A }).ok, false);
    assert.equal(validarPerfilCrear({ tipo: 'organizacion', cliente_id: UUID_A }).ok, false);
    assert.equal(validarPerfilCrear({ tipo: 'organizacion', organizacion_id: UUID_A }).ok, true);
    assert.equal(validarPerfilCrear({ tipo: 'empresa', cliente_id: UUID_A }).ok, false);
  });

  test('edición: solo contenido, documentos y envío a revisión', () => {
    assert.equal(validarPerfilEditar('minero', { estado: 'aprobado' }).ok, false);
    assert.equal(validarPerfilEditar('minero', { creado_por: UUID_B }).ok, false);
    assert.equal(validarPerfilEditar('minero', {}).ok, false);
    assert.equal(validarPerfilEditar('minero', { contenido: { municipio: 'Tocoa' } }).ok, true);
    assert.equal(validarPerfilEditar('minero', { documentos_respaldo: ['no-uuid'] }).ok, false);
  });
});

describe('expediente de solo lectura', () => {
  const base = {
    titularId: UUID_A,
    perfil: { id: 'p1', cliente_id: UUID_A, estado: 'aprobado', version: 2, updated_at: '2026-11-28T00:00:00Z' },
    minas: [
      { id: 'm1', cliente_id: UUID_A, nombre: 'Mina A', codigo: 'MINA-A', numero_expediente_inhgeomin: 'INTERNO-1', notas: 'nota interna' },
      { id: 'm2', cliente_id: UUID_B, nombre: 'Mina B' },
    ],
    licencias: [
      { id: 'l1', mina_id: 'm1', tipo: 'permiso_municipal', estado: 'vigente', numero: 'PM-1' },
      { id: 'l2', mina_id: 'm2', tipo: 'licencia_ambiental', estado: 'vigente' },
    ],
    expedientes: [
      { id: 'e1', cliente_id: UUID_A, numero_expediente: 'EXP-2026-0001', notas: 'interno', cliente: 'Nombre Completo' },
      { id: 'e2', cliente_id: UUID_B, numero_expediente: 'EXP-2026-0002' },
    ],
    documentos: [
      { id: 'd1', expediente_id: 'e1', nombre: 'Escritura', ruta_storage: 'privado/x.pdf' },
      { id: 'd2', expediente_id: 'e2', nombre: 'Documento ajeno' },
    ],
    respaldos: [
      { documento_id: 'd1', version: 1, sha256: 'a'.repeat(64), vigente: false },
      { documento_id: 'd2', version: 1, sha256: 'b'.repeat(64), vigente: true },
    ],
  };

  test('no mezcla titulares: lo ajeno se descarta y se cuenta', () => {
    const v = armarVistaExpediente(base);
    assert.deepEqual(v.minas.map((m) => m.id), ['m1']);
    assert.deepEqual(v.minas[0].licencias.map((l) => l.numero), ['PM-1']);
    assert.deepEqual(v.tramites.map((t) => t.id), ['e1']);
    assert.deepEqual(v.tramites[0].documentos.map((d) => d.id), ['d1']);
    assert.equal(v.descartados, 4);
    assert.ok(!JSON.stringify(v).includes('ajeno') && !JSON.stringify(v).includes('Mina B'));
  });

  test('lista cerrada: no salen llaves internas, notas, rutas ni nombres', () => {
    const texto = JSON.stringify(armarVistaExpediente(base));
    for (const prohibido of ['INTERNO-1', 'nota interna', 'privado/x.pdf', 'Nombre Completo', 'numero_expediente_inhgeomin', 'ruta_storage', 'notas']) {
      assert.ok(!texto.includes(prohibido), prohibido);
    }
  });

  test('documento sin respaldo vigente → "en implementación"; con respaldo → versión y huella', () => {
    const v = armarVistaExpediente(base);
    assert.deepEqual(v.tramites[0].documentos[0].respaldo, { estado: 'en_implementacion' });
    const con = armarVistaExpediente({ ...base, respaldos: [{ documento_id: 'd1', version: 3, sha256: 'c'.repeat(64), vigente: true }] });
    assert.deepEqual(con.tramites[0].documentos[0].respaldo, { estado: 'respaldado', version: 3, huella: 'c'.repeat(64) });
  });

  test('un perfil de otro titular no se muestra', () => {
    const v: VistaExpediente = armarVistaExpediente({ ...base, perfil: { ...base.perfil, cliente_id: UUID_B } });
    assert.equal(v.perfil, null);
    assert.equal(v.solo_lectura, true);
  });
});

describe('usuarios externos: cero escritura (guardas de ruta)', () => {
  const sinExternos = (ruta: string, metodos: string[]) => {
    const guardas = guardasDeRuta(ruta).filter((g) => metodos.includes(g.metodo));
    assert.equal(guardas.length, metodos.length, `${ruta}: faltan handlers ${metodos.join(',')}`);
    for (const g of guardas) {
      assert.ok(g.encontrada, `${ruta} ${g.metodo}: sin guarda de rol`);
      assert.ok(g.roles.length > 0, `${ruta} ${g.metodo}: guarda sin roles`);
      for (const r of ROLES_EXTERNOS) assert.ok(!g.roles.includes(r), `${ruta} ${g.metodo}: admite a ${r}`);
    }
  };

  test('regresión: /api/expedientes y /api/documentos rechazan (403) la escritura de cliente', () => {
    sinExternos('app/api/expedientes/route.ts', ['POST']);
    sinExternos('app/api/expedientes/[id]/transition/route.ts', ['POST']);
    sinExternos('app/api/documentos/[id]/route.ts', ['PATCH']);
  });

  test('perfiles y decisiones: solo personal', () => {
    sinExternos('app/api/perfiles/route.ts', ['GET', 'POST']);
    sinExternos('app/api/perfiles/[id]/route.ts', ['GET', 'PATCH']);
    sinExternos('app/api/perfiles/[id]/decidir/route.ts', ['POST']);
  });

  test('consentimientos: los registra y los revoca el personal — el titular ya no', () => {
    sinExternos('app/api/cadena/consentimientos/route.ts', ['POST']);
    sinExternos('app/api/cadena/consentimientos/[id]/revocar/route.ts', ['POST']);
  });

  test('cliente no escribe en ninguna ruta de la cadena', () => {
    for (const ruta of [
      'app/api/cadena/fuentes/route.ts', 'app/api/cadena/lotes/route.ts', 'app/api/cadena/lotes/[id]/eventos/route.ts',
      'app/api/cadena/lotes/[id]/pagos/route.ts', 'app/api/cadena/lotes/[id]/conciliar/route.ts', 'app/api/cadena/organizaciones/route.ts',
    ]) {
      for (const g of guardasDeRuta(ruta).filter((x) => x.metodo !== 'GET')) {
        assert.ok(g.encontrada, ruta);
        assert.ok(!g.roles.includes('cliente') && !g.roles.includes('auditor'), `${ruta} ${g.metodo}`);
      }
    }
  });

  test('el portal del titular solo expone lectura; el registro directo está cerrado', async () => {
    const g = guardasDeRuta('app/api/portal/expediente/route.ts');
    assert.deepEqual(g.map((x) => x.metodo), ['GET']);
    assert.deepEqual(g[0].roles, ['cliente']);
    const { POST } = await import('@/app/api/auth/register/route');
    const res = await POST();
    assert.equal(res.status, 410);
    assert.equal((await res.json()).code, 'REGISTRO_CERRADO');
  });

  test('las páginas del portal no tienen formularios de carga ni subidas', async () => {
    const { readFileSync } = await import('node:fs');
    for (const f of ['app/portal/page.tsx', 'app/portal/lotes/PortalLotesClient.tsx', 'app/expedientes/page.tsx']) {
      const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
      assert.doesNotMatch(src, /<input|<textarea|<select|type="file"|method:\s*'(POST|PATCH|PUT|DELETE)'|<form/, f);
    }
  });
});

describe('migración 046 (estática)', () => {
  test('cabecera, RLS, search_path y append-only', () => {
    verificarMigracion('046_perfiles_aprobacion.sql', { appendOnly: ['aprobaciones_perfil'] });
  });

  test('ningún rol externo recibe escritura; perfiles sin DELETE', () => {
    const sql = leerMigracion('046_perfiles_aprobacion.sql');
    for (const m of sql.matchAll(/create policy ([a-z0-9_]+) on public\.[a-z0-9_]+\s+for (insert|update|all) to authenticated([\s\S]*?);/g)) {
      assert.doesNotMatch(m[3], /'cliente'|'comercializador'|'planta'|'auditor'/, `policy ${m[1]} concede escritura a un rol externo`);
      assert.match(m[3], /'admin', 'abogado', 'tecnico_ambiental', 'recepcion'/, `policy ${m[1]} sin lista de personal`);
    }
    assert.match(sql, /revoke delete, truncate on table public\.perfiles from anon, authenticated, service_role/);
    assert.match(sql, /grant execute on function public\.decidir_perfil\(uuid, text, text, uuid\) to service_role/);
  });
});
