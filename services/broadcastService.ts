import Anthropic from '@anthropic-ai/sdk';
import { getAdminClient } from '@/services/adminSupabase';
import { sendWhatsAppText } from '@/services/whatsappService';
import { getDailyReportConfig, type DailyReportConfig } from '@/services/configService';
import { type PreciosDiarios } from '@/services/pricingService';
import { getActiveSubscribers, type BroadcastRol } from '@/services/userService';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Metric label map ─────────────────────────────────────────────────────────

const METRIC_LABELS: Record<string, string> = {
  gold:    'Oro',
  silver:  'Plata',
  usd_hnl: 'USD/HNL',
  copper:  'Cobre',
};

const METRIC_UNITS: Record<string, string> = {
  gold:    '/ oz',
  silver:  '/ oz',
  usd_hnl: '',
  copper:  '/ lb',
};

const PRICE_KEYS: Record<string, keyof PreciosDiarios> = {
  gold:    'oro',
  silver:  'plata',
  usd_hnl: 'usd_hnl',
  copper:  'cobre',
};

// ─── Format price based on config ────────────────────────────────────────────

function formatPrice(
  value: number | null,
  metric: string,
  cfg: DailyReportConfig,
  usdHnl: number | null
): string {
  if (value === null) return 'N/D';

  let displayValue = value;
  let symbol = '$';

  if (cfg.currency === 'HNL' && metric !== 'usd_hnl' && usdHnl) {
    displayValue = value * usdHnl;
    symbol = 'L';
  } else if (metric === 'usd_hnl') {
    symbol = '';
  }

  const formatted = new Intl.NumberFormat('es-HN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(displayValue);

  const unit = METRIC_UNITS[metric] ?? '';
  return `${symbol}${formatted}${unit ? ' ' + unit : ''}`;
}

// ─── Generate daily message via María (Claude) ────────────────────────────────

export async function generateDailyMessage(precios: PreciosDiarios): Promise<string> {
  const config = await getDailyReportConfig();
  const enabled = config.filter(c => c.enabled).sort((a, b) => a.order_index - b.order_index);

  if (enabled.length === 0) return 'Actualizacion diaria: sin metricas configuradas.';

  // Build price lines
  const usdHnl = precios.usd_hnl;
  const priceLines = enabled.map(cfg => {
    const key = PRICE_KEYS[cfg.metric];
    const value = precios[key] as number | null;
    const label = METRIC_LABELS[cfg.metric] ?? cfg.metric;
    return `${label}: ${formatPrice(value, cfg.metric, cfg, usdHnl)}`;
  });

  // Ask María for a short market commentary
  const priceContext = priceLines.join('\n');
  let commentary = '';

  try {
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      messages: [{
        role: 'user',
        content: `Eres Maria, asistente de CHT Honduras. Con base en estos precios de hoy, escribe UN comentario corto (maximo 2 oraciones) en espanol hondureno para mineros artesanales. No uses emojis. No repitas los precios.

${priceContext}`,
      }],
    });
    commentary = ((res.content?.[0] as { text?: string })?.text ?? '').trim();
  } catch {
    commentary = 'Los precios de hoy estan disponibles para su consulta.';
  }

  const fecha = new Date().toLocaleDateString('es-HN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return [
    `Actualizacion diaria — ${fecha}`,
    '',
    ...priceLines,
    '',
    commentary,
  ].join('\n');
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
