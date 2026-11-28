// tests/organizaciones.test.ts — Fase 5: tipos de organización, membresías,
// invitaciones, aislamiento entre organizaciones y migración 048.
// Las mismas reglas se prueban contra PostgreSQL en tests/rls-reestructura.test.ts.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TIPOS_ORGANIZACION } from '@/lib/cadena/types';
import { validarBodyOrganizacion } from '@/lib/cadena/validacion';
import {
  lotesVisiblesParaOrganizacion, membresiasVisibles, papelAdmitidoParaTipo, representaOrganizacion, validarMembresiaAlta,
  validarTransicionMembresia, type PertenenciaUsuario,
} from '@/lib/organizaciones/membresias';
import {
  INVITACION_VIGENCIA_MS, esTokenBienFormado, evaluarInvitacion, generarTokenInvitacion, hashTokenInvitacion, validarInvitacion, venceEn,
} from '@/lib/organizaciones/invitaciones';
import { leerMigracion, sinComentarios, verificarMigracion } from '@/tests/migraciones-estaticas';
import { guardasDeRuta, ROLES_EXTERNOS } from '@/tests/guardas-rutas';

const ORG_A = 'b0000000-0000-4000-8000-00000000000a';
const ORG_B = 'b0000000-0000-4000-8000-00000000000b';
const u = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('tipos de organización', () => {
  test('una sola entidad: los tipos nuevos se SUMAN a los operativos', () => {
    assert.deepEqual([...TIPOS_ORGANIZACION], ['comercializador', 'planta', 'auditor', 'laboratorio', 'centro_acopio', 'cooperativa', 'municipio', 'otro']);
    for (const tipo of ['cooperativa', 'municipio', 'otro', 'laboratorio', 'centro_acopio', 'comercializador']) {
      assert.equal(validarBodyOrganizacion({ tipo, nombre: 'Organización de prueba' }).ok, true, tipo);
    }
    assert.equal(validarBodyOrganizacion({ tipo: 'empresa', nombre: 'X' }).ok, false);
  });

  test('un municipio no es parte compradora; el destino es un laboratorio', () => {
    assert.equal(papelAdmitidoParaTipo('municipio', 'parte_compradora'), false);
    assert.equal(papelAdmitidoParaTipo('municipio', 'operador_recepcion'), true);
    assert.equal(papelAdmitidoParaTipo('cooperativa', 'parte_compradora'), true);
    assert.equal(papelAdmitidoParaTipo('cooperativa', 'laboratorio_destino'), false);
    assert.equal(papelAdmitidoParaTipo('laboratorio', 'laboratorio_destino'), true);
  });
});

