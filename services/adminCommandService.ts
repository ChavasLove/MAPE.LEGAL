/**
 * Admin Command Interpreter
 *
 * Deterministic layer between WhatsApp admin messages and backend config
 * functions. Never executes arbitrary code — every action maps to a
 * pre-approved function in configService. All executions are logged to
 * admin_actions table.
 *
 * Entry point: interpretAndExecute(user, message)
 *   - Returns a Spanish response string if commands were found and executed
 *   - Returns null if the message contains no recognisable admin commands
 *     (caller should fall through to Claude)
 */

import { getAdminClient } from '@/services/adminSupabase';
import {
  enableMetric,
  disableMetric,
  updateMetricCurrency,
  updateAudience,
  updateSchedule,
  type ReportMetric,
} from '@/services/configService';
import { type BroadcastRol, type UsuarioBroadcast } from '@/services/userService';

// ─── Command schema ───────────────────────────────────────────────────────────

export type AdminCommand =
  | { type: 'ENABLE_METRIC';      metric: ReportMetric }
  | { type: 'DISABLE_METRIC';     metric: ReportMetric }
  | { type: 'SET_CURRENCY';       metric: ReportMetric; currency: 'USD' | 'HNL' }
  | { type: 'SET_AUDIENCE';       roles: BroadcastRol[] }
  | { type: 'SET_BROADCAST_TIME'; time: string }
  | { type: 'SEND_BROADCAST' };

export interface CommandResult {
  command:  AdminCommand;
  success:  boolean;
  message:  string;
  error?:   string;
}

// ─── Allowed value sets (hardcoded — never derived from user input) ────────────

const ALLOWED_METRICS: ReportMetric[] = ['gold', 'silver', 'usd_hnl', 'copper'];
const ALLOWED_ROLES:   BroadcastRol[] = ['minero', 'comprador', 'tecnico', 'admin'];

// ─── Alias maps ───────────────────────────────────────────────────────────────

const METRIC_ALIASES: Record<string, ReportMetric> = {
  gold:    'gold',    oro:    'gold',
  silver:  'silver',  plata:  'silver',
  copper:  'copper',  cobre:  'copper',
  usd_hnl: 'usd_hnl', usd:   'usd_hnl', hnl: 'usd_hnl',
  dolar:   'usd_hnl', dolares: 'usd_hnl',
  cambio:  'usd_hnl', 'tipo de cambio': 'usd_hnl',
};

const ROLE_ALIASES: Record<string, BroadcastRol> = {
  minero: 'minero',    mineros: 'minero',
  comprador: 'comprador', compradores: 'comprador',
  tecnico: 'tecnico',  tecnicos: 'tecnico',
  admin: 'admin',      admins: 'admin',
};

const CURRENCY_ALIASES: Record<string, 'USD' | 'HNL'> = {
  usd: 'USD', dolares: 'USD', dólares: 'USD', dolar: 'USD', 'dólar': 'USD',
  hnl: 'HNL', lempiras: 'HNL', lempira: 'HNL',
};

// ─── Normalise text for matching ──────────────────────────────────────────────

function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9\s]/g, ' ')   // punctuation → space
    .replace(/\s+/g, ' ')
    .trim();
}

// Find the first metric alias token in a clause
function findMetric(clause: string): ReportMetric | null {
  // Try multi-word alias first (e.g. "tipo de cambio")
  for (const alias of Object.keys(METRIC_ALIASES).sort((a, b) => b.length - a.length)) {
    if (clause.includes(alias)) return METRIC_ALIASES[alias];
  }
  return null;
}

