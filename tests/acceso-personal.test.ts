// tests/acceso-personal.test.ts — matriz rol × acción, separación de funciones
// y verificación estática de la migración 045 (Fase 2).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { KNOWN_ROLES, isKnownRole, type Role } from '@/lib/userRoleLookup';
import { DASHBOARD_ROLES, PERSONAL_ROLES } from '@/lib/serverAuth';
import { destinoPorRol, ROLE_REDIRECT } from '@/lib/auth/sesionCookies';
import {
  ACCIONES_PERSONAL, alcanzaPunto, esPersonal, esUsuarioSoloLectura, puede, rolesCon, separacionDeFunciones,
} from '@/lib/acceso/personal';
import { leerMigracion, verificarMigracion } from '@/tests/migraciones-estaticas';

const EXTERNOS: Role[] = ['cliente', 'comercializador', 'planta', 'auditor'];

describe('roles nuevos', () => {
  test('verificador y recepcion son roles conocidos, de personal y con destino propio', () => {
    for (const r of ['verificador', 'recepcion'] as Role[]) {
      assert.ok(isKnownRole(r));
      assert.ok(PERSONAL_ROLES.includes(r));
      assert.ok(DASHBOARD_ROLES.includes(r));
      assert.ok(esPersonal(r));
    }
    assert.equal(destinoPorRol('verificador'), '/dashboard/aprobaciones');
    assert.equal(destinoPorRol('recepcion'), '/dashboard/recepcion');
    assert.equal(destinoPorRol('desconocido'), '/dashboard');
    assert.deepEqual(Object.keys(ROLE_REDIRECT).sort(), [...KNOWN_ROLES].sort());
  });

  test('ningún rol existente se renombró', () => {
    for (const r of ['admin', 'abogado', 'tecnico_ambiental', 'cliente', 'comercializador', 'planta', 'auditor']) {
      assert.ok(isKnownRole(r), r);
    }
  });
});

describe('matriz rol × acción', () => {
  test('usuarios externos: cero acciones de carga', () => {
    for (const rol of EXTERNOS) {
      assert.ok(esUsuarioSoloLectura(rol));
      for (const accion of ACCIONES_PERSONAL) assert.equal(puede(rol, accion), false, `${rol} no debe poder ${accion}`);
    }
  });

  test('admin: todas las acciones', () => {
    for (const accion of ACCIONES_PERSONAL) assert.equal(puede('admin', accion), true);
  });

  test('verificador decide y no carga; recepcion carga y no decide', () => {
    assert.equal(puede('verificador', 'perfil:decidir'), true);
    assert.equal(puede('verificador', 'membresia:activar'), true);
    for (const a of ['perfil:crear', 'perfil:editar', 'recepcion:registrar', 'caja:cerrar', 'envio:registrar', 'documento:subir', 'rol:asignar'] as const) {
      assert.equal(puede('verificador', a), false, a);
    }
    for (const a of ['perfil:crear', 'perfil:editar', 'recepcion:registrar', 'caja:cerrar', 'envio:registrar', 'laboratorio:recibir', 'documento:subir'] as const) {
      assert.equal(puede('recepcion', a), true, a);
    }
    for (const a of ['perfil:decidir', 'membresia:activar', 'rol:asignar', 'documento:revocar'] as const) {
      assert.equal(puede('recepcion', a), false, a);
    }
  });

  test('solo admin asigna roles; solo verificador y admin deciden perfiles', () => {
    assert.deepEqual(rolesCon('rol:asignar'), ['admin']);
    assert.deepEqual(rolesCon('perfil:decidir').sort(), ['admin', 'verificador']);
    assert.deepEqual(rolesCon('membresia:activar').sort(), ['admin', 'verificador']);
  });

  test('abogado y técnico: cargan perfiles, no registran recepciones ni deciden', () => {
    for (const rol of ['abogado', 'tecnico_ambiental'] as Role[]) {
      assert.equal(puede(rol, 'perfil:crear'), true);
      assert.equal(puede(rol, 'recepcion:ver'), true);
      assert.equal(puede(rol, 'recepcion:registrar'), false);
      assert.equal(puede(rol, 'perfil:decidir'), false);
    }
  });
});

describe('separación de funciones', () => {
  test('quien creó o editó no aprueba — tampoco el administrador', () => {
    assert.deepEqual(separacionDeFunciones('u1', { creado_por: 'u1', editado_por: null }), { ok: false, motivo: 'es_creador' });
    assert.deepEqual(separacionDeFunciones('u2', { creado_por: 'u1', editado_por: 'u2' }), { ok: false, motivo: 'es_editor' });
    assert.deepEqual(separacionDeFunciones('u3', { creado_por: 'u1', editado_por: 'u2' }), { ok: true });
    assert.deepEqual(separacionDeFunciones(null, { creado_por: 'u1', editado_por: null }), { ok: false, motivo: 'sin_actor' });
  });
});

describe('alcance por punto de recepción', () => {
  const punto = { organizacion_id: 'org-a' };
  test('recepcion opera solo los puntos de su organización', () => {
    assert.equal(alcanzaPunto({ rol: 'recepcion', userId: 'u', organizacionId: 'org-a' }, punto), true);
    assert.equal(alcanzaPunto({ rol: 'recepcion', userId: 'u', organizacionId: 'org-b' }, punto), false);
    assert.equal(alcanzaPunto({ rol: 'recepcion', userId: 'u', organizacionId: null }, punto), false);
  });
  test('resto del personal ve todos; externos ninguno', () => {
    assert.equal(alcanzaPunto({ rol: 'verificador', userId: 'u', organizacionId: null }, punto), true);
    assert.equal(alcanzaPunto({ rol: 'admin', userId: 'u', organizacionId: null }, punto), true);
    for (const rol of EXTERNOS) assert.equal(alcanzaPunto({ rol, userId: 'u', organizacionId: 'org-a' }, punto), false);
  });
});

describe('migración 045 (estática; NO aplicada, sin base de datos local)', () => {
  test('cabecera, RLS, search_path y append-only', () => {
    verificarMigracion('045_acceso_otp_y_roles.sql', { appendOnly: ['bitacora_acciones', 'auth_otp_auditoria'] });
  });

  test('el CHECK de roles solo AGREGA valores y conserva la regla de organización', () => {
    const sql = leerMigracion('045_acceso_otp_y_roles.sql');
    for (const r of KNOWN_ROLES) assert.ok(sql.includes(`'${r}'`), `falta ${r} en el CHECK`);
    assert.match(sql, /conname <> 'user_roles_org_requerida_check'/);
  });

  test('el control del OTP no tiene columna para el código y solo lo toca service_role', () => {
    const sql = leerMigracion('045_acceso_otp_y_roles.sql');
    const tabla = sql.slice(sql.indexOf('create table if not exists public.auth_otp_control'), sql.indexOf('comment on table public.auth_otp_control'));
    assert.doesNotMatch(tabla, /codigo|token|otp_hash/i);
    assert.match(sql, /grant select, insert, update, delete on table public\.auth_otp_control to service_role/);
    assert.doesNotMatch(sql, /grant [a-z, ]+ on table public\.auth_otp_(control|auditoria) to (anon|authenticated)/);
  });
});
