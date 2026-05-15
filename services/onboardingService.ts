/**
 * Onboarding State Machine
 *
 * Guides new WhatsApp users through 4 questions (name → DPI → location → role)
 * one at a time, saving each answer to DB immediately. When COMPLETE the user
 * gets a row in clientes and usuarios_broadcast and María takes over normally.
 *
 * Entry points:
 *   getOnboardingState(telefono)     — null means returning/registered user
 *   startOnboarding(telefono)        — call for brand-new numbers (creates row)
 *   handleOnboarding(telefono, msg)  — process one message, return María's reply
 */

import Anthropic from '@anthropic-ai/sdk';
import { getAdminClient } from '@/services/adminSupabase';
import { getOrCreateUserByPhone, assignRole, type BroadcastRol } from '@/services/userService';

// Gated init mirrors app/api/whatsapp/route.js: instantiating unconditionally
// at module load throws "Could not find API key" during Next.js page-data
// collection when env vars aren't injected, breaking the whole module import
// (and therefore the route handler).
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// ─── Types ────────────────────────────────────────────────────────────────────

export type OnboardingEstado =
  | 'ASK_NAME'
  | 'ASK_ID'
  | 'ASK_LOCATION'
  | 'ASK_ROLE'
  | 'COMPLETE';

export interface OnboardingDatos {
  nombre_completo?:    string;
  numero_identidad?:   string;
  ubicacion_proyecto?: string;
  rol?:                BroadcastRol;
}

export interface OnboardingState {
  id:         string;
  telefono:   string;
  estado:     OnboardingEstado;
  datos:      OnboardingDatos;
  created_at: string;
  updated_at: string;
}

// ─── State helpers ────────────────────────────────────────────────────────────

// Names that must NOT be accepted as the user's nombre_completo. Primary risk:
// "Hola Maria" → Haiku extracts "Maria" because the assistant's own name
// collides with the user's input. Also covers brand and greeting tokens that
// the LLM sometimes mistakes for proper nouns.
const BLOCKED_NAMES = new Set([
  'maria', 'maría',
  'cht', 'mape', 'mape legal',
  'hola', 'buenas', 'buenos dias', 'buenos días',
  'buenas tardes', 'buenas noches',
  'gerencia', 'soporte', 'asistente', 'bot',
]);

// Tokens that, when they appear as the FIRST word of an otherwise-valid
// compound name, indicate the LLM picked up the assistant/brand name and not
// the user's. Keep this list narrow — generic Spanish first names like Ana,
// Juan, etc. must never appear here.
const BLOCKED_NAME_PREFIXES = new Set(['maria', 'maría', 'mape']);

function isBlockedName(name: string): boolean {
  const normalized = name.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) return true;
  if (BLOCKED_NAMES.has(normalized)) return true;
  // Compound names starting with a blocked prefix ("Maria Jose Lopez",
  // "María García") — without this, the exact-match check above only caught
  // the bare token and any decoration slipped through.
  const firstWord = normalized.split(' ', 1)[0];
  if (BLOCKED_NAME_PREFIXES.has(firstWord)) return true;
  return false;
}

// Detects explicit correction intent: user is denying a previously-set field.
// Run before extraction so wrong data can be rolled back instead of permanent.
// Patterns avoid bare "no es" / "no soy" — those would false-trigger when a
// user answers ASK_ROLE with "no soy minero, soy comprador".
const CORRECTION_REGEX = /\b(no\s+me\s+llamo|mi\s+nombre\s+no|te\s+equivocaste|equivocado|incorrecto|no\s+es\s+correcto|borr[aá]me|reiniciar|empezar\s+de\s+nuevo)\b/i;

function detectCorrection(message: string): boolean {
  return CORRECTION_REGEX.test(message);
}

// Mid-flow rows untouched for this long are treated as abandoned. Prevents a
// user from being stuck in a stale state from weeks-old test traffic.
const STALE_ROW_MS = 7 * 24 * 60 * 60 * 1000;

// Determines the next state based on which fields are still missing
function nextPendingState(datos: OnboardingDatos): OnboardingEstado {
  if (!datos.nombre_completo)    return 'ASK_NAME';
  if (!datos.numero_identidad)   return 'ASK_ID';
  if (!datos.ubicacion_proyecto) return 'ASK_LOCATION';
  if (!datos.rol)                return 'ASK_ROLE';
  return 'COMPLETE';
}

