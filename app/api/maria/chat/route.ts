// María — web chat endpoint. Public-facing, anonymous, ephemeral.
// Mirrors the substantive parts of `app/api/whatsapp/route.js` (prices, RAG,
// concesiones, Claude Haiku) but drops everything that's WhatsApp-specific
// (phone normalization, Twilio TwiML, onboarding state, admin commands,
// contact forwarding, expediente/cliente lookup).
//
// History lives in the browser (sessionStorage on the client). The endpoint
// is stateless: each request POSTs the full message array.

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { CHT_SYSTEM_PROMPT } from '@/lib/maria/systemPrompt';
import { embedQuery, toVectorText } from '@/lib/maria/embeddings';
import { supabase } from '@/services/supabase';
import { fetchAllPrices } from '@/services/pricingService';
import { checkRateLimit, clientIpFrom } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_MESSAGES = 30;
const MAX_CONTENT_CHARS = 2000;
const RATE_LIMIT_PER_IP = 20;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

type ChatMessage = { role: 'user' | 'assistant'; content: string };

// ─── Concesiones context (anon-safe — RPC is SECURITY DEFINER) ─────────────
const CONCESION_TRIGGERS = /\b(concesi[oó]n(?:es)?|inhgeomin|permiso\s+(?:de\s+)?(?:exploraci[oó]n|explotaci[oó]n|miner[oa])|registro\s+(?:de\s+)?(?:concesi[oó]n|miner[oa])|otorgad[ao]\s+para|en\s+solicitud|pendiente\s+de\s+aprobaci[oó]n|qui[eé]n\s+tiene\s+(?:la\s+)?concesi[oó]n|empresa\s+miner|d[oó]nde\s+est[aá]\s+ubicad)/i;

async function buildConcesionContext(message: string): Promise<string> {
  if (!CONCESION_TRIGGERS.test(message)) return '';
  const stopwords = /\b(concesi[oó]n(?:es)?|inhgeomin|permiso|exploraci[oó]n|explotaci[oó]n|miner[oa]?|registro|otorgad[ao]|para|en|solicitud|pendiente|de|aprobaci[oó]n|qui[eé]n|tiene|la|el|empresa|d[oó]nde|est[aá]|ubicad[ao]?|hay|alguna|alguien|los|las|del|al|si|me|por|favor|gracias)\b/gi;
  const cleaned = message
    .replace(stopwords, ' ')
    .replace(/[¿?¡!.,;:%_\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length < 3) return '';

  try {
    const { data, error } = await supabase.rpc('search_concesion_minera', {
      p_query: cleaned.slice(0, 80),
      p_categoria: null,
      p_clasificacion: null,
      p_limit: 5,
    });
    if (error || !data?.length) return '';
    const SHORT: Record<string, string> = {
      explotacion_otorgada: 'Otorgada · Explotación',
      exploracion_otorgada: 'Otorgada · Exploración',
      solicitud_pendiente: 'En Solicitud (pendiente)',
    };
    type Row = {
      categoria: string;
      codigo: string | null;
      nombre_zona: string;
      solicitante: string;
      clasificacion: string;
      fecha_solicitud: string | null;
    };
    const lines = (data as Row[]).slice(0, 5).map((r) => {
      const cat = SHORT[r.categoria] ?? r.categoria;
      const cod = r.codigo ? ` · cód. ${r.codigo}` : '';
      const fecha = r.fecha_solicitud ?? 's/f';
      return `• ${r.nombre_zona}${cod} — ${r.solicitante} — ${cat} (${r.clasificacion}) — solicitud ${fecha}`;
    });
    return `\n\nREGISTRO INHGEOMIN — concesiones encontradas (datos públicos):
${lines.join('\n')}
La mayoría de los registros marcados "En Solicitud" siguen pendientes de aprobación; no afirmes que ya está aprobada una concesión que figura como "solicitud_pendiente".`;
  } catch (e) {
    console.warn('[maria-web concesiones] non-fatal:', (e as Error)?.message);
    return '';
  }
}

// ─── RAG retrieval (anon-safe — both RPCs are SECURITY DEFINER) ────────────
const RAG_MATCH_COUNT = 3;
const RAG_MATCH_THRESHOLD = 0.7;

type KnowledgeRow = { category: string; title: string; content: string };

function formatKnowledgeRows(rows: KnowledgeRow[]): string | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows.map((c) => `[${c.category}] ${c.title}: ${c.content}`).join('\n\n');
}

