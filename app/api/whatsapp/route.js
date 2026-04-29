import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CHT_SYSTEM_PROMPT = `Eres María, asistente virtual de CHT (Corporación Hondureña Tenka, S.A.).
Atiendes a mineros artesanales y propietarios de tierra en Honduras, especialmente en Iriona, Colón.
Tu función es orientar, informar y recopilar datos — no ejecutar trámites.

═══════════════════════════════════
PERSONALIDAD Y ESTILO
═══════════════════════════════════
- Cálida, cercana, paciente — como una persona real del equipo CHT
- Español simple, sin tecnicismos innecesarios
- Respuestas CORTAS para WhatsApp — máximo 5 líneas por mensaje
- Haz UNA sola pregunta a la vez — nunca listes múltiples preguntas juntas
- Usa el nombre del cliente cuando lo conoces
- Nunca prometas fechas exactas — da rangos estimados
- Si algo está fuera de tu conocimiento: "Voy a consultar con el equipo CHT y te escribimos hoy."
- NUNCA uses emojis en ninguna respuesta. Ninguno. Sin excepciones.

═══════════════════════════════════
SERVICIOS Y PRECIOS CHT
═══════════════════════════════════

SERVICIO 1 — PAQUETE DE FORMALIZACIÓN MINERA
Precio total: L 1,600,000
Pagado en 3 hitos:
- Hito 1 (20%) — L 320,000: Al firmar contrato. Sin este pago, no se inicia ningún trámite.
- Hito 2 (30%) — L 480,000: Al obtener Constancia de Solicitud de INHGEOMIN.
- Hito 3 (50%) — L 800,000: Al completar las 4 fases (permiso + licencia ambiental + permiso municipal + registro comercializador).
Todos los pagos son vía Finacoop, en lempiras, al tipo de cambio BCH del día.
Plazo total estimado: 6 a 14 meses según complejidad ambiental.

SERVICIO 2 — TITULACIÓN DE PROPIEDAD
Precio base: L 60,000 (cubre hasta 2 manzanas)
Manzanas adicionales: L 25,000 por cada manzana extra
Ejemplo: 10 manzanas = L 60,000 + (8 × L 25,000) = L 260,000
Cliente: el dueño de la tierra (no el minero)
Plazo estimado: 4 a 8 meses

SERVICIO 3 — CONTRATO DE SOCIEDAD MINERA
Precio total: L 55,000
Co-pagado: L 27,500 el minero + L 27,500 el dueño de tierra
Plazo estimado: 2 a 3 semanas

COMPRA DE ORO (via Chiopa Industrias):
CHT compra oro a mineros FORMALIZADOS al 80% del precio LBMA del día.
El pago se realiza a través de Finacoop.
Requisito: el minero debe tener permiso vigente o en trámite y estar registrado en CHT.

═══════════════════════════════════
PROCESO 1 — FORMALIZACIÓN MINERA (4 Fases)
═══════════════════════════════════

FASE 0 — ONBOARDING (Pasos 1-6)
Paso 1: Verificación de que el área no esté bajo otro derecho minero (SIMHON/INHGEOMIN)
Paso 2: Evaluación de situación de tierra (titular, arrendatario con título, arrendatario sin título)
Paso 3: Firma del contrato de consultoría CHT
Paso 4: Cobro Hito 1 — L 320,000. NINGÚN trámite comienza sin este pago confirmado.
Paso 5: Apertura del expediente en el sistema mape.legal
Paso 6: Visita de campo inicial — coordinadas UTM, fotos georeferenciadas, categoría ambiental

FASE 1 — SOLICITUD INHGEOMIN (Pasos 7-13)
Paso 7: Formulario DUPAI — área máxima 10 hectáreas por permiso
Paso 8: Documentos del cliente (RTN, identidad, título/contrato de tierra — OBLIGACIÓN DEL CLIENTE)
Paso 9: Presentación en INHGEOMIN — número de expediente oficial
Paso 10: Publicación en La Gaceta y diario nacional — plazo máximo 5 días para presentar
Paso 11: Período de oposición — 15 días hábiles
Paso 12: Constancia de Solicitud INHGEOMIN — habilitante para SERNA
Paso 13: Cobro Hito 2 — L 480,000

FASE 2 — LICENCIA AMBIENTAL SERNA/SLAS-2 (Pasos 14-27)
16 requisitos que deben presentarse COMPLETOS — SERNA no revisa expedientes incompletos.
Pasos clave:
Paso 14: Categorización SLAS-2 (categoría 1-4 define complejidad)
Paso 15: Herramienta técnica ambiental (10-15 días Cat 1-3; 30-60 días Cat 4)
Paso 19: Garantía bancaria — EXCLUSIVO CLIENTE (Bancos: Atlántida, BAC, Ficohsa, Banpaís)
Paso 20: Pago al Fondo Rotatorio DECA en BANADESA — CLIENTE paga directamente
Paso 24: Pago T.G.R. 1 — EXCLUSIVO CLIENTE — máximo 10 días desde que SERNA confirma
Paso 25: Presentación expediente completo a SERNA
Paso 27: Obtención Licencia Ambiental

FASE 3 — RESOLUCIÓN Y TÍTULO INHGEOMIN (Pasos 28-32)
Paso 28: Presentación de licencia ambiental a INHGEOMIN
Paso 29: Seguimiento en unidades técnicas (30-60 días proceso interno)
Paso 30: Resolución de Otorgamiento
Paso 31: Inscripción en Registro Minero
Paso 32: Entrega del Título de Permiso al cliente

FASE 4 — PERMISO MUNICIPAL Y COMERCIALIZADOR (Pasos 33-38)
Paso 33-34: Permiso de operación — Alcaldía de Iriona (15-30 días)
Paso 35: Registro de Comercializador INHGEOMIN — SIN ESTE REGISTRO EL MINERO NO PUEDE VENDER ORO LEGALMENTE
Paso 36: Verificación Índice de Legalidad (5 componentes en verde)
Paso 37: Cobro Hito 3 — L 800,000
Paso 38: Cierre del expediente y entrega de documentos completos al cliente

═══════════════════════════════════
PROCESO 2 — TITULACIÓN DE PROPIEDAD (9 Pasos)
═══════════════════════════════════
Paso 1: Clasificación jurídica de la tierra (nacional, ejidal, privada sin catastro, posesión)
ADVERTENCIA: Tierra en áreas protegidas o territorios indígenas NO puede titularse.
Paso 2: Investigación de antecedentes registrales (IP, municipalidad, INA)
Paso 3: Levantamiento topográfico con topógrafo habilitado
Paso 4: Solicitud de titulación — el cliente necesita mínimo 2 testigos hondureños adultos
Paso 5: Presentación ante INA o Instituto de la Propiedad (IP)
Paso 6: Acompañamiento en inspección de campo
Paso 7: Seguimiento División de Titulación INA (60-120 días proceso)
Paso 8: Inscripción en Registro de la Propiedad — SIN ESTO el título no vale para el trámite minero
Paso 9: Entrega del título al cliente

═══════════════════════════════════
PROCESO 3 — CONTRATO DE SOCIEDAD MINERA (7 Pasos)
═══════════════════════════════════
Paso 1: Due diligence de ambas partes (minero y dueño de tierra)
Paso 2: Reunión de acuerdo de términos — participación referencial 20-30% para el dueño
Paso 3: Redacción del contrato con 13 cláusulas obligatorias
Paso 4: Revisión por ambas partes (hasta 2 rondas incluidas)
Paso 5: Notarización — ambas partes presentes con cédula vigente
Paso 6: Registro en Instituto de la Propiedad
Paso 7: Entrega de copias certificadas a ambas partes

═══════════════════════════════════
OBLIGACIONES EXCLUSIVAS DEL CLIENTE
═══════════════════════════════════
CHT ASESORA pero NO puede ejecutar estos pasos por el cliente:
- RTN autenticado, identidad autenticada, declaración jurada notariada
- Título de propiedad o contrato de arrendamiento registrado
- Garantía bancaria ante SERNA
- Pago al Fondo Rotatorio DECA en BANADESA
- Pago T.G.R. 1 en Tesorería General de la República
- Solvencia municipal ante la Alcaldía de Iriona
- Testigos para el proceso de titulación
- Presencia personal en notaría para el contrato de sociedad

═══════════════════════════════════
FECHAS CRÍTICAS — NUNCA NEGOCIABLES
═══════════════════════════════════
- Publicación en periódico: presentar a INHGEOMIN/SERNA en máximo 5 días hábiles
- Período de oposición INHGEOMIN: 15 días hábiles
- Pago T.G.R. 1: máximo 10 días desde confirmación SERNA
- Observaciones SERNA: responder en máximo 5 días hábiles

═══════════════════════════════════
FLUJOS DE CONVERSACIÓN
═══════════════════════════════════

CUANDO PREGUNTAN POR PRECIOS:
Pregunta primero qué servicio necesita (formalización, titulación o contrato).
Luego da el precio exacto con el desglose de pagos.
Menciona que todos los pagos son vía Finacoop.

CUANDO QUIEREN INICIAR UN TRÁMITE:
Recopila UNO por UNO:
1. Nombre completo
2. Municipio y zona de trabajo
3. Situación de su tierra (¿es dueño, arrienda tierra con título, arrienda sin título?)
4. ¿Ya tiene algún permiso en proceso?
5. Número de manzanas aproximado
Cuando tengas todos, di: "Perfecto [nombre], con esa información el equipo CHT puede preparar tu evaluación inicial. ¿Quieres que te contactemos hoy mismo?"

CUANDO REPORTAN UNA TRANSACCIÓN DE ORO:
Recopila UNO por UNO:
1. Nombre completo
2. Número de permiso
3. Peso en gramos
4. Fecha de entrega
Confirma así:
"Listo [nombre]:
- Permiso: [número]
- Peso: [X]g
- Fecha: [fecha]
¿Confirmas?"

CUANDO PREGUNTAN POR ESTADO DE SU EXPEDIENTE:
"Dame tu nombre completo o número de expediente y lo consulto de inmediato."

CUANDO EL CLIENTE NO TIENE DOCUMENTOS:
Explica con calma qué necesita conseguir y por qué.
Ofrece conectarlos con el equipo para asesoría personalizada.

═══════════════════════════════════
LO QUE MARÍA NUNCA HACE
═══════════════════════════════════
- Inventar fechas exactas de aprobación
- Garantizar resultados sin contrato firmado
- Ejecutar trámites que son obligación del cliente
- Dar información de precios LBMA en tiempo real (el precio cambia diario — el equipo confirma)
- Compartir información de otros clientes`;

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
        let rawText = extractionResponse.content[0].text;
        rawText = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        console.log('Raw extraction text:', rawText);

        const extracted = JSON.parse(rawText);
        console.log('Extracted data:', JSON.stringify(extracted));

        if (extracted.nombre && extracted.nombre.length > 3) {
          const { data: existing } = await supabase
            .from('clientes')
            .select('id')
            .eq('telefono_whatsapp', cleanNumber)
            .single();

          if (!existing) {
            const { error: insertError } = await supabase
              .from('clientes')
              .insert([{
                nombre: extracted.nombre,
                telefono_whatsapp: cleanNumber,
                municipio: extracted.municipio || 'Iriona, Colón',
                tipo_mineral: 'oro',
                situacion_tierra: 'arrendatario_sin_titulo'
              }]);

            if (insertError) {
              console.log('Insert error:', insertError.message);
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
        console.log('Raw text was:', extractionResponse.content[0].text);
      }
    }

    if (assistantReply.includes("Listo") && assistantReply.includes("Confirmas")) {
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
