import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient } from '@/services/adminSupabase';

// GET /api/admin/usuarios — list all auth users with their roles
export async function GET() {
  try {
    const admin = getAdminClient();

    const { data: { users }, error } = await admin.auth.admin.listUsers();
    if (error) throw error;

    // Fetch roles for all users
    const { data: roles } = await admin
      .from('user_roles')
      .select('user_id, rol, activo, perfil_id, perfiles_profesionales(nombre, iniciales, rol)');

    const rolesMap = Object.fromEntries(
      (roles ?? []).map((r: { user_id: string; rol: string; activo: boolean; perfil_id: string | null; perfiles_profesionales: unknown }) => [r.user_id, r])
    );

    const result = users.map(u => ({
      id:          u.id,
      email:       u.email,
      created_at:  u.created_at,
      last_sign_in: u.last_sign_in_at,
      rol:         rolesMap[u.id]?.rol ?? 'sin_rol',
      activo:      rolesMap[u.id]?.activo ?? false,
      perfil:      rolesMap[u.id]?.perfiles_profesionales ?? null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al obtener usuarios';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/admin/usuarios — create a new user + assign role
export async function POST(req: NextRequest) {
  try {
    const { email, password, rol, perfil_id } = await req.json();

    if (!email || !password || !rol) {
      return NextResponse.json(
        { error: 'email, password y rol son obligatorios' },
        { status: 400 }
      );
    }

    const validRoles = ['admin', 'abogado', 'tecnico_ambiental', 'cliente'];
    if (!validRoles.includes(rol)) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
    }

    const admin = getAdminClient();

    const { data: { user }, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError || !user) {
      throw createError ?? new Error('No se pudo crear el usuario');
    }

    // Assign role
    const { error: roleError } = await admin
      .from('user_roles')
      .insert({ user_id: user.id, rol, perfil_id: perfil_id ?? null, activo: true });

    if (roleError) throw roleError;

    return NextResponse.json({ id: user.id, email: user.email, rol }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al crear usuario';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
