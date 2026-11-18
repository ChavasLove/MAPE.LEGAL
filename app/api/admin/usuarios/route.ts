import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient } from '@/services/adminSupabase';
import { emailInvitacionUsuario } from '@/services/emailService';
import { requireRole } from '@/lib/serverAuth';
import { KNOWN_ROLES, isKnownRole } from '@/lib/userRoleLookup';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Roles del estándar privado que pertenecen a una organización (migración 043:
// user_roles.organizacion_id). `auditor` puede o no tener organización.
const ROLES_CON_ORGANIZACION_OBLIGATORIA = new Set(['comercializador', 'planta']);

export const dynamic = 'force-dynamic';

// GET /api/admin/usuarios — list all auth users with their roles
export async function GET() {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const admin = getAdminClient();

    // listUsers defaults to perPage: 50 in supabase-js — silently truncating
    // the admin's view past 50 accounts. Bump to 1000 (the Supabase API
    // ceiling per page) so projects up to that size show the full list.
    // Past 1000 we'd need real pagination; flag in the response so the UI
    // can warn.
    //
    // The roles query is independent of the users payload — run them in
    // parallel to save one round-trip on every list-users render.
    const [usersRes, rolesRes] = await Promise.all([
      admin.auth.admin.listUsers({ perPage: 1000 }),
      admin
        .from('user_roles')
        .select('user_id, rol, activo, perfil_id, organizacion_id, perfiles_profesionales(nombre, iniciales, rol)'),
    ]);
    const { data: { users }, error } = usersRes;
    if (error || !users) throw error ?? new Error('listUsers returned no data');

    // Si la migración 043 (user_roles.organizacion_id) no está aplicada, PostgREST
    // responde 42703 — reintentamos sin la columna para no romper la lista.
    let roles = rolesRes.data as Array<Record<string, unknown>> | null;
    if (rolesRes.error) {
      if (rolesRes.error.code !== '42703') throw rolesRes.error;
      const retry = await admin
        .from('user_roles')
        .select('user_id, rol, activo, perfil_id, perfiles_profesionales(nombre, iniciales, rol)');
      if (retry.error) throw retry.error;
      roles = retry.data as Array<Record<string, unknown>> | null;
    }

    type RoleRow = { user_id: string; rol: string; activo: boolean; perfil_id: string | null; organizacion_id?: string | null; perfiles_profesionales: unknown };
    const rolesMap = Object.fromEntries(
      ((roles ?? []) as unknown as RoleRow[]).map((r) => [r.user_id, r])
    );

    const result = users.map(u => ({
      id:          u.id,
      email:       u.email,
      created_at:  u.created_at,
      last_sign_in: u.last_sign_in_at,
      confirmed:   Boolean(u.email_confirmed_at),
      rol:         rolesMap[u.id]?.rol ?? 'sin_rol',
      activo:      rolesMap[u.id]?.activo ?? false,
      perfil:      rolesMap[u.id]?.perfiles_profesionales ?? null,
      organizacion_id: rolesMap[u.id]?.organizacion_id ?? null,
    }));

    if (users.length >= 1000) {
      console.warn('[admin/usuarios GET] hit listUsers ceiling (1000) — list is truncated');
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('[admin/usuarios GET] failed:', error);
    return NextResponse.json({ error: 'Error al obtener usuarios' }, { status: 500 });
  }
}

// POST /api/admin/usuarios — invite a new user. The invitee receives a branded
// SendGrid email with a Supabase-signed link; they set their own password on
// `/auth/establecer-password`. Admins never type or transmit plaintext passwords.
export async function POST(req: NextRequest) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { email, rol, perfil_id, organizacion_id } = await req.json();

    if (!email || !rol) {
      return NextResponse.json(
        { error: 'email y rol son obligatorios' },
        { status: 400 }
      );
    }

    if (!isKnownRole(rol)) {
      return NextResponse.json(
        { error: `Rol inválido. Permitidos: ${KNOWN_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    // organizacion_id (migración 043): obligatorio para comercializador/planta,
    // opcional para auditor, no aplica al resto.
    let organizacionId: string | null | undefined = undefined;
    if (organizacion_id !== undefined && organizacion_id !== null && organizacion_id !== '') {
      if (typeof organizacion_id !== 'string' || !UUID_RE.test(organizacion_id)) {
        return NextResponse.json({ error: 'organizacion_id inválido (uuid).' }, { status: 400 });
      }
      if (!['comercializador', 'planta', 'auditor'].includes(rol)) {
        return NextResponse.json({ error: 'organizacion_id solo aplica a comercializador, planta o auditor.' }, { status: 400 });
      }
      organizacionId = organizacion_id;
    }
    if (ROLES_CON_ORGANIZACION_OBLIGATORIA.has(rol) && !organizacionId) {
      return NextResponse.json(
        { error: `El rol ${rol} requiere organizacion_id.` },
        { status: 400 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mape.legal';
    const admin   = getAdminClient();

    // generateLink('invite') creates the auth.users row AND returns a signed
    // link. We use it instead of inviteUserByEmail because the latter fires
    // Supabase's built-in mailer — we want SendGrid only.
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type:  'invite',
      email,
      options: {
        data:       { rol, perfil_id: perfil_id ?? null },
        redirectTo: `${siteUrl}/auth/establecer-password`,
      },
    });

    if (linkError) {
      const msg = (linkError.message ?? '').toLowerCase();
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        return NextResponse.json({ error: 'El correo ya está registrado.' }, { status: 409 });
      }
      console.error('[admin/usuarios POST] generateLink failed:', linkError);
      return NextResponse.json({ error: 'Error al crear la invitación.' }, { status: 500 });
    }
    if (!linkData?.user || !linkData.properties?.action_link) {
      console.error('[admin/usuarios POST] generateLink returned no user/link');
      return NextResponse.json({ error: 'Error al crear la invitación.' }, { status: 500 });
    }

    const userId     = linkData.user.id;
    const actionLink = linkData.properties.action_link;

    // The on_auth_user_created trigger (migration 015) inserted a row with the
    // default 'cliente' role. Override with the role the admin selected. If
    // this update fails, the auth user exists but with the wrong role — roll
    // back the auth user so the admin can retry cleanly instead of being left
    // with a half-created account.
    const roleUpdate: Record<string, unknown> = { rol, perfil_id: perfil_id ?? null, activo: true };
    if (organizacionId !== undefined) roleUpdate.organizacion_id = organizacionId;

    const { error: roleError } = await admin
      .from('user_roles')
      .update(roleUpdate)
      .eq('user_id', userId);

    if (roleError) {
      console.error('[admin/usuarios POST] role update failed, rolling back user:', roleError);
      const { error: rollbackErr } = await admin.auth.admin.deleteUser(userId);
      if (rollbackErr) {
        console.error('[admin/usuarios POST] rollback also failed:', rollbackErr);
      }
      if (roleError.code === '42703') {
        return NextResponse.json(
          { error: 'La migración 043 (organizaciones) no está aplicada en la base de datos.', code: 'MIGRATION_PENDING' },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: 'No se pudo asignar el rol. Intenta de nuevo.' },
        { status: 500 }
      );
    }

    // Send branded invitation — non-blocking failure must not undo the user.
    emailInvitacionUsuario(email, rol, actionLink).catch(
      (err: unknown) => console.error('[admin/usuarios POST] invitation email failed:', err)
    );

    return NextResponse.json({ id: userId, email, rol, organizacion_id: organizacionId ?? null }, { status: 201 });
  } catch (error) {
    console.error('[admin/usuarios POST] failed:', error);
    return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 });
  }
}
