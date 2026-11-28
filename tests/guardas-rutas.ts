// tests/guardas-rutas.ts — lectura ESTÁTICA de la guarda de rol de cada handler
// de una ruta. requireRole() usa cookies() de Next y no puede ejecutarse fuera
// de una petición, así que la regresión "un usuario externo recibe 403 al
// escribir" se prueba sobre la lista de roles que cada handler le pasa a la
// guarda (requireRole devuelve 403 a todo rol fuera de esa lista —
// lib/serverAuth.ts).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolesCon, ACCIONES_PERSONAL, type AccionPersonal } from '@/lib/acceso/personal';
import { KNOWN_ROLES } from '@/lib/userRoleLookup';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GUARDAS = ['requireRole', 'iniciarSesionCadena', 'iniciarSesionPersonal', 'iniciarSesionRoles'];

export interface GuardaHandler { metodo: string; roles: string[]; encontrada: boolean }

/** Roles admitidos por cada handler exportado (GET/POST/PATCH/PUT/DELETE) de un archivo de ruta. */
export function guardasDeRuta(rutaRelativa: string): GuardaHandler[] {
  const src = readFileSync(join(ROOT, rutaRelativa), 'utf8');
  const out: GuardaHandler[] = [];
  const re = /export async function (GET|POST|PATCH|PUT|DELETE)\s*\(/g;
  const inicios: Array<{ metodo: string; i: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) inicios.push({ metodo: m[1], i: m.index });
  inicios.forEach((h, k) => {
    const cuerpo = src.slice(h.i, inicios[k + 1]?.i ?? src.length);
    const g = new RegExp(`(?:${GUARDAS.join('|')})\\(([^;]*?)\\);`).exec(cuerpo);
    if (!g) return out.push({ metodo: h.metodo, roles: [], encontrada: false });
    const args = g[1];
    const roles = new Set<string>();
    for (const a of args.matchAll(/rolesCon\('([a-z_:]+)'\)/g)) {
      if (!(ACCIONES_PERSONAL as ReadonlyArray<string>).includes(a[1])) throw new Error(`acción desconocida: ${a[1]}`);
      rolesCon(a[1] as AccionPersonal).forEach((r) => roles.add(r));
    }
    // iniciarSesionPersonal('accion') — el argumento es una acción, no un rol.
    for (const a of args.matchAll(/'([a-z_]+:[a-z_]+)'/g)) {
      if ((ACCIONES_PERSONAL as ReadonlyArray<string>).includes(a[1])) rolesCon(a[1] as AccionPersonal).forEach((r) => roles.add(r));
    }
    for (const a of args.matchAll(/'([a-z_]+)'/g)) {
      if ((KNOWN_ROLES as ReadonlyArray<string>).includes(a[1])) roles.add(a[1]);
    }
    out.push({ metodo: h.metodo, roles: [...roles].sort(), encontrada: true });
  });
  return out;
}

export const ROLES_EXTERNOS = ['cliente', 'comercializador', 'planta', 'auditor'] as const;
