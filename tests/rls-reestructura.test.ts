// tests/rls-reestructura.test.ts — migraciones 045+ contra un PostgreSQL
// EFÍMERO local (nunca una base real). Aplica fixtures → 043 → seed → cada
// migración nueva DOS veces (idempotencia) y prueba triggers, RLS y RPCs.
// Si no hay PostgreSQL disponible la suite se declara NO CORRIDA (skip).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { BaseEfimera, SIN_POSTGRES, migracion, sqlDePrueba } from '@/tests/pg-efimero';

const db = new BaseEfimera();

const U = {
  admin: 'a0000000-0000-4000-8000-000000000001',
  comA: 'a0000000-0000-4000-8000-000000000002',
  planta: 'a0000000-0000-4000-8000-000000000004',
  auditor: 'a0000000-0000-4000-8000-000000000005',
  clienteA: 'a0000000-0000-4000-8000-000000000006',
  verificador: 'a0000000-0000-4000-8000-000000000011',
  recepcionA: 'a0000000-0000-4000-8000-000000000012',
  recepcionB: 'a0000000-0000-4000-8000-000000000013',
  abogado: 'a0000000-0000-4000-8000-000000000014',
  clienteB: 'a0000000-0000-4000-8000-000000000015',
  verificador2: 'a0000000-0000-4000-8000-000000000016',
} as const;
const ORG = { A: 'b0000000-0000-4000-8000-000000000001', B: 'b0000000-0000-4000-8000-000000000002', P: 'b0000000-0000-4000-8000-000000000003' } as const;
const CLI = { A: 'c0000000-0000-4000-8000-000000000001', B: 'c0000000-0000-4000-8000-000000000002' } as const;
const FUENTE = { A: 'd0000000-0000-4000-8000-000000000001', B: 'd0000000-0000-4000-8000-000000000002' } as const;

const MIGRACIONES = [
  '045_acceso_otp_y_roles.sql',
  '046_perfiles_aprobacion.sql',
];

