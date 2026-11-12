// lib/registroPublico.ts
// Feature flag de la consulta pública de concesiones (/registro y
// /api/concesiones/buscar). Apagada por defecto (hotfix de neutralidad,
// 11-nov-2026): solo se sirve cuando NEXT_PUBLIC_REGISTRO_PUBLICO === 'true'
// (comparación exacta; 'TRUE', '1' u 'on' NO la encienden).

export const REGISTRO_PUBLICO_ENV = 'NEXT_PUBLIC_REGISTRO_PUBLICO';

export function registroPublicoHabilitado(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env[REGISTRO_PUBLICO_ENV] === 'true';
}
