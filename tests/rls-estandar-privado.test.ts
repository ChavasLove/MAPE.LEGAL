// tests/rls-estandar-privado.test.ts — políticas RLS, triggers y RPCs de la
// migración 043 (estándar privado de debida diligencia) contra un PostgreSQL
// REAL. Nunca toca Supabase ni producción.
//
// Fuente de la base de datos (en este orden):
//   1. PGTEST_URL (CI: postgres://postgres:postgres@localhost:5432/postgres).
//   2. Un clúster PostgreSQL 16 local efímero (initdb + pg_ctl en un directorio
//      temporal, socket Unix, sin TCP) si existe /usr/lib/postgresql/*/bin/pg_ctl.
//      Como root, initdb corre vía `su postgres`.
//   3. Si no hay nada → la suite se omite (skip) con mensaje claro.
//
// Secuencia: tests/sql/043_fixtures.sql (esquema stub) → 043 ×2 (idempotencia)
// → tests/sql/043_seed.sql → casos con `set role` + `set app.uid`.
// Corre con: npm test   (node --experimental-strip-types --test)

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, chmodSync, chownSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRACION = join(ROOT, 'supabase', 'migrations', '043_estandar_privado_cadena.sql');
const FIXTURES = join(ROOT, 'tests', 'sql', '043_fixtures.sql');
const SEED = join(ROOT, 'tests', 'sql', '043_seed.sql');

/* ── Descubrimiento de PostgreSQL ────────────────────────────────────────── */