function buildQuestion(estado: OnboardingEstado, datos: OnboardingDatos): string {
  const nombre = datos.nombre_completo?.split(' ')[0];
  switch (estado) {
    case 'ASK_NAME':
      return 'Hola, soy Maria de CHT. Para atenderte mejor, digame tu nombre completo.';
    case 'ASK_ID':
      return `Mucho gusto${nombre ? `, ${nombre}` : ''}. Compartime tu numero de identidad (DPI).`;
    case 'ASK_LOCATION':
      return 'Listo. En que zona o municipio trabajas?';
    case 'ASK_ROLE':
      return 'Perfecto. Cual es tu rol?\n1. Minero\n2. Comprador\n3. Tecnico';
    case 'COMPLETE':
      return `Listo${nombre ? ` ${nombre}` : ''}, ya quedas registrado. Nuestro equipo se comunica con vos pronto. Cualquier consulta me escribis.`;
  }
}

// ─── Data extraction via Claude ───────────────────────────────────────────────

interface ExtractedFields {
  nombre_completo?:    string | null;
  numero_identidad?:   string | null;
  ubicacion_proyecto?: string | null;
  rol?:                BroadcastRol | null;
}

// Messages that obviously carry no extractable name/DPI/location — short
// greetings, pure questions, acknowledgments, or canned escapes. Catching
// them here avoids a Haiku round-trip per turn AND removes the most common
// path where the LLM hallucinates "Maria" as the user's name from a hola.
const NO_DATA_REGEX  = /^(hola|holi|holaa|holiwi|buenas|buenos\s+d[ií]as|buenas\s+tardes|buenas\s+noches|saludos|hey|hi|hello|gracias|ok|dale|si|s[ií]|no|talvez|quiz[aá]s?|claro|listo|bien|aja|aj[aá])[\s.!¡?¿]*$/i;
const QUESTION_REGEX = /^[\s¿]*(qu[eé]|cu[áa]l|c[oó]mo|d[oó]nde|cu[áa]ndo|por\s+qu[eé]|qui[eé]n|cu[áa]nto|bolet[ií]n|precio|cotizaci[oó]n|tipo\s+de\s+cambio|art[ií]culo|reglamento|ley)\b/i;

function hasNoExtractableData(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return true;
  if (NO_DATA_REGEX.test(trimmed)) return true;
  // Pure questions starting with an interrogative don't carry user data.
  if (QUESTION_REGEX.test(trimmed) && !/\d{10,}/.test(trimmed)) return true;
  return false;
}

