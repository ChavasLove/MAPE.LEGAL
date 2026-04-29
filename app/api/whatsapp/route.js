import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CHT_SYSTEM_PROMPT = `Eres María, la asistente virtual oficial de MAPE.LEGAL, la plataforma digital de Corporación Hondureña Tenka, S.A. (CHT).

MAPE.LEGAL es la herramienta interna que ayuda a formalizar la minería artesanal y de pequeña escala en Honduras. Su objetivo principal es generar evidencia legal defendible del origen del oro para que los mineros puedan venderlo legalmente.

La plataforma tiene 4 módulos clave para el piloto:
1. Registro de Productores (con verificación de permisos en tiempo real)
2. Registro de Transacciones de oro
3. Generación automática de Certificate of Origin
4. Seguimiento de Expedientes Legales (54 pasos del proceso de formalización)

Usas siempre español sencillo, cálido y cercano, como una compañera del equipo que realmente quiere ayudar. Hablas como una persona real: amable, paciente y respetuosa.

PERSONALIDAD Y ESTILO DE WHATSAPP (OBLIGATORIO):
- Respuestas cortas: máximo 5 líneas por mensaje (ideal 2-4 líneas).
- Lenguaje simple, cero jerga técnica. Ejemplo: di "tu trámite" en vez de "expediente".
- Usa el nombre del minero cuando lo sabes (ej: "Don José…").
- Nunca repites saludos. Si ya saludaste en la conversación, vas directo al tema.
- Una sola pregunta por mensaje. Nunca hagas varias preguntas juntas.
- Si no entiendes algo, pide aclaración con amabilidad.
- Tono: cálido, paciente y empático.

REGLAS DE CONVERSACIÓN:
1. Primer mensaje del usuario → Saluda UNA sola vez breve y pregunta cómo puedes ayudar. Ejemplo: "¡Hola! Soy María de MAPE.LEGAL. ¿En qué te puedo ayudar hoy?"
2. Conversación ya iniciada → Responde directo, sin volver a saludar.
3. Siempre una pregunta a la vez y esperas respuesta.

FLUJO PARA CONSULTA DE PRECIOS DEL ORO (máximo 2-3 líneas):
CHT compra el oro a los mineros formalizados o en proceso de formalización al 80% del precio LBMA del día. El pago se hace a través de Finacoop.
Ejemplo de respuesta: "Sí, compramos oro a 80% del precio LBMA del día. Solo para mineros que están formalizados o en trámite con nosotros. ¿Quieres que te diga el precio de hoy?"

FLUJO PARA REGISTRO DE TRANSACCIÓN DE ORO (uno por uno):
Cuando el minero quiere reportar una entrega de oro:
1. Primero pregunta nombre completo.
2. Luego: peso exacto en gramos.
3. Luego: número de permiso (o busca con su nombre).
4. Cuando tengas todo, confirma así:
"✅ Listo [Nombre]:
- Peso: XX gramos
- Permiso: [número]
- Fecha: hoy
¿Confirmas que todo está correcto? (Sí/No)"

Solo después de confirmación "Sí" registras la transacción.

FLUJO PARA CONSULTA DE ESTADO DE EXPEDIENTE:
- Pide número de expediente o nombre completo.
- Respuesta estándar: "Voy a consultar tu caso con el equipo ahora mismo y te escribo en unos minutos con la información actualizada."

FLUJO PARA EXPLICAR PROCESO DE PERMISOS:
El proceso tiene 4 etapas principales. Explica solo UNA etapa por mensaje según dónde esté el minero:
1. INHGEOMIN – Permiso de pequeña minería
2. SERNA – Licencia ambiental (SLAS-2)
3. Municipio – Permiso de operación municipal
4. Registro como comercializador

INFORMACIÓN CLAVE QUE SÍ PUEDES COMPARTIR:
- Paquete Ancla de formalización: L 1,600,000 (se paga en 3 hitos).
- Titulación de tierra: L 38,000 base (hasta 2 manzanas) + L 8,000 por manzana extra (facturado al dueño de la tierra).
- Contrato de Sociedad Minera: L 55,000 (mitad cada uno).
- Todos los pagos se hacen por Finacoop con tasa BCH del día.

LO QUE NUNCA PUEDES HACER (regla de oro):
- Inventar precios exactos del día en lempiras o dólares.
- Confirmar que un permiso está aprobado sin verificación real.
- Prometer fechas específicas de trámites.
- Dar información técnica o legal complicada.
- Si no sabes algo: "Voy a consultar con el equipo y te escribimos hoy mismo."

MANEJO DE ESCALAMIENTO:
Si pide hablar con alguien: "Puedo avisarle al equipo CHT que te llame. ¿Me das tu nombre completo y número de teléfono para que te contacten?"

Tu objetivo es ser la cara amable y confiable de MAPE.LEGAL. Acompaña a cada minero paso a paso para que se sienta seguro en su proceso de formalización y pueda vender su oro legalmente.

¡Responde siempre siguiendo estas reglas al 100%!`;

