import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { getUserByPhone, getOrCreateUserByPhone } from "@/services/userService";
import { interpretAndExecute } from "@/services/adminCommandService";
import { getOnboardingState, handleOnboarding } from "@/services/onboardingService";
import { fetchAllPrices, fetchAndStorePrices, TROY_OUNCE_GRAMS } from "@/services/pricingService";
import { embedQuery, toVectorText } from "@/lib/maria/embeddings";
import { normalizePhone } from "@/lib/maria/normalizePhone";
import { CHT_SYSTEM_PROMPT } from "@/lib/maria/systemPrompt";

// Conditional init — instantiating these unconditionally at module load would
// throw during Next.js's page-data-collection build phase when env vars aren't
// injected, breaking the whole production build. At runtime on Vercel the env
// vars are always set, so the consts are real clients in the handler path.
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _supabase;
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// User intents that bypass the onboarding gate so substantive questions don't
// get black-holed by the registration flow. The row (if any) stays so the
// user can resume onboarding later; this only relaxes the gate for this turn.
const ONBOARDING_ESCAPE_PATTERNS = /\b(boletin|bolet[ií]n|precio(s)?\s+(de(l)?\s+)?(oro|plata|hoy)|cotizaci[oó]n|tipo\s+de\s+cambio|ley\s+general|reglamento|acuerdo\s+042|art[ií]culo\s+\d+|art\.?\s*\d+|no\s+quiero\s+(registrar(me|se)?|onboarding)|m[aá]s\s+tarde|despu[eé]s|stop|salir)\b/i;


function buildExpedienteContext(exps) {
  const FASE_NOMBRES = [
    'Onboarding',
    'Solicitud INHGEOMIN',
    'Licencia Ambiental SERNA',
    'Resolución y Título INHGEOMIN',
    'Permiso Municipal y Comercializador',
  ];
  return exps.map(exp => {
    const faseNombre = FASE_NOMBRES[exp.fase_numero] ?? `Fase ${exp.fase_numero}`;
    const faseActual = exp.progress_fases?.find(f => f.estado === 'activo')?.nombre ?? faseNombre;
    const hitosPend = exp.hitos
      ?.filter(h => h.estado === 'pendiente')
      .map(h => `Hito ${h.numero} (L ${Number(h.monto ?? 0).toLocaleString('es-HN')})`)
      .join(', ');
    return `
EXPEDIENTE ACTIVO: ${exp.numero_expediente}
- Tipo: ${exp.tipo || 'Formalización minera'}
- Fase actual: ${faseActual} (Fase ${exp.fase_numero}, paso ${exp.paso} de ${exp.total_pasos})
- Estado: ${exp.estado}
- Cierre estimado: ${exp.cierre_estimado ?? 'por definir'}
- Hitos pendientes de pago: ${hitosPend || 'ninguno'}
Cuando el cliente pregunte por el avance de su trámite, usa esta información. Sé específico con el número de expediente y la fase.`;
  }).join('\n');
}

// ─── Manual Operativo 2026 lookup ─────────────────────────────────────────────
// Triggers when the user asks about a specific paso, the Manual Operativo,
// or who is responsible for a step. Uses the existing service-role client.

const MANUAL_TRIGGERS = /\bpaso\s+\d+\b|primer\s+paso|siguiente\s+paso|pr[oó]ximo\s+paso|qu[eé]\s+(paso\s+)?sigue|c[oó]mo\s+(empiezo|empezar|inicio|iniciar)|por\s+d[oó]nde\s+(empiezo|empezar|inicio|iniciar)|manual\s+operativo|qu[eé]\s+dice\s+el\s+paso|qui[eé]n\s+es\s+responsable|rol\s+del\s+paso|responsable\s+del\s+paso|encargado\s+del\s+paso/i;

const FIRST_STEP_TRIGGERS  = /primer\s+paso|c[oó]mo\s+(empiezo|empezar|inicio|iniciar)|por\s+d[oó]nde\s+(empiezo|empezar|inicio|iniciar)/i;

// Detect which of the three CHT processes the conversation is about, so we can
// scope the documentos_referencia query (the table now stores all three:
// formalizacion 1-38, titulacion 1-9, sociedad 1-7).
function detectProceso(haystack) {
  if (/sociedad\s+minera|contrato\s+de\s+sociedad|due\s+diligence/i.test(haystack)) return 'sociedad';
  if (/titulaci[oó]n|titular(?!.*minero)|propiedad|topograf[ií]a|registro\s+de\s+la\s+propiedad/i.test(haystack)) return 'titulacion';
  if (/formalizaci[oó]n|inhgeomin|serna|hito\s*[123]|dupai|gaceta|comercializador/i.test(haystack)) return 'formalizacion';
  return null; // unknown → caller decides default
}

