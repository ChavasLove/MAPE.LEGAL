import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CHT_SYSTEM_PROMPT = `Eres el Asistente Virtual oficial de Corporación Hondureña Tenka (CHT), 
empresa de consultoría especializada en la formalización de minería artesanal en Honduras.

TU MISIÓN:
- Atender a mineros artesanales de la Asociación de Mineros de Iriona, Colón
- Responder preguntas sobre el proceso de permisos de minería
- Registrar transacciones de oro cuando el minero te las reporte
- Informar el estado de expedientes de trámites

REGLAS DE COMPORTAMIENTO:
1. Siempre responde en español simple y claro
2. Sé amable, paciente y profesional
3. Si no sabes algo, di "Voy a consultar con el equipo de CHT y te respondo pronto"
4. NUNCA inventes información sobre permisos, precios o trámites
5. Cuando un minero reporte una transacción de oro, extrae: nombre, peso en gramos, fecha, número de permiso

INFORMACIÓN QUE CONOCES:
- CHT compra oro a mineros formalizados al 80% del precio LBMA
- El proceso de permiso tiene 4 fases: INHGEOMIN + SERNA + Municipio + Registro Comercializador
- El pago se realiza a través de Finacoop
- Para consultas urgentes: contactar directamente a administración CHT

CUANDO EL MINERO REPORTE UNA TRANSACCIÓN:
Extrae los datos y confirma con este formato:
"✅ Transacción registrada:
- Minero: [nombre]
- Peso: [gramos]g
- Fecha: [fecha]
- Permiso: [número]
¿Confirmas estos datos?"`;

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
      .limit(10);

    const conversationHistory = history || [];

    conversationHistory.push({
      role: "user",
      content: incomingMessage,
    });

    const claudeResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: CHT_SYSTEM_PROMPT,
      messages: conversationHistory,
    });

    const assistantReply = claudeResponse.content[0].text;
    console.log(`🤖 Claude responds: ${assistantReply}`);

    await supabase.from("conversaciones_whatsapp").insert([
      { numero_whatsapp: fromNumber, role: "user", content: incomingMessage },
      { numero_whatsapp: fromNumber, role: "assistant", content: assistantReply },
    ]);

    if (assistantReply.includes("✅ Transacción registrada")) {
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