describe('membresías', () => {
  const base = { actorId: u(2), altaPor: u(1) };

  test('alta: un solo sujeto, papel de lista cerrada, sin campos extra', () => {
    assert.equal(validarMembresiaAlta({ perfil_id: u(9) }).ok, true);
    assert.equal(validarMembresiaAlta({ user_id: u(9), rol_en_organizacion: 'representante' }).ok, true);
    assert.equal(validarMembresiaAlta({ perfil_id: u(9), user_id: u(8) }).ok, false);
    assert.equal(validarMembresiaAlta({}).ok, false);
    assert.equal(validarMembresiaAlta({ perfil_id: u(9), rol_en_organizacion: 'dueño' }).ok, false);
    assert.equal(validarMembresiaAlta({ perfil_id: u(9), estado: 'activa' }).ok, false); // no se puede pedir activa
  });

  test('transiciones válidas', () => {
    assert.deepEqual(validarTransicionMembresia({ ...base, de: 'pendiente', a: 'activa', actorRol: 'verificador' }), { ok: true });
    assert.deepEqual(validarTransicionMembresia({ ...base, de: 'pendiente', a: 'activa', actorRol: 'admin' }), { ok: true });
    assert.deepEqual(validarTransicionMembresia({ ...base, de: 'pendiente', a: 'baja', actorRol: 'abogado', motivo: 'alta por error' }), { ok: true });
    assert.deepEqual(validarTransicionMembresia({ ...base, de: 'activa', a: 'baja', actorRol: 'abogado', motivo: 'solicitud de salida' }), { ok: true });
  });

  test('transiciones inválidas', () => {
    assert.deepEqual(validarTransicionMembresia({ ...base, de: 'pendiente', a: 'activa', actorRol: 'recepcion' }), { ok: false, motivo: 'activacion_no_autorizada' });
    assert.deepEqual(validarTransicionMembresia({ ...base, de: 'pendiente', a: 'activa', actorRol: 'abogado' }), { ok: false, motivo: 'activacion_no_autorizada' });
    assert.deepEqual(validarTransicionMembresia({ actorId: u(1), altaPor: u(1), de: 'pendiente', a: 'activa', actorRol: 'admin' }), { ok: false, motivo: 'separacion_de_funciones' });
    assert.deepEqual(validarTransicionMembresia({ ...base, de: 'activa', a: 'baja', actorRol: 'abogado', motivo: 'no' }), { ok: false, motivo: 'motivo_obligatorio' });
    for (const [de, a] of [['baja', 'activa'], ['baja', 'pendiente'], ['activa', 'pendiente'], ['activa', 'activa'], ['baja', 'baja']] as const) {
      assert.deepEqual(validarTransicionMembresia({ ...base, de, a, actorRol: 'admin', motivo: 'motivo suficiente' }), { ok: false, motivo: 'transicion_invalida' }, `${de}→${a}`);
    }
  });
});

describe('aislamiento entre organizaciones', () => {
  const todas = [
    { id: 'm1', organizacion_id: ORG_A, perfil_id: 'pA', user_id: null, rol_en_organizacion: 'representante' as const, estado: 'activa' as const },
    { id: 'm2', organizacion_id: ORG_A, perfil_id: 'pA2', user_id: null, rol_en_organizacion: 'miembro' as const, estado: 'activa' as const },
    { id: 'm3', organizacion_id: ORG_B, perfil_id: 'pB', user_id: null, rol_en_organizacion: 'representante' as const, estado: 'activa' as const },
    { id: 'm4', organizacion_id: ORG_B, perfil_id: null, user_id: u(5), rol_en_organizacion: 'miembro' as const, estado: 'activa' as const },
  ];
  const de = (perfilId: string | null, userId: string, mias: string[]): PertenenciaUsuario => ({ userId, perfilId, membresias: todas.filter((m) => mias.includes(m.id)) });

  test('el representante de A ve los miembros de A y NINGUNO de B', () => {
    const p = de('pA', u(1), ['m1']);
    assert.equal(representaOrganizacion(p, ORG_A), true);
    assert.equal(representaOrganizacion(p, ORG_B), false);
    assert.deepEqual(membresiasVisibles(p, todas).map((m) => m.id), ['m1', 'm2']);
  });

  test('un miembro raso ve solo su propia pertenencia', () => {
    assert.deepEqual(membresiasVisibles(de('pA2', u(2), ['m2']), todas).map((m) => m.id), ['m2']);
    assert.deepEqual(membresiasVisibles(de(null, u(5), ['m4']), todas).map((m) => m.id), ['m4']);
  });

  test('una membresía pendiente o de baja no da vista de la organización', () => {
    for (const estado of ['pendiente', 'baja'] as const) {
      const p: PertenenciaUsuario = { userId: u(1), perfilId: 'pA', membresias: [{ ...todas[0], estado }] };
      assert.equal(representaOrganizacion(p, ORG_A), false);
      assert.deepEqual(membresiasVisibles(p, todas).map((m) => m.id), ['m1']);
    }
  });

  test('quien no pertenece a nada no ve nada', () => {
    assert.deepEqual(membresiasVisibles({ userId: u(99), perfilId: null, membresias: [] }, todas), []);
  });

  test('lotes de miembros: solo con membresía activa Y consentimiento vigente con alcance "lotes" a ESA organización', () => {
    const lotes = [{ id: 'l1', cliente_id: 'c1' }, { id: 'l2', cliente_id: 'c2' }, { id: 'l3', cliente_id: 'c3' }, { id: 'l4', cliente_id: 'c4' }];
    const r = lotesVisiblesParaOrganizacion({
      organizacionId: ORG_A,
      lotes,
      titularesActivos: ['c1', 'c2', 'c3'],
      consentimientos: [
        { cliente_id: 'c1', otorgado_a_org_id: ORG_A, estado: 'vigente', alcance: { lotes: true } },
        { cliente_id: 'c2', otorgado_a_org_id: ORG_A, estado: 'revocado', alcance: { lotes: true } },
        { cliente_id: 'c3', otorgado_a_org_id: ORG_B, estado: 'vigente', alcance: { lotes: true } },
        { cliente_id: 'c4', otorgado_a_org_id: ORG_A, estado: 'vigente', alcance: { lotes: true } }, // no es miembro activo
        { cliente_id: 'c2', otorgado_a_org_id: ORG_A, estado: 'vigente', alcance: { expediente: true } }, // otro alcance
      ],
    });
    assert.deepEqual(r.map((l) => l.id), ['l1']);
    assert.deepEqual(lotesVisiblesParaOrganizacion({ organizacionId: ORG_A, lotes, titularesActivos: ['c1'], consentimientos: [] }), []);
  });
});