async function extractFields(
  message:  string,
  existing: OnboardingDatos
): Promise<ExtractedFields> {
  // Quick check: role numeric input (1/2/3) — no LLM call needed
  const roleMap: Record<string, BroadcastRol> = {
    '1': 'minero', 'minero': 'minero', 'mineros': 'minero',
    '2': 'comprador', 'comprador': 'comprador', 'compradores': 'comprador',
    '3': 'tecnico', 'tecnico': 'tecnico', 'tecnicos': 'tecnico',
  };
  const trimmed = message.trim().toLowerCase();
  if (roleMap[trimmed]) {
    return { rol: roleMap[trimmed] };
  }

  // Fast path: greetings, questions, and short acknowledgments carry no data.
  // Skipping the LLM here removes the loop where Haiku hallucinated "Maria"
  // as the user's name from a plain "hola maria".
  if (hasNoExtractableData(message)) {
    return {};
  }

  if (!anthropic) {
    console.warn('[onboarding] ANTHROPIC_API_KEY missing — field extraction disabled');
    return {};
  }

  try {
    const res = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role:    'user',
        content: `Extrae datos de este mensaje de WhatsApp de un usuario hondureno.
Datos ya recopilados: ${JSON.stringify(existing)}
Mensaje del usuario: "${message}"

Responde SOLO con JSON valido, sin texto adicional:
{
  "nombre_completo": null,
  "numero_identidad": null,
  "ubicacion_proyecto": null,
  "rol": null
}

Reglas:
- nombre_completo: nombre del usuario, una o mas palabras (ej "Willis", "Willis Yang", "Jose Lopez", "Ana Garcia"). Solo si parece un nombre propio que el USUARIO esta declarando como suyo. NO extraer:
  * "Maria", "María", "Mape" o "Mape Legal" — son nombres del asistente o de la marca, NUNCA del usuario; devuelve null aunque el mensaje empiece o termine con uno de esos. Esto incluye compuestos como "Maria Jose", "Maria Lopez", "María García" — siempre devuelve null cuando la PRIMERA palabra del nombre es Maria/María/Mape.
  * saludos solos ("hola", "buenas", "buenos dias") incluso si llevan mayuscula.
  * verbos ("tienes", "quiero", "necesito"), preguntas, palabras comunes.
  * si el mensaje es solo un saludo seguido de un nombre (ej "Hola Maria", "buenas Carlos"), asume que el nombre se refiere al asistente y devuelve null.
- numero_identidad: numero de DPI hondureno (13 digitos, puede tener guiones) o pasaporte.
- ubicacion_proyecto: municipio, zona o departamento de Honduras mencionado.
- rol: "minero", "comprador" o "tecnico". Mapea "1"→minero, "2"→comprador, "3"→tecnico.
- No re-extraigas campos que ya estan en datos_ya_recopilados (devuelve null para esos).
- Si un dato no esta claramente presente, devuelve null.`,
      }],
    });

    const raw = ((res.content?.[0] as { text?: string })?.text ?? '{}')
      .replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(raw) as ExtractedFields;
  } catch {
    return {};
  }
}

// ─── DB read/write ────────────────────────────────────────────────────────────

export async function getOnboardingState(
  telefono: string
): Promise<OnboardingState | null> {
  const admin = getAdminClient();
  const { data } = await admin
    .from('onboarding_states')
    .select('*')
    .eq('telefono', telefono)
    .single();
  if (!data) return null;
  const row = data as OnboardingState;
  row.datos = row.datos ?? {};
  // Garbage-collect abandoned mid-flow rows so a stale state doesn't trap the
  // user on the next contact. COMPLETE rows are kept indefinitely as a record.
  if (row.estado !== 'COMPLETE') {
    const age = Date.now() - new Date(row.updated_at).getTime();
    if (age > STALE_ROW_MS) {
      await admin.from('onboarding_states').delete().eq('id', row.id);
      return null;
    }
    // Heal rows poisoned by an earlier extraction that captured the bot's
    // own name. Existing stuck conversations had nombre_completo='Maria'
    // persisted before isBlockedName covered compound forms; without this
    // pass they keep looping at ASK_ID until the row hits STALE_ROW_MS.
    if (row.datos.nombre_completo && isBlockedName(row.datos.nombre_completo)) {
      console.warn(
        `[onboarding] poisoned nombre_completo="${row.datos.nombre_completo}" for ${telefono} — wiping`
      );
      delete row.datos.nombre_completo;
    }
    // Repair inconsistent rows: estado must match what datos implies.
    // Without this a row saved as ASK_ID + datos:{} (e.g. via admin patch or
    // a partial write) loops forever — buildQuestion renders the ASK_ID
    // greeting with no name, the user can't satisfy it, and nextPendingState
    // would still want ASK_NAME.
    const expectedState = nextPendingState(row.datos);
    if (row.estado !== expectedState) {
      console.warn(
        `[onboarding] state drift for ${telefono}: row=${row.estado} expected=${expectedState} — repairing`
      );
      row.estado = expectedState;
      await upsertState(telefono, expectedState, row.datos);
    }
  }
  return row;
}

async function upsertState(
  telefono: string,
  estado:   OnboardingEstado,
  datos:    OnboardingDatos
): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin
    .from('onboarding_states')
    .upsert(
      { telefono, estado, datos, updated_at: new Date().toISOString() },
      { onConflict: 'telefono' }
    );
  if (error) throw new Error(`onboardingService: upsert failed — ${error.message}`);
}

