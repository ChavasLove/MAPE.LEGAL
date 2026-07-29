// /dashboard/precio — panel de fijación diaria del Precio de Referencia.
// Restringido al rol de administración de CHT (admin). El layout del
// dashboard ya exige sesión con rol de dashboard; esta página añade el
// gate admin-only. La guardia con consecuencias (el POST) vive en
// /api/precio con requireRole('admin') — R3.
//
// Server component: lee el historial completo (incluye 'reemplazado' —
// evidencia de auditoría) con el cliente service-role, que nunca llega al
// navegador, y lo pasa al client island del formulario.

import { getServerAuth } from '@/lib/serverAuth';
import { redirect } from 'next/navigation';
import { getAdminClient } from '@/services/adminSupabase';
import { fechaHondurasHoy, normalizePrecioRow, type PrecioReferenciaRow } from '@/lib/precio/consulta';
import PrecioPanelClient from './PrecioPanelClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function PrecioPanelPage() {
  const auth = await getServerAuth();
  if (!auth) redirect('/login');

  // Rol no autorizado → 403 (acceso denegado en página; el POST del API
  // devuelve 403 real). El resto del dashboard sigue disponible.
  if (auth.role !== 'admin') {
    return (
      <div
        role="alert"
        style={{
          background: 'color-mix(in oklch, var(--red) 8%, white)',
          border: '1px solid color-mix(in oklch, var(--red) 28%, white)',
          borderRadius: 12,
          padding: 24,
          maxWidth: 560,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--red)',
            marginBottom: 8,
          }}
        >
          403 — Acceso restringido
        </div>
        <p style={{ fontSize: 15, color: 'var(--t1)', lineHeight: 1.6 }}>
          La fijación del Precio de Referencia está reservada a la administración de CHT.
        </p>
      </div>
    );
  }

  const hoy = fechaHondurasHoy();
  let rows: PrecioReferenciaRow[] = [];
  let migracionPendiente = false;
  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('precios_referencia')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(200);
    if (error) throw error;
    rows = (data ?? []).map(normalizePrecioRow);
    // Orden de auditoría: fecha desc y, dentro de la misma fecha, el
    // registro más reciente primero (los reemplazos después del original).
    rows.sort((a, b) =>
      a.fecha === b.fecha ? (a.created_at < b.created_at ? 1 : -1) : a.fecha < b.fecha ? 1 : -1,
    );
  } catch (e) {
    const code = (e as { code?: string })?.code;
    migracionPendiente = code === '42P01';
    console.error('[dashboard/precio] lectura de historial falló:', (e as Error)?.message);
  }

  const vigenteHoy = rows.find((r) => r.fecha === hoy && r.estado === 'vigente') ?? null;

  return (
    <PrecioPanelClient
      hoy={hoy}
      vigenteHoy={vigenteHoy}
      historial={rows}
      migracionPendiente={migracionPendiente}
    />
  );
}
