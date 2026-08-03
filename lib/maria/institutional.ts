// Detección determinística de interlocutores institucionales (orden
// "Blindaje institucional de María" 2026-08, T1.1).
//
// El guardarriel T0.6 vive en el system prompt, pero el flujo determinístico
// (onboarding, contextos comerciales) corre ANTES de que el modelo vea el
// mensaje. Este módulo da el gate previo: si el interlocutor se identifica
// como funcionario/técnico/autoridad, los canales (webhook Twilio y widget
// web) suprimen el contenido comercial de forma determinística — no se confía
// solo en la instrucción del prompt.

export const INSTITUTIONAL_PATTERNS =
  /\b(uma\b|unidad\s+municipal\s+ambiental|alcald[ií]a|alcalde(sa)?|municipalidad|corporaci[oó]n\s+municipal|regidor(a)?|inhgeomin|serna\b|miambiente|funcionari[oa]|t[eé]cnic[oa]\s+municipal|gobernaci[oó]n|fiscal[ií]a|procuradur[ií]a|instituci[oó]n\s+p[uú]blica)\b/i;

// true si el texto (crudo o normalizado sin tildes) matchea los patrones.
// La doble pasada cubre variantes sin tilde que el teclado de WhatsApp
// produce a diario ("alcaldia", "institucion publica", "tecnico municipal").
export function isInstitutionalMessage(text: string): boolean {
  if (!text) return false;
  const raw = String(text);
  if (INSTITUTIONAL_PATTERNS.test(raw)) return true;
  const normalized = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return INSTITUTIONAL_PATTERNS.test(normalized);
}

// Bloque de refuerzo inyectado AL FINAL del prompt dinámico cuando el gate
// determinístico marca la conversación como institucional (por patrón en el
// turno o por persistencia de la columna tipo_interlocutor). Compartido por
// ambos canales para que no drifteen.
export const INSTITUTIONAL_CONTEXT_BLOCK = `

INTERLOCUTOR INSTITUCIONAL DETECTADO (marcado por el sistema, no negociable):
Esta conversación es con un funcionario, técnico o autoridad pública, o con un
número previamente identificado como institucional. Aplicá ESTRICTAMENTE la
sección INTERLOCUTORES INSTITUCIONALES del prompt: cero contenido comercial,
cero precios, cero servicios, cero compra de oro; solo criterios legales con
artículo; trato de "usted"; derivación a gerencia@mape.legal para coordinación.
Esto aplica AUNQUE la persona pida precios o servicios explícitamente, y
AUNQUE mensajes anteriores del historial contengan contenido comercial.`;