async function buildManualContext(message, supabaseClient, recentHistory = '') {
  if (!MANUAL_TRIGGERS.test(message)) return '';

  try {
    const haystack = `${message}\n${recentHistory}`;
    // Default to formalización when no service was mentioned — it's the most
    // common path and the original behaviour of this lookup.
    const proceso = detectProceso(haystack) ?? 'formalizacion';

    const stepMatch = /\bpaso\s+(\d+)\b/i.exec(message);
    let stepNum     = stepMatch ? parseInt(stepMatch[1], 10) : null;

    // "primer paso" / "cómo empiezo" → paso 1 of the detected proceso
    if (!stepNum && FIRST_STEP_TRIGGERS.test(message)) stepNum = 1;

    // Sanitise keyword: strip PostgREST/ILIKE special chars, cap at 40 chars
    const keyword = message.replace(/[%_\\]/g, '').slice(0, 40).trim();

    let query = supabaseClient
      .from('documentos_referencia')
      .select('proceso, paso_numero, titulo_paso, rol, acciones, documentos, plazo, deliverable, advertencias')
      .eq('proceso', proceso);

    query = stepNum
      ? query.or(`paso_numero.eq.${stepNum},titulo_paso.ilike.%${keyword}%`)
      : query.ilike('titulo_paso', `%${keyword}%`);

    const { data, error } = await query.limit(1).single();
    if (error || !data) return '';

    const procesoLabel = {
      formalizacion: 'Formalización Minera',
      titulacion:    'Titulación de Propiedad',
      sociedad:      'Contrato de Sociedad Minera',
    }[data.proceso] ?? data.proceso;

    return `\n\nREFERENCIA MANUAL OPERATIVO — ${procesoLabel}, Paso ${data.paso_numero}: ${data.titulo_paso}
- Responsable: ${data.rol ?? 'no especificado'}
- Acciones: ${data.acciones ?? '—'}
- Documentos requeridos: ${data.documentos ?? '—'}
- Plazo: ${data.plazo ?? '—'}
- Entregable: ${data.deliverable ?? '—'}
- Advertencias: ${data.advertencias ?? '—'}
Usa esta información para responder con precisión. No inventes datos fuera de este bloque.`;
  } catch {
    return ''; // silent failure — never block María's response
  }
}

// ─── Concesiones INHGEOMIN — registro público ──────────────────────────────────
// Si el usuario menciona "concesión", "INHGEOMIN", "permiso de exploración",
// "permiso de explotación", "está registrado", etc. — buscamos en el registro
// `concesiones_mineras_registro` y devolvemos un bloque resumen para que
// María responda con datos reales en vez de inventar.
//
// Tres categorías canónicas: explotacion_otorgada, exploracion_otorgada,
// solicitud_pendiente (la mayoría son solicitudes pendientes).
// El RPC `search_concesion_minera` tiene SECURITY DEFINER → bypasea RLS
// independientemente del estado del service_role.
const CONCESION_TRIGGERS = /\b(concesi[oó]n(?:es)?|inhgeomin|permiso\s+(?:de\s+)?(?:exploraci[oó]n|explotaci[oó]n|miner[oa])|registro\s+(?:de\s+)?(?:concesi[oó]n|miner[oa])|otorgad[ao]\s+para|en\s+solicitud|pendiente\s+de\s+aprobaci[oó]n|qui[eé]n\s+tiene\s+(?:la\s+)?concesi[oó]n|empresa\s+miner|d[oó]nde\s+est[aá]\s+ubicad)/i;