describe('migraciones de la reestructura (PostgreSQL efímero)', { skip: SIN_POSTGRES }, () => {
  before(() => {
    db.iniciar();
    db.aplicar(sqlDePrueba('043_fixtures.sql'), 'fixtures 043');
    db.aplicar(migracion('043_estandar_privado_cadena.sql'), '043');
    db.aplicar(sqlDePrueba('043_seed.sql'), 'seed 043');
    db.aplicar(sqlDePrueba('reestructura_fixtures.sql'), 'fixtures reestructura');
    for (const m of MIGRACIONES) {
      db.aplicar(migracion(m), `${m} (1ª pasada)`);
      db.aplicar(migracion(m), `${m} (2ª pasada, idempotencia)`);
      if (m.startsWith('045')) db.aplicar(sqlDePrueba('reestructura_seed_045.sql'), 'seed 045');
    }
  });

  after(() => db.parar());

  /* ── 045 ─────────────────────────────────────────────────────────────── */

  test('045: roles nuevos admitidos; los de la 043 siguen válidos; rol inventado rechazado', () => {
    const def = db.su(`select pg_get_constraintdef(oid) from pg_constraint where conname='user_roles_rol_check'`);
    for (const r of ['admin', 'abogado', 'tecnico_ambiental', 'cliente', 'comercializador', 'planta', 'auditor', 'verificador', 'recepcion']) {
      assert.match(def, new RegExp(`'${r}'`));
    }
    assert.equal(Number(db.su(`select count(*) from pg_constraint where conname='user_roles_org_requerida_check'`)), 1);
    assert.match(db.suFalla(`update public.user_roles set rol='superusuario' where user_id='${U.abogado}'`), /user_roles_rol_check/);
    // comercializador sin organización sigue prohibido (regla 043 intacta).
    db.suFalla(`update public.user_roles set rol='comercializador', organizacion_id=null where user_id='${U.abogado}'`);
  });

  test('045: organización de recepcion — debe existir y estar activa; cliente no lleva organización', () => {
    assert.match(db.suFalla(`update public.user_roles set organizacion_id='${ORG.A}' where user_id='${U.clienteA}'`), /no aplica al rol cliente/);
    db.su(`update public.organizaciones set activo=false where id='${ORG.P}'`);
    assert.match(db.suFalla(`update public.user_roles set organizacion_id='${ORG.P}' where user_id='${U.recepcionB}'`), /no existe o no está activa/);
    db.su(`update public.organizaciones set activo=true where id='${ORG.P}'`);
  });

  test('045: has_role y es_personal', () => {
    assert.equal(db.usuario(U.verificador, `select public.has_role('${U.verificador}','verificador')`), 't');
    assert.equal(db.usuario(U.verificador, `select public.has_role('${U.verificador}','admin')`), 'f');
    assert.equal(db.usuario(U.recepcionA, `select public.es_personal()`), 't');
    for (const u of [U.clienteA, U.comA, U.planta, U.auditor]) assert.equal(db.usuario(u, `select public.es_personal()`), 'f');
  });

  test('045: el cambio de rol deja bitácora, y la bitácora es append-only', () => {
    const antes = Number(db.su(`select count(*) from public.bitacora_acciones where recurso_tipo='user_roles'`));
    db.su(`set app.uid='${U.admin}'; update public.user_roles set rol='tecnico_ambiental' where user_id='${U.abogado}'`);
    db.su(`set app.uid='${U.admin}'; update public.user_roles set rol='abogado' where user_id='${U.abogado}'`);
    assert.equal(Number(db.su(`select count(*) from public.bitacora_acciones where recurso_tipo='user_roles'`)), antes + 2);
    const fila = db.su(`select accion || '|' || actor_user_id || '|' || resumen from public.bitacora_acciones where recurso_tipo='user_roles' order by created_at desc, id limit 1`);
    assert.match(fila, /rol_cambiado\|a0000000-0000-4000-8000-000000000001\|/);
    assert.match(db.suFalla(`update public.bitacora_acciones set resumen='x'`), /append-only/);
    assert.match(db.suFalla(`delete from public.bitacora_acciones`), /append-only/);
    assert.match(db.servicioFalla(`delete from public.bitacora_acciones`), /permission denied/);
    // Solo admin y auditor la leen; un externo no inserta.
    assert.ok(db.contar(U.admin, 'bitacora_acciones') > 0);
    assert.equal(db.contar(U.recepcionA, 'bitacora_acciones'), 0);
    db.usuarioFalla(U.clienteA, `insert into public.bitacora_acciones (actor_user_id, accion, recurso_tipo, resumen) values ('${U.clienteA}','x','y','z')`);
    db.usuario(U.recepcionA, `insert into public.bitacora_acciones (actor_user_id, accion, recurso_tipo, resumen) values ('${U.recepcionA}','prueba','prueba','asiento de prueba')`);
    db.usuarioFalla(U.recepcionA, `insert into public.bitacora_acciones (actor_user_id, accion, recurso_tipo, resumen) values ('${U.admin}','x','y','suplantación')`);
  });

  test('045: control del OTP — solo service_role; intento atómico con bloqueo', () => {
    const h = 'a'.repeat(64);
    db.usuarioFalla(U.admin, `select * from public.auth_otp_control`);
    db.anonFalla(`select * from public.auth_otp_control`);
    db.usuarioFalla(U.admin, `select public.auth_otp_registrar_intento('${h}', 5, 900)`);
    db.servicio(`insert into public.auth_otp_control (email_hash, emitido_en, expira_en) values ('${h}', now(), now() + interval '10 minutes')`);
    for (let i = 1; i <= 4; i++) {
      const r = db.servicio(`select intentos || '|' || coalesce(bloqueado_hasta::text,'') from public.auth_otp_registrar_intento('${h}', 5, 900)`);
      assert.equal(r, `${i}|`);
    }
    const quinto = db.servicio(`select intentos || '|' || (bloqueado_hasta > now()) from public.auth_otp_registrar_intento('${h}', 5, 900)`);
    assert.equal(quinto, '5|true');
    assert.equal(db.servicio(`select count(*) from public.auth_otp_registrar_intento('${'b'.repeat(64)}', 5, 900)`), '0');
    // No existe columna para el código.
    assert.equal(Number(db.su(`select count(*) from information_schema.columns where table_name='auth_otp_control' and column_name ~* 'codigo|token'`)), 0);
  });

  test('045: auditoría del OTP append-only; búsqueda de cuenta solo para service_role', () => {
    db.servicio(`insert into public.auth_otp_auditoria (evento, email_hash, ip) values ('solicitud_emitida', '${'a'.repeat(64)}', '127.0.0.1')`);
    assert.match(db.suFalla(`update public.auth_otp_auditoria set detalle='x'`), /append-only/);
    db.servicioFalla(`insert into public.auth_otp_auditoria (evento) values ('evento_inventado')`);
    assert.equal(db.servicio(`select public.auth_usuario_id_por_correo('  MINERO@test.local ')`), U.clienteA);
    assert.equal(db.servicio(`select coalesce(public.auth_usuario_id_por_correo('nadie@test.local')::text, 'null')`), 'null');
    db.usuarioFalla(U.admin, `select public.auth_usuario_id_por_correo('minero@test.local')`);
    db.anonFalla(`select public.auth_usuario_id_por_correo('minero@test.local')`);
  });

  test('045: solicitudes de acceso — anon y externos no leen ni escriben; personal lee', () => {
    db.servicio(`insert into public.solicitudes_acceso (correo, nombre_contacto) values ('alguien@test.local', 'Contacto')`);
    db.anonFalla(`insert into public.solicitudes_acceso (correo) values ('x@test.local')`);
    db.usuarioFalla(U.clienteA, `insert into public.solicitudes_acceso (correo) values ('x@test.local')`);
    assert.equal(db.contar(U.clienteA, 'solicitudes_acceso'), 0);
    assert.equal(db.contar(U.verificador, 'solicitudes_acceso'), 1);
  });

  /* ── 046 ─────────────────────────────────────────────────────────────── */

  test('046: todo perfil nace pendiente (o borrador) — nunca aprobado', () => {
    db.usuario(U.recepcionA, `insert into public.perfiles (tipo, cliente_id, contenido, estado) values ('minero', '${CLI.A}', '{"municipio":"Iriona","nombre_legal":"Titular A"}', 'aprobado')`);
    const fila = db.su(`select estado || '|' || version || '|' || creado_por || '|' || contenido_hash from public.perfiles where cliente_id='${CLI.A}'`);
    const [estado, version, creador, hash] = fila.split('|');
    assert.equal(estado, 'pendiente');
    assert.equal(version, '1');
    assert.equal(creador, U.recepcionA);
    assert.match(hash, /^[0-9a-f]{64}$/);
    db.usuario(U.abogado, `insert into public.perfiles (tipo, cliente_id, estado) values ('minero', '${CLI.B}', 'borrador')`);
    assert.equal(db.su(`select estado from public.perfiles where cliente_id='${CLI.B}'`), 'borrador');
    // Un perfil por titular.
    db.usuarioFalla(U.recepcionA, `insert into public.perfiles (tipo, cliente_id) values ('minero', '${CLI.A}')`);
    // Sujeto coherente con el tipo.
    db.usuarioFalla(U.recepcionA, `insert into public.perfiles (tipo, organizacion_id) values ('minero', '${ORG.A}')`);
  });

  test('046: el hash del contenido coincide con el de TypeScript', async () => {
    const { hashContenidoPerfil } = await import('@/lib/perfiles/estados');
    const sql = db.su(`select contenido_hash from public.perfiles where cliente_id='${CLI.A}'`);
    assert.equal(sql, hashContenidoPerfil({ nombre_legal: 'Titular A', municipio: 'Iriona' }));
  });

  test('046: cliente, organizaciones externas y verificador NO escriben perfiles', () => {
    for (const u of [U.clienteA, U.comA, U.planta, U.auditor, U.verificador]) {
      db.usuarioFalla(u, `insert into public.perfiles (tipo, organizacion_id) values ('organizacion', '${ORG.P}')`);
      assert.equal(db.usuario(u, `with x as (update public.perfiles set contenido='{"municipio":"X"}' returning 1) select count(*) from x`), '0');
    }
    db.usuarioFalla(U.recepcionA, `delete from public.perfiles`);
    assert.match(db.suFalla(`delete from public.perfiles`), /indeleble/);
  });

  test('046: el titular lee SOLO su perfil; no ve el de otro titular', () => {
    assert.equal(db.contar(U.clienteA, 'perfiles'), 1);
    assert.equal(db.contar(U.clienteA, 'perfiles', `cliente_id='${CLI.B}'`), 0);
    assert.equal(db.contar(U.clienteB, 'perfiles', `cliente_id='${CLI.A}'`), 0);
    assert.equal(db.contar(U.comA, 'perfiles'), 0);
    assert.equal(db.contar(U.verificador, 'perfiles'), 2);
  });

  test('046: un perfil pendiente no puede originar un lote', () => {
    const err = db.suFalla(`insert into public.lotes (codigo, fuente_id) values ('LOTE-PEND', '${FUENTE.A}')`);
    assert.match(err, /perfil_no_aprobado/);
    // Titular sin perfil: igual.
    db.su(`insert into public.clientes (id, nombre) values ('c0000000-0000-4000-8000-000000000009', 'Sin perfil (prueba)')`);
    db.su(`insert into public.fuentes_comercializador (id, organizacion_id, cliente_id, permiso_vigente_hasta, dentro_area_inhgeomin, declaracion_mercurio_cero, clpi_estado)
           values ('d0000000-0000-4000-8000-000000000009', '${ORG.A}', 'c0000000-0000-4000-8000-000000000009', current_date + 30, true, true, 'no_aplica')`);
    assert.match(db.suFalla(`insert into public.lotes (codigo, fuente_id) values ('LOTE-SINPERFIL', 'd0000000-0000-4000-8000-000000000009')`), /perfil_no_aprobado/);
  });

  test('046: el estado decidido no se alcanza con un UPDATE directo', () => {
    assert.match(db.suFalla(`update public.perfiles set estado='aprobado' where cliente_id='${CLI.A}'`), /solo se alcanza con decidir_perfil/);
    assert.match(db.servicioFalla(`update public.perfiles set estado='aprobado' where cliente_id='${CLI.A}'`), /solo se alcanza con decidir_perfil/);
  });

  test('046: separación de funciones — quien creó no decide; rol no autorizado tampoco', () => {
    const id = db.su(`select id from public.perfiles where cliente_id='${CLI.A}'`);
    db.usuarioFalla(U.verificador, `select public.decidir_perfil('${id}', 'aprobado', null, '${U.verificador}')`); // sin EXECUTE
    // recepcionA creó el perfil: aunque fuera admin, no decide. Aquí además no tiene el rol.
    assert.equal(db.json(`set role service_role; select public.decidir_perfil('${id}', 'aprobado', null, '${U.recepcionA}')`).motivo, 'rol_no_autorizado');
    db.su(`update public.user_roles set rol='admin', organizacion_id=null where user_id='${U.recepcionA}'`);
    assert.equal(db.json(`set role service_role; select public.decidir_perfil('${id}', 'aprobado', null, '${U.recepcionA}')`).motivo, 'es_creador');
    db.su(`update public.user_roles set rol='recepcion', organizacion_id='${ORG.A}' where user_id='${U.recepcionA}'`);
    assert.equal(db.su(`select estado from public.perfiles where id='${id}'`), 'pendiente');
    // Inserción directa en la bitácora por el creador: el trigger también lo impide.
    assert.match(db.servicioFalla(`insert into public.aprobaciones_perfil (perfil_id, secuencia, decision, decidido_por, decidido_rol, version, contenido_hash, hash_previo, hash)
      values ('${id}', 0, 'aprobado', '${U.recepcionA}', 'admin', 1, 'x', '', repeat('0',64))`), /separacion_de_funciones/);
  });

  test('046: transiciones — rechazo exige motivo; borrador no se decide; aprobación válida', () => {
    const a = db.su(`select id from public.perfiles where cliente_id='${CLI.A}'`);
    const b = db.su(`select id from public.perfiles where cliente_id='${CLI.B}'`);
    const decidir = (id: string, d: string, motivo: string | null, actor: string) =>
      db.json(`set role service_role; select public.decidir_perfil('${id}', '${d}', ${motivo === null ? 'null' : `'${motivo}'`}, '${actor}')`);
    assert.equal(decidir(a, 'rechazado', null, U.verificador).motivo, 'motivo_obligatorio');
    assert.equal(decidir(a, 'rechazado', 'no', U.verificador).motivo, 'motivo_obligatorio');
    assert.equal(decidir(b, 'aprobado', null, U.verificador).motivo, 'transicion_invalida'); // borrador
    assert.equal(decidir(a, 'suspendido', 'motivo suficiente', U.verificador).motivo, 'transicion_invalida'); // pendiente
    assert.equal(decidir(a, 'anulado', null, U.verificador).motivo, 'decision_invalida');
    const ok = decidir(a, 'aprobado', null, U.verificador);
    assert.equal(ok.ok, true);
    assert.equal(db.su(`select estado from public.perfiles where id='${a}'`), 'aprobado');
    assert.equal(decidir(a, 'aprobado', null, U.verificador2).motivo, 'transicion_invalida'); // ya aprobado
  });

  test('046: con el perfil aprobado, el lote sí nace', () => {
    db.su(`insert into public.lotes (id, codigo, fuente_id) values ('e0000000-0000-4000-8000-0000000000a1', 'LOTE-APROB', '${FUENTE.A}')`);
    assert.equal(db.su(`select estado from public.lotes where codigo='LOTE-APROB'`), 'abierto');
  });

  test('046: bitácora de aprobaciones — encadenada, con la versión aprobada, sin UPDATE ni DELETE', () => {
    const a = db.su(`select id from public.perfiles where cliente_id='${CLI.A}'`);
    const fila = db.su(`select secuencia || '|' || decision || '|' || decidido_por || '|' || decidido_rol || '|' || version || '|' || hash_previo || '|' || (contenido_hash = (select contenido_hash from public.perfiles where id='${a}'))
                          from public.aprobaciones_perfil where perfil_id='${a}'`);
    assert.equal(fila, `1|aprobado|${U.verificador}|verificador|1|GENESIS|true`);
    assert.match(db.suFalla(`update public.aprobaciones_perfil set motivo='x'`), /append-only/);
    assert.match(db.suFalla(`delete from public.aprobaciones_perfil`), /append-only/);
    assert.match(db.servicioFalla(`update public.aprobaciones_perfil set motivo='x'`), /permission denied/);
    db.usuarioFalla(U.verificador, `insert into public.aprobaciones_perfil (perfil_id, secuencia, decision, decidido_por, decidido_rol, version, contenido_hash, hash_previo, hash) values ('${a}',0,'aprobado','${U.verificador}','verificador',1,'x','',repeat('0',64))`);
    assert.equal(db.contar(U.clienteA, 'aprobaciones_perfil'), 0);
    assert.equal(db.contar(U.verificador, 'aprobaciones_perfil'), 1);
    assert.equal(Number(db.su(`select count(*) from public.bitacora_acciones where accion='perfil_aprobado' and recurso_id='${a}'`)), 1);
  });

  test('046: editar un perfil aprobado lo devuelve a pendiente, sube la versión y bloquea al editor como decisor', () => {
    const a = db.su(`select id from public.perfiles where cliente_id='${CLI.A}'`);
    db.usuario(U.abogado, `update public.perfiles set contenido = contenido || '{"departamento":"Colón"}' where id='${a}'`);
    assert.equal(db.su(`select estado || '|' || version || '|' || editado_por from public.perfiles where id='${a}'`), `pendiente|2|${U.abogado}`);
    assert.match(db.suFalla(`insert into public.lotes (codigo, fuente_id) values ('LOTE-TRAS-EDICION', '${FUENTE.A}')`), /perfil_no_aprobado/);
    db.su(`update public.user_roles set rol='admin' where user_id='${U.abogado}'`);
    assert.equal(db.json(`set role service_role; select public.decidir_perfil('${a}', 'aprobado', null, '${U.abogado}')`).motivo, 'es_editor');
    db.su(`update public.user_roles set rol='abogado' where user_id='${U.abogado}'`);
    // Otro verificador aprueba la versión 2; la cadena sigue.
    assert.equal(db.json(`set role service_role; select public.decidir_perfil('${a}', 'aprobado', null, '${U.verificador2}')`).ok, true);
    const cadena = db.su(`select string_agg(secuencia || ':' || version || ':' || (hash_previo = coalesce(lag_hash,'GENESIS')), ',' order by secuencia)
                            from (select *, lag(hash) over (order by secuencia) as lag_hash from public.aprobaciones_perfil where perfil_id='${a}') t`);
    assert.equal(cadena, '1:1:true,2:2:true');
    // Suspender exige motivo y saca al titular de los lotes nuevos.
    assert.equal(db.json(`set role service_role; select public.decidir_perfil('${a}', 'suspendido', 'documento vencido', '${U.verificador}')`).ok, true);
    assert.match(db.suFalla(`insert into public.lotes (codigo, fuente_id) values ('LOTE-SUSPENDIDO', '${FUENTE.A}')`), /perfil_no_aprobado/);
    // Reactivar: el personal lo devuelve a pendiente y un verificador lo aprueba de nuevo.
    db.usuario(U.recepcionB, `update public.perfiles set estado='pendiente' where id='${a}'`);
    assert.equal(db.json(`set role service_role; select public.decidir_perfil('${a}', 'aprobado', null, '${U.verificador}')`).ok, true);
  });

  test('046: licencias — el personal carga, el titular solo lee las de SUS minas', () => {
    db.usuario(U.recepcionA, `insert into public.licencias_mina (mina_id, tipo, estado) values ('70000000-0000-4000-8000-000000000001', 'permiso_municipal', 'en_tramite'), ('70000000-0000-4000-8000-000000000002', 'licencia_ambiental', 'en_tramite')`);
    assert.equal(db.contar(U.clienteA, 'licencias_mina'), 1);
    assert.equal(db.contar(U.clienteB, 'licencias_mina'), 1);
    assert.equal(db.contar(U.clienteA, 'licencias_mina', `mina_id='70000000-0000-4000-8000-000000000002'`), 0);
    db.usuarioFalla(U.clienteA, `insert into public.licencias_mina (mina_id, tipo) values ('70000000-0000-4000-8000-000000000001', 'otro')`);
    assert.equal(db.usuario(U.clienteA, `with x as (update public.licencias_mina set estado='vigente' returning 1) select count(*) from x`), '0');
    db.usuarioFalla(U.recepcionA, `insert into public.licencias_mina (mina_id, tipo, estado) values ('70000000-0000-4000-8000-000000000001', 'otro', 'inventado')`);
  });
});
