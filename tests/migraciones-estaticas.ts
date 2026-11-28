// tests/migraciones-estaticas.ts — verificación ESTÁTICA de migraciones nuevas
// (045 en adelante). No hay base de datos local para estas migraciones: aquí se
// comprueba el texto del .sql, no su ejecución. Lo que se verifica:
//   · cabecera NO APLICAR
//   · RLS habilitada y `revoke all` en cada tabla creada
//   · search_path fijo, owner y revoke de EXECUTE en cada SECURITY DEFINER
//   · triggers append-only + revoke update/delete donde se declara
//   · ningún `using (true)` fuera de las policies de service_role
//   · sin valores de negocio sembrados en configuracion_sistema
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function leerMigracion(nombre: string): string {
  return readFileSync(join(ROOT, 'supabase', 'migrations', nombre), 'utf8');
}

/** SQL sin comentarios de línea (para no contar ejemplos en comentarios). */
export function sinComentarios(sql: string): string {
  return sql.split('\n').map((l) => {
    const i = l.indexOf('--');
    return i === -1 ? l : l.slice(0, i);
  }).join('\n');
}

export function tablasCreadas(sql: string): string[] {
  return [...sinComentarios(sql).matchAll(/create table if not exists public\.([a-z0-9_]+)/g)].map((m) => m[1]);
}

export interface FuncionSql { nombre: string; cabecera: string; definer: boolean }

export function funciones(sql: string): FuncionSql[] {
  const limpio = sinComentarios(sql);
  const out: FuncionSql[] = [];
  const re = /create or replace function public\.([a-z0-9_]+)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(limpio))) {
    const fin = limpio.indexOf('$$', m.index);
    const cabecera = limpio.slice(m.index, fin === -1 ? undefined : fin);
    out.push({ nombre: m[1], cabecera, definer: /security definer/i.test(cabecera) });
  }
  return out;
}

export interface OpcionesVerificacion {
  /** Tablas que deben ser append-only (trigger + revoke update/delete). */
  appendOnly: string[];
}

export function verificarMigracion(nombre: string, opts: OpcionesVerificacion): void {
  const sql = leerMigracion(nombre);
  const limpio = sinComentarios(sql);

  // Cabecera.
  const cabeza = sql.split('\n').slice(0, 4).join('\n');
  assert.match(cabeza, /-- NO APLICAR\./, `${nombre}: falta la cabecera NO APLICAR`);
  assert.match(sql, /PLAN DE REVERSA/, `${nombre}: falta el plan de reversa documentado`);
  assert.match(sql, /DEPENDENCIAS:/, `${nombre}: faltan las dependencias`);

  // RLS por tabla.
  const tablas = tablasCreadas(sql);
  for (const t of tablas) {
    assert.ok(limpio.includes(`alter table public.${t} enable row level security`), `${nombre}: ${t} sin RLS habilitada`);
    assert.match(limpio, new RegExp(`revoke all on table public\\.${t} from public, anon, authenticated`), `${nombre}: ${t} sin revoke all`);
    assert.match(limpio, new RegExp(`create policy ${t}_service_all on public\\.${t}\\s+for all to service_role`), `${nombre}: ${t} sin policy de service_role`);
    assert.match(sql, new RegExp(`comment on table public\\.${t} is`), `${nombre}: ${t} sin comentario`);
  }

  // SECURITY DEFINER.
  for (const f of funciones(sql)) {
    if (!f.definer) continue;
    assert.match(f.cabecera, /set search_path = (public, pg_temp|'')/, `${nombre}: ${f.nombre} sin search_path fijo`);
    assert.match(limpio, new RegExp(`alter function public\\.${f.nombre}\\([^)]*\\) owner to postgres`), `${nombre}: ${f.nombre} sin owner explícito`);
    assert.match(limpio, new RegExp(`revoke execute on function public\\.${f.nombre}\\([^)]*\\) from public`), `${nombre}: ${f.nombre} sin revoke execute from public`);
  }

  // Append-only.
  for (const t of opts.appendOnly) {
    assert.match(limpio, new RegExp(`before update or delete on public\\.${t}\\s+for each row execute function public\\.fn_append_only\\(\\)`), `${nombre}: ${t} sin trigger append-only`);
    assert.match(limpio, new RegExp(`revoke update, delete, truncate on table public\\.${t} from anon, authenticated, service_role`), `${nombre}: ${t} sin revoke update/delete`);
  }

  // `using (true)` solo para service_role.
  for (const m of limpio.matchAll(/create policy ([a-z0-9_]+) on public\.[a-z0-9_]+([\s\S]*?);/g)) {
    if (/using \(true\)/.test(m[2])) {
      assert.match(m[2], /to service_role/, `${nombre}: policy ${m[1]} usa using (true) fuera de service_role`);
    }
  }

  // Sin valores de negocio sembrados.
  assert.doesNotMatch(limpio, /insert into public\.configuracion_sistema\s*\([^)]*\bvalor\b/, `${nombre}: siembra un valor en configuracion_sistema`);
  assert.doesNotMatch(limpio, /update public\.configuracion_sistema\s+set\s+valor/, `${nombre}: fija un valor en configuracion_sistema`);

  // No se ejecuta nada fuera del esquema esperado ni se tocan secretos.
  assert.doesNotMatch(limpio, /\bdrop table\b/i, `${nombre}: contiene drop table`);
}
