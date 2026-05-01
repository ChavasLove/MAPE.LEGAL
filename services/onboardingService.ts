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

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
- nombre_completo: nombre y apellido (minimo 2 palabras). Solo si esta CLARAMENTE presente.
- numero_identidad: numero de DPI hondureno (13 digitos, puede tener guiones) o pasaporte.
- ubicacion_proyecto: municipio, zona o departamento de Honduras mencionado.
- rol: "minero", "comprador" o "tecnico". Mapea "1"→minero, "2"→comprador, "3"→tecnico.
- No re-extraigas campos que ya estan en datos_ya_recopilados (devuelve null para esos).
- Si un dato no esta claramente presente, devuelve null.`,
      }],
    });

    const raw = (res.content?.[0]?.text ?? '{}')
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
  return (data as OnboardingState) ?? null;
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
    await admin.from('clientes').update({
      nombre:            datos.nombre_completo  ?? undefined,
      dpi:               datos.numero_identidad ?? undefined,
      municipio:         datos.ubicacion_proyecto ?? undefined,
      updated_at:        new Date().toISOString(),
    }).eq('id', existing.id);
  } else {
    await admin.from('clientes').insert({
      nombre:            datos.nombre_completo   ?? 'Sin nombre',
      dpi:               datos.numero_identidad  ?? null,
      municipio:         datos.ubicacion_proyecto ?? 'Iriona, Colon',
      tipo_minero:       'artesanal',
      tipo_mineral:      'oro',
      situacion_tierra:  'por_definir',
      telefono_whatsapp: telefono,
    });
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
  const current  = existing ?? { estado: 'ASK_NAME' as OnboardingEstado, datos: {} };

  // Extract whatever fields are present in this message
  const extracted = await extractFields(message, current.datos);

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
