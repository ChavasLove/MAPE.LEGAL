import { listCombustiblesAdmin } from '@/services/combustiblesService';
import { getLatestPrices } from '@/services/pricingService';
import { type Combustible } from '@/lib/types/combustible';
import AdminPreciosClient, { type MetalsSnapshot } from './AdminPreciosClient';

// Auth enforced by app/admin/layout.tsx (getServerAuth + role === 'admin').
export const dynamic = 'force-dynamic';

export default async function AdminPreciosPage() {
  // Degrade cleanly when migration 028 hasn't been applied yet — show the empty
  // editor instead of a 500 so the operator can still reach the page.
  let combustibles: Combustible[] = [];
  try {
    combustibles = await listCombustiblesAdmin();
  } catch (err) {
    console.error('[admin/precios] non-fatal — combustibles unavailable (migration 028 applied?):', err);
  }

  let metals: MetalsSnapshot | null = null;
  try {
    const latest = await getLatestPrices();
    if (latest) {
      metals = {
        fecha: latest.fecha ?? null,
        oro: latest.oro ?? null,
        plata: latest.plata ?? null,
        usd_hnl: latest.usd_hnl ?? null,
        fuente: latest.fuente ?? null,
        fetched_at: latest.fetched_at ?? null,
      };
    }
  } catch (err) {
    console.error('[admin/precios] non-fatal — latest metals unavailable:', err);
  }

  return <AdminPreciosClient initialCombustibles={combustibles} metals={metals} />;
}
