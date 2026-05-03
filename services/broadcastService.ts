import { getAdminClient } from '@/services/adminSupabase';
import { sendWhatsAppText } from '@/services/whatsappService';
import { type PreciosDiarios } from '@/services/pricingService';
import { getActiveSubscribers, type BroadcastRol } from '@/services/userService';

// ─── Generate daily price message — FIXED TEMPLATE ───────────────────────────
//
// Formato canónico del broadcast diario de las 8 AM Honduras.
// No llama a Claude — el mensaje es determinístico para garantizar consistencia
// y evitar alucinaciones de precio.

export async function generateDailyMessage(precios: PreciosDiarios): Promise<string> {
  const now = new Date();

  // Honduras: UTC-6, sin horario de verano
  const hondurasTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Tegucigalpa' }));
  const fechaLarga = hondurasTime.toLocaleDateString('es-HN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const horaCorta = hondurasTime.toLocaleTimeString('es-HN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

  const tc = precios.usd_hnl ?? 0;
  const oroUsd = precios.oro ?? 0;
  const oroLps = oroUsd && tc ? oroUsd * tc : 0;
  const compraLps = oroLps ? oroLps * 0.8 : 0;

  const fmtLps = (n: number) =>
    n > 0
      ? 'L ' + n.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : 'N/D';

  const fmtUsd = (n: number) =>
    n > 0
      ? '$' + n.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : 'N/D';

  // Si no hay precio de oro, devolver mensaje de fallback
  if (oroUsd <= 0) {
    return [
      `Estimado Socio MAPE`,
      ``,
      `Fijese que hoy no pude traer el precio exacto. Te lo envio en cuanto lo tengamos.`,
      ``,
      `Precios de referencia al ${fechaLarga} — ${horaCorta} Honduras`,
      `Fuentes: [goldapi.io](http://goldapi.io) + BCH referencial`,
      ``,
      `Ver detalles: [www.mape.legal](http://www.mape.legal)`,
      ``,
      `Dale pues, cualquier consulta me escribis.`,
    ].join('\n');
  }

  const lines = [
    `Estimado Socio MAPE`,
    ``,
    `El precio de oro el dia de hoy es:`,
    `- LBMA: ${fmtUsd(oroUsd)} USD/oz`,
    `- En Lempiras: ${fmtLps(oroLps)} por onza (aprox.)`,
    ``,
    `Tasa de cambio referencia: ${tc > 0 ? 'L ' + tc.toFixed(2) + ' por USD' : 'N/D'}`,
    ``,
    `Precio de compra oro calculado en Lempiras:`,
    `- MAPE LEGAL compra al 80% LBMA`,
    `- ${fmtLps(compraLps)} por onza estimado`,
    ``,
    `Precios de referencia al ${fechaLarga} — ${horaCorta} Honduras`,
    `Fuentes: [goldapi.io](http://goldapi.io) + BCH referencial`,
    ``,
    `Ver detalles: [www.mape.legal](http://www.mape.legal)`,
    ``,
    `Dale pues, cualquier consulta me escribis.`,
  ];

  return lines.join('\n');
}

// ─── Send broadcast to all active subscribers ─────────────────────────────────

export interface BroadcastResult {
  total: number;
  enviados: number;
  errores: number;
  precio_id: string;
  mensaje: string;
}

export async function sendDailyBroadcast(options: {
  precios: PreciosDiarios;
  precio_id: string;
  triggeredBy?: string;
  roles?: BroadcastRol[];
}): Promise<BroadcastResult> {
  const admin = getAdminClient();
  const { precios, precio_id, triggeredBy = 'cron', roles } = options;

  const [mensaje, subscribers] = await Promise.all([
    generateDailyMessage(precios),
    getActiveSubscribers(roles),
  ]);

  let enviados = 0;
  let errores = 0;

  // Send in batches of 10 to avoid rate limits
  const BATCH = 10;
  for (let i = 0; i < subscribers.length; i += BATCH) {
    const batch = subscribers.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (user) => {
        try {
          await sendWhatsAppText(user.telefono, mensaje);
          enviados++;
        } catch (e) {
          console.error(`broadcastService: failed to send to ${user.telefono} —`, e);
          errores++;
        }
      })
    );
    // Brief pause between batches
    if (i + BATCH < subscribers.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // Log the broadcast run
  await admin.from('broadcast_log').insert({
    fecha: new Date().toISOString().slice(0, 10),
    precio_id,
    mensaje_texto: mensaje,
    total_enviados: enviados,
    total_errores: errores,
    roles_destino: roles ?? ['minero', 'comprador', 'tecnico', 'admin'],
    triggered_by: triggeredBy,
  });

  return { total: subscribers.length, enviados, errores, precio_id, mensaje };
}

// Retrieve the latest broadcast log entry
export async function getLastBroadcastLog() {
  const admin = getAdminClient();
  const { data } = await admin
    .from('broadcast_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  return data;
}
