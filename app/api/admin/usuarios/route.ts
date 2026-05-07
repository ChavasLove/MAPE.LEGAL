import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient } from '@/services/adminSupabase';
import { emailInvitacionUsuario } from '@/services/emailService';

// GET /api/admin/usuarios — list all auth users with their roles
export async function GET() {
  try {
    const admin = getAdminClient();

    const { data: { users }, error } = await admin.auth.admin.listUsers();
    if (error || !users) throw error ?? new Error('listUsers returned no data');

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
      confirmed:   Boolean(u.email_confirmed_at),
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

// POST /api/admin/usuarios — invite a new user. The invitee receives a branded
// SendGrid email with a Supabase-signed link; they set their own password on
// `/auth/establecer-password`. Admins never type or transmit plaintext passwords.
export async function POST(req: NextRequest) {
  try {
    const { email, rol, perfil_id } = await req.json();

    if (!email || !rol) {
      return NextResponse.json(
        { error: 'email y rol son obligatorios' },
        { status: 400 }
      );
    }

    const validRoles = ['admin', 'abogado', 'tecnico_ambiental', 'cliente'];
    if (!validRoles.includes(rol)) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
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

    if (linkError || !linkData?.user || !linkData.properties?.action_link) {
      throw linkError ?? new Error('No se pudo generar el enlace de invitación');
    }

    const userId     = linkData.user.id;
    const actionLink = linkData.properties.action_link;

    // The on_auth_user_created trigger (migration 015) inserted a row with the
    // default 'cliente' role. Override with the role the admin selected.
    const { error: roleError } = await admin
      .from('user_roles')
      .update({ rol, perfil_id: perfil_id ?? null, activo: true })
      .eq('user_id', userId);

    if (roleError) throw roleError;

    // Send branded invitation — non-blocking failure must not undo the user.
    emailInvitacionUsuario(email, rol, actionLink).catch(
      (err: unknown) => console.error('[usuarios] invitation email failed:', err)
    );

    return NextResponse.json({ id: userId, email, rol }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al crear usuario';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