describe('invitaciones', () => {
  const ahora = new Date('2026-11-28T15:00:00Z');
  const inv = { estado: 'pendiente' as const, expira_en: venceEn(ahora), correo: 'Invitado@Ejemplo.test' };

  test('token aleatorio de 256 bits; en la base solo viaja su hash', () => {
    const a = generarTokenInvitacion();
    const b = generarTokenInvitacion();
    assert.ok(esTokenBienFormado(a.token));
    assert.notEqual(a.token, b.token);
    assert.match(a.hash, /^[0-9a-f]{64}$/);
    assert.equal(a.hash, hashTokenInvitacion(a.token));
    assert.ok(!a.hash.includes(a.token));
    assert.equal(esTokenBienFormado('corto'), false);
    assert.equal(esTokenBienFormado(123), false);
  });

  test('vigente y para la cuenta correcta → se puede aceptar', () => {
    assert.deepEqual(evaluarInvitacion(inv, ahora, 'invitado@ejemplo.test'), { ok: true });
    assert.equal(Date.parse(inv.expira_en) - ahora.getTime(), INVITACION_VIGENCIA_MS);
  });

  test('expirada, reusada (ya aceptada), revocada, inexistente o de otra cuenta → rechazada', () => {
    assert.deepEqual(evaluarInvitacion(inv, new Date(Date.parse(inv.expira_en)), 'invitado@ejemplo.test'), { ok: false, motivo: 'expirada' });
    assert.deepEqual(evaluarInvitacion({ ...inv, estado: 'aceptada' }, ahora, 'invitado@ejemplo.test'), { ok: false, motivo: 'ya_aceptada' });
    assert.deepEqual(evaluarInvitacion({ ...inv, estado: 'expirada' }, ahora, 'invitado@ejemplo.test'), { ok: false, motivo: 'expirada' });
    assert.deepEqual(evaluarInvitacion({ ...inv, estado: 'revocada' }, ahora, 'invitado@ejemplo.test'), { ok: false, motivo: 'revocada' });
    assert.deepEqual(evaluarInvitacion(null, ahora, 'invitado@ejemplo.test'), { ok: false, motivo: 'invitacion_invalida' });
    assert.deepEqual(evaluarInvitacion(inv, ahora, 'otro@ejemplo.test'), { ok: false, motivo: 'correo_no_coincide' });
    assert.deepEqual(evaluarInvitacion(inv, ahora, null), { ok: false, motivo: 'correo_no_coincide' });
  });

  test('emisión: correo válido y papel de lista cerrada', () => {
    const ok = validarInvitacion({ correo: ' Alguien@Ejemplo.TEST ' });
    assert.ok(ok.ok && ok.data.correo === 'alguien@ejemplo.test' && ok.data.rol_en_organizacion === 'miembro');
    assert.equal(validarInvitacion({ correo: 'no' }).ok, false);
    assert.equal(validarInvitacion({ correo: 'a@b.test', rol_en_organizacion: 'admin' }).ok, false);
    assert.equal(validarInvitacion({ correo: 'a@b.test', permisos: ['escribir'] }).ok, false);
  });
});

