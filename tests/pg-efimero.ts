// tests/pg-efimero.ts — clúster PostgreSQL EFÍMERO para pruebas de migraciones
// (mismo mecanismo que tests/rls-estandar-privado.test.ts): PGTEST_URL si está
// definida; si no, initdb + pg_ctl en un directorio temporal por socket Unix.
// Nunca toca una base real: el clúster nace vacío y se destruye al terminar.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, chmodSync, chownSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const migracion = (nombre: string) => join(ROOT, 'supabase', 'migrations', nombre);
export const sqlDePrueba = (nombre: string) => join(ROOT, 'tests', 'sql', nombre);

function which(bin: string): string | null {
  const r = spawnSync('which', [bin], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

function findPgBinDir(): string | null {
  const base = '/usr/lib/postgresql';
  if (!existsSync(base)) return null;
  const versions = readdirSync(base).filter((v) => /^\d+$/.test(v)).sort((a, b) => Number(b) - Number(a));
  for (const v of versions) {
    const dir = join(base, v, 'bin');
    if (existsSync(join(dir, 'pg_ctl')) && existsSync(join(dir, 'initdb'))) return dir;
  }
  return null;
}

const PGTEST_URL = process.env.PGTEST_URL?.trim() || null;
// Se PREFIERE un clúster local propio aunque exista PGTEST_URL: en CI esa URL
// la comparte tests/rls-estandar-privado.test.ts, que recrea el esquema
// `public`; dos suites en paralelo sobre la misma base se pisarían.
const PG_BIN = findPgBinDir();
const PSQL = which('psql') ?? (PG_BIN ? join(PG_BIN, 'psql') : null);

/** Motivo para omitir la suite (undefined = se puede correr). */
export const SIN_POSTGRES: string | undefined = !PSQL
  ? 'psql no está instalado — suite de base de datos NO CORRIDA'
  : !PGTEST_URL && !PG_BIN
    ? 'sin PGTEST_URL ni PostgreSQL local — suite de base de datos NO CORRIDA'
    : undefined;

function sh(cmd: string, args: string[], input?: string) {
  return spawnSync(cmd, args, { encoding: 'utf8', input, maxBuffer: 64 * 1024 * 1024 });
}

function asPostgres(cmd: string) {
  const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
  return isRoot ? sh('su', ['postgres', '-s', '/bin/bash', '-c', cmd]) : sh('/bin/bash', ['-c', cmd]);
}

export interface Res { status: number; out: string; err: string }
export type RolPg = 'anon' | 'authenticated' | 'service_role';

export class BaseEfimera {
  private psqlArgs: string[] = [];
  private detener: () => void = () => {};

  iniciar(): void {
    if (!PG_BIN) {
      if (!PGTEST_URL) throw new Error('sin PostgreSQL local');
      this.iniciarEnBasePropia(PGTEST_URL);
      return;
    }
    const dir = mkdtempSync(join(tmpdir(), 'mape-reestructura-pg-'));
    const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
    if (isRoot) {
      let p = dir;
      while (p !== '/' && p !== '.') {
        try { chmodSync(p, 0o755); } catch { /* ancestros del sistema */ }
        p = dirname(p);
      }
      const uid = sh('id', ['-u', 'postgres']);
      const gid = sh('id', ['-g', 'postgres']);
      if (uid.status === 0 && gid.status === 0) chownSync(dir, Number(uid.stdout.trim()), Number(gid.stdout.trim()));
    }
    const data = join(dir, 'data');
    const port = 50000 + Math.floor(Math.random() * 9000);
    const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
    const leer = (p: string) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };
    const init = asPostgres(`${q(join(PG_BIN, 'initdb'))} -D ${q(data)} -U postgres -A trust >${q(join(dir, 'initdb.log'))} 2>&1`);
    if (init.status !== 0) throw new Error(`initdb falló: ${init.stderr}\n${leer(join(dir, 'initdb.log'))}`);
    const start = asPostgres(`${q(join(PG_BIN, 'pg_ctl'))} -D ${q(data)} -o "-k ${dir} -p ${port} -c listen_addresses=''" -l ${q(join(dir, 'pg.log'))} -w start`);
    if (start.status !== 0) throw new Error(`pg_ctl start falló: ${start.stderr}\n${leer(join(dir, 'pg.log'))}`);
    this.psqlArgs = ['-h', dir, '-p', String(port), '-U', 'postgres', '-d', 'postgres'];
    this.detener = () => {
      asPostgres(`${q(join(PG_BIN, 'pg_ctl'))} -D ${q(data)} -m immediate stop`);
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignorar */ }
    };
  }

  /**
   * Sin binarios locales: se usa el servidor de PGTEST_URL, pero en una base
   * de datos PROPIA (nombre aleatorio), que se elimina al terminar. Los roles
   * son del clúster: se crean tolerando que otra suite los cree a la vez.
   */
  private iniciarEnBasePropia(url: string): void {
    if (!PSQL) throw new Error('psql no disponible');
    const nombre = `mape_reestructura_${process.pid}_${Math.floor(Math.random() * 1e9)}`;
    const admin = [url, '-X', '-q', '-v', 'ON_ERROR_STOP=1'];
    const crear = sh(PSQL, [...admin, '-c', `create database ${nombre}`]);
    if (crear.status !== 0) throw new Error(`no se pudo crear la base de pruebas: ${crear.stderr}`);
    for (const rol of ['anon', 'authenticated', 'service_role']) {
      sh(PSQL, [...admin, '-c', `do $$ begin create role ${rol} nologin; exception when others then null; end $$`]);
    }
    const propia = new URL(url);
    propia.pathname = `/${nombre}`;
    this.psqlArgs = [propia.toString()];
    this.detener = () => { sh(PSQL, [...admin, '-c', `drop database if exists ${nombre} with (force)`]); };
  }

  parar(): void { this.detener(); }

  psql(sql: string, archivo?: string): Res {
    if (!PSQL) throw new Error('psql no disponible');
    const args = [...this.psqlArgs, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-At', '-F', '|'];
    if (archivo) args.push('-f', archivo);
    const r = sh(PSQL, args, archivo ? undefined : sql);
    return { status: r.status ?? 1, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
  }

  /** Aplica un archivo .sql; falla el test si psql falla. */
  aplicar(archivo: string, etiqueta: string): void {
    const r = this.psql('', archivo);
    assert.equal(r.status, 0, `${etiqueta} falló:\n${r.err}`);
  }

  /** SQL como superusuario. */
  su(sql: string): string {
    const r = this.psql(sql);
    assert.equal(r.status, 0, `SQL falló:\n${sql}\n--- stderr ---\n${r.err}`);
    return r.out;
  }

  /** SQL que DEBE fallar; devuelve stderr. */
  suFalla(sql: string): string {
    const r = this.psql(sql);
    assert.notEqual(r.status, 0, `se esperaba un error y el SQL pasó:\n${sql}\n--- stdout ---\n${r.out}`);
    return r.err;
  }

  private como(rol: RolPg, uid: string | null, sql: string): string {
    return `set role ${rol};\n` + (uid ? `set app.uid = '${uid}';\n` : '') + sql;
  }
  usuario(uid: string, sql: string): string { return this.su(this.como('authenticated', uid, sql)); }
  usuarioFalla(uid: string, sql: string): string { return this.suFalla(this.como('authenticated', uid, sql)); }
  servicio(sql: string): string { return this.su(this.como('service_role', null, sql)); }
  servicioFalla(sql: string): string { return this.suFalla(this.como('service_role', null, sql)); }
  anonFalla(sql: string): string { return this.suFalla(this.como('anon', null, sql)); }
  contar(uid: string, tabla: string, where = 'true'): number {
    return Number(this.usuario(uid, `select count(*) from public.${tabla} where ${where};`));
  }
  json<T = Record<string, unknown>>(sql: string): T { return JSON.parse(this.su(sql)) as T; }
}