async function finalise(telefono: string, datos: OnboardingDatos): Promise<void> {
  const admin = getAdminClient();

  // 1. Write to clientes (upsert by telefono_whatsapp)
  const { data: existing } = await admin
    .from('clientes')
    .select('id')
    .eq('telefono_whatsapp', telefono)
    .single();

  if (existing?.id) {
    const { error: updateErr } = await admin.from('clientes').update({
      nombre:            datos.nombre_completo  ?? undefined,
      dpi:               datos.numero_identidad ?? undefined,
      municipio:         datos.ubicacion_proyecto ?? undefined,
      updated_at:        new Date().toISOString(),
    }).eq('id', existing.id);
    if (updateErr) console.error('[onboarding] clientes update failed:', updateErr.message);
  } else {
    const { error: insertErr } = await admin.from('clientes').insert({
      nombre:            datos.nombre_completo   ?? 'Sin nombre',
      dpi:               datos.numero_identidad  ?? null,
      municipio:         datos.ubicacion_proyecto ?? 'Iriona, Colon',
      tipo_minero:       'artesanal',
      tipo_mineral:      'oro',
      situacion_tierra:  'por_definir',
      telefono_whatsapp: telefono,
    });
    if (insertErr) console.error('[onboarding] clientes insert failed:', insertErr.message);
  }

  // 2. Ensure broadcast user exists and has the correct role
  await getOrCreateUserByPhone(telefono, datos.nombre_completo ?? undefined);
  if (datos.rol) {
    await assignRole(telefono, datos.rol);
  }

  // 3. Mark COMPLETE
  await upsertState(telefono, 'COMPLETE', datos);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create an onboarding record and return the first question.
 * Call this when a brand-new number sends their first message.
 */
export async function startOnboarding(telefono: string): Promise<string> {
  await upsertState(telefono, 'ASK_NAME', {});
  return buildQuestion('ASK_NAME', {});
}

/**
 * Process one incoming message from a user in the onboarding flow.
 * Extracts any data present, advances state, persists, returns next question.
 */
export async function handleOnboarding(
  telefono: string,
  message:  string
): Promise<string> {
  const existing = await getOnboardingState(telefono);
  const current  = existing ?? { estado: 'ASK_NAME' as OnboardingEstado, datos: {} as OnboardingDatos };

  // Correction intent: user is denying a previously-captured field. Wipe the
  // most-recently captured field (or the name by default — that's where false
  // positives hurt most) and re-ask. Bypasses Haiku because a "no" is fast and
  // unambiguous when matched at the regex layer. Runs even when datos is
  // empty: a "reiniciar" or "mi nombre no" at turn 0 is a no-op for wiping
  // but still re-presents the current question, never gets stuck.
  if (detectCorrection(message)) {
    const datos = { ...current.datos };
    if (datos.nombre_completo)         delete datos.nombre_completo;
    else if (datos.numero_identidad)   delete datos.numero_identidad;
    else if (datos.ubicacion_proyecto) delete datos.ubicacion_proyecto;
    else if (datos.rol)                delete datos.rol;
    const nextAfterFix = nextPendingState(datos);
    await upsertState(telefono, nextAfterFix, datos);
    return `Disculpa, lo corrijo. ${buildQuestion(nextAfterFix, datos)}`;
  }

  // Extract whatever fields are present in this message
  const extracted = await extractFields(message, current.datos);

  // Bot-name / brand-name filter — Haiku occasionally reads "Hola Maria" as a
  // name reveal. Reject before merging so the wrong value never persists.
  if (extracted.nombre_completo && isBlockedName(extracted.nombre_completo)) {
    extracted.nombre_completo = null;
  }

  // Merge into existing datos — never overwrite with null
  const merged: OnboardingDatos = {
    ...current.datos,
    ...(extracted.nombre_completo    ? { nombre_completo:    extracted.nombre_completo }    : {}),
    ...(extracted.numero_identidad   ? { numero_identidad:   extracted.numero_identidad }   : {}),
    ...(extracted.ubicacion_proyecto ? { ubicacion_proyecto: extracted.ubicacion_proyecto } : {}),
    ...(extracted.rol                ? { rol:                extracted.rol }                : {}),
  };

  // Determine next state (skips already-answered fields automatically)
  const next = nextPendingState(merged);

  if (next === 'COMPLETE') {
    await finalise(telefono, merged);
  } else {
    await upsertState(telefono, next, merged);
  }

  return buildQuestion(next, merged);
}