async function buildConcesionContext(message, supabaseClient) {
  if (!CONCESION_TRIGGERS.test(message)) return '';

  // Extraer un término de búsqueda razonable — quitamos palabras gatillo y
  // dejamos lo distintivo (nombre, empresa, código). Word boundaries (`\b`)
  // evitan strippear substrings dentro de nombres reales (e.g. "Dorado" no
  // contiene "de" como palabra, pero `/de/g` sin boundary podría matchear
  // dentro de zonas como "depósito" o "dedos").
  const stopwords = /\b(concesi[oó]n(?:es)?|inhgeomin|permiso|exploraci[oó]n|explotaci[oó]n|miner[oa]?|registro|otorgad[ao]|para|en|solicitud|pendiente|de|aprobaci[oó]n|qui[eé]n|tiene|la|el|empresa|d[oó]nde|est[aá]|ubicad[ao]?|hay|alguna|alguien|los|las|del|al|si|me|por|favor|gracias)\b/gi;
  const cleaned = message
    .replace(stopwords, ' ')
    .replace(/[¿?¡!.,;:%_\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Si no queda nada distintivo, no consultamos.
  if (cleaned.length < 3) return '';

  try {
    const { data, error } = await supabaseClient.rpc('search_concesion_minera', {
      p_query:         cleaned.slice(0, 80),
      p_categoria:     null,
      p_clasificacion: null,
      p_limit:         5,
    });
    if (error || !data?.length) return '';

    const CATEGORIA_SHORT = {
      explotacion_otorgada: 'Otorgada · Explotación',
      exploracion_otorgada: 'Otorgada · Exploración',
      solicitud_pendiente:  'En Solicitud (pendiente)',
    };

    const lines = data.slice(0, 5).map(r => {
      const cat   = CATEGORIA_SHORT[r.categoria] ?? r.categoria;
      const cod   = r.codigo ? ` · cód. ${r.codigo}` : '';
      const fecha = r.fecha_solicitud ?? 's/f';
      return `• ${r.nombre_zona}${cod} — ${r.solicitante} — ${cat} (${r.clasificacion}) — solicitud ${fecha}`;
    });

    return `\n\nREGISTRO INHGEOMIN — concesiones encontradas (datos públicos):
${lines.join('\n')}
Si el cliente quiere más detalle de alguno, sugiérele consultar el portal de INHGEOMIN o el panel www.mape.legal/admin/concesiones. La mayoría de los registros marcados "En Solicitud" siguen pendientes de aprobación; no afirmes que ya está aprobada una concesión que figura como "solicitud_pendiente".`;
  } catch (e) {
    console.warn('[concesiones] non-fatal:', e?.message);
    return '';
  }
}

// ─── RAG: knowledge retrieval from maria_knowledge ────────────────────────────
// Hybrid retrieval. Primero intenta búsqueda semántica vía embeddings (OpenAI
// `text-embedding-3-small` → RPC `match_maria_knowledge`). Si no hay
// `OPENAI_API_KEY`, si el embed call falla, o si el threshold de similitud
// no devuelve filas, cae al RPC FTS determinístico
// (`search_maria_knowledge_fts`) que sigue activo desde migración 024.
//
// Devuelve string concatenado de "[category] title: content" o null si
// ninguna de las dos rutas trajo resultados. Non-blocking — cualquier
// excepción se loggea y se retorna null para no romper la respuesta de María.
const RAG_MATCH_COUNT = 3;
const RAG_MATCH_THRESHOLD = 0.7;

function formatKnowledgeRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows.map(c => `[${c.category}] ${c.title}: ${c.content}`).join('\n\n');
}

async function retrieveKnowledge(supabaseClient, userMessage) {
  // 0. Pre-check: count rows with an embedding. If the table isn't
  //    backfilled yet (or every row was wiped to NULL by some operator
  //    action), skip the OpenAI call entirely and go straight to FTS.
  //    `head: true` makes this a HEAD request with no row body —
  //    cheap even on a busy table.
  let hasEmbeddings = false;
  try {
    const { count, error } = await supabaseClient
      .from('maria_knowledge')
      .select('id', { count: 'exact', head: true })
      .not('embedding', 'is', null);
    if (error) {
      console.error('[rag] pre-check failed:', error.message);
    } else {
      hasEmbeddings = (count ?? 0) > 0;
      console.log(`[rag] pre-check embedded=${count ?? 0}`);
    }
  } catch (e) {
    console.error('[rag] pre-check non-fatal:', e?.message);
  }

  // 1. Semantic search (preferred — captures intent across synonyms).
  if (hasEmbeddings) {
    try {
      const queryEmbedding = await embedQuery(userMessage);
      if (queryEmbedding) {
        // pgvector requires the text form `[f1,f2,...]` as RPC arg. Passing
        // a raw JS array makes supabase-js JSON-encode it as a JSON array;
        // PostgREST hands it to PG as a json value, and there is no implicit
        // cast from json to vector — the RPC either errors or silently
        // returns 0 rows. Same root cause as the UPDATE serialization bug
        // fixed for the backfill in PR #130; the query path was missed
        // until PR #136.
        const vecText = toVectorText(queryEmbedding);
        const { data, error } = await supabaseClient.rpc('match_maria_knowledge', {
          query_embedding: vecText,
          match_threshold: RAG_MATCH_THRESHOLD,
          match_count: RAG_MATCH_COUNT,
        });
        if (!error && data?.length) {
          console.log(`[rag] path=semantic candidates=${data.length}`);
          return formatKnowledgeRows(data);
        }
        if (error) {
          // Surface as error, not warn — a broken semantic path looks
          // identical to "no match" downstream, so this log line is the
          // only diagnostic.
          console.error('[rag] match_maria_knowledge RPC error:', error.message);
        }
      }
    } catch (e) {
      console.error('[rag] semantic search non-fatal:', e?.message);
    }
  }

  // 2. FTS fallback — keyword-based, no external API call.
  try {
    const { data: chunks, error } = await supabaseClient.rpc('search_maria_knowledge_fts', {
      query_text: userMessage,
      match_count: RAG_MATCH_COUNT,
    });
    if (error || !chunks?.length) {
      if (error) console.error('[rag] search_maria_knowledge_fts RPC error:', error.message);
      console.log('[rag] path=none');
      return null;
    }
    console.log(`[rag] path=fts candidates=${chunks.length}`);
    return formatKnowledgeRows(chunks);
  } catch (e) {
    console.error('[rag] FTS retrieve error:', e?.message);
    return null;
  }
}



export async function POST(request) {
  try {
    const formData = await request.formData();
    const incomingMessage = formData.get("Body") || '';
    const fromNumber = formData.get("From") || '';

    // Media messages (images, voice notes) arrive with no Body text
    if (!incomingMessage.trim()) {
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Lo sentimos, solo puedo procesar mensajes de texto. Escribime tu consulta.</Message></Response>`,
        { status: 200, headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // --- EXECUTIVE MODE: Willis Yang admin trigger ---
    const ADMIN_PASSPHRASE = 'TENKA-2026';
    const isAdminCommand =
      incomingMessage.toLowerCase().includes('willis yang') &&
      incomingMessage.includes(ADMIN_PASSPHRASE);

    // --- ADMIN SUB-COMMANDS (fires before main admin report) ---
    if (incomingMessage.toLowerCase().startsWith('expediente ')) {
      // Gate behind admin status — either the inline passphrase OR the
      // caller's broadcast role. Without this, any WhatsApp number that
      // typed "expediente <uuid>" could pull the full row (cliente name,
      // notas, internal IDs) — CLAUDE.md described this subcommand as
      // "abierto por diseño" but that was a leak.
      let isAdminCaller = isAdminCommand;
      if (!isAdminCaller) {
        try {
          const callerPhone = normalizePhone(fromNumber);
          const callerUser  = await getUserByPhone(callerPhone);
          isAdminCaller = callerUser?.rol === 'admin';
        } catch {
          /* non-fatal — falls through to normal María flow below */
        }
      }

      if (isAdminCaller) {
        const expNum = incomingMessage.split(' ')[1];
        // Whitelist columns — defense in depth so a future loosening of the
        // gate can't accidentally leak new sensitive fields.
        const { data: exp } = await getSupabase()
          .from('expedientes')
          .select('id, cliente, estado, tipo, inicio, paso, notas')
          .eq('id', expNum)
          .single();

        const expDetail = exp
          ? `EXPEDIENTE ${expNum}
Cliente: ${exp.cliente || 'Sin datos'}
Estado: ${exp.estado}
Servicio: ${exp.tipo || 'Sin datos'}
Inicio: ${exp.inicio?.slice(0, 10) || 'Sin fecha'}
Paso actual: ${exp.paso || 'Sin datos'}
Notas: ${exp.notas || 'Sin notas'}`
          : `Expediente ${expNum} no encontrado.`;

        return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${esc(expDetail)}</Message></Response>`, {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        });
      }
      // Non-admin caller — fall through to the normal María flow so a real
      // visitor saying "expediente 12345 ¿cuándo terminan?" gets a sensible
      // answer instead of silence or a stray data leak.
    }

    if (isAdminCommand) {
      const now = new Date();
      const last1h = new Date(now - 60 * 60 * 1000).toISOString();
      const last24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();
      const last7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
      const today = now.toISOString().slice(0, 10);

      const [
        activeHourRes,
        active24hRes,
        active7dRes,
        totalMessagesRes,
        allClientesRes,
        expedientesRes,
        transaccionesRes,
        hitosRes,
        precioRes,
      ] = await Promise.all([
        getSupabase().from('conversaciones_whatsapp').select('numero_whatsapp, created_at').gte('created_at', last1h),
        getSupabase().from('conversaciones_whatsapp').select('numero_whatsapp, role, created_at').gte('created_at', last24h),
        getSupabase().from('conversaciones_whatsapp').select('numero_whatsapp').gte('created_at', last7d),
        getSupabase().from('conversaciones_whatsapp').select('*', { count: 'exact', head: true }),
        getSupabase().from('clientes').select('nombre, municipio, situacion_tierra, tipo_mineral, fecha_registro, telefono_whatsapp').order('created_at', { ascending: false }),
        getSupabase().from('expedientes').select('estado, tipo, inicio').order('inicio', { ascending: false }),
        getSupabase().from('transacciones_pendientes').select('estado, created_at, mensaje_original').order('created_at', { ascending: false }),
        getSupabase().from('hitos').select('estado, monto, trigger_evento').order('created_at', { ascending: false }),
      ]);

      const activeHour = activeHourRes.data;
      const active24h = active24hRes.data;
      const active7d = active7dRes.data;
      const totalMessages = totalMessagesRes.count;
      const allClientes = allClientesRes.data;
      const expedientes = expedientesRes.data;
      const transacciones = transaccionesRes.data;
      const hitos = hitosRes.data;
      const precioLatest = precioRes.data;

      const activeHourNumbers = new Set(activeHour?.map(r => r.numero_whatsapp) || []);
      const active24hNumbers = new Set(active24h?.map(r => r.numero_whatsapp) || []);
      const active7dNumbers = new Set(active7d?.map(r => r.numero_whatsapp) || []);
      const userMessages24h = active24h?.filter(r => r.role === 'user').length || 0;

      const totalClientes = allClientes?.length || 0;
      const recentClientes = allClientes?.slice(0, 3) || [];

      const byMunicipio = {};
      allClientes?.forEach(c => {
        const m = c.municipio || 'Sin municipio';
        byMunicipio[m] = (byMunicipio[m] || 0) + 1;
      });

      const bySituacion = {};
      allClientes?.forEach(c => {
        const s = c.situacion_tierra || 'sin_datos';
        bySituacion[s] = (bySituacion[s] || 0) + 1;
      });

      const totalExpedientes = expedientes?.length || 0;
      const expByEstado = {};
      const expByServicio = {};
      expedientes?.forEach(e => {
        expByEstado[e.estado] = (expByEstado[e.estado] || 0) + 1;
        expByServicio[e.tipo] = (expByServicio[e.tipo] || 0) + 1;
      });

      const pendingTx = transacciones?.filter(t => t.estado === 'pendiente_confirmacion') || [];
      const recentTx = transacciones?.slice(0, 3) || [];

      const hitosPendientes = hitos?.filter(h => h.estado === 'pendiente') || [];
      const hitosConfirmados = hitos?.filter(h => h.estado === 'cobrado') || [];
      const totalCobrado = hitosConfirmados.reduce((sum, h) => sum + (parseFloat(h.monto) || 0), 0);
      const totalPendiente = hitosPendientes.reduce((sum, h) => sum + (parseFloat(h.monto) || 0), 0);

      // Section builders that distinguish "no data" from "query error"
      const expedientesSection = expedientesRes.error
        ? `Error leyendo expedientes: ${expedientesRes.error.message}`
        : totalExpedientes === 0
          ? 'Total expedientes: 0\n→ No hay expedientes registrados. Sistema operativo, esperando registros nuevos.'
          : `Total expedientes: ${totalExpedientes}\n\nPor estado:\n${Object.entries(expByEstado).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n\nPor servicio:\n${Object.entries(expByServicio).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`;

      const transaccionesSection = transaccionesRes.error
        ? `Error leyendo transacciones: ${transaccionesRes.error.message}`
        : (transacciones?.length ?? 0) === 0
          ? 'Pendientes de revision: 0\n→ Sin transacciones registradas.'
          : `Pendientes de revision: ${pendingTx.length}\nUltimas transacciones:\n${recentTx.map(t => `- ${t.created_at?.slice(0, 10)}: ${t.estado}`).join('\n')}`;

      const hitosSection = hitosRes.error
        ? `Error leyendo hitos: ${hitosRes.error.message}`
        : (hitos?.length ?? 0) === 0
          ? 'Total cobrado confirmado: L 0\nHitos pendientes de cobro: 0\n→ Sin hitos registrados.'
          : `Total cobrado confirmado: L ${totalCobrado.toLocaleString('es-HN')}\nHitos pendientes de cobro: ${hitosPendientes.length}\nMonto pendiente total: L ${totalPendiente.toLocaleString('es-HN')}`;

      // Price freshness section
      let preciosSection;
      if (precioRes.error || !precioLatest) {
        preciosSection = `Sin precio registrado.\nVerificar API de precios o cron de broadcast.`;
      } else {
        const isToday = precioLatest.fecha === today;
        const fetchedAtStr = precioLatest.fetched_at
          ? new Date(precioLatest.fetched_at).toLocaleString('es-HN', { timeZone: 'America/Tegucigalpa' })
          : 'fecha de obtención desconocida';
        preciosSection =
`${isToday ? 'PRECIO ORO HOY' : `ULTIMO REGISTRO (${precioLatest.fecha})`}
LBMA: $${precioLatest.oro ?? 'N/D'} USD/oz
Tasa: L ${precioLatest.usd_hnl ?? 'N/D'}/USD
Fuente: ${precioLatest.fuente ?? 'N/D'}
Obtenido: ${fetchedAtStr}${!isToday ? '\n⚠️ ALERTA: Precio no actualizado hoy. Revisar cron de broadcast.' : ''}`;
      }

      const report1 =
`CHT EXECUTIVE REPORT
${now.toLocaleString('es-HN', { timeZone: 'America/Tegucigalpa' })}
━━━━━━━━━━━━━━━━━━━━
MARIA / WHATSAPP
Conversaciones activas ahora: ${activeHourNumbers.size}
Conversaciones hoy: ${active24hNumbers.size}
Conversaciones esta semana: ${active7dNumbers.size}
Mensajes recibidos hoy: ${userMessages24h}
Total mensajes historico: ${totalMessages || 0}
━━━━━━━━━━━━━━━━━━━━
CLIENTES REGISTRADOS
${allClientesRes.error ? `Error: ${allClientesRes.error.message}` : `Total: ${totalClientes}`}
${totalClientes > 0 ? `Recientes:\n${recentClientes.map(c => `- ${c.nombre} (${c.municipio || 'sin municipio'})`).join('\n')}` : '→ Sin clientes registrados todavia.'}

${totalClientes > 0 ? `Por municipio:\n${Object.entries(byMunicipio).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n\nPor situacion de tierra:\n${Object.entries(bySituacion).map(([k, v]) => `- ${k}: ${v}`).join('\n')}` : ''}`;

      const report2 =
`━━━━━━━━━━━━━━━━━━━━
EXPEDIENTES ACTIVOS
${expedientesSection}
━━━━━━━━━━━━━━━━━━━━
TRANSACCIONES DE ORO
${transaccionesSection}
━━━━━━━━━━━━━━━━━━━━
PRECIOS
${preciosSection}`;

      const report3 =
`━━━━━━━━━━━━━━━━━━━━
FACTURACION Y PAGOS
${hitosSection}
━━━━━━━━━━━━━━━━━━━━
REGULACIONES
INHGEOMIN: Operativo. Ventanilla presencial Tegucigalpa.
SERNA/SLAS-2: Sistema en linea activo.
INA Titulacion: Operativo. Plazo 60-120 dias.
Alcaldias municipales: Verificar requisitos locales vigentes por municipio.
Registro Comercializador: Unidad Fiscalizacion Minera activa.
━━━━━━━━━━━━━━━━━━━━
Comandos disponibles:
- expediente [numero]
- cliente [nombre]
- transacciones pendientes`;

      const twimlAdmin = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${esc(report1)}</Message>
  <Message>${esc(report2)}</Message>
  <Message>${esc(report3)}</Message>
</Response>`;

      return new Response(twimlAdmin, {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    console.log(`📩 Message from ${fromNumber}: ${incomingMessage}`);

    const { data: history } = await getSupabase()
      .from("conversaciones_whatsapp")
      .select("role, content")
      .eq("numero_whatsapp", fromNumber)
      .order("created_at", { ascending: true })
      .limit(40);

    const conversationHistory = history || [];
    console.log('History found:', conversationHistory.length, 'messages');

    // --- Look up miner in clientes table ---
    // normalizePhone handles whatsapp:/tel:/sms: prefixes, URL-encoding, and stray whitespace.
    // fromNumber stays as-is for conversaciones_whatsapp inserts (legacy rows use the prefix).
    const cleanNumber = normalizePhone(fromNumber);
    const { data: cliente } = await getSupabase()
      .from('clientes')
      .select('id, nombre, situacion_tierra, municipio, tipo_mineral, dpi, telefono_whatsapp')
      .eq('telefono_whatsapp', cleanNumber)
      .single();

    console.log('Cliente found:', cliente ? cliente.nombre : 'Unknown');

    // --- Profile completeness check ---
    let completenessSummary = '';
    if (cliente) {
      const camposRequeridos = {
        'Nombre':              !!cliente.nombre,
        'DPI':                 !!cliente.dpi,
        'Municipio':           !!cliente.municipio,
        'Situacion de tierra': !!cliente.situacion_tierra,
        'Tipo de mineral':     !!cliente.tipo_mineral,
      };
      const faltantes = Object.entries(camposRequeridos)
        .filter(([, ok]) => !ok)
        .map(([campo]) => campo);
      completenessSummary = faltantes.length === 0
        ? '\n- Perfil completo: si'
        : `\n- Perfil completo: no — faltan: ${faltantes.join(', ')}`;
    }

    // --- Fetch gold/silver prices: cache-first, then live API ---
    let preciosHoy = null;
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    try {
      const { data: cached } = await getSupabase()
        .from('precios_diarios')
        .select('oro, plata, usd_hnl, fecha, fetched_at, fuente')
        .eq('fecha', today)
        .single();
      if (cached?.oro) {
        preciosHoy = cached;
        console.log('Precios from cache:', `oro=${cached.oro} fetched_at=${cached.fetched_at}`);
      }
    } catch { /* table may not exist or be empty — fall through to live fetch */ }

    if (!preciosHoy) {
      try {
        const live = await fetchAllPrices();
        if (live.oro) {
          preciosHoy = {
            oro: live.oro,
            plata: live.plata,
            usd_hnl: live.usd_hnl,
            fecha: today,
            fetched_at: live.fetched_at,
            fuente: live.fuente,
          };
          console.log('Precios fetched live:', `oro=${live.oro} usd_hnl=${live.usd_hnl} fuente=${live.fuente}`);
          // Best-effort DB cache write — non-fatal
          fetchAndStorePrices().catch(e => console.log('Price DB cache failed (non-fatal):', e.message));
        }
      } catch (e) {
        console.log('Live price fetch failed (non-fatal):', e.message);
      }
    }

    const fmt = (n, d = 2) => Number(n).toLocaleString('en-US', {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    });
    const oroLBMA   = preciosHoy?.oro    != null ? `$${fmt(preciosHoy.oro)} USD/oz troy`   : null;
    const oroCompra = (preciosHoy?.oro != null && preciosHoy?.usd_hnl != null)
      ? `L ${fmt(preciosHoy.oro * 0.80 * preciosHoy.usd_hnl / TROY_OUNCE_GRAMS)}/gramo`
      : null;
    const plataLBMA = preciosHoy?.plata  != null ? `$${fmt(preciosHoy.plata)} USD/oz troy` : null;

    // Timestamp reflects the moment María assembles the reply, not the cache row's
    // fetched_at — otherwise a stale cache write yesterday surfaces as "actualizado hoy 06:57 p.m."
    // at 08:05 a.m. the next morning. MARIA.md §8 calls this "el momento exacto en que se armó el mensaje".
    const horaConsultaHN = new Date().toLocaleTimeString('es-HN', {
      timeZone: 'America/Tegucigalpa',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    const frescuraLabel = `consultado hoy ${horaConsultaHN}`;

    const tipoCambio = preciosHoy?.usd_hnl != null ? `L ${fmt(preciosHoy.usd_hnl)}/USD` : null;
    const priceContext = preciosHoy
      ? `\n\nPRECIOS DE REFERENCIA (${preciosHoy.fecha ?? 'hoy'}${frescuraLabel ? ` — ${frescuraLabel}` : ''}):
- Oro LBMA: ${oroLBMA ?? 'no disponible'}
- Precio de compra CHT (80% LBMA): ${oroCompra ?? 'el equipo confirma hoy'}
- Plata LBMA: ${plataLBMA ?? 'no disponible'}
- Tipo de cambio: ${tipoCambio ?? 'no disponible'}
- Frescura: ${frescuraLabel || 'no disponible'}
${preciosHoy.fuente ? `- Fuente: ${preciosHoy.fuente}` : ''}
El formato canónico de respuesta para precio del día está en CUANDO PREGUNTAN POR EL PRECIO DEL ORO — síguelo al pie de la letra (4 viñetas: LBMA + CHT compra + Tipo de cambio USD/LPS + Actualizado, luego Finacoop + www.mape.legal). El timestamp ("Actualizado") y el tipo de cambio USD/LPS son OBLIGATORIOS en cada respuesta de precio.`
      : `\n\nPRECIOS DE REFERENCIA: No hay datos de precios cargados hoy. Si el cliente pregunta por precio de compra del oro, di: "Hoy no tengo el precio cargado en el sistema. Para precio actualizado escribí a gerencia@mape.legal."`;

    // --- Query expedientes linked to this client ---
    let expedienteContext = '';
    if (cliente) {
      // Sanitize nombre: strip PostgREST or() separator chars to prevent filter injection
      const safeNombre = cliente.nombre.replace(/[,()]/g, ' ').trim();
      const { data: exps } = await getSupabase()
        .from('expedientes')
        .select(`
          numero_expediente, tipo, estado, fase_numero, paso, total_pasos,
          cierre_estimado,
          hitos(numero, monto, porcentaje, estado),
          progress_fases(nombre, estado, orden)
        `)
        .or(`cliente_id.eq.${cliente.id},cliente.ilike.%${safeNombre}%`)
        .order('created_at', { ascending: false })
        .limit(3);

      if (exps?.length) {
        expedienteContext = buildExpedienteContext(exps);
      } else {
        expedienteContext = `\nEXPEDIENTE: Este cliente no tiene expediente activo todavía. Si pregunta por su trámite, explícale el proceso de Fase 0 y el Hito 1 de L 640,000 (40% anticipo del Paquete Ancla L 1,600,000) para iniciarlo.`;
      }
    }

    // --- Build client context for María ---
    const clienteContext = cliente
      ? `
CONTEXTO DEL MINERO ACTIVO:
- Nombre: ${cliente.nombre}
- Municipio: ${cliente.municipio || 'no registrado'}
- Situación de tierra: ${cliente.situacion_tierra || 'no registrada'}
- Mineral: ${cliente.tipo_mineral || 'oro'}
- DPI: ${cliente.dpi || 'no registrado'}${completenessSummary}
Usa su nombre naturalmente en la conversación. Ya lo conoces — no le pidas datos que ya tienes.`
      : `
MINERO NO REGISTRADO:
Este número no está en nuestra base de datos todavía.
En algún momento natural de la conversación, pide su nombre completo.
Cuando lo tengas, dile: "Perfecto [nombre], te voy a registrar en nuestro sistema."
NO fuerces el registro — deja que fluya naturalmente en la conversación.`;

    // Detect if conversation already started
    const isNewConversation = conversationHistory.length === 0;

    // --- Broadcast user lookup (role-based admin commands) ---
    let broadcastUser = null;
    try {
      broadcastUser = await getUserByPhone(cleanNumber);
    } catch { /* non-fatal */ }

    const isAdmin = broadcastUser?.rol === 'admin';

    // --- Admin command interception (runs BEFORE Claude) ---
    if (isAdmin && broadcastUser) {
      const cmdReply = await interpretAndExecute(broadcastUser, incomingMessage);
      if (cmdReply !== null) {
        await getSupabase().from("conversaciones_whatsapp").insert([
          { numero_whatsapp: fromNumber, role: "user",      content: incomingMessage },
          { numero_whatsapp: fromNumber, role: "assistant", content: cmdReply },
        ]);
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${esc(cmdReply)}</Message></Response>`,
          { status: 200, headers: { "Content-Type": "text/xml" } }
        );
      }
    }

    // --- Onboarding check (new users, runs BEFORE building the prompt) ---
    // Wrapped in try/catch so a missing onboarding_states table or any DB error
    // gracefully falls through to the normal María flow instead of erroring.
    // handleOnboarding handles both turn-1 (no row yet — defaults to ASK_NAME/{}) and
    // subsequent turns, so it always parses the user's actual message for fields
    // instead of greeting blindly when the first message already contains a name.
    //
    // Escape gate: if the user is asking for prices, the daily bulletin, a law
    // reference, or explicitly opting out, skip onboarding this turn and route
    // them to free chat. Their onboarding row stays untouched so they can
    // resume later when they send a non-escape message.
    const wantsEscape = ONBOARDING_ESCAPE_PATTERNS.test(incomingMessage);
    if (!isAdmin && !wantsEscape) {
      try {
        const onboardingState = await getOnboardingState(cleanNumber);
        const isNewUser     = !cliente && onboardingState === null;
        const isInProgress  = onboardingState && onboardingState.estado !== 'COMPLETE';
        if (isNewUser || isInProgress) {
          const reply = await handleOnboarding(cleanNumber, incomingMessage);
          await getSupabase().from("conversaciones_whatsapp").insert([
            { numero_whatsapp: fromNumber, role: "user",      content: incomingMessage },
            { numero_whatsapp: fromNumber, role: "assistant", content: reply },
          ]);
          return new Response(
            `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${esc(reply)}</Message></Response>`,
            { status: 200, headers: { "Content-Type": "text/xml" } }
          );
        }
      } catch (e) {
        // Most common cause: migration 010 not applied → onboarding_states is missing.
        // Falls through to the regular María flow so unregistered users still get a reply.
        console.error('[onboarding] non-fatal — falling through to María flow:', e?.message);
      }
    } else if (wantsEscape) {
      console.log('[onboarding] escape pattern matched — bypassing gate for this turn:', incomingMessage.slice(0, 60));
    }

    // --- Manual Operativo 2026 lookup (keyword-triggered, non-blocking) ---
    // Pass the last 6 turns so buildManualContext can tell which service the
    // client has been discussing (formalización vs titulación vs sociedad).
    const recentHistoryText = conversationHistory
      .slice(-6)
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');
    const manualContext = await buildManualContext(incomingMessage, getSupabase(), recentHistoryText);

    // --- Concesiones INHGEOMIN — registro público (keyword-triggered) ---
    // Cuando el cliente pregunta por una concesión específica, una empresa, o
    // "¿quién tiene el permiso de X?", inyectamos hasta 5 filas del registro
    // INHGEOMIN. La mayoría siguen siendo solicitudes pendientes — el bloque
    // instruye a María a no afirmar aprobación cuando el estado es solicitud.
    const concesionContext = await buildConcesionContext(incomingMessage, getSupabase());

    // --- RAG: retrieve top-3 relevant chunks from maria_knowledge ---
    const knowledgeContext = await retrieveKnowledge(getSupabase(), incomingMessage);
    const ragBlock = knowledgeContext
      ? `\n\nCONTEXTO DEL SISTEMA (citas literales de la base de conocimiento legal y regulatoria de CHT — Ley General del Ambiente Decreto 104-93, Decreto 181-2007 que adiciona Arts. 28-A y 29-C, Decreto 47-2010, Requisitos SLAS-2 de MiAmbiente, Reglamento de Minería Acuerdo 042-2013, Manual Operativo CHT):\n${knowledgeContext}\n\nINSTRUCCIONES PARA USAR ESTE BLOQUE:\n- Si la respuesta a la pregunta del cliente está aquí, CITALA con la referencia específica (artículo, decreto, requisito). Resumí el texto en hondureño claro pero conservando los términos legales.\n- NO derives a gerencia@mape.legal cuando este bloque responde la pregunta — comunicar la norma es tu trabajo, no interpretación jurídica.\n- Solo derivá si la pregunta requiere análisis jurídico específico que este bloque no cubre (por ejemplo, estrategia de litigio, jurisprudencia, casos novedosos sin precedente en el bloque).`
      : '';

    const dynamicPrompt = CHT_SYSTEM_PROMPT + priceContext + clienteContext + expedienteContext + manualContext + concesionContext + ragBlock + (isNewConversation
      ? ''
      : `

CONTEXTO CRÍTICO: Esta conversación YA ESTÁ EN CURSO.
PROHIBIDO saludar de nuevo.
PROHIBIDO decir "Hola", "Bienvenido", o "Soy María" en este mensaje.
Responde DIRECTAMENTE a lo que acaba de decir el usuario.`);

    // Strip the admin take-over prefix BEFORE Claude sees it. The admin UI
    // tags messages it sends from /api/admin/maria/conversations/[phone] with
    // "[Admin · email] …" so the thread view can render them with an Admin
    // badge — but that label is NOT meant for Claude. If we sent it through
    // the model would parrot the bracket convention and could leak the admin
    // email to the customer over WhatsApp on the next turn.
    const ADMIN_PREFIX_RE = /^\[Admin · [^\]]+\]\s*/;
    const sanitizedHistory = conversationHistory.map(msg => {
      if (msg.role !== 'assistant') return msg;
      return { ...msg, content: msg.content.replace(ADMIN_PREFIX_RE, '') };
    });

    // Remove duplicate consecutive assistant messages from history
    const cleanHistory = sanitizedHistory.filter((msg, i) => {
      if (i === 0) return true;
      return !(msg.role === 'assistant' && sanitizedHistory[i-1].role === 'assistant');
    });

    cleanHistory.push({
      role: "user",
      content: incomingMessage,
    });

    if (!anthropic) {
      console.error('[maria] ANTHROPIC_API_KEY missing — cannot call Claude');
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${esc('Estoy en mantenimiento un momento. Escribime de nuevo en unos minutos.')}</Message></Response>`,
        { status: 200, headers: { 'Content-Type': 'text/xml' } }
      );
    }

    const claudeResponse = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: dynamicPrompt,
      messages: cleanHistory,
    });

    let assistantReply = claudeResponse.content?.[0]?.text ?? 'Lo siento, no pude procesar tu mensaje en este momento.';
    console.log(`🤖 Claude responds: ${assistantReply}`);

    // --- Auto-create broadcast user if not yet registered ---
    if (!broadcastUser) {
      getOrCreateUserByPhone(cleanNumber, cliente?.nombre ?? undefined).catch(() => {});
    }

    const { error: insertError } = await getSupabase().from("conversaciones_whatsapp").insert([
      { numero_whatsapp: fromNumber, role: "user", content: incomingMessage },
      { numero_whatsapp: fromNumber, role: "assistant", content: assistantReply },
    ]);
    console.log('Insert result:', insertError ? insertError.message : 'success');

    // --- Forward contact requests to Willis ---
    const contactTriggers = [
      'te va a llamar',
      'te contactamos',
      'nos comunicamos',
      'te vamos a contactar'
    ];

    const needsContact = contactTriggers.some(trigger =>
      assistantReply.toLowerCase().includes(trigger)
    );

    if (needsContact) {
      try {
        const WILLIS_NUMBER = 'whatsapp:+50432100683';
        const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
        const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
        const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM;

        const clientName = cliente?.nombre || 'Cliente no registrado';
        const alertMessage =
`ALERTA CHT — Solicitud de contacto
Cliente: ${clientName}
Numero: ${fromNumber.replace('whatsapp:', '')}
Mensaje: "${incomingMessage}"
Respuesta Maria: "${assistantReply.slice(0, 100)}..."
Accion requerida: Llamar o escribir al cliente hoy.`;

        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

        await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            From: TWILIO_FROM,
            To: WILLIS_NUMBER,
            Body: alertMessage
          })
        });

        console.log('Contact alert sent to Willis for:', clientName);
      } catch (alertErr) {
        console.log('Contact alert failed (non-fatal):', alertErr.message);
      }
    }

    // --- Auto-register new client if not found ---
    if (!cliente && assistantReply.includes('te voy a registrar')) {
      const nombreDetectado = incomingMessage.trim();
      if (nombreDetectado.length > 3 && nombreDetectado.length < 60) {
        await getSupabase().from('clientes').insert([{
          nombre: nombreDetectado,
          telefono_whatsapp: cleanNumber,
          tipo_mineral: 'oro',
          situacion_tierra: 'arrendatario_sin_titulo'
        }]);
        console.log('✅ New client registered:', nombreDetectado);
      }
    }

    // --- Extract and save structured client data ---
    if (!cliente) {
      const extractionResponse = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{
          role: "user",
          content: `Analiza esta conversación de WhatsApp y extrae SOLO si están claramente presentes:
- nombre completo del cliente
- número de teléfono mencionado por el cliente
- municipio o zona mencionada
- número de manzanas mencionado

Conversación:
${conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n')}

Responde ÚNICAMENTE en JSON válido, sin texto adicional:
{"nombre": null, "telefono": null, "municipio": null, "manzanas": null}

Si algún dato no está claramente mencionado, deja null.`
        }]
      });

      try {
        // Strip markdown code blocks if Claude wraps the JSON
        let rawText = extractionResponse.content?.[0]?.text ?? '';
        rawText = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        console.log('Raw extraction text:', rawText);

        const extracted = JSON.parse(rawText);
        console.log('Extracted data:', JSON.stringify(extracted));

        if (extracted.nombre && extracted.nombre.length > 3) {
          const { data: existing } = await getSupabase()
            .from('clientes')
            .select('id')
            .eq('telefono_whatsapp', cleanNumber)
            .single();

          if (!existing) {
            const { error: clientInsertError } = await getSupabase()
              .from('clientes')
              .insert([{
                nombre: extracted.nombre,
                telefono_whatsapp: cleanNumber,
                ...(extracted.municipio ? { municipio: extracted.municipio } : {}),
                tipo_mineral: 'oro',
                situacion_tierra: 'arrendatario_sin_titulo'
              }]);

            if (clientInsertError) {
              console.log('Insert error:', clientInsertError.message);
            } else {
              console.log('Client auto-registered:', extracted.nombre);
            }
          } else {
            console.log('Client already exists, skipping insert');
          }
        } else {
          console.log('No valid name found in extraction');
        }
      } catch (e) {
        console.log('Extraction parse error:', e.message);
        console.log('Raw text was:', extractionResponse.content?.[0]?.text);
      }
    }

    if (assistantReply.includes("Listo") && assistantReply.includes("Confirmas")) {
      await getSupabase().from("transacciones_pendientes").insert([{
        numero_whatsapp: fromNumber,
        mensaje_original: incomingMessage,
        respuesta_asistente: assistantReply,
        estado: "pendiente_confirmacion",
      }]);
    }

    // --- Detect new expediente intake pattern ---
    if (
      assistantReply.includes("Listo") &&
      assistantReply.includes("registré tu solicitud de")
    ) {
      const tipoMatch = assistantReply.match(/registré tu solicitud de ([^.]+)\./i);
      const tipoServicio = tipoMatch ? tipoMatch[1].trim() : 'servicio no especificado';
      await getSupabase().from("transacciones_pendientes").insert([{
        numero_whatsapp: fromNumber,
        mensaje_original: incomingMessage,
        respuesta_asistente: assistantReply,
        estado: "pendiente_confirmacion",
        detalle: `Nuevo expediente solicitado: ${tipoServicio}. Cliente: ${cliente?.nombre ?? 'no registrado'}. Mensaje: "${incomingMessage}"`,
      }]).catch(err => console.log('Nuevo expediente insert (non-fatal):', err.message));
      console.log('Nuevo expediente registrado para:', cliente?.nombre ?? fromNumber);
    }

    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${esc(assistantReply)}</Message>
</Response>`;

    return new Response(twimlResponse, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });

  } catch (error) {
    console.error("❌ Webhook error:", error);
    const errorResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Lo sentimos, tuvimos un problema técnico. Por favor intenta de nuevo.</Message>
</Response>`;
    return new Response(errorResponse, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }
}

export async function GET() {
  return new Response("CHT WhatsApp Webhook activo ✅", { status: 200 });
}
