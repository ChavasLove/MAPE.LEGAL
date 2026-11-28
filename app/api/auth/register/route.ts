import { NextResponse } from 'next/server';

// POST /api/auth/register — CERRADA (reestructura 2026-11-28, Fase 2).
//
// El auto-registro creaba una cuenta con datos autodeclarados (nombre y
// teléfono). Con la regla "los usuarios solo ven", las cuentas y los perfiles
// los da de alta el personal. La página pública deja una solicitud de acceso
// en /api/auth/solicitud-acceso (correo y nombre de contacto, sin crear cuenta).
//
// Se conserva la ruta para responder de forma explícita a clientes antiguos.
export async function POST() {
  return NextResponse.json(
    {
      error: 'El registro directo ya no está disponible. Envíe una solicitud de acceso y el equipo le escribirá.',
      code: 'REGISTRO_CERRADO',
      solicitud: '/auth/registro',
    },
    { status: 410 },
  );
}