// Collect all role alias tokens in a clause
function findRoles(clause: string): BroadcastRol[] {
  const found = new Set<BroadcastRol>();
  for (const alias of Object.keys(ROLE_ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`).test(clause)) found.add(ROLE_ALIASES[alias]);
  }
  // "todos" / "all" → all roles
  if (/\b(todos|all|todas)\b/.test(clause)) ALLOWED_ROLES.forEach(r => found.add(r));
  return [...found];
}

// Normalise a time string to HH:MM (24h)
function normaliseTime(raw: string): string | null {
  const m = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2] ?? '0', 10);
  const period = (m[3] ?? '').toLowerCase();
  if (period === 'pm' && h < 12) h += 12;
  if (period === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// ─── Intent parser ────────────────────────────────────────────────────────────

/**
 * Parses a natural language admin message into an array of AdminCommands.
 * Returns null if no recognisable commands are found.
 *
 * Multi-command: "quita plata y agrega cobre, solo para compradores" → 3 commands
 */
export function parseAdminIntent(message: string): AdminCommand[] | null {
  const norm = normalise(message);

  // Split into intent segments on conjunctions and punctuation
  const segments = norm.split(/\s+y\s+|\s+and\s+|\s+ademas\s+|\s+tambien\s+|[,.]/).map(s => s.trim()).filter(Boolean);

  const commands: AdminCommand[] = [];

  for (const seg of segments) {
    // ── SEND_BROADCAST ────────────────────────────────────────────────────────
    if (/\b(enviar?\s+ahora|send\s+now|manda\s+ahora|dispara|envia\s+reporte|send\s+report|enviar?\s+reporte|broadcast\s+now)\b/.test(seg)) {
      commands.push({ type: 'SEND_BROADCAST' });
      continue;
    }

    // ── ENABLE_METRIC ─────────────────────────────────────────────────────────
    if (/\b(add|enable|include|activar?|habilitar?|agregar?|incluir?|pon|poner)\b/.test(seg)) {
      const metric = findMetric(seg);
      if (metric) { commands.push({ type: 'ENABLE_METRIC', metric }); continue; }
    }

    // ── DISABLE_METRIC ────────────────────────────────────────────────────────
    if (/\b(remove|disable|quitar?|deshabilitar?|desactivar?|eliminar?|sacar?)\b/.test(seg)) {
      const metric = findMetric(seg);
      if (metric) { commands.push({ type: 'DISABLE_METRIC', metric }); continue; }
    }

    // ── SET_CURRENCY ──────────────────────────────────────────────────────────
    if (/\b(currency|moneda|en\s+usd|en\s+hnl|en\s+dolares|en\s+lempiras|cambiar?\s+moneda|set\s+currency)\b/.test(seg)) {
      const metric  = findMetric(seg) ?? 'gold'; // default to gold if metric unspecified
      let currency: 'USD' | 'HNL' | null = null;
      for (const [alias, cur] of Object.entries(CURRENCY_ALIASES)) {
        if (new RegExp(`\\b${alias}\\b`).test(seg)) { currency = cur; break; }
      }
      if (currency) { commands.push({ type: 'SET_CURRENCY', metric, currency }); continue; }
    }

    // ── SET_AUDIENCE ──────────────────────────────────────────────────────────
    if (/\b(solo\s+a|only\s+to|solo\s+para|only\s+for|para|audiencia|envia\s+a|enviar?\s+a|send\s+to|destinatarios)\b/.test(seg)) {
      const roles = findRoles(seg);
      if (roles.length > 0) { commands.push({ type: 'SET_AUDIENCE', roles }); continue; }
    }

    // ── SET_BROADCAST_TIME ────────────────────────────────────────────────────
    if (/\b(hora|time|a\s+las|at|programa|agenda|schedule|cambiar?\s+hora)\b/.test(seg)) {
      const timeMatch = seg.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
      if (timeMatch) {
        const normalised = normaliseTime(timeMatch[1]);
        if (normalised) { commands.push({ type: 'SET_BROADCAST_TIME', time: normalised }); continue; }
      }
    }
  }

  return commands.length > 0 ? commands : null;
}

// ─── Executor ─────────────────────────────────────────────────────────────────

const METRIC_LABELS: Record<ReportMetric, string> = {
  gold:    'oro',
  silver:  'plata',
  usd_hnl: 'USD/HNL',
  copper:  'cobre',
};

export async function executeAdminCommand(
  command:   AdminCommand,
  updatedBy: string
): Promise<CommandResult> {
  try {
    switch (command.type) {
      case 'ENABLE_METRIC': {
        if (!ALLOWED_METRICS.includes(command.metric)) {
          throw new Error(`Metrica desconocida: ${command.metric}`);
        }
        await enableMetric(command.metric, updatedBy);
        return { command, success: true,
          message: `Listo, ${METRIC_LABELS[command.metric]} ya esta habilitado en el reporte diario.` };
      }

      case 'DISABLE_METRIC': {
        if (!ALLOWED_METRICS.includes(command.metric)) {
          throw new Error(`Metrica desconocida: ${command.metric}`);
        }
        await disableMetric(command.metric, updatedBy);
        return { command, success: true,
          message: `Listo, ${METRIC_LABELS[command.metric]} quedo deshabilitado del reporte.` };
      }

      case 'SET_CURRENCY': {
        if (!ALLOWED_METRICS.includes(command.metric)) {
          throw new Error(`Metrica desconocida: ${command.metric}`);
        }
        await updateMetricCurrency(command.metric, command.currency, updatedBy);
        return { command, success: true,
          message: `Dale, ${METRIC_LABELS[command.metric]} ahora se muestra en ${command.currency}.` };
      }

      case 'SET_AUDIENCE': {
        const invalid = command.roles.filter(r => !ALLOWED_ROLES.includes(r));
        if (invalid.length > 0) throw new Error(`Roles desconocidos: ${invalid.join(', ')}`);
        await updateAudience(command.roles, updatedBy);
        return { command, success: true,
          message: `Audiencia del reporte actualizada: ${command.roles.join(', ')}.` };
      }

      case 'SET_BROADCAST_TIME': {
        await updateSchedule(command.time, updatedBy);
        return { command, success: true,
          message: `Hora del reporte diario cambiada a ${command.time}.` };
      }

      case 'SEND_BROADCAST': {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
        const secret  = process.env.CRON_SECRET ?? '';
        // Fire and forget — do not await
        fetch(`${siteUrl}/api/broadcast/run`, {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${secret}`,
          },
          body: JSON.stringify({ triggered_by: `admin:${updatedBy}` }),
        }).catch(e => console.error('[adminCommandService] broadcast trigger failed:', e));
        return { command, success: true,
          message: 'Dale, el reporte diario se esta enviando ahora mismo.' };
      }
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { command, success: false,
      message: 'Fijese que hubo un problema al ejecutar ese comando. Intente de nuevo.',
      error };
  }
}

