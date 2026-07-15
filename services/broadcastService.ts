import { getAdminClient } from '@/services/adminSupabase';
import {
  sendWhatsAppText,
  checkWhatsAppTokenHealth,
  WhatsAppApiError,
} from '@/services/whatsappService';
import { type PreciosDiarios, TROY_OUNCE_GRAMS } from '@/services/pricingService';
import { getActiveSubscribers, type BroadcastRol } from '@/services/userService';

// ─── Honduras local time ──────────────────────────────────────────────────────
//
// Honduras is UTC-6 year-round (no DST). Compute the local date + time via Intl
// so the broadcast "day" is stable regardless of the server's timezone. This is
// the single source of truth for "today" shared by the broadcast_log writer
// (below) and the schedule gate in app/api/broadcast/run/route.ts. hourCycle
// 'h23' guarantees 00–23 (avoids the "24:00" midnight edge case).
export function hondurasNow(): { date: string; hhmm: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Tegucigalpa',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hhmm: `${get('hour')}:${get('minute')}`,
  };
}

export function hondurasDate(): string {
  return hondurasNow().date;
}

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
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const horaCorta = hondurasTime.toLocaleTimeString('es-HN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

  const tc = precios.usd_hnl ?? 0;
  const oroUsd = precios.oro ?? 0;
  const oroLps = oroUsd && tc ? oroUsd * tc : 0;
  const compraLpsPorGramo = oroLps ? (oroLps * 0.8) / TROY_OUNCE_GRAMS : 0;
  const fuente = precios.fuente && precios.fuente !== 'failed-all-sources' ? precios.fuente : 'yahoo-finance';

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
      `BOLETIN DIARIO`,
      ``,
      `Buenos Días,`,
      `Hoy no pude traer el precio exacto. Te lo enviamos en cuanto lo tengamos.`,
      ``,
      `Precios de referencia al ${fechaLarga} — ${horaCorta} Honduras`,
      `Fuentes: ${fuente} + BCH referencial`,
      ``,
      `Ver detalles: [www.mape.legal](https://www.mape.legal)`,
    ].join('\n');
  }

  // Every data line is a `* ` bullet — matches MARIA.md §8 (canonical price
  // format requires 4 obligatory bullets: Oro internacional, MAPE LEGAL compra
  // 80%, Tipo de cambio USD/LPS, Actualizado). The reference price comes from
  // goldapi.io spot / Yahoo COMEX GC=F — NOT the LBMA fix — so it is labeled
  // "Oro internacional", not "LBMA". Footer lines are unprefixed so they read
  // as a separator from the data section.
  const tcLine = tc > 0 ? `L ${tc.toFixed(2)} por USD` : 'N/D';
  const lines = [
    `BOLETIN DIARIO`,
    ``,
    `Buenos Días,`,
    `El precio de oro el día de hoy es:`,
    `* Oro internacional: ${fmtUsd(oroUsd)} USD/oz`,
    `* En Lempiras: ${fmtLps(oroLps)} por onza (aprox.)`,
    `* Tasa de cambio referencia: ${tcLine}`,
    ``,
    `Precio de compra oro calculado en Lempiras:`,
    `* MAPE LEGAL compra al 80% del precio internacional`,
    `* ${fmtLps(compraLpsPorGramo)} por gramo estimado`,
    `* Pago realizado en Lempiras en su cuenta de FINACOOP`,
    ``,
    `Precios de referencia al ${fechaLarga} — ${horaCorta} Honduras`,
    `Fuentes: ${fuente} + BCH referencial`,
    ``,
    `Ver detalles: [www.mape.legal](https://www.mape.legal)`,
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
  aborted_reason?: 'whatsapp_auth' | 'whatsapp_config';
}