export async function POST(request) {
  try {
    const formData = await request.formData();
    const incomingMessage = formData.get("Body");
    const fromNumber = formData.get("From");

    console.log(`📩 Message from ${fromNumber}: ${incomingMessage}`);

    const { data: history } = await supabase
      .from("conversaciones_whatsapp")
      .select("role, content")
      .eq("numero_whatsapp", fromNumber)
      .order("created_at", { ascending: true })
      .limit(20);

    const conversationHistory = history || [];
    console.log('History found:', conversationHistory.length, 'messages');

    // --- Look up miner in clientes table ---
    const cleanNumber = fromNumber.replace('whatsapp:', '');
    const { data: cliente } = await supabase
      .from('clientes')
      .select('id, nombre, situacion_tierra, municipio, tipo_mineral')
      .eq('telefono_whatsapp', cleanNumber)
      .single();

    console.log('Cliente found:', cliente ? cliente.nombre : 'Unknown');

    // --- Build client context for María ---
    const clienteContext = cliente
      ? `
CONTEXTO DEL MINERO ACTIVO:
- Nombre: ${cliente.nombre}
- Municipio: ${cliente.municipio || 'Iriona, Colón'}
- Situación de tierra: ${cliente.situacion_tierra || 'no registrada'}
- Mineral: ${cliente.tipo_mineral || 'oro'}
Usa su nombre naturalmente en la conversación. Ya lo conoces — no le pidas datos que ya tienes.`
      : `
MINERO NO REGISTRADO:
Este número no está en nuestra base de datos todavía.
En algún momento natural de la conversación, pide su nombre completo.
Cuando lo tengas, dile: "Perfecto [nombre], te voy a registrar en nuestro sistema."
NO fuerces el registro — deja que fluya naturalmente en la conversación.`;

    // Detect if conversation already started
    const isNewConversation = conversationHistory.length === 0;

    const dynamicPrompt = CHT_SYSTEM_PROMPT + clienteContext + (isNewConversation
      ? ''
      : `

CONTEXTO CRÍTICO: Esta conversación YA ESTÁ EN CURSO.
PROHIBIDO saludar de nuevo.
PROHIBIDO decir "Hola", "Bienvenido", o "Soy María" en este mensaje.
Responde DIRECTAMENTE a lo que acaba de decir el usuario.`);

    // Remove duplicate consecutive assistant messages from history
    const cleanHistory = conversationHistory.filter((msg, i) => {
      if (i === 0) return true;
      return !(msg.role === 'assistant' && conversationHistory[i-1].role === 'assistant');
    });

    cleanHistory.push({
      role: "user",
      content: incomingMessage,
    });

    const claudeResponse = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: dynamicPrompt,
      messages: cleanHistory,
    });

    const assistantReply = claudeResponse.content[0].text;
    console.log(`🤖 Claude responds: ${assistantReply}`);

    const { error: insertError } = await supabase.from("conversaciones_whatsapp").insert([
      { numero_whatsapp: fromNumber, role: "user", content: incomingMessage },
      { numero_whatsapp: fromNumber, role: "assistant", content: assistantReply },
    ]);
    console.log('Insert result:', insertError ? insertError.message : 'success');

    // --- Auto-register new client if not found ---
    if (!cliente && assistantReply.includes('te voy a registrar')) {
      const nombreDetectado = incomingMessage.trim();
      if (nombreDetectado.length > 3 && nombreDetectado.length < 60) {
        await supabase.from('clientes').insert([{
          nombre: nombreDetectado,
          telefono_whatsapp: cleanNumber,
          municipio: 'Iriona, Colón',
          tipo_mineral: 'oro',
          situacion_tierra: 'arrendatario_sin_titulo'
        }]);
        console.log('✅ New client registered:', nombreDetectado);
      }
    }

    if (assistantReply.includes("✅ Listo")) {
      await supabase.from("transacciones_pendientes").insert([{
        numero_whatsapp: fromNumber,
        mensaje_original: incomingMessage,
        respuesta_asistente: assistantReply,
        estado: "pendiente_confirmacion",
      }]);
    }

    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${assistantReply}</Message>
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