// ─── Logger ───────────────────────────────────────────────────────────────────

async function logAdminAction(
  userPhone:   string,
  command:     AdminCommand,
  success:     boolean,
  errorMsg?:   string
): Promise<void> {
  try {
    const admin = getAdminClient();
    const { type, ...payload } = command;
    await admin.from('admin_actions').insert({
      user_phone:   userPhone,
      command_type: type,
      payload:      payload as Record<string, unknown>,
      success,
      error_msg:    errorMsg ?? null,
    });
  } catch (e) {
    // Non-fatal — log failures must never break the main flow
    console.error('[adminCommandService] logAdminAction failed:', e);
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Interpret and execute admin commands from a natural language message.
 *
 * Returns:
 *   - A Spanish reply string (one line per command) if commands were found
 *   - null if no commands detected — caller should fall through to Claude
 */
export async function interpretAndExecute(
  user:    UsuarioBroadcast,
  message: string
): Promise<string | null> {
  // Safety gate — only admins can execute commands
  if (user.rol !== 'admin') return null;

  const commands = parseAdminIntent(message);
  if (!commands || commands.length === 0) return null;

  // Execute all commands concurrently, log each
  const results = await Promise.all(
    commands.map(async (cmd) => {
      const result = await executeAdminCommand(cmd, user.telefono);
      await logAdminAction(user.telefono, cmd, result.success, result.error);
      return result;
    })
  );

  return results.map(r => r.message).join('\n');
}
