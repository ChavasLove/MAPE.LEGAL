// lib/perfiles/avisos.ts — aviso por correo a los verificadores cuando hay
// perfiles pendientes. SERVER-ONLY. Sin datos personales: el correo solo dice
// cuántos hay y enlaza a la cola. Nunca bloquea ni rompe la respuesta.

import type { SupabaseClient } from '@supabase/supabase-js';
import { emailPerfilesPendientes } from '@/services/emailService';

export function avisarPerfilesPendientes(admin: SupabaseClient): void {
  void (async () => {
    const [{ count }, roles] = await Promise.all([
      admin.from('perfiles').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'),
      admin.from('user_roles').select('user_id').eq('rol', 'verificador').eq('activo', true).limit(50),
    ]);
    const ids = ((roles.data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id);
    if (!count || ids.length === 0) return;
    const correos: string[] = [];
    for (const id of ids) {
      const { data } = await admin.auth.admin.getUserById(id);
      if (data?.user?.email) correos.push(data.user.email);
    }
    if (correos.length === 0) return;
    const sitio = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mape.legal').replace(/\/+$/, '');
    await emailPerfilesPendientes(correos, count, `${sitio}/dashboard/aprobaciones`);
  })().catch((err: unknown) => {
    console.warn('[perfiles] aviso a verificadores no enviado:', err instanceof Error ? err.message : err);
  });
}
