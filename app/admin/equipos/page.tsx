import { listEquiposAdmin } from '@/services/equiposService';
import { AdminEquiposClient } from './AdminEquiposClient';
import type { EquipoMercado } from '@/lib/types/equipo';

// Auth is enforced by app/admin/layout.tsx (getServerAuth + role === 'admin'),
// same as every other /admin page — no extra guard here.
export const dynamic = 'force-dynamic';

export default async function AdminEquiposPage() {
  // Degrade cleanly when migration 027 hasn't been applied yet — show an empty
  // table instead of a 500 so the operator can still reach the page.
  let equipos: EquipoMercado[] = [];
  let total = 0;
  try {
    ({ equipos, total } = await listEquiposAdmin(1, 50));
  } catch (err) {
    console.error('[admin/equipos] non-fatal — list unavailable (migration 027 applied?):', err);
  }

  return <AdminEquiposClient initialEquipos={equipos} total={total} />;
}