async function retrieveKnowledge(userMessage: string): Promise<string | null> {
  let hasEmbeddings = false;
  try {
    const { count, error } = await supabase
      .from('maria_knowledge')
      .select('id', { count: 'exact', head: true })
      .not('embedding', 'is', null);
    if (!error) hasEmbeddings = (count ?? 0) > 0;
  } catch (e) {
    console.error('[maria-web rag] pre-check non-fatal:', (e as Error)?.message);
  }

  if (hasEmbeddings) {
    try {
      const queryEmbedding = await embedQuery(userMessage);
      if (queryEmbedding) {
        const vecText = toVectorText(queryEmbedding);
        const { data, error } = await supabase.rpc('match_maria_knowledge', {
          query_embedding: vecText,
          match_threshold: RAG_MATCH_THRESHOLD,
          match_count: RAG_MATCH_COUNT,
        });
        if (!error && data?.length) {
          return formatKnowledgeRows(data as KnowledgeRow[]);
        }
        if (error) console.error('[maria-web rag] match RPC error:', error.message);
      }
    } catch (e) {
      console.error('[maria-web rag] semantic non-fatal:', (e as Error)?.message);
    }
  }

  try {
    const { data: chunks, error } = await supabase.rpc('search_maria_knowledge_fts', {
      query_text: userMessage,
      match_count: RAG_MATCH_COUNT,
    });
    if (error || !chunks?.length) {
      if (error) console.error('[maria-web rag] FTS RPC error:', error.message);
      return null;
    }
    return formatKnowledgeRows(chunks as KnowledgeRow[]);
  } catch (e) {
    console.error('[maria-web rag] FTS non-fatal:', (e as Error)?.message);
    return null;
  }
}

// ─── Price context (cache → live fallback) ──────────────────────────────────
interface PriceSnapshot {
  oro: number;
  plata: number | null;
  usd_hnl: number | null;
  fecha?: string;
  fuente?: string;
}

