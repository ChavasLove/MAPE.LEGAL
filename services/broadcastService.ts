import { getAdminClient } from '@/services/adminSupabase';
import {
  sendWhatsAppText,
  checkWhatsAppTokenHealth,
  WhatsAppApiError,
} from '@/services/whatsappService';
import {
  type PreciosDiarios,
  oroLpsPorGramoFino,
  buildKaratPrices,
  parseFuente,
  resolverTipoCambioBch,
} from '@/services/pricingService';
import type { TipoCambioBch } from '@/lib/precio/bch';
import {
  AVISO_PRECIO_INFORMATIVO,
  DATO_NO_DISPONIBLE,
  ETIQUETA_TIPO_CAMBIO,
  FUENTE_TIPO_CAMBIO,
} from '@/lib/content/copy-legal';
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
//
// DEC-2026-11-26-1 / DEC-2026-11-27-2: el boletín publica el precio
// internacional del oro en lempiras por gramo de oro fino, SOLO INFORMATIVO y
// SIN factor de compra (oro × tipo de COMPRA del BCH ÷ 31.1034768), acompañado
// SIEMPRE del aviso literal AVISO_PRECIO_INFORMATIVO. El oro se atribuye a su
// feed real (nunca "LBMA oficial") y el tipo de cambio ÚNICAMENTE al BCH; si el
// BCH no está disponible, la viñeta y las cifras en lempiras dicen "dato no
// disponible" — nunca se estima. No nombra contrapartes ni promete pago ni plazo.
// Cualquier cambio de estructura debe reflejarse también en el template del
// prompt de María (lib/maria/systemPrompt.ts §NOTIFICACIÓN DIARIA).

export async function generateDailyMessage(
  precios: PreciosDiarios,
  // Inyectable para tests; por defecto resuelve con el adaptador del BCH
  // (snapshot marcado fx:bch → vivo → último registrado → null).
  resolverTc: (p: PreciosDiarios) => Promise<TipoCambioBch | null> = resolverTipoCambioBch,
): Promise<string> {
  const now = new Date();

  // Honduras: UTC-6, sin horario de verano
  const hondurasTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Tegucigalpa' }));
  const fechaLarga = hondurasTime.toLocaleDateString('es-HN', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const horaCorta = hondurasTime.toLocaleTimeString('es-HN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

  const oroUsd = precios.oro ?? 0;
  const tcBch = oroUsd > 0 ? await resolverTc(precios) : null;
  const tc = tcBch?.compra ?? 0;
  const oroLps = oroUsd && tc ? oroUsd * tc : 0;
  // Helper canónico — mismo cálculo (sin factor) que /api/precios/live, el widget y María.
  const lpsPorGramoFino = oroLpsPorGramoFino(oroUsd, tc) ?? 0;
  const oroFuenteId = parseFuente(precios.fuente).oro;
  const fuente = oroFuenteId && oroFuenteId !== 'failed-all-sources' ? oroFuenteId : 'yahoo-finance';

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
      `Precios informativos al ${fechaLarga} — ${horaCorta} Honduras`,
      `Fuentes: ${fuente} + ${FUENTE_TIPO_CAMBIO}`,
      ``,
      `Ver detalles: www.mape.legal`,
    ].join('\n');
  }

  // Every data line is a `* ` bullet — matches MARIA.md §8. The international
  // reference comes from goldapi.io spot / Yahoo COMEX GC=F — NOT the LBMA fix —
  // so it is labeled "Oro internacional (<fuente>)", not "LBMA". Footer lines
  // are unprefixed so they read as a separator from the data section.
  const tcLine = tcBch
    ? `L ${tcBch.compra.toFixed(4)} por USD${tcBch.origen === 'respaldo' ? ' (último valor registrado)' : ''}`
    : DATO_NO_DISPONIBLE;
  const tcFecha = tcBch ? tcBch.fecha : 'sin dato del BCH';
  // Conversión por kilates — mismo helper canónico que el widget de /precios y
  // el bloque PRECIOS DE REFERENCIA de María, para que los cuatro canales
  // muestren exactamente los mismos números.
  //
  // "por gramo de material" es deliberado y NO debe abreviarse a "por gramo":
  // la viñeta referencial de arriba es por gramo de oro FINO, y estas son por
  // gramo del material al kilataje indicado. Dos cifras distintas separadas por
  // dos líneas — sin el calificativo se leen como la misma (misma ambigüedad
  // que persigue la regla R5 del encargo Precio de Referencia).
  //
  // El penique (pennyweight, dwt = 1.5552 g) es la unidad corriente del
  // comercio de oro artesanal — cada viñeta trae ambas unidades y el encabezado
  // define la equivalencia para que la cifra sea verificable.
  const kilates = buildKaratPrices(oroUsd, tc);
  const kilatesLines = kilates
    ? [
        `Por kilates (según su contenido de oro fino; 1 penique/dwt = 1.5552 g):`,
        ...kilates.map(
          (k) =>
            `* ${k.kilates} kilates: ${fmtLps(k.oro_lps_g)} por gramo de material · ${fmtLps(k.oro_lps_dwt)} por penique`,
        ),
        ``,
      ]
    : [];
  const lines = [
    `BOLETIN DIARIO`,
    ``,
    `Buenos Días,`,
    `El precio de oro el día de hoy es:`,
    `* Oro internacional (${fuente}): ${fmtUsd(oroUsd)} USD/oz`,
    `* En Lempiras: ${oroLps > 0 ? `${fmtLps(oroLps)} por onza (aprox.)` : DATO_NO_DISPONIBLE}`,
    `* ${ETIQUETA_TIPO_CAMBIO} (${tcFecha}): ${tcLine}`,
    ``,
    `Oro en lempiras por gramo de oro fino (solo informativo):`,
    `* ${lpsPorGramoFino > 0 ? `${fmtLps(lpsPorGramoFino)} por gramo de oro fino` : DATO_NO_DISPONIBLE}`,
    ``,
    ...kilatesLines,
    `* ${AVISO_PRECIO_INFORMATIVO}`,
    ``,
    `Precios informativos al ${fechaLarga} — ${horaCorta} Honduras`,
    `Fuentes: ${fuente} + ${FUENTE_TIPO_CAMBIO}`,
    ``,
    `Ver detalles: www.mape.legal`,
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