const TOKEN_REFRESH_HINT =
  'Regenera WHATSAPP_TOKEN en Meta Developer Console → WhatsApp → Configuration ' +
  '(usa un System User access token sin expiración) y actualiza la env var en Vercel.';

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

  // Pre-flight: verify the WhatsApp token before fanning out. Without this, an
  // expired token produces N identical 401s in the per-recipient loop and
  // pollutes the broadcast_log with bogus errores=N when the real failure is
  // a single config issue.
  const health = await checkWhatsAppTokenHealth();
  if (!health.ok) {
    const reason: BroadcastResult['aborted_reason'] =
      health.isAuthError ? 'whatsapp_auth' : 'whatsapp_config';
    const detail = health.isAuthError
      ? `[broadcast] WHATSAPP_TOKEN inválido o expirado — ${health.error}. ${TOKEN_REFRESH_HINT}`
      : `[broadcast] WhatsApp pre-flight falló — ${health.error}`;
    console.error(detail);

    await admin.from('broadcast_log').insert({
      fecha: hondurasDate(),
      precio_id,
      mensaje_texto: mensaje,
      total_enviados: 0,
      total_errores: 0,
      roles_destino: roles ?? ['minero', 'comprador', 'tecnico', 'admin'],
      triggered_by: triggeredBy,
      error_msg: detail.slice(0, 1000),
      aborted_reason: reason,
    });

    return {
      total: subscribers.length,
      enviados: 0,
      errores: 0,
      precio_id,
      mensaje,
      aborted_reason: reason,
    };
  }

  let enviados = 0;
  let errores = 0;
  // Wrapper-object pattern: TS won't narrow through property access into
  // nested closures, which lets us assign from inside `Promise.all` callbacks
  // and still see the populated value on the read after the loop.
  const authState: { aborted: WhatsAppApiError | null } = { aborted: null };
  // AbortController cancels in-flight sends the instant any sibling in the
  // same batch hits an auth error. Without it, Promise.all would still wait
  // for the 9 remaining 401s in flight to complete — burning Meta quota and
  // delaying the abort. The signal is passed into sendWhatsAppText (added
  // for this purpose; back-compat for other callers that omit options).
  const abortCtrl = new AbortController();

  // Send in batches of 10 to avoid rate limits
  const BATCH = 10;
  for (let i = 0; i < subscribers.length; i += BATCH) {
    if (authState.aborted) break;

    const batch = subscribers.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (user) => {
        if (authState.aborted) return;
        try {
          await sendWhatsAppText(user.telefono, mensaje, { signal: abortCtrl.signal });
          enviados++;
        } catch (e) {
          // Cancelled because a sibling already hit the auth error and
          // aborted the controller — not a per-recipient failure.
          if ((e as Error)?.name === 'AbortError') return;
          // If the token died mid-broadcast (rare but possible), flag the
          // abort, cancel siblings, and skip per-recipient bookkeeping —
          // the failure is a broadcast-level config problem, not a delivery
          // error for this subscriber. aborted_reason carries the signal;
          // total_errores stays reserved for genuine per-recipient failures.
          if (e instanceof WhatsAppApiError && e.isAuthError) {
            authState.aborted = e;
            abortCtrl.abort();
            console.error('[broadcast] auth error mid-broadcast — aborting remaining batches', e);
            return;
          }
          // Mask the phone number — Vercel function logs are visible to anyone
          // with project access. Pattern: keep country code + last 4 digits,
          // mask the middle so log readers can still correlate complaints to
          // a specific failure without exposing the full PII.
          const masked = user.telefono.replace(/(\+?\d{3})\d+(\d{4})$/, '$1•••$2');
          console.error(`broadcastService: failed to send to ${masked} —`, e);
          errores++;
        }
      })
    );
    // Brief pause between batches
    if (i + BATCH < subscribers.length && !authState.aborted) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  const aborted_reason: BroadcastResult['aborted_reason'] | undefined =
    authState.aborted ? 'whatsapp_auth' : undefined;
  const errorMsg = authState.aborted
    ? `[broadcast] WHATSAPP_TOKEN expiró durante el envío — ${authState.aborted.message}. ${TOKEN_REFRESH_HINT}`
    : null;
  if (errorMsg) console.error(errorMsg);

  // Log the broadcast run
  await admin.from('broadcast_log').insert({
    fecha: hondurasDate(),
    precio_id,
    mensaje_texto: mensaje,
    total_enviados: enviados,
    total_errores: errores,
    roles_destino: roles ?? ['minero', 'comprador', 'tecnico', 'admin'],
    triggered_by: triggeredBy,
    error_msg: errorMsg ? errorMsg.slice(0, 1000) : null,
    aborted_reason: aborted_reason ?? null,
  });

  return {
    total: subscribers.length,
    enviados,
    errores,
    precio_id,
    mensaje,
    aborted_reason,
  };
}

// Retrieve the latest broadcast log entry
export async function getLastBroadcastLog() {
  const admin = getAdminClient();
  // maybeSingle handles the empty-table case cleanly; .single() emitted
  // PGRST116 there and the discarded error masked any real DB failure as
  // "no broadcasts yet".
  const { data, error } = await admin
    .from('broadcast_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('[broadcastService] getLastBroadcastLog failed:', error.message);
    return null;
  }
  return data;
}