async function buildPriceContext(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  let prices: PriceSnapshot | null = null;

  try {
    const { data: cached } = await supabase
      .from('precios_diarios')
      .select('oro, plata, usd_hnl, fecha, fuente')
      .eq('fecha', today)
      .single();
    if (cached?.oro) {
      prices = cached as unknown as PriceSnapshot;
    }
  } catch {
    // missing row is the common case — fall through to live fetch
  }

  if (!prices) {
    try {
      const live = await fetchAllPrices();
      if (live.oro) {
        prices = {
          oro: live.oro,
          plata: live.plata,
          usd_hnl: live.usd_hnl,
          fecha: today,
          fuente: live.fuente,
        };
      }
    } catch (e) {
      console.log('[maria-web prices] live fetch non-fatal:', (e as Error)?.message);
    }
  }

  if (!prices) {
    return `\n\nPRECIOS DE REFERENCIA: No hay datos de precios cargados hoy. Si el cliente pregunta por precio de compra del oro, di: "Hoy no tengo el precio cargado en el sistema. Para precio actualizado escribí a gerencia@mape.legal."`;
  }

  const fmt = (n: number, d = 2) =>
    Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const oroLBMA = `$${fmt(prices.oro)} USD/oz troy`;
  const oroCompra =
    prices.usd_hnl != null
      ? `L ${fmt((prices.oro * 0.8 * prices.usd_hnl) / 31.1035)}/gramo`
      : null;
  const plataLBMA = prices.plata != null ? `$${fmt(prices.plata)} USD/oz troy` : null;
  const horaConsultaHN = new Date().toLocaleTimeString('es-HN', {
    timeZone: 'America/Tegucigalpa',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  const frescuraLabel = `consultado hoy ${horaConsultaHN}`;
  const tipoCambio = prices.usd_hnl != null ? `L ${fmt(prices.usd_hnl)}/USD` : null;

  return `\n\nPRECIOS DE REFERENCIA (${prices.fecha ?? 'hoy'} — ${frescuraLabel}):
- Oro LBMA: ${oroLBMA}
- Precio de compra CHT (80% LBMA): ${oroCompra ?? 'el equipo confirma hoy'}
- Plata LBMA: ${plataLBMA ?? 'no disponible'}
- Tipo de cambio: ${tipoCambio ?? 'no disponible'}
- Frescura: ${frescuraLabel}
${prices.fuente ? `- Fuente: ${prices.fuente}` : ''}
El formato canónico de respuesta para precio del día está en CUANDO PREGUNTAN POR EL PRECIO DEL ORO — síguelo al pie de la letra. El timestamp ("Actualizado") y el tipo de cambio USD/LPS son OBLIGATORIOS en cada respuesta de precio.`;
}

// ─── Web channel guidance — injected after the base prompt ──────────────────
const WEB_CHANNEL_CONTEXT = `

CONTEXTO DEL CANAL — WEB (mape.legal):
Este visitante está chateando desde el sitio web institucional, no por WhatsApp. La conversación es anónima — no tenés su número, ni su nombre, ni datos de cliente registrados.
- NO le pidas DPI, número de teléfono, ni datos personales en este canal. La captura formal de datos sucede por WhatsApp (+504 9737 3139) o por correo a gerencia@mape.legal.
- Si el visitante avanza hacia una solicitud concreta (cotización formal, inicio de trámite, transacción de oro), invitalo a continuar con María por WhatsApp al +504 9737 3139 o por correo a gerencia@mape.legal — ahí se registra formalmente.
- Mantené tu personalidad y reglas: tuteo, respuestas cortas (≤5 líneas), sin emojis, sin fechas exactas. Las reglas de "Tierra Primero" siguen aplicando: si el visitante quiere formalización, preguntá primero por situación de tierra.
- El bloque CONTEXTO DEL MINERO ACTIVO no aparece en este canal — no asumas datos del visitante.`;

// ─── POST handler ────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const ip = clientIpFrom(request);
  const rl = checkRateLimit(`maria-web:${ip}`, RATE_LIMIT_PER_IP, RATE_LIMIT_WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Estás escribiendo muy rápido. Intentá en un momento.', code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Cuerpo inválido.', code: 'BAD_BODY' },
      { status: 400 }
    );
  }

  const body = payload as { messages?: unknown };
  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: 'Falta el campo "messages".', code: 'BAD_BODY' },
      { status: 400 }
    );
  }
  if (messages.length > MAX_MESSAGES) {
    return NextResponse.json(
      { error: 'La conversación está demasiado larga. Recargá para empezar de nuevo.', code: 'TOO_MANY_MESSAGES' },
      { status: 400 }
    );
  }

  const validated: ChatMessage[] = [];
  for (const m of messages) {
    const obj = m as { role?: unknown; content?: unknown };
    if (
      (obj.role !== 'user' && obj.role !== 'assistant') ||
      typeof obj.content !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Formato de mensaje inválido.', code: 'BAD_BODY' },
        { status: 400 }
      );
    }
    const content = obj.content.trim();
    if (!content) {
      return NextResponse.json(
        { error: 'Mensaje vacío.', code: 'BAD_LENGTH' },
        { status: 400 }
      );
    }
    if (content.length > MAX_CONTENT_CHARS) {
      return NextResponse.json(
        { error: 'Mensaje demasiado largo.', code: 'BAD_LENGTH' },
        { status: 400 }
      );
    }
    validated.push({ role: obj.role, content });
  }

  if (!anthropic) {
    console.error('[maria-web] ANTHROPIC_API_KEY not set');
    return NextResponse.json(
      { error: 'Servicio no disponible. Intentá más tarde.', code: 'SERVER_CONFIG' },
      { status: 500 }
    );
  }

  // Anthropic requires the first message in the array to be 'user'.
  // Drop any leading 'assistant' messages defensively (the client should
  // never send the welcome message, but be tolerant).
  while (validated.length && validated[0].role !== 'user') validated.shift();

  // Dedup consecutive same-role messages by merging their content — same
  // defensive pattern as `route.js` (cleanHistory). Anthropic rejects
  // two consecutive user or assistant turns.
  const cleanHistory: ChatMessage[] = [];
  for (const m of validated) {
    const last = cleanHistory[cleanHistory.length - 1];
    if (!last || last.role !== m.role) {
      cleanHistory.push({ ...m });
    } else {
      last.content = `${last.content}\n\n${m.content}`;
    }
  }
  if (cleanHistory.length === 0 || cleanHistory[cleanHistory.length - 1].role !== 'user') {
    return NextResponse.json(
      { error: 'Falta un mensaje del usuario.', code: 'BAD_BODY' },
      { status: 400 }
    );
  }

  const lastUserMessage = [...cleanHistory].reverse().find((m) => m.role === 'user')?.content ?? '';

  // Build dynamic context blocks in parallel — independent queries.
  const [priceContext, concesionContext, ragBlock] = await Promise.all([
    buildPriceContext(),
    buildConcesionContext(lastUserMessage),
    retrieveKnowledge(lastUserMessage),
  ]);

  const ragContext = ragBlock ? `\n\nCONTEXTO DEL SISTEMA:\n${ragBlock}` : '';
  const dynamicPrompt =
    CHT_SYSTEM_PROMPT + WEB_CHANNEL_CONTEXT + priceContext + concesionContext + ragContext;

  try {
    const claudeRes = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: dynamicPrompt,
      messages: cleanHistory,
    });
    const first = claudeRes.content[0];
    const reply = first?.type === 'text' ? first.text.trim() : '';
    if (!reply) {
      console.error('[maria-web] empty reply from Claude');
      return NextResponse.json(
        { error: 'Respuesta vacía. Probá de nuevo.', code: 'EMPTY' },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { reply },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e) {
    console.error('[maria-web] anthropic call failed:', (e as Error)?.message);
    return NextResponse.json(
      { error: 'No pude responder ahora mismo. Probá de nuevo en unos minutos.', code: 'UPSTREAM' },
      { status: 500 }
    );
  }
}
