// tests/alias-loader.mjs — resolución de `@/…` y de imports sin extensión para
// correr archivos .ts del repo con `node --experimental-strip-types --test`.
// Solo para tests locales/CI; la app usa el alias de tsconfig vía Next.
import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const EXTS = ['.ts', '.tsx', '.mts', '.js', '.mjs'];

function withExtension(abs) {
  if (existsSync(abs) && statSync(abs).isFile()) return abs;
  for (const e of EXTS) if (existsSync(abs + e)) return abs + e;
  for (const e of EXTS) if (existsSync(join(abs, 'index' + e))) return join(abs, 'index' + e);
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const abs = withExtension(join(ROOT, specifier.slice(2)));
    if (abs) return { url: pathToFileURL(abs).href, shortCircuit: true };
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
    const base = dirname(fileURLToPath(context.parentURL));
    const abs = withExtension(resolvePath(base, specifier));
    if (abs) return { url: pathToFileURL(abs).href, shortCircuit: true };
  }
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    // Paquetes CJS sin "exports" para subpaths sin extensión (p. ej. next/server).
    const code = err && typeof err === 'object' ? err.code : undefined;
    if ((code === 'ERR_MODULE_NOT_FOUND' || code === 'ERR_UNSUPPORTED_DIR_IMPORT') && !/\.[a-z]+$/.test(specifier)) {
      return nextResolve(specifier + '.js', context);
    }
    throw err;
  }
}