function which(bin: string): string | null {
  const r = spawnSync('which', [bin], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

function findPgBinDir(): string | null {
  const base = '/usr/lib/postgresql';
  if (!existsSync(base)) return null;
  const versions = readdirSync(base)
    .filter((v) => /^\d+$/.test(v))
    .sort((a, b) => Number(b) - Number(a));
  for (const v of versions) {
    const dir = join(base, v, 'bin');
    if (existsSync(join(dir, 'pg_ctl')) && existsSync(join(dir, 'initdb'))) return dir;
  }
  return null;
}

const PGTEST_URL = process.env.PGTEST_URL?.trim() || null;
const PG_BIN = PGTEST_URL ? null : findPgBinDir();
const PSQL = which('psql') ?? (PG_BIN ? join(PG_BIN, 'psql') : null);
const SKIP_REASON = !PSQL
  ? 'psql no está instalado — se omite la suite RLS de la migración 043'
  : !PGTEST_URL && !PG_BIN
    ? 'sin PGTEST_URL ni PostgreSQL local (/usr/lib/postgresql/*/bin/pg_ctl) — se omite la suite RLS de la migración 043'
    : undefined;

/* ── Clúster efímero ─────────────────────────────────────────────────────── */

interface Cluster {
  psqlArgs: string[];
  stop: () => void;
}

function sh(cmd: string, args: string[], opts: { input?: string } = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', input: opts.input, maxBuffer: 64 * 1024 * 1024 });
}

/** Ejecuta un comando como el usuario postgres cuando corremos como root. */
function asPostgres(cmd: string): ReturnType<typeof sh> {
  const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
  if (isRoot) return sh('su', ['postgres', '-s', '/bin/bash', '-c', cmd]);
  return sh('/bin/bash', ['-c', cmd]);
}

function startCluster(): Cluster {
  if (PGTEST_URL) return { psqlArgs: [PGTEST_URL], stop: () => {} };
  if (!PG_BIN) throw new Error('sin PostgreSQL local');

  const dir = mkdtempSync(join(tmpdir(), 'mape-043-pg-'));
  const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
  // initdb se niega a correr como root: el directorio pasa a postgres y los
  // ancestros deben ser atravesables (o+x) para ese usuario.
  if (isRoot) {
    let p = dir;
    while (p !== '/' && p !== '.') {
      try { chmodSync(p, 0o755); } catch { /* ancestros del sistema: ignorar */ }
      p = dirname(p);
    }
    const ids = sh('id', ['-u', 'postgres']);
    const gids = sh('id', ['-g', 'postgres']);
    if (ids.status === 0 && gids.status === 0) {
      chownSync(dir, Number(ids.stdout.trim()), Number(gids.stdout.trim()));
    }
  }
  const data = join(dir, 'data');
  const port = 50000 + Math.floor(Math.random() * 9000);
  const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

  const init = asPostgres(`${q(join(PG_BIN, 'initdb'))} -D ${q(data)} -U postgres -A trust >${q(join(dir, 'initdb.log'))} 2>&1`);
  if (init.status !== 0) {
    throw new Error(`initdb falló: ${init.stderr}\n${safeRead(join(dir, 'initdb.log'))}`);
  }
  const start = asPostgres(
    `${q(join(PG_BIN, 'pg_ctl'))} -D ${q(data)} -o "-k ${dir} -p ${port} -c listen_addresses=''" -l ${q(join(dir, 'pg.log'))} -w start`,
  );
  if (start.status !== 0) {
    throw new Error(`pg_ctl start falló: ${start.stderr}\n${safeRead(join(dir, 'pg.log'))}`);
  }
  return {
    psqlArgs: ['-h', dir, '-p', String(port), '-U', 'postgres', '-d', 'postgres'],
    stop: () => {
      asPostgres(`${q(join(PG_BIN, 'pg_ctl'))} -D ${q(data)} -m immediate stop`);
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignorar */ }
    },
  };
}

function safeRead(p: string): string {
  try { return readFileSync(p, 'utf8'); } catch { return ''; }
}

/* ── Helpers psql ────────────────────────────────────────────────────────── */

let cluster: Cluster | null = null;

interface Res { status: number; out: string; err: string }

function psql(sql: string, file?: string): Res {
  if (!cluster || !PSQL) throw new Error('clúster no iniciado');
  const args = [...cluster.psqlArgs, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-At', '-F', '|'];
  if (file) args.push('-f', file);
  const r = sh(PSQL, args, { input: file ? undefined : sql });
  return { status: r.status ?? 1, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
}

/** Ejecuta SQL como superusuario; falla el test si psql falla. */
function su(sql: string): string {
  const r = psql(sql);
  assert.equal(r.status, 0, `SQL falló:\n${sql}\n--- stderr ---\n${r.err}`);
  return r.out;
}

/** Ejecuta SQL esperando un error; devuelve stderr. */
function suFalla(sql: string): string {
  const r = psql(sql);
  assert.notEqual(r.status, 0, `se esperaba un error y el SQL pasó:\n${sql}\n--- stdout ---\n${r.out}`);
  return r.err;
}

const U = {
  admin: 'a0000000-0000-4000-8000-000000000001',
  comA: 'a0000000-0000-4000-8000-000000000002',
  comB: 'a0000000-0000-4000-8000-000000000003',
  planta: 'a0000000-0000-4000-8000-000000000004',
  auditor: 'a0000000-0000-4000-8000-000000000005',
  cliente: 'a0000000-0000-4000-8000-000000000006',
} as const;
const ORG = {
  A: 'b0000000-0000-4000-8000-000000000001',
  B: 'b0000000-0000-4000-8000-000000000002',
  P: 'b0000000-0000-4000-8000-000000000003',
  AUD: 'b0000000-0000-4000-8000-000000000004',
} as const;
const CLI = { C1: 'c0000000-0000-4000-8000-000000000001', C2: 'c0000000-0000-4000-8000-000000000002' } as const;
const FUENTE = { A1: 'd0000000-0000-4000-8000-000000000001', B1: 'd0000000-0000-4000-8000-000000000002', BAD: 'd0000000-0000-4000-8000-000000000003' } as const;
const LOTE = { A1: 'e0000000-0000-4000-8000-000000000001', B1: 'e0000000-0000-4000-8000-000000000002', H: '11111111-1111-4111-8111-111111111111' } as const;

type Rol = 'anon' | 'authenticated' | 'service_role';

/** SQL con `set role` + sesión simulada (auth.uid()). */
function como(rol: Rol, uid: string | null, sql: string): string {
  const pre = `set role ${rol};\n` + (uid ? `set app.uid = '${uid}';\n` : '');
  return pre + sql;
}
function asUser(uid: string, sql: string): string { return su(como('authenticated', uid, sql)); }
function asUserFalla(uid: string, sql: string): string { return suFalla(como('authenticated', uid, sql)); }
function count(uid: string, from: string, where = 'true'): number {
  return Number(asUser(uid, `select count(*) from public.${from} where ${where};`));
}
function countSu(from: string, where = 'true'): number {
  return Number(su(`select count(*) from public.${from} where ${where};`));
}
function json(sql: string): Record<string, unknown> {
  return JSON.parse(su(sql)) as Record<string, unknown>;
}

/* ── Suite ───────────────────────────────────────────────────────────────── */

describe('migración 043 — estándar privado (RLS, triggers, RPCs)', { skip: SKIP_REASON }, () => {
  before(() => {
    cluster = startCluster();
    const fx = psql('', FIXTURES);
    assert.equal(fx.status, 0, `fixtures fallaron:\n${fx.err}`);
    const m1 = psql('', MIGRACION);
    assert.equal(m1.status, 0, `043 (1ª pasada) falló:\n${m1.err}`);
    const m2 = psql('', MIGRACION);
    assert.equal(m2.status, 0, `043 (2ª pasada, idempotencia) falló:\n${m2.err}`);
    const seed = psql('', SEED);
    assert.equal(seed.status, 0, `seed falló:\n${seed.err}`);
  });

  after(() => {
    cluster?.stop();
    cluster = null;
  });

  test('idempotencia: roles sembrados, CHECK ampliado, objetos únicos', () => {
    assert.equal(countSu('roles', `nombre in ('comercializador','planta','auditor')`), 3);
    assert.equal(Number(su(`select count(*) from pg_constraint where conrelid='public.user_roles'::regclass and contype='c'`)), 2);
    const def = su(`select pg_get_constraintdef(oid) from pg_constraint where conname='user_roles_rol_check'`);
    assert.match(def, /comercializador/);
    assert.match(def, /planta/);
    assert.match(def, /auditor/);
    assert.equal(Number(su(`select count(*) from pg_trigger where tgname='lote_evento_encadenar' and not tgisinternal`)), 1);
    assert.equal(su(`select valor is null from public.configuracion_sistema where clave='umbral_conciliacion_peso_pct'`), 't');
  });

  test('user_roles: comercializador/planta exigen org del tipo correcto', () => {
    su(`insert into auth.users (id) values ('a0000000-0000-4000-8000-000000000099');`);
    assert.match(
      suFalla(`insert into public.user_roles (user_id, rol) values ('a0000000-0000-4000-8000-000000000099','planta');`),
      /user_roles_org_requerida_check/,
    );
    assert.match(
      suFalla(`insert into public.user_roles (user_id, rol, organizacion_id) values ('a0000000-0000-4000-8000-000000000099','planta','${ORG.A}');`),
      /no coincide con el rol/,
    );
  });

  test('hash: vector de prueba = lib/cadena/hash.ts y verificar_cadena_lote ok', () => {
    const fila = su(`
      insert into public.lote_eventos (lote_id, tipo, actor_user_id, fecha, lugar, peso_g, ley_fino, detalle, detalle_canonico)
      values ('${LOTE.H}', 'origen_mina', null, '2026-11-12T14:05:06.007Z', 'Iriona', 1250.5, 0.9165,
              '{"b":"x","a":1}'::jsonb, '{"a":1,"b":"x"}')
      returning secuencia || '|' || hash_previo || '|' || hash;`);
    assert.equal(fila, '1|GENESIS|a2e60d8d5871069087b5bda166e719a73303777c81a04436633e1938944f09b8');

    // Fallback jsonb_canonico (sin detalle_canonico): claves ordenadas, anidado.
    const seg = su(`
      insert into public.lote_eventos (lote_id, tipo, actor_user_id, fecha, lugar, peso_g, detalle)
      values ('${LOTE.H}', 'acopio', '${U.comA}', '2026-11-12T15:00:00.000Z', 'Acopio', 1249.75,
              '{"b":"x","a":{"z":1,"y":[true,null,"q"]}}'::jsonb)
      returning secuencia || '|' || detalle_canonico || '|' || (hash_previo = 'a2e60d8d5871069087b5bda166e719a73303777c81a04436633e1938944f09b8');`);
    assert.equal(seg, '2|{"a":{"y":[true,null,"q"],"z":1},"b":"x"}|true');

    const v = json(`select public.verificar_cadena_lote('${LOTE.H}');`);
    assert.deepEqual(v, { ok: true, total: 2, primera_rotura: null, motivo: null });

    // Un hash recibido que no coincide con el canónico se rechaza.
    assert.match(
      suFalla(`insert into public.lote_eventos (lote_id, tipo, hash) values ('${LOTE.H}', 'nota', repeat('0', 64));`),
      /hash_no_coincide/,
    );
    assert.match(
      suFalla(`insert into public.lote_eventos (lote_id, tipo, secuencia) values ('${LOTE.H}', 'nota', 9);`),
      /secuencia_no_coincide/,
    );
  });

  test('lote_eventos es append-only (trigger + revoke) y la verificación detecta alteraciones', () => {
    assert.match(suFalla(`update public.lote_eventos set lugar = 'X' where lote_id = '${LOTE.H}' and secuencia = 1;`), /append-only/);
    assert.match(suFalla(`delete from public.lote_eventos where lote_id = '${LOTE.H}';`), /append-only/);
    assert.match(
      suFalla(como('service_role', null, `update public.lote_eventos set lugar = 'X' where lote_id = '${LOTE.H}';`)),
      /permission denied/,
    );
    assert.match(
      suFalla(como('service_role', null, `delete from public.lote_eventos where lote_id = '${LOTE.H}';`)),
      /permission denied/,
    );
    // Simulación de manipulación directa (trigger deshabilitado por el superusuario):
    // la cadena se rompe y verificar_cadena_lote lo reporta.
    const v = json(`
      alter table public.lote_eventos disable trigger lote_eventos_append_only;
      update public.lote_eventos set peso_g = 1251 where lote_id = '${LOTE.H}' and secuencia = 1;
      alter table public.lote_eventos enable trigger lote_eventos_append_only;
      select public.verificar_cadena_lote('${LOTE.H}');`);
    assert.equal(v.ok, false);
    assert.equal(v.primera_rotura, 1);
    assert.equal(v.motivo, 'hash_alterado');
    su(`
      alter table public.lote_eventos disable trigger lote_eventos_append_only;
      update public.lote_eventos set peso_g = 1250.5 where lote_id = '${LOTE.H}' and secuencia = 1;
      alter table public.lote_eventos enable trigger lote_eventos_append_only;`);
    assert.equal(json(`select public.verificar_cadena_lote('${LOTE.H}');`).ok, true);
  });

  test('elegibilidad de la fuente: lote nace bloqueado + alertas fuente_no_elegible y mercurio', () => {
    const r = su(`
      insert into public.lotes (codigo, fuente_id) values ('LOTE-BAD', '${FUENTE.BAD}')
      returning id || '|' || estado || '|' || bloqueo_motivo || '|' || cliente_id || '|' || comercializador_org_id;`);
    const [id, estado, motivo, cliente, org] = r.split('|');
    assert.equal(estado, 'bloqueado');
    assert.equal(motivo, 'permiso_municipal_no_vigente;fuera_de_area_inhgeomin;clpi_pendiente');
    assert.equal(cliente, CLI.C1);
    assert.equal(org, ORG.A);
    assert.equal(countSu('alertas_lote', `lote_id = '${id}' and tipo = 'fuente_no_elegible'`), 1);
    assert.equal(countSu('alertas_lote', `lote_id = '${id}' and tipo = 'mercurio'`), 1);
    assert.equal(
      su(`select detalle->'bloqueos' from public.alertas_lote where lote_id = '${id}' and tipo = 'fuente_no_elegible'`),
      '["permiso_municipal_no_vigente", "fuera_de_area_inhgeomin", "clpi_pendiente"]',
    );
    // Fuente elegible → abierto, sin alertas.
    const ok = su(`insert into public.lotes (codigo, fuente_id) values ('LOTE-OK', '${FUENTE.A1}') returning id || '|' || estado || '|' || coalesce(bloqueo_motivo,'');`);
    assert.equal(ok.split('|').slice(1).join('|'), 'abierto|');
    assert.equal(countSu('alertas_lote', `lote_id = '${ok.split('|')[0]}'`), 0);
    // Cliente distinto al de la fuente → rechazo.
    assert.match(
      suFalla(`insert into public.lotes (codigo, fuente_id, cliente_id) values ('LOTE-X', '${FUENTE.A1}', '${CLI.C2}');`),
      /lote_cliente_no_coincide/,
    );
  });

  test('fundición: el comercializador no funde; exige titular de beneficio identificado', () => {
    assert.match(
      suFalla(`insert into public.lote_eventos (lote_id, tipo, actor_rol, detalle) values ('${LOTE.A1}', 'fundicion', 'comercializador', '{"titular_beneficio":{"nombre":"Planta P","identificacion":"RTN-1"}}');`),
      /fundicion_no_permitida: el comercializador no funde/,
    );
    assert.match(
      suFalla(`insert into public.lote_eventos (lote_id, tipo, actor_rol, detalle) values ('${LOTE.A1}', 'fundicion', 'planta', '{"realizado_por_rol":"comercializador","titular_beneficio":{"nombre":"Planta P","identificacion":"RTN-1"}}');`),
      /fundicion_no_permitida: el comercializador no funde/,
    );
    assert.match(
      suFalla(`insert into public.lote_eventos (lote_id, tipo, actor_rol, detalle) values ('${LOTE.A1}', 'fundicion', 'planta', '{"titular_beneficio":{"nombre":"  ","identificacion":"RTN-1"}}');`),
      /fundicion_no_permitida: sin titular de beneficio identificado/,
    );
    assert.match(
      suFalla(`insert into public.lote_eventos (lote_id, tipo, actor_rol) values ('${LOTE.A1}', 'fundicion', 'planta');`),
      /fundicion_no_permitida: sin titular de beneficio identificado/,
    );
    assert.equal(countSu('lote_eventos', `lote_id = '${LOTE.A1}' and tipo = 'fundicion'`), 0);
    su(`insert into public.lote_eventos (lote_id, tipo, actor_user_id, actor_rol, detalle) values ('${LOTE.A1}', 'fundicion', '${U.planta}', 'planta', '{"titular_beneficio":{"nombre":"Planta de beneficio P","identificacion":"RTN-0801"}}');`);
    assert.equal(countSu('lote_eventos', `lote_id = '${LOTE.A1}' and tipo = 'fundicion'`), 1);
  });

  test('conciliar_lote: umbral NULL → alerta y estado intacto; 5 → alerta; 10 → conciliado', () => {
    const r0 = json(`select public.conciliar_lote('${LOTE.A1}', '${U.admin}');`);
    assert.equal(r0.estado, 'umbral_no_configurado');
    assert.equal(r0.conciliado, false);
    assert.equal(r0.lote_estado, 'abierto');
    assert.equal(su(`select estado from public.lotes where id = '${LOTE.A1}'`), 'abierto');
    assert.equal(countSu('alertas_lote', `lote_id = '${LOTE.A1}' and tipo = 'umbral_no_configurado'`), 1);
    json(`select public.conciliar_lote('${LOTE.A1}', '${U.admin}');`);
    assert.equal(countSu('alertas_lote', `lote_id = '${LOTE.A1}' and tipo = 'umbral_no_configurado'`), 1, 'no duplica la alerta sin resolver');

    su(`update public.configuracion_sistema set valor = '5' where clave = 'umbral_conciliacion_peso_pct';`);
    const r5 = json(`select public.conciliar_lote('${LOTE.A1}', '${U.admin}');`);
    assert.equal(r5.estado, 'alerta');
    assert.deepEqual(r5.faltan, []);
    const difs = r5.diferencias as Array<Record<string, unknown>>;
    assert.equal(difs.length, 3);
    assert.deepEqual(difs.map((d) => `${d.desde}>${d.hasta}`), ['origen_mina>acopio', 'acopio>laboratorio', 'laboratorio>refinado']);
    assert.deepEqual(difs.map((d) => d.excede), [false, false, true]);
    assert.ok(Math.abs(Number(difs[2].diferencia_pct) - 9.0909) < 0.001);
    assert.equal(su(`select estado from public.lotes where id = '${LOTE.A1}'`), 'abierto');
    assert.equal(countSu('alertas_lote', `lote_id = '${LOTE.A1}' and tipo = 'conciliacion_peso'`), 1);

    su(`update public.configuracion_sistema set valor = '10' where clave = 'umbral_conciliacion_peso_pct';`);
    const r10 = json(`select public.conciliar_lote('${LOTE.A1}', '${U.admin}');`);
    assert.equal(r10.estado, 'conciliado');
    assert.equal(r10.conciliado, true);
    assert.equal(su(`select estado from public.lotes where id = '${LOTE.A1}'`), 'conciliado');

    // Incompleto (sin pesajes) y nunca desbloquea un lote bloqueado.
    const rb = json(`select public.conciliar_lote((select id from public.lotes where codigo = 'LOTE-BAD'), '${U.admin}');`);
    assert.equal(rb.estado, 'incompleto');
    assert.equal(rb.lote_estado, 'bloqueado');
    assert.equal(su(`select estado from public.lotes where codigo = 'LOTE-BAD'`), 'bloqueado');
  });

  test('registrar_pago_lote: efectivo bloquea el lote (sin excepción) + alerta; bancario → pago + evento', () => {
    const ef = json(`select public.registrar_pago_lote('${LOTE.B1}', 'efectivo', 'n/a', 1000, null, current_date, '${U.comB}');`);
    assert.deepEqual(ef, { ok: false, motivo: 'efectivo_prohibido', lote_bloqueado: true });
    assert.equal(su(`select estado || '|' || bloqueo_motivo from public.lotes where id = '${LOTE.B1}'`), 'bloqueado|pago_invalido: efectivo_prohibido');
    assert.equal(countSu('alertas_lote', `lote_id = '${LOTE.B1}' and tipo = 'pago_invalido'`), 1);
    assert.equal(countSu('pagos_lote', `lote_id = '${LOTE.B1}'`), 0);
    // Ya bloqueado: ningún pago, ni válido, pasa.
    const post = json(`select public.registrar_pago_lote('${LOTE.B1}', 'transferencia', 'REF-123456', 1000, 'Banco X', current_date, '${U.comB}');`);
    assert.equal(post.ok, false);
    assert.equal(post.motivo, 'lote_bloqueado');

    // Referencia corta y medio no admitido también bloquean (otro lote).
    const corto = json(`select public.registrar_pago_lote((select id from public.lotes where codigo = 'LOTE-OK'), 'transferencia', '12', 500, null, current_date, '${U.comA}');`);
    assert.equal(corto.motivo, 'sin_referencia_bancaria');
    assert.equal(su(`select estado from public.lotes where codigo = 'LOTE-OK'`), 'bloqueado');

    // Pago válido sobre LOTE-A1 (conciliado): pago + evento 'pago' sin monto, cadena íntegra.
    const antes = countSu('lote_eventos', `lote_id = '${LOTE.A1}'`);
    const ok = json(`select public.registrar_pago_lote('${LOTE.A1}', 'Transferencia', ' REF-2026-0001 ', 48250.75, 'Banco Y', '2026-11-12', '${U.comA}');`);
    assert.equal(ok.ok, true);
    assert.equal(countSu('pagos_lote', `lote_id = '${LOTE.A1}' and id = '${ok.pago_id}' and medio = 'transferencia' and referencia_bancaria = 'REF-2026-0001' and monto_lps = 48250.75 and beneficiario_cliente_id = '${CLI.C1}' and pagado_por_org_id = '${ORG.A}'`), 1);
    assert.equal(countSu('lote_eventos', `lote_id = '${LOTE.A1}'`), antes + 1);
    const ev = su(`select detalle::text || '|' || actor_rol from public.lote_eventos where lote_id = '${LOTE.A1}' and tipo = 'pago'`);
    assert.doesNotMatch(ev, /monto/);
    assert.match(ev, /"pago_id"/);
    assert.match(ev, /\|comercializador$/);
    assert.equal(json(`select public.verificar_cadena_lote('${LOTE.A1}');`).ok, true);

    // pagos_lote es indeleble; nadie inserta directo salvo service_role.
    assert.match(suFalla(como('service_role', null, `delete from public.pagos_lote;`)), /permission denied/);
    assert.match(
      asUserFalla(U.comA, `insert into public.pagos_lote (lote_id, monto_lps, medio, referencia_bancaria, fecha_pago, beneficiario_cliente_id, pagado_por_org_id) values ('${LOTE.A1}', 1, 'deposito', 'REF-9999', current_date, '${CLI.C1}', '${ORG.A}');`),
      /permission denied/,
    );
    // Solo service_role ejecuta los RPCs de pago y conciliación.
    assert.match(asUserFalla(U.comA, `select public.registrar_pago_lote('${LOTE.A1}', 'deposito', 'REF-1', 1, null, current_date, '${U.comA}');`), /permission denied/);
    assert.match(asUserFalla(U.admin, `select public.conciliar_lote('${LOTE.A1}', '${U.admin}');`), /permission denied/);
  });

  test('RLS staff (admin): lee todo salvo márgenes; escribe fuentes/lotes/eventos', () => {
    assert.equal(count(U.admin, 'lotes'), countSu('lotes'));
    assert.equal(count(U.admin, 'fuentes_comercializador'), countSu('fuentes_comercializador'));
    assert.equal(count(U.admin, 'lote_eventos'), countSu('lote_eventos'));
    assert.equal(count(U.admin, 'pagos_lote'), countSu('pagos_lote'));
    assert.equal(count(U.admin, 'alertas_lote'), countSu('alertas_lote'));
    assert.equal(count(U.admin, 'organizaciones'), 4);
    su(`insert into public.margenes_comercializador (organizacion_id, lote_id, precio_venta_lps, margen_pct) values ('${ORG.A}', '${LOTE.A1}', 51000, 5.5);`);
    assert.equal(count(U.admin, 'margenes_comercializador'), 0, 'CHT no ve márgenes');
    asUser(U.admin, `insert into public.lote_eventos (lote_id, tipo, actor_user_id, actor_rol) values ('${LOTE.B1}', 'nota', '${U.admin}', 'admin');`);
    asUser(U.admin, `update public.lotes set estado = 'cerrado' where codigo = 'LOTE-OK' and estado = 'conciliado';`);
    assert.match(asUserFalla(U.admin, `delete from public.lotes where codigo = 'LOTE-OK';`), /permission denied/);
    assert.match(asUserFalla(U.admin, `delete from public.fuentes_comercializador where id = '${FUENTE.BAD}';`), /permission denied/);
  });

  test('RLS comercializador: solo su organización', () => {
    assert.equal(count(U.comA, 'lotes'), countSu('lotes', `comercializador_org_id = '${ORG.A}'`));
    assert.equal(count(U.comA, 'lotes', `comercializador_org_id = '${ORG.B}'`), 0);
    assert.equal(count(U.comA, 'fuentes_comercializador'), countSu('fuentes_comercializador', `organizacion_id = '${ORG.A}'`));
    assert.equal(count(U.comB, 'fuentes_comercializador'), 1);
    assert.equal(count(U.comA, 'lote_eventos'), countSu('lote_eventos e', `exists (select 1 from public.lotes l where l.id = e.lote_id and l.comercializador_org_id = '${ORG.A}')`));
    assert.equal(count(U.comA, 'pagos_lote'), countSu('pagos_lote', `pagado_por_org_id = '${ORG.A}'`));
    assert.equal(count(U.comB, 'pagos_lote'), 0);
    assert.equal(count(U.comA, 'alertas_lote'), countSu('alertas_lote a', `exists (select 1 from public.lotes l where l.id = a.lote_id and l.comercializador_org_id = '${ORG.A}')`));
    assert.equal(count(U.comA, 'organizaciones'), 1);
    assert.equal(count(U.comA, 'consentimientos'), 0);
    // Escribe en lo suyo…
    asUser(U.comA, `insert into public.fuentes_comercializador (organizacion_id, cliente_id, permiso_vigente_hasta, dentro_area_inhgeomin, declaracion_mercurio_cero, clpi_estado, registrado_por) values ('${ORG.A}', '${CLI.C1}', current_date + 30, true, true, 'documentado', '${U.comA}');`);
    asUser(U.comA, `insert into public.lotes (codigo, fuente_id, created_by) values ('LOTE-A2', '${FUENTE.A1}', '${U.comA}');`);
    asUser(U.comA, `insert into public.lote_eventos (lote_id, tipo, actor_user_id, actor_rol, peso_g) values ((select id from public.lotes where codigo = 'LOTE-A2'), 'origen_mina', '${U.comA}', 'comercializador', 500);`);
    // …y no en lo ajeno.
    assert.match(asUserFalla(U.comA, `insert into public.fuentes_comercializador (organizacion_id, cliente_id) values ('${ORG.B}', '${CLI.C2}');`), /row-level security/);
    assert.match(asUserFalla(U.comA, `insert into public.lotes (codigo, fuente_id) values ('LOTE-B2', '${FUENTE.B1}');`), /row-level security/);
    assert.match(asUserFalla(U.comA, `insert into public.lote_eventos (lote_id, tipo) values ('${LOTE.B1}', 'nota');`), /row-level security/);
    assert.equal(Number(asUser(U.comA, `update public.lotes set planta_org_id = '${ORG.P}' where id = '${LOTE.B1}' returning 1;`) || 0), 0, 'update ajeno no afecta filas');
    // Márgenes: solo los propios.
    asUser(U.comA, `insert into public.margenes_comercializador (organizacion_id, precio_venta_lps, margen_pct) values ('${ORG.A}', 52000, 6);`);
    assert.equal(count(U.comA, 'margenes_comercializador'), 2);
    assert.equal(count(U.comB, 'margenes_comercializador'), 0);
    assert.match(asUserFalla(U.comB, `insert into public.margenes_comercializador (organizacion_id, precio_venta_lps) values ('${ORG.A}', 1);`), /row-level security/);
  });

  test('RLS planta: sus lotes y eventos; nunca pagos ni márgenes; expediente solo con consentimiento', () => {
    assert.equal(count(U.planta, 'lotes'), countSu('lotes', `planta_org_id = '${ORG.P}'`));
    assert.ok(count(U.planta, 'lotes') >= 1);
    assert.equal(count(U.planta, 'lote_eventos'), countSu('lote_eventos e', `exists (select 1 from public.lotes l where l.id = e.lote_id and l.planta_org_id = '${ORG.P}')`));
    assert.equal(count(U.planta, 'alertas_lote'), countSu('alertas_lote a', `exists (select 1 from public.lotes l where l.id = a.lote_id and l.planta_org_id = '${ORG.P}')`));
    assert.equal(count(U.planta, 'pagos_lote'), 0, 'planta nunca ve pagos');
    assert.equal(count(U.planta, 'margenes_comercializador'), 0, 'planta nunca ve márgenes');
    assert.equal(count(U.planta, 'fuentes_comercializador'), 0);
    asUser(U.planta, `insert into public.lote_eventos (lote_id, tipo, actor_user_id, actor_rol, peso_g) values ('${LOTE.A1}', 'recepcion_planta', '${U.planta}', 'planta', 899.5);`);
    assert.match(asUserFalla(U.planta, `insert into public.lote_eventos (lote_id, tipo) values ('${LOTE.H}', 'nota');`), /row-level security/);
    assert.match(asUserFalla(U.planta, `insert into public.lotes (codigo, fuente_id) values ('LOTE-P', '${FUENTE.A1}');`), /row-level security/);

    // Expediente / documentos / ficha del minero: 0 sin consentimiento.
    assert.equal(count(U.planta, 'expedientes'), 0);
    assert.equal(count(U.planta, 'documentos'), 0);
    assert.equal(count(U.planta, 'clientes'), 0);
    assert.equal(count(U.planta, 'consentimientos'), 0);

    su(`insert into public.consentimientos (id, cliente_id, otorgado_a_org_id, documento_path, hash_sha256, fecha_firma, alcance, registrado_por)
        values ('99000000-0000-4000-8000-000000000001', '${CLI.C1}', '${ORG.P}', 'consentimientos/c1-p.pdf', repeat('ab', 32), current_date, '{"expediente":true,"documentos":true}', '${U.admin}');`);
    assert.equal(count(U.planta, 'expedientes'), 1);
    assert.equal(count(U.planta, 'documentos'), 1);
    assert.equal(count(U.planta, 'clientes'), 1);
    assert.equal(count(U.planta, 'consentimientos'), 1, 'la planta ve los consentimientos otorgados a su org');
    // Alcance parcial: sin "documentos" no ve documentos.
    su(`insert into public.consentimientos (id, cliente_id, otorgado_a_org_id, documento_path, hash_sha256, fecha_firma, alcance)
        values ('99000000-0000-4000-8000-000000000002', '${CLI.C2}', '${ORG.P}', 'consentimientos/c2-p.pdf', repeat('cd', 32), current_date, '{"expediente":true}');`);
    assert.equal(count(U.planta, 'clientes'), 2);

    // Revocación: 0 filas desde revocado_en; el consentimiento no se borra ni se altera.
    assert.match(suFalla(`update public.consentimientos set alcance = '{}' where id = '99000000-0000-4000-8000-000000000001';`), /vigente → revocado/);
    assert.match(suFalla(`delete from public.consentimientos where id = '99000000-0000-4000-8000-000000000001';`), /indeleble/);
    su(`update public.consentimientos set estado = 'revocado', revocacion_motivo = 'solicitud del minero' where id = '99000000-0000-4000-8000-000000000001';`);
    assert.equal(su(`select revocado_en is not null from public.consentimientos where id = '99000000-0000-4000-8000-000000000001'`), 't');
    assert.equal(count(U.planta, 'expedientes'), 0);
    assert.equal(count(U.planta, 'documentos'), 0);
    assert.equal(count(U.planta, 'clientes'), 1, 'solo queda la ficha del cliente 2');
    assert.match(suFalla(`update public.consentimientos set estado = 'vigente' where id = '99000000-0000-4000-8000-000000000001';`), /vigente → revocado/);
    // Revocación con fecha efectiva futura: el acceso sigue hasta esa fecha.
    su(`update public.consentimientos set estado = 'revocado', revocado_en = now() + interval '1 hour' where id = '99000000-0000-4000-8000-000000000002';`);
    assert.equal(count(U.planta, 'clientes'), 1);
    su(`insert into public.consentimientos (cliente_id, otorgado_a_org_id, documento_path, hash_sha256, fecha_firma, alcance)
        values ('${CLI.C2}', '${ORG.P}', 'consentimientos/c2-p-2.pdf', repeat('ef', 32), current_date, '{"expediente":true}');`);
    su(`update public.consentimientos set estado = 'revocado', revocado_en = now() - interval '1 minute' where documento_path = 'consentimientos/c2-p-2.pdf';`);
    su(`update public.consentimientos set estado = 'revocado', revocado_en = now() - interval '1 minute' where id = '99000000-0000-4000-8000-000000000002' and estado = 'vigente';`);
    // (el 2 ya estaba revocado a futuro: sigue vigente 1 h; el nuevo caducó)
    assert.equal(count(U.planta, 'clientes'), 1);
  });

  test('RLS cliente: solo sus lotes, eventos, pagos y consentimientos', () => {
    assert.equal(count(U.cliente, 'lotes'), countSu('lotes', `cliente_id = '${CLI.C1}'`));
    assert.ok(count(U.cliente, 'lotes') >= 2);
    assert.equal(count(U.cliente, 'lotes', `cliente_id = '${CLI.C2}'`), 0);
    assert.equal(count(U.cliente, 'lote_eventos'), countSu('lote_eventos e', `exists (select 1 from public.lotes l where l.id = e.lote_id and l.cliente_id = '${CLI.C1}')`));
    assert.equal(count(U.cliente, 'pagos_lote'), countSu('pagos_lote', `beneficiario_cliente_id = '${CLI.C1}'`));
    assert.ok(count(U.cliente, 'pagos_lote') >= 1, 'el minero ve el precio de SUS ventas');
    assert.equal(count(U.cliente, 'consentimientos'), countSu('consentimientos', `cliente_id = '${CLI.C1}'`));
    assert.equal(count(U.cliente, 'fuentes_comercializador'), 0);
    assert.equal(count(U.cliente, 'alertas_lote'), 0);
    assert.equal(count(U.cliente, 'margenes_comercializador'), 0);
    assert.equal(count(U.cliente, 'organizaciones'), 0);
    assert.match(asUserFalla(U.cliente, `insert into public.lotes (codigo, fuente_id) values ('LOTE-C', '${FUENTE.A1}');`), /row-level security/);
    assert.match(asUserFalla(U.cliente, `insert into public.lote_eventos (lote_id, tipo) values ('${LOTE.A1}', 'nota');`), /row-level security/);
    assert.equal(json(como('authenticated', U.cliente, `select public.verificar_cadena_lote('${LOTE.A1}');`)).ok, true);
    assert.equal(json(como('authenticated', U.cliente, `select public.verificar_cadena_lote('${LOTE.B1}');`)).motivo, 'lote_no_visible');
  });

  test('RLS auditor: lectura total (sin márgenes), sin escritura', () => {
    assert.equal(count(U.auditor, 'lotes'), countSu('lotes'));
    assert.equal(count(U.auditor, 'lote_eventos'), countSu('lote_eventos'));
    assert.equal(count(U.auditor, 'fuentes_comercializador'), countSu('fuentes_comercializador'));
    assert.equal(count(U.auditor, 'alertas_lote'), countSu('alertas_lote'));
    assert.equal(count(U.auditor, 'consentimientos'), countSu('consentimientos'));
    assert.equal(count(U.auditor, 'pagos_lote'), countSu('pagos_lote'), 'pendiente de Willis: hoy ve el monto');
    assert.equal(count(U.auditor, 'organizaciones'), countSu('organizaciones'));
    assert.equal(count(U.auditor, 'margenes_comercializador'), 0);
    assert.match(asUserFalla(U.auditor, `insert into public.lotes (codigo, fuente_id) values ('LOTE-AUD', '${FUENTE.A1}');`), /row-level security/);
    assert.match(asUserFalla(U.auditor, `insert into public.lote_eventos (lote_id, tipo) values ('${LOTE.A1}', 'nota');`), /row-level security/);
    // UPDATE sin policy de escritura: la RLS filtra todas las filas → 0 afectadas, sin error.
    assert.equal(asUser(U.auditor, `update public.lotes set estado = 'cerrado' where id = '${LOTE.A1}' returning 1;`), '');
    assert.equal(su(`select estado from public.lotes where id = '${LOTE.A1}'`), 'conciliado');
    assert.equal(json(como('authenticated', U.auditor, `select public.verificar_cadena_lote('${LOTE.A1}');`)).ok, true);
  });

  test('bitácora de accesos: inserta el propio usuario o la API; leen admin y auditor; append-only', () => {
    asUser(U.comA, `insert into public.bitacora_accesos (user_id, rol, organizacion_id, accion, recurso_tipo, recurso_id) values ('${U.comA}', 'comercializador', '${ORG.A}', 'lectura', 'lote', '${LOTE.A1}');`);
    assert.match(asUserFalla(U.comA, `insert into public.bitacora_accesos (user_id, accion, recurso_tipo) values ('${U.comB}', 'lectura', 'lote');`), /row-level security/);
    su(como('service_role', null, `insert into public.bitacora_accesos (user_id, rol, accion, recurso_tipo, recurso_id) values ('${U.auditor}', 'auditor', 'exportacion', 'lotes', null);`));
    assert.equal(count(U.comA, 'bitacora_accesos'), 0);
    assert.equal(count(U.planta, 'bitacora_accesos'), 0);
    assert.equal(count(U.admin, 'bitacora_accesos'), 2);
    assert.equal(count(U.auditor, 'bitacora_accesos'), 2);
    assert.match(suFalla(`update public.bitacora_accesos set accion = 'exportacion';`), /append-only/);
    assert.match(suFalla(`delete from public.bitacora_accesos;`), /append-only/);
    assert.match(suFalla(como('service_role', null, `delete from public.bitacora_accesos;`)), /permission denied/);
    assert.match(asUserFalla(U.auditor, `update public.bitacora_accesos set accion = 'lectura';`), /permission denied/);
  });

  test('anon: todo denegado', () => {
    for (const t of ['organizaciones', 'fuentes_comercializador', 'lotes', 'lote_eventos', 'pagos_lote', 'consentimientos', 'alertas_lote', 'bitacora_accesos', 'margenes_comercializador']) {
      assert.match(suFalla(como('anon', null, `select count(*) from public.${t};`)), /permission denied/, t);
    }
    assert.match(suFalla(como('anon', null, `select public.verificar_cadena_lote('${LOTE.A1}');`)), /permission denied/);
    assert.match(suFalla(como('anon', null, `select public.conciliar_lote('${LOTE.A1}', null);`)), /permission denied/);
    assert.match(suFalla(como('anon', null, `select public.current_rol();`)), /permission denied/);
  });

  test('service_role: FOR ALL pero sin DELETE en evidencia', () => {
    assert.equal(Number(su(como('service_role', null, `select count(*) from public.lotes;`))), countSu('lotes'));
    su(como('service_role', null, `insert into public.alertas_lote (lote_id, tipo, detalle) values ('${LOTE.A1}', 'fundicion_rechazada', '{"motivo":"fundicion_por_comercializador"}');`));
    assert.match(suFalla(como('service_role', null, `delete from public.lotes where codigo = 'LOTE-BAD';`)), /permission denied/);
    assert.match(suFalla(como('service_role', null, `delete from public.consentimientos;`)), /permission denied/);
    assert.match(suFalla(como('service_role', null, `delete from public.margenes_comercializador;`)), /permission denied/);
  });
});
