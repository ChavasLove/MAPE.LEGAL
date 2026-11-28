// tests/rls-reestructura.test.ts — migraciones 045+ contra un PostgreSQL
// EFÍMERO local (nunca una base real). Aplica fixtures → 043 → seed → cada
// migración nueva DOS veces (idempotencia) y prueba triggers, RLS y RPCs.
// Si no hay PostgreSQL disponible la suite se declara NO CORRIDA (skip).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { BaseEfimera, SIN_POSTGRES, migracion, sqlDePrueba } from '@/tests/pg-efimero';
import { canonicalJson, hashEvento, verificarCadena } from '@/lib/cadena/hash';
import { TIPOS_EVENTO_RECEPCION } from '@/lib/cadena/types';
import { construirManifiesto } from '@/lib/recepcion/manifiesto';
import { conciliarManifiesto } from '@/lib/recepcion/reglas';

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
  '047_recepcion_custodia.sql',
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
      if (m.startsWith('047')) db.aplicar(sqlDePrueba('reestructura_seed_047.sql'), 'seed 047');
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

  /* ── 047 ─────────────────────────────────────────────────────────────── */

  const LAB = 'b0000000-0000-4000-8000-000000000010';
  const PUNTO = { A: '90000000-0000-4000-8000-000000000001', B: '90000000-0000-4000-8000-000000000002' };
  const MINA = { A: '70000000-0000-4000-8000-000000000001', B: '70000000-0000-4000-8000-000000000002', A2: '70000000-0000-4000-8000-000000000003' };
  const LOTE = { A: 'e0000000-0000-4000-8000-0000000000a1', B: 'e0000000-0000-4000-8000-000000000002', viejo: 'e0000000-0000-4000-8000-000000000001' };

  const recepcionSql = (codigo: string, punto: string, lote: string, mina: string, actor: string) =>
    `insert into public.recepciones (codigo, punto_id, lote_id, mina_id, modo_entrega, guia, fecha_llegada, receptor_user_id, estado_embalaje)
     values ('${codigo}', '${punto}', '${lote}', '${mina}', 'dhl', 'GUIA-${codigo}', '2026-11-28T15:00:00Z', '${actor}', 'integro') returning id`;
  const nuevaRecepcion = (codigo: string, punto: string, lote: string, mina: string, actor: string) =>
    db.servicio(recepcionSql(codigo, punto, lote, mina, actor));
  const nuevoSobre = (recepcion: string, actor: string, extra = '') =>
    db.servicio(`insert into public.sobres (recepcion_id, registrado_por${extra ? ', ' + extra.split('=')[0] : ''}) values ('${recepcion}', '${actor}'${extra ? ', ' + extra.split('=')[1] : ''}) returning id`);
  const completarSobre = (id: string, peso: string, etiqueta: string) =>
    db.servicio(`update public.sobres set peso_bruto_g=${peso}+1, peso_neto_g=${peso}, instrumento='Balanza de prueba', ley_fino=0.9, etiqueta='${etiqueta}', numero_sello='SELLO-${etiqueta}', actualizado_por='${U.recepcionA}' where id='${id}'`);
  const nuevaCaja = (codigo: string, titular: string, punto = PUNTO.A) =>
    db.servicio(`insert into public.cajas (codigo, punto_id, titular_cliente_id, laboratorio_org_id, creada_por) values ('${codigo}', '${punto}', '${titular}', '${LAB}', '${U.recepcionA}') returning id`);
  const manifiestoDe = (cajaId: string, precinto: string) => {
    const caja = db.json<{ codigo: string; punto_id: string; laboratorio_org_id: string; titular_cliente_id: string }>(
      `select row_to_json(c) from (select codigo, punto_id, laboratorio_org_id, titular_cliente_id from public.cajas where id='${cajaId}') c`);
    const sobres = db.json<Array<{ id: string; etiqueta: string; numero_sello: string; mina_id: string; lote_id: string; titular_cliente_id: string; peso_neto_g: number }>>(
      `select coalesce(json_agg(x), '[]') from (select id, etiqueta, numero_sello, mina_id, lote_id, titular_cliente_id, peso_neto_g from public.sobres where caja_id='${cajaId}' order by created_at desc) x`);
    return construirManifiesto({ ...caja, precinto }, sobres);
  };
  const cerrar = (cajaId: string, precinto: string, canonico: string, hash: string) =>
    db.json(`set role service_role; select public.cerrar_caja('${cajaId}', '${precinto}', '${canonico.replace(/'/g, "''")}', '${hash}', '${U.recepcionA}')`);

  let recA = '';
  let sobreA1 = '';
  let sobreA2 = '';
  let cajaA = '';

  test('047: las cadenas existentes siguen verificando; el CHECK admite los tipos nuevos', () => {
    assert.equal(db.json(`select public.verificar_cadena_lote('${LOTE.viejo}')`).ok, true);
    const def = db.su(`select pg_get_constraintdef(oid) from pg_constraint where conname='lote_eventos_tipo_check'`);
    for (const t of [...TIPOS_EVENTO_RECEPCION, 'fundicion', 'refinado', 'pago', 'origen_mina']) assert.match(def, new RegExp(`'${t}'`));
  });

  test('047: los eventos de recepción están reservados al personal', () => {
    assert.match(db.usuarioFalla(U.comA, `insert into public.lote_eventos (lote_id, tipo, actor_user_id, detalle_canonico) values ('${LOTE.A}', 'recepcion', '${U.comA}', '{}')`), /evento_reservado/);
    assert.match(db.usuarioFalla(U.comA, `insert into public.lote_eventos (lote_id, tipo, actor_user_id, detalle_canonico) values ('${LOTE.A}', 'empaque_caja', '${U.comA}', '{}')`), /evento_reservado/);
    // Lo que la 043 ya le permitía al comercializador sigue igual.
    db.usuario(U.comA, `insert into public.lote_eventos (lote_id, tipo, actor_user_id, detalle_canonico) values ('${LOTE.A}', 'nota', '${U.comA}', '{}')`);
  });

  test('047 (e): un titular sin perfil aprobado no origina recepción', () => {
    assert.match(db.servicioFalla(recepcionSql('REC-B-NO', PUNTO.B, LOTE.B, MINA.B, U.recepcionB)), /perfil_no_aprobado/);
  });

  test('047: la mina debe ser del titular del lote (no se mezclan expedientes); punto activo', () => {
    assert.match(db.servicioFalla(recepcionSql('REC-MEZCLA', PUNTO.A, LOTE.A, MINA.B, U.recepcionA)), /mina_de_otro_titular/);
    db.su(`update public.puntos_recepcion set activo=false where id='${PUNTO.B}'`);
    assert.match(db.servicioFalla(recepcionSql('REC-INACTIVO', PUNTO.B, LOTE.A, MINA.A, U.recepcionA)), /punto_inactivo/);
    db.su(`update public.puntos_recepcion set activo=true where id='${PUNTO.B}'`);
    assert.match(db.servicioFalla(`insert into public.recepciones (codigo, punto_id, lote_id, mina_id, modo_entrega, fecha_llegada, receptor_user_id) values ('REC-MODO', '${PUNTO.A}', '${LOTE.A}', '${MINA.A}', 'paloma_mensajera', now(), '${U.recepcionA}')`), /recepciones_modo_check/);
  });

  test('047: recepción válida → evento encadenado; (a) un sobre es de la mina de su recepción', () => {
    recA = nuevaRecepcion('REC-A-1', PUNTO.A, LOTE.A, MINA.A, U.recepcionA);
    assert.equal(db.su(`select tipo || '|' || actor_user_id || '|' || actor_rol || '|' || lugar from public.lote_eventos where lote_id='${LOTE.A}' order by secuencia desc limit 1`),
      `recepcion|${U.recepcionA}|recepcion|Punto A (prueba)`);
    assert.match(db.servicioFalla(`insert into public.sobres (recepcion_id, mina_id, registrado_por) values ('${recA}', '${MINA.A2}', '${U.recepcionA}')`), /sobre_de_otra_mina/);
    sobreA1 = nuevoSobre(recA, U.recepcionA);
    sobreA2 = nuevoSobre(recA, U.recepcionA);
    assert.equal(db.su(`select mina_id || '|' || titular_cliente_id || '|' || lote_id || '|' || estado from public.sobres where id='${sobreA1}'`), `${MINA.A}|${CLI.A}|${LOTE.A}|abierto`);
  });

  test('047: pesaje, análisis y etiquetado emiten cada uno su evento', () => {
    const antes = Number(db.su(`select count(*) from public.lote_eventos where lote_id='${LOTE.A}'`));
    completarSobre(sobreA1, '100.250', 'ETQ-A1');
    const tipos = db.su(`select string_agg(tipo, ',' order by secuencia) from (select tipo, secuencia from public.lote_eventos where lote_id='${LOTE.A}' order by secuencia desc limit 3) t`);
    assert.equal(tipos, 'pesaje,analisis,etiquetado');
    assert.equal(Number(db.su(`select count(*) from public.lote_eventos where lote_id='${LOTE.A}'`)), antes + 3);
    assert.equal(db.su(`select peso_g from public.lote_eventos where lote_id='${LOTE.A}' and tipo='pesaje' order by secuencia desc limit 1`), '100.250');
    assert.equal(db.su(`select ley_fino from public.lote_eventos where lote_id='${LOTE.A}' and tipo='analisis' order by secuencia desc limit 1`), '0.900000');
    db.servicioFalla(`update public.sobres set peso_neto_g=200, peso_bruto_g=100 where id='${sobreA2}'`); // neto > bruto
    db.servicioFalla(`update public.sobres set ley_fino=1.5 where id='${sobreA2}'`);
  });

  test('047 (b)(d): caja de un solo titular; solo entran sobres pesados y etiquetados', () => {
    assert.match(db.servicioFalla(`insert into public.cajas (codigo, punto_id, titular_cliente_id, laboratorio_org_id, creada_por) values ('CAJA-MAL', '${PUNTO.A}', '${CLI.A}', '${ORG.P}', '${U.recepcionA}')`), /destino_no_es_laboratorio/);
    cajaA = nuevaCaja('CAJA-A-1', CLI.A);
    assert.match(db.servicioFalla(`update public.sobres set caja_id='${cajaA}' where id='${sobreA2}'`), /sobre_sin_pesar/);
    db.servicio(`update public.sobres set peso_neto_g=50.5, peso_bruto_g=51, actualizado_por='${U.recepcionA}' where id='${sobreA2}'`);
    assert.match(db.servicioFalla(`update public.sobres set caja_id='${cajaA}' where id='${sobreA2}'`), /sobre_sin_etiquetar/);

    // Titular B: se aprueba su perfil y se le registra una recepción con un sobre completo.
    const b = db.su(`select id from public.perfiles where cliente_id='${CLI.B}'`);
    db.usuario(U.recepcionA, `update public.perfiles set estado='pendiente' where id='${b}'`);
    assert.equal(db.json(`set role service_role; select public.decidir_perfil('${b}', 'aprobado', null, '${U.verificador}')`).ok, true);
    const recB = nuevaRecepcion('REC-B-1', PUNTO.B, LOTE.B, MINA.B, U.recepcionB);
    const sobreB = nuevoSobre(recB, U.recepcionB);
    completarSobre(sobreB, '75.000', 'ETQ-B1');
    // Mezcla de titulares A y B: rechazada por la base.
    assert.match(db.servicioFalla(`update public.sobres set caja_id='${cajaA}' where id='${sobreB}'`), /mezcla_de_titulares/);
    assert.equal(db.su(`select coalesce(caja_id::text,'null') from public.sobres where id='${sobreB}'`), 'null');
    // El sobre de A sí entra.
    db.servicio(`update public.sobres set caja_id='${cajaA}', actualizado_por='${U.recepcionA}' where id='${sobreA1}'`);
    assert.equal(db.su(`select estado from public.sobres where id='${sobreA1}'`), 'empacado');
  });

  test('047 (c)(d): no se cierra sin manifiesto, con sobres incompletos ni con un manifiesto que no corresponde', () => {
    const m = manifiestoDe(cajaA, 'PRE-001');
    assert.ok(m.ok);
    if (!m.ok) return;
    assert.equal(cerrar(cajaA, 'PRE-001', '', '').motivo, 'sin_manifiesto');
    assert.equal(cerrar(cajaA, '', m.canonico, m.hash).motivo, 'sin_precinto');
    assert.equal(cerrar(cajaA, 'PRE-001', m.canonico, 'f'.repeat(64)).motivo, 'hash_no_coincide');
    // Manifiesto con un peso alterado y su hash recalculado: íntegro pero infiel al contenido.
    const falso = construirManifiesto(
      { codigo: 'CAJA-A-1', precinto: 'PRE-001', punto_id: PUNTO.A, laboratorio_org_id: LAB, titular_cliente_id: CLI.A },
      [{ id: sobreA1, etiqueta: 'ETQ-A1', numero_sello: 'SELLO-ETQ-A1', mina_id: MINA.A, lote_id: LOTE.A, titular_cliente_id: CLI.A, peso_neto_g: 999 }]);
    assert.ok(falso.ok);
    if (falso.ok) assert.equal(cerrar(cajaA, 'PRE-001', falso.canonico, falso.hash).motivo, 'manifiesto_no_corresponde');
    // Precinto distinto del que consta en el manifiesto.
    assert.equal(cerrar(cajaA, 'PRE-OTRO', m.canonico, m.hash).motivo, 'manifiesto_no_corresponde');
    // Caja vacía.
    const vacia = nuevaCaja('CAJA-A-VACIA', CLI.A);
    assert.equal(cerrar(vacia, 'PRE-V', m.canonico, m.hash).motivo, 'caja_vacia');
    // El estado no se alcanza con un UPDATE directo, ni siquiera con service_role.
    assert.match(db.servicioFalla(`update public.cajas set estado='cerrada' where id='${cajaA}'`), /el estado solo cambia con/);
    assert.equal(db.su(`select estado from public.cajas where id='${cajaA}'`), 'abierta');
  });

  test('047: manifiesto determinista (TS) aceptado por la base; la caja cerrada queda congelada', () => {
    const m1 = manifiestoDe(cajaA, 'PRE-001');
    const m2 = manifiestoDe(cajaA, 'PRE-001');
    assert.ok(m1.ok && m2.ok);
    if (!m1.ok || !m2.ok) return;
    assert.equal(m1.hash, m2.hash);
    assert.equal(m1.canonico, m2.canonico);
    assert.doesNotMatch(m1.canonico, /precio|monto|pago|lempira/i);
    const r = cerrar(cajaA, 'PRE-001', m1.canonico, m1.hash);
    assert.deepEqual({ ok: r.ok, estado: r.estado, sobres: r.sobres, hash: r.manifiesto_hash }, { ok: true, estado: 'cerrada', sobres: 1, hash: m1.hash });
    assert.equal(db.su(`select public.sha256_hex(manifiesto_canonico) = manifiesto_hash from public.cajas where id='${cajaA}'`), 't');
    assert.equal(db.su(`select tipo from public.lote_eventos where lote_id='${LOTE.A}' order by secuencia desc limit 1`), 'empaque_caja');
    assert.match(db.servicioFalla(`update public.sobres set peso_neto_g=1 where id='${sobreA1}'`), /sobre_en_caja_cerrada/);
    assert.match(db.servicioFalla(`update public.sobres set caja_id=null where id='${sobreA1}'`), /sobre_en_caja_cerrada/);
    db.servicio(`update public.sobres set etiqueta='ETQ-A2', numero_sello='SELLO-ETQ-A2', actualizado_por='${U.recepcionA}' where id='${sobreA2}'`);
    assert.match(db.servicioFalla(`update public.sobres set caja_id='${cajaA}' where id='${sobreA2}'`), /caja_no_abierta/);
    assert.equal(cerrar(cajaA, 'PRE-001', m1.canonico, m1.hash).motivo, 'caja_no_abierta');
  });

  test('047: envío — solo una caja cerrada; recepción en laboratorio con umbral NULL → alerta y NO conciliada', () => {
    const abierta = nuevaCaja('CAJA-A-ABIERTA', CLI.A);
    assert.equal(db.json(`set role service_role; select public.registrar_envio_laboratorio('${abierta}', 'dhl', 'G1', now(), '${U.recepcionA}')`).motivo, 'caja_no_cerrada');
    assert.equal(db.json(`set role service_role; select public.registrar_recepcion_laboratorio('${cajaA}', now(), true, '[]', '${U.recepcionA}')`).motivo, 'caja_no_enviada');
    assert.equal(db.json(`set role service_role; select public.registrar_envio_laboratorio('${cajaA}', 'burro', 'G1', now(), '${U.recepcionA}')`).motivo, 'medio_invalido');
    const envio = db.json(`set role service_role; select public.registrar_envio_laboratorio('${cajaA}', 'dhl', 'GUIA-LAB-1', '2026-11-28T18:00:00Z', '${U.recepcionA}')`);
    assert.equal(envio.ok, true);
    assert.equal(db.su(`select estado from public.cajas where id='${cajaA}'`), 'enviada');
    assert.equal(db.su(`select tipo || '|' || (detalle->>'guia') from public.lote_eventos where lote_id='${LOTE.A}' order by secuencia desc limit 1`), 'envio_laboratorio|GUIA-LAB-1');
    assert.match(db.suFalla(`update public.envios_laboratorio set guia='x'`), /append-only/);

    assert.equal(db.su(`select coalesce(valor,'null') from public.configuracion_sistema where clave='umbral_conciliacion_peso_pct'`), 'null');
    const pesos = JSON.stringify([{ sobre_id: sobreA1, peso_g: '100.250' }]);
    const rec = db.json(`set role service_role; select public.registrar_recepcion_laboratorio('${cajaA}', '2026-11-29T15:00:00Z', true, '${pesos}', '${U.recepcionA}')`);
    assert.equal(rec.estado_conciliacion, 'umbral_no_configurado');
    assert.equal(rec.conciliada, false);
    assert.equal(conciliarManifiesto([{ id: sobreA1, peso_neto_g: '100.250' }], [{ sobre_id: sobreA1, peso_g: '100.250' }], null).estado, 'umbral_no_configurado');
    assert.equal(Number(db.su(`select count(*) from public.alertas_lote where lote_id='${LOTE.A}' and tipo='umbral_no_configurado' and not resuelta`)), 1);
    assert.equal(db.su(`select estado from public.cajas where id='${cajaA}'`), 'recibida');
    assert.equal(db.su(`select tipo || '|' || peso_g from public.lote_eventos where lote_id='${LOTE.A}' order by secuencia desc limit 1`), 'recepcion_laboratorio|100.250');
    assert.equal(db.su(`select estado from public.lotes where id='${LOTE.A}'`), 'abierto'); // nada se dio por conciliado
  });

  test('047: con un umbral de PRUEBA → conciliada / discrepancia / incompleto (igual que la regla en TS)', () => {
    db.su(`update public.configuracion_sistema set valor='2' where clave='umbral_conciliacion_peso_pct'`); // valor de prueba, no de negocio
    const ciclo = (n: number, pesoManifiesto: string, pesosRecibidos: Array<string | null>, precinto = true) => {
      const rec = nuevaRecepcion(`REC-A-C${n}`, PUNTO.A, LOTE.A, MINA.A, U.recepcionA);
      const caja = nuevaCaja(`CAJA-A-C${n}`, CLI.A);
      const ids: string[] = [];
      pesosRecibidos.forEach((_, k) => {
        const sb = nuevoSobre(rec, U.recepcionA);
        completarSobre(sb, pesoManifiesto, `ETQ-C${n}-${k}`);
        db.servicio(`update public.sobres set caja_id='${caja}', actualizado_por='${U.recepcionA}' where id='${sb}'`);
        ids.push(sb);
      });
      const m = manifiestoDe(caja, `PRE-C${n}`);
      assert.ok(m.ok);
      if (!m.ok) throw new Error('manifiesto');
      assert.equal(cerrar(caja, `PRE-C${n}`, m.canonico, m.hash).ok, true);
      assert.equal(db.json(`set role service_role; select public.registrar_envio_laboratorio('${caja}', 'en_persona', null, now(), '${U.recepcionA}')`).ok, true);
      const recibidos = ids.map((id, k) => ({ sobre_id: id, peso_g: pesosRecibidos[k] })).filter((x) => x.peso_g !== null) as Array<{ sobre_id: string; peso_g: string }>;
      const sql = db.json(`set role service_role; select public.registrar_recepcion_laboratorio('${caja}', now(), ${precinto}, '${JSON.stringify(recibidos)}', '${U.recepcionA}')`);
      const ts = conciliarManifiesto(m.manifiesto.sobres, recibidos, 2, precinto);
      assert.equal(sql.estado_conciliacion, ts.estado, `caso ${n}`);
      return String(sql.estado_conciliacion);
    };
    assert.equal(ciclo(1, '100.000', ['99.000', '101.500']), 'conciliada');
    assert.equal(ciclo(2, '100.000', ['99.000', '95.000']), 'discrepancia');
    assert.equal(ciclo(3, '100.000', ['100.000', null]), 'incompleto');
    assert.equal(ciclo(4, '100.000', ['100.000'], false), 'discrepancia'); // precinto roto
    assert.ok(Number(db.su(`select count(*) from public.alertas_lote where lote_id='${LOTE.A}' and tipo='conciliacion_peso'`)) >= 2);
    db.su(`update public.configuracion_sistema set valor=null where clave='umbral_conciliacion_peso_pct'`);
    assert.match(db.suFalla(`delete from public.recepciones_laboratorio`), /append-only/);
  });

  test('047: hash cruzado TS ↔ SQL de TODOS los eventos del lote, incluidos los tipos nuevos', () => {
    type Fila = { lote_id: string; secuencia: number; tipo: string; actor_user_id: string | null; fecha: string; lugar: string | null; peso_g: string | null; ley_fino: string | null; detalle: Record<string, unknown>; detalle_canonico: string; hash_previo: string; hash: string };
    const filas = db.json<Fila[]>(
      `select json_agg(x order by x.secuencia) from (select lote_id, secuencia, tipo, actor_user_id,
         to_char(fecha at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as fecha, lugar, peso_g::text, ley_fino::text, detalle, detalle_canonico, hash_previo, hash
         from public.lote_eventos where lote_id='${LOTE.A}') x`);
    const tipos = new Set(filas.map((f) => f.tipo));
    for (const t of TIPOS_EVENTO_RECEPCION) assert.ok(tipos.has(t), `falta un evento ${t} en la cadena`);
    for (const f of filas) {
      // El hash que calculó el trigger SQL es el que calcula TypeScript…
      assert.equal(hashEvento(f), f.hash, `hash distinto en secuencia ${f.secuencia} (${f.tipo})`);
      // …y el JSON canónico de SQL coincide con canonicalJson() de TS para el detalle.
      assert.equal(canonicalJson(f.detalle), f.detalle_canonico, `canónico distinto en ${f.tipo}`);
      assert.equal(hashEvento({ ...f, detalle_canonico: null }), f.hash);
    }
    assert.deepEqual(verificarCadena(filas), { ok: true, total: filas.length, primeraRotura: null, motivo: null });
    assert.equal(db.json(`select public.verificar_cadena_lote('${LOTE.A}')`).ok, true);
    // Ningún evento de este flujo es de pago, fundición ni refinado, ni lleva montos.
    for (const prohibido of ['pago', 'fundicion', 'refinado']) assert.ok(!tipos.has(prohibido), prohibido);
    assert.doesNotMatch(JSON.stringify(filas.map((f) => f.detalle)), /monto|precio|recibo|medio_pago/i);
  });

  test('047 (f): nada se borra — la anulación es un evento de corrección', () => {
    const rec = nuevaRecepcion('REC-A-ANULAR', PUNTO.A, LOTE.A, MINA.A, U.recepcionA);
    const sb = nuevoSobre(rec, U.recepcionA);
    assert.match(db.suFalla(`delete from public.recepciones where id='${rec}'`), /indeleble/);
    assert.match(db.suFalla(`delete from public.sobres where id='${sb}'`), /indeleble/);
    assert.match(db.suFalla(`delete from public.cajas where id='${cajaA}'`), /indeleble/);
    assert.match(db.servicioFalla(`delete from public.recepciones where id='${rec}'`), /permission denied/);
    assert.match(db.servicioFalla(`update public.recepciones set observaciones='cambio' where id='${rec}'`), /use anular_recepcion/);
    assert.equal(db.json(`set role service_role; select public.anular_recepcion('${rec}', 'no', '${U.recepcionA}')`).motivo, 'motivo_obligatorio');
    const antes = Number(db.su(`select count(*) from public.lote_eventos where lote_id='${LOTE.A}'`));
    assert.equal(db.json(`set role service_role; select public.anular_recepcion('${rec}', 'guía equivocada', '${U.recepcionA}')`).ok, true);
    assert.equal(db.su(`select estado || '|' || anulada_por from public.recepciones where id='${rec}'`), `anulada|${U.recepcionA}`);
    assert.equal(db.su(`select estado from public.sobres where id='${sb}'`), 'anulado');
    assert.equal(Number(db.su(`select count(*) from public.lote_eventos where lote_id='${LOTE.A}'`)), antes + 1);
    assert.equal(db.su(`select tipo || '|' || (detalle->>'anula') from public.lote_eventos where lote_id='${LOTE.A}' order by secuencia desc limit 1`), 'correccion|recepcion');
    assert.equal(db.json(`set role service_role; select public.anular_recepcion('${rec}', 'otra vez más', '${U.recepcionA}')`).motivo, 'ya_anulada');
    assert.match(db.servicioFalla(`insert into public.sobres (recepcion_id, registrado_por) values ('${rec}', '${U.recepcionA}')`), /recepcion_anulada/);
    // Lo que ya salió en una caja cerrada no se anula.
    assert.equal(db.json(`set role service_role; select public.anular_recepcion('${recA}', 'intento tardío', '${U.recepcionA}')`).motivo, 'sobres_en_caja_cerrada');
    assert.equal(db.json(`select public.verificar_cadena_lote('${LOTE.A}')`).ok, true);
  });

  test('047: RLS — el titular ve solo lo suyo; nadie autenticado escribe; recepcion ve solo su punto', () => {
    assert.ok(db.contar(U.clienteA, 'recepciones') >= 1);
    assert.equal(db.contar(U.clienteA, 'recepciones', `titular_cliente_id='${CLI.B}'`), 0);
    assert.equal(db.contar(U.clienteB, 'recepciones', `titular_cliente_id='${CLI.A}'`), 0);
    assert.equal(db.contar(U.clienteB, 'sobres', `titular_cliente_id='${CLI.A}'`), 0);
    assert.equal(db.contar(U.clienteB, 'cajas'), 0);
    for (const u of [U.comA, U.planta]) {
      for (const t of ['recepciones', 'sobres', 'cajas', 'envios_laboratorio', 'recepciones_laboratorio', 'puntos_recepcion', 'partes_flujo']) assert.equal(db.contar(u, t), 0, `${u} ve ${t}`);
    }
    // Alcance por punto: recepcionB (organización B) no ve el punto A.
    assert.equal(db.contar(U.recepcionB, 'recepciones', `punto_id='${PUNTO.A}'`), 0);
    assert.ok(db.contar(U.recepcionB, 'recepciones', `punto_id='${PUNTO.B}'`) >= 1);
    assert.ok(db.contar(U.recepcionA, 'recepciones', `punto_id='${PUNTO.A}'`) >= 1);
    assert.ok(db.contar(U.verificador, 'recepciones') >= 2);
    assert.ok(db.contar(U.auditor, 'cajas') >= 1);
    // Ningún rol autenticado escribe directo: todo pasa por la API (service_role).
    for (const u of [U.clienteA, U.comA, U.planta, U.auditor, U.recepcionA, U.verificador, U.admin]) {
      db.usuarioFalla(u, recepcionSql(`REC-DIRECTA-${u.slice(-2)}`, PUNTO.A, LOTE.A, MINA.A, u));
      db.usuarioFalla(u, `update public.sobres set etiqueta='x' where id='${sobreA1}'`);
      db.usuarioFalla(u, `select public.cerrar_caja('${cajaA}', 'p', 'm', 'h', '${u}')`);
    }
    db.anonFalla(`select * from public.recepciones`);
  });

  test('047: partes del flujo configurables; sin columnas de pago, monto, precio ni recibo', () => {
    db.servicio(`insert into public.partes_flujo (papel, organizacion_id, punto_id) values ('operador_recepcion', '${ORG.A}', '${PUNTO.A}'), ('laboratorio_destino', '${LAB}', '${PUNTO.A}')`);
    db.servicio(`insert into public.partes_flujo (papel, organizacion_id, lote_id) values ('parte_compradora', '${ORG.B}', '${LOTE.A}')`);
    db.servicioFalla(`insert into public.partes_flujo (papel, organizacion_id, punto_id) values ('operador_recepcion', '${ORG.B}', '${PUNTO.A}')`); // uno vigente por papel y punto
    db.servicioFalla(`insert into public.partes_flujo (papel, organizacion_id) values ('operador_recepcion', '${ORG.A}')`); // lote o punto
    db.servicioFalla(`insert into public.partes_flujo (papel, organizacion_id, punto_id) values ('pagador', '${ORG.A}', '${PUNTO.B}')`);
    const columnas = db.su(`select string_agg(table_name || '.' || column_name, ',') from information_schema.columns
      where table_schema='public' and table_name in ('recepciones','sobres','cajas','envios_laboratorio','recepciones_laboratorio','partes_flujo','puntos_recepcion')
        and column_name ~* 'monto|pago|precio|recibo|lempira|factura'`);
    assert.equal(columnas, '');
    // Lo de la 043 sigue intacto.
    assert.equal(Number(db.su(`select count(*) from information_schema.tables where table_name='pagos_lote'`)), 1);
    assert.ok(db.su(`select pg_get_functiondef('public.registrar_pago_lote(uuid,text,text,numeric,text,date,uuid)'::regprocedure)`).length > 0);
  });
});
