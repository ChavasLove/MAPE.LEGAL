/**
 * Daily broadcast job.
 *
 * This module exports runDailyBroadcast() — a pure function with no side
 * effects beyond fetching prices, storing them, and sending WhatsApp messages.
 * It is invoked by POST /api/broadcast/run (protected by CRON_SECRET) and
 * can also be imported directly in any job runner (node-cron, Vercel Cron, etc.)
 */

import { fetchAndStorePrices } from '@/services/pricingService';
import { sendDailyBroadcast, type BroadcastResult } from '@/services/broadcastService';
import type { BroadcastRol } from '@/services/userService';

export interface DailyBroadcastOptions {
  triggeredBy?: string;
  roles?: BroadcastRol[];
}

export async function runDailyBroadcast(
  options: DailyBroadcastOptions = {}
): Promise<BroadcastResult> {
  const { triggeredBy = 'cron', roles } = options;

  console.log(`[dailyBroadcast] Starting — triggered_by=${triggeredBy}`);

  // 1. Fetch and persist today's prices
  const { id: precio_id, precios } = await fetchAndStorePrices();
  console.log(`[dailyBroadcast] Prices stored — id=${precio_id}`, precios);

  // 2. Generate message via Maria and broadcast to all active subscribers
  const result = await sendDailyBroadcast({ precios, precio_id, triggeredBy, roles });
  console.log(
    `[dailyBroadcast] Done — sent=${result.enviados} errors=${result.errores} total=${result.total}`
  );

  return result;
}