describe('matriz de permisos', () => {
  test('altas, bajas, activaciones e invitaciones: solo personal', () => {
    const esperar = (ruta: string, metodo: string, roles: string[]) => {
      const g = guardasDeRuta(ruta).find((x) => x.metodo === metodo);
      assert.ok(g?.encontrada, `${ruta} ${metodo}`);
      assert.deepEqual(g!.roles, [...roles].sort(), `${ruta} ${metodo}`);
    };
    esperar('app/api/organizaciones/[id]/membresias/route.ts', 'POST', ['abogado', 'admin']);
    esperar('app/api/organizaciones/[id]/invitaciones/route.ts', 'POST', ['abogado', 'admin']);
    esperar('app/api/organizaciones/membresias/[id]/route.ts', 'PATCH', ['abogado', 'admin', 'verificador']);
    for (const ruta of ['app/api/organizaciones/route.ts', 'app/api/organizaciones/[id]/membresias/route.ts', 'app/api/organizaciones/[id]/invitaciones/route.ts']) {
      const g = guardasDeRuta(ruta).find((x) => x.metodo === 'GET');
      for (const r of ROLES_EXTERNOS) assert.ok(!g!.roles.includes(r), `${ruta}: ${r}`);
    }
  });

  test('los usuarios externos solo tienen lectura de su pertenencia; aceptar una invitación no es una ruta de personal', () => {
    const portal = guardasDeRuta('app/api/portal/organizacion/route.ts');
    assert.deepEqual(portal.map((g) => g.metodo), ['GET']);
    assert.deepEqual(portal[0].roles, ['auditor', 'cliente', 'comercializador', 'planta']);
    const aceptar = guardasDeRuta('app/api/organizaciones/invitaciones/aceptar/route.ts');
    assert.deepEqual(aceptar.map((g) => g.metodo), ['POST']);
    assert.ok(aceptar[0].encontrada);
  });
});

describe('migración 048 (estática)', () => {
  test('cabecera, RLS, search_path y bitácora append-only', () => {
    verificarMigracion('048_organizaciones_membresias.sql', { appendOnly: ['membresias_bitacora'] });
  });

  test('no crea otra tabla de organizaciones; ningún rol autenticado escribe; el hash del token no se concede', () => {
    const sql = sinComentarios(leerMigracion('048_organizaciones_membresias.sql'));
    assert.doesNotMatch(sql, /create table if not exists public\.organizaciones\b/);
    assert.doesNotMatch(sql, /grant [a-z, ]*(insert|update|delete)[a-z, ]* on table public\.[a-z_]+ to authenticated/);
    assert.doesNotMatch(sql, /for (insert|update|delete|all) to authenticated/);
    const grant = /grant select \(([^)]*)\)\s+on table public\.invitaciones_organizacion to authenticated/.exec(sql);
    assert.ok(grant, 'falta el grant por columnas de invitaciones');
    assert.ok(!grant![1].includes('token_hash'));
    assert.match(sql, /grant execute on function public\.aceptar_invitacion_organizacion\(text, uuid\) to service_role/);
  });

  test('el CHECK de tipos (declarado en la 047) incluye los ocho tipos', () => {
    const sql047 = leerMigracion('047_recepcion_custodia.sql');
    for (const t of TIPOS_ORGANIZACION) assert.ok(sql047.includes(`'${t}'`), t);
  });
});
