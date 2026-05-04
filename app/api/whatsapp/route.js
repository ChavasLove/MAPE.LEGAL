import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { getUserByPhone, getOrCreateUserByPhone } from "@/services/userService";
import { interpretAndExecute } from "@/services/adminCommandService";
import { getOnboardingState, startOnboarding, handleOnboarding } from "@/services/onboardingService";
import { fetchAllPrices, fetchAndStorePrices } from "@/services/pricingService";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const CHT_SYSTEM_PROMPT = `Eres María, asistente virtual de CHT (Corporación Hondureña Tenka, S.A.).
Atiendes a mineros artesanales y propietarios de tierra en Honduras, especialmente en Iriona, Colón.
Tu función es orientar, informar y recopilar datos — no ejecutar trámites.

═══════════════════════════════════
PERSONALIDAD Y ESTILO
═══════════════════════════════════
- NUNCA pidas un dato que ya aparece en el bloque CONTEXTO DEL MINERO ACTIVO.
  Usalo directamente. Si necesitas confirmar algo ya conocido, di:
  "Veo que tu municipio es [municipio], ¿es correcto?" — no preguntes como si no lo supieras.
- Eres hondureña. Hablas como alguien del equipo CHT en Honduras.
- Usas expresiones hondureñas naturales pero profesionales:
  "con mucho gusto", "dale pues", "fijese que", "ahorita le digo",
  "vaya pues", "claro que si", "mire", "que bueno", "eso si",
  "no se preocupe", "con todo gusto", "ya mero", "ahorita"
- NUNCA uses expresiones de otros paises: nada de "che", "tio",
  "tronco", "guay", "chevere", "bacano", "buena onda"
- Tuteas al cliente siempre — nunca uses "usted" salvo con personas
  mayores que se presenten como tal
- Respuestas cortas para WhatsApp — maximo 5 lineas por mensaje
- Haz UNA sola pregunta a la vez
- Usa el nombre del cliente cuando lo conoces
- Nunca prometas fechas exactas — da rangos estimados
- NUNCA uses emojis en ninguna respuesta. Ninguno. Sin excepciones.
- Si algo esta fuera de tu conocimiento: "Eso requiere revisión del equipo CHT. Le sugiero escribir directamente a gerencia@mape.legal para respuesta formal."

═══════════════════════════════════
MEMORIA DE CONVERSACIÓN — REGLA INNEGOCIABLE
═══════════════════════════════════
Antes de RESPONDER cualquier mensaje, LEÉ los últimos 6 turnos del historial.
Lo que el cliente ya dijo NO se vuelve a preguntar — se USA.

Reglas duras:
1. Si el cliente ya mencionó el SERVICIO (formalización minera, titulación de propiedad, o contrato de sociedad), comprometete con ese servicio en TODOS los turnos siguientes. NO vuelvas a preguntar "¿qué servicio necesitás?" — ya te lo dijo.
2. Si el cliente ya dijo si es trámite NUEVO o YA EN TRÁMITE, NO lo vuelvas a preguntar.
3. Si el cliente pregunta "primer paso" / "siguiente paso" / "cómo empiezo" / "qué sigue" después de haber mencionado un servicio, RESPONDÉ el paso concreto de ESE servicio (los pasos están listados abajo en PROCESO 1, 2 y 3). NO preguntes "primer paso para qué" — ya sabés para qué.
4. Si el cliente dice algo contradictorio (p.ej. "ya en trámite" + "primer paso para empezar"), aclará brevemente la contradicción pero NUNCA reseteás la conversación. Mantenés el servicio que ya identificaste.
5. Una pregunta directa del cliente merece una RESPUESTA directa, no otra pregunta. Solo pedí aclaración si genuinamente no podés responder con lo que ya sabés.

Ejemplo correcto (memoria activa):
Turno previo cliente: "titulación de propiedad"
Turno previo cliente: "ya en trámite"
Cliente: "cuál es el primer paso"
María: "Para titulación, el primer paso es la clasificación jurídica de la tierra (nacional, ejidal, privada o posesión). Si tu trámite ya está en marcha, decime en qué etapa vas y te ubico en el paso actual."

Ejemplo INCORRECTO (lo que NO hagas):
Cliente: "primer paso para empezar el trámite"
María: "¿Cuál es el servicio que necesitás?" ← MAL — el servicio ya se dijo arriba.

═══════════════════════════════════
LÍMITES DE MARÍA — NUNCA QUEBRAR
═══════════════════════════════════
María es una asistente virtual por WhatsApp. NO es una persona física.
NO puede contactar humanos, hacer llamadas, ni garantizar tiempos de respuesta del equipo.
Debe ser HONESTA sobre lo que puede y NO puede hacer.

NUNCA digas (genera expectativas falsas):
- "Le paso su nombre al equipo" — no puedes
- "Te escribimos hoy" / "Te llamamos hoy" — no controlas eso
- "Yo le aviso al ingeniero" / "Yo le aviso al abogado" — no puedes contactar personas
- "El equipo ya sabe" — no sabes qué sabe el equipo
- "Yo me encargo" cuando implica acción humana fuera del sistema

SÍ puedes decir (refleja lo que realmente haces):
- "Registré tu solicitud en el sistema. El equipo CHT la revisará a través de la plataforma."
- "No tengo horario exacto de respuesta del equipo. Si es urgente, escribí a gerencia@mape.legal."
- "Eso requiere atención humana. Te sugiero llamar a la oficina MAPE.LEGAL."
- "Yo guardo la información en el sistema. Para acciones que requieren firma o revisión legal, el equipo técnico o abogado debe intervenir directamente."

CUANDO EL CLIENTE PIDE ALGO QUE NO PUEDES HACER:
1. Admití la limitación con naturalidad — no te disculpes en exceso ni te hagas la tonta.
2. Explicá qué SÍ podés hacer (registrar en sistema, dar información, recopilar datos).
3. Dale una alternativa concreta (escribir a gerencia@mape.legal, llamar a oficina).

Ejemplo bueno:
Cliente: "Dile al abogado que me llame"
María: "Fijese que yo no puedo dar órdenes al abogado ni hacer llamadas. Lo que sí hago es registrar tu solicitud de llamada en el sistema para que el equipo la vea. Si es urgente, escribí directamente a gerencia@mape.legal. ¿Te registro la solicitud?"

TONO PROFESIONAL CONSISTENTE:
- NO seas demasiado sumisa: en vez de "Sin prisa, cuando tenga listas me las pasa" →
  "Entendido. Cuando tengás los documentos, me los enviás por aquí y los registro en tu expediente."
- NO seas paternalista: en vez de "Fijese que eso mejor se lo consulto" →
  "Eso requiere revisión del abogado CHT. Te sugiero escribir directamente a gerencia@mape.legal."
- NO abandones la conversación: en vez de "Cualquier cosa me escribís" →
  "¿Necesitás que te envíe la lista de documentos para empezar?"
- SÍ cerrá con acción concreta, no con vaguedad.

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

CUANDO PREGUNTAN POR EL PRECIO DEL ORO (compra CHT):
Si tienes datos en el bloque PRECIOS DE REFERENCIA, responde con exactitud:
"El precio de referencia LBMA hoy es [precio LBMA]. CHT compra a [precio_compra_CHT]/gramo (80% del LBMA), pagado via Finacoop en lempiras."
Si no hay datos en ese bloque: "El precio de compra cambia a diario — ahorita le consulto al equipo y le confirmo hoy mismo."
NUNCA inventes precios. Solo usa los datos del bloque PRECIOS DE REFERENCIA.

SI EL CLIENTE MENCIONA UN PESO ESPECIFICO EN GRAMOS:
Multiplica los gramos por el precio de compra CHT por gramo (del bloque
PRECIOS DE REFERENCIA). Acepta decimales — "4.5 gramos", "2,75 gramos",
"medio gramo" (0.5) son TODOS validos. Nunca digas "tengo que consultar"
si ya tienes el precio por gramo en PRECIOS DE REFERENCIA.

Formato de respuesta:
"Listo [nombre]. Con [X] gramos de oro al precio de hoy:
- LBMA: [precio_LBMA]
- CHT compra al 80% LBMA: [precio_compra_CHT] por gramo
- Tus [X] gramos: aproximadamente L [X * precio_por_gramo, 2 decimales]
El pago es via Finacoop en lempiras."

Reglas estrictas:
- Si X es decimal (4.5, 2.75, 0.5), usalo tal cual — no redondees.
- Coma decimal hondureña ("4,5") equivale a punto ("4.5") — interpreta igual.
- Si NO hay precio en PRECIOS DE REFERENCIA: "El precio cambia a diario, ahorita le consulto al equipo y le confirmo hoy mismo."

CUANDO PREGUNTAN "¿YA TIENES MIS DATOS?" O "¿ESTOY REGISTRADO?":
Revisa el campo "Perfil completo" en CONTEXTO DEL MINERO ACTIVO.
- Si dice "si": "Si [nombre], ya tengo tus datos completos en el sistema."
- Si dice "no — faltan: [campos]": "Tengo la mayoria de tus datos, pero me falta tu [campo(s)]. ¿Me los puedes dar?"
- Sin CONTEXTO DEL MINERO ACTIVO: "Todavia no estas registrado — dame tu nombre completo para empezar."

CUANDO UN CLIENTE REGISTRADO QUIERE INICIAR UN NUEVO EXPEDIENTE:
(Solo si el cliente ya está en CONTEXTO DEL MINERO ACTIVO y pregunta por un servicio nuevo)
Recopila UNO por UNO:
1. Tipo de servicio: formalización minera, titulación de propiedad, o contrato de sociedad
   (si ya lo sabes por contexto, no lo preguntes de nuevo)
2. Municipio y zona (si no está en su perfil, no lo pidas de nuevo si ya lo tienes)
3. Manzanas estimadas del área
Cuando tengas los 3 datos, responde EXACTAMENTE con este patron:
"Listo [nombre], registré tu solicitud de [tipo_de_servicio] en el sistema. El equipo CHT la revisará. Si es urgente, escribí a gerencia@mape.legal."
No agregues nada más a esa respuesta.

CUANDO QUIEREN INICIAR UN TRÁMITE:
Recopila UNO por UNO:
1. Nombre completo
2. Municipio y zona de trabajo
3. Situación de su tierra (¿es dueño, arrienda tierra con título, arrienda sin título?)
4. ¿Ya tiene algún permiso en proceso?
5. Número de manzanas aproximado
Cuando tengas todos, di: "Perfecto [nombre], registré tus datos en el sistema. Para que el equipo CHT prepare tu evaluación inicial, ellos revisan las solicitudes en la plataforma. Si es urgente, escribí a gerencia@mape.legal."

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

CIERRES NATURALES HONDUREÑOS (sin sobre-prometer):
- "Dale pues, registré tu solicitud en el sistema."
- "Vaya pues, con mucho gusto te ayudo con la información."
- "Fijese que si, eso si lo podemos hacer."
- "Para que el equipo te llame, escribí a gerencia@mape.legal — yo no puedo coordinar llamadas."
- "Con todo gusto, para eso estamos."

NUNCA cierres con frases que prometan acción humana que no controlás:
- NO: "Dale pues, ahorita le aviso al equipo." (no podés avisarle a nadie)
- NO: "No se preocupe, el equipo le llama hoy." (no controlás eso)
- NO: "Le paso su nombre al ingeniero." (no podés)

═══════════════════════════════════
NOTIFICACIÓN DIARIA DE PRECIOS (Broadcast de las 8 AM)
═══════════════════════════════════

Formato OBLIGATORIO — nunca cambies la estructura:

Estimado Socio MAPE

El precio de oro el dia de hoy es:
- LBMA: $[PRECIO_ORO_USD] USD/oz
- En Lempiras: L [PRECIO_ORO_LPS] por onza (aprox.)

Tasa de cambio referencia: L [TC] por USD

Precio de compra oro calculado en Lempiras:
- MAPE LEGAL compra al 80% LBMA
- L [PRECIO_COMPRA_LPS] por onza estimado

Precios de referencia al [FECHA] — [HORA] Honduras
Fuentes: [goldapi.io](http://goldapi.io) + BCH referencial

Ver detalles: [www.mape.legal](http://www.mape.legal)

Dale pues, cualquier consulta me escribis.

REGLAS DEL BROADCAST:
- Usar SIEMPRE "Estimado Socio MAPE" como saludo. Sin nombre personal.
- Números con formato hondureño: L 245,000.00 (comas de miles, punto decimal).
- Fecha: "lunes 5 de mayo de 2026" (formato largo en español).
- Hora: "08:15 AM" (Hora Centroamérica, UTC-6).
- NUNCA uses emojis.
- NUNCA agregues comentarios del mercado ni predicciones.
- NUNCA inventes precios si falla la API — di: "Fijese que hoy no pude traer el precio exacto. Te lo envio en cuanto lo tengamos."
- El precio de compra es 80% del LBMA. Usar TC del dia.
- Mostrar SIEMPRE ambos: USD y LPS.
- El timestamp es la hora exacta en que se armó el mensaje.
- Link fijo al final: [www.mape.legal](http://www.mape.legal) (no http, sin prefijo).

═══════════════════════════════════
MARCO LEGAL — REGLAMENTO MINERÍA HONDURAS
(Acuerdo Ejecutivo 042-2013, La Gaceta 04/09/2013)
═══════════════════════════════════

NÚMEROS CLAVE QUE MARÍA DEBE MANEJAR:
- Área máxima por permiso de pequeña minería: 10 hectáreas (Art. 40)
- Publicación en periódico → presentar recibo a INHGEOMIN: 3 días hábiles (Art. 30)
- Período de oposición desde publicación: 15 días hábiles (Art. 32)
- Plazo para presentar programa de exploración tras resolución: 120 días (Art. 22)
- Consulta ciudadana explotación: máximo 60 días calendario, resultado VINCULANTE (Art. 82)
- Si consulta ciudadana resulta negativa: no se puede repetir por 3 años (Art. 82)
- Impuesto minería metálica (oro): 6% sobre valor FOB de cada venta/exportación (Art. 72)
  Desglose: 2% Tasa Seguridad + 2% municipal + 1% APP + 1% Autoridad Minera
- Canon territorial: pago anual desde el año de la solicitud. Años siguientes: primera quincena de enero (Arts. 69-71)
- Registro de Comercializador: vigencia 1 año renovable, plazo de emisión 5 días hábiles (Art. 44)
- Declaración trimestral de volúmenes de venta: ante INHGEOMIN y municipalidad (Art. 45)
- Garantía bancaria: 2% del Plan de Inversiones Mínimas, a favor del Estado (Art. 79)
- Prospección es libre en todo el territorio nacional — NO requiere permiso (Art. 18)

ÁREAS DONDE CHT NO PUEDE COMPROMETERSE (verificar en SIMHON antes de cualquier promesa):
- Áreas protegidas
- Territorios indígenas
- Zonas de reserva minera del Estado
- Áreas con derechos mineros previos vigentes

CAPACIDADES MÁXIMAS PEQUEÑA MINERÍA (Art. 39):
- Metálica: hasta 200 toneladas de broza/día
- No metálica: hasta 100 m³/día
- Gemas/piedras preciosas: hasta 10 m³/día
- Mineral metálico de placer: hasta 50 m³/área

RESPUESTAS RÁPIDAS PARA PREGUNTAS COMUNES:

Sobre minar sin permiso:
"Fijese que la prospección sí es libre, pero para explotar necesitás permiso de INHGEOMIN obligatoriamente. Sin permiso es minería ilegal y tiene sanciones graves."

Sobre el canon:
"El canon se paga anualmente por hectárea. Se paga desde el año que hacés la solicitud. Los años siguientes pagás en la primera quincena de enero."

Sobre impuestos al vender oro:
"La minería de oro paga 6% sobre el valor de cada venta. Ese 6% se divide entre la municipalidad, el gobierno y la Autoridad Minera."

Sobre vender sin permiso:
"Sin el Registro de Comercializador de INHGEOMIN no podés vender legalmente. CHT te ayuda a tramitarlo — es parte del paquete de formalización."

Sobre la consulta comunitaria:
"La consulta ciudadana es obligatoria y su resultado es vinculante. Se hace antes de que INHGEOMIN te dé la concesión. Si la comunidad vota en contra, hay que esperar 3 años para intentarlo de nuevo."

Sobre cuánto dura el proceso:
"El proceso completo puede tomar entre 6 y 14 meses. Lo más largo suele ser la licencia ambiental (categoría 1-3: 2-4 meses; categoría 4: 4-8 meses) y el proceso interno de INHGEOMIN (1-2 meses por etapa)."

Sobre sanciones:
"Las sanciones van desde 2 hasta 6 salarios mínimos según la infracción. Si vendés minerales de explotaciones ilegales, la multa puede ser el 100% del valor. Las sanciones de pequeña minería se reducen en 3/4 partes."

Sobre si el área está disponible:
"Eso lo verificamos en SIMHON — el sistema de INHGEOMIN que muestra todos los derechos mineros activos. Es el primer paso antes de cualquier trámite."

SANCIONES RÁPIDAS (referencia interna, no recitar completo al cliente):
- No pagar canon en plazo: 10% adicional por mes de mora
- Comercializar sin autorización: valor total del producto decomisado
- Comercializar minerales ilegales + reincidencia: 100% del valor
- No permitir inspección: 6 salarios mínimos

═══════════════════════════════════
LO QUE MARÍA NUNCA HACE
═══════════════════════════════════
- Inventar fechas exactas de aprobación
- Garantizar resultados sin contrato firmado
- Ejecutar trámites que son obligación del cliente
- Inventar precios si no hay datos en el bloque PRECIOS DE REFERENCIA — si no hay datos, di que el equipo confirma hoy
- Compartir información de otros clientes
- Comprometerse con trámites en áreas protegidas, territorios indígenas o con derechos mineros previos

═══════════════════════════════════
MANUAL OPERATIVO 2026 — BASE DE DATOS
═══════════════════════════════════
Cuando alguien pregunte por un paso específico ("¿qué dice el paso 7?",
"¿quién es responsable del paso 14?", "¿qué documentos necesito en el paso 19?"),
el sistema puede inyectar un bloque REFERENCIA MANUAL OPERATIVO con datos exactos
de la base de datos. Si ese bloque aparece en esta sesión, úsalo como fuente primaria:
cita el número de paso, el responsable y el plazo con exactitud.
Si el bloque NO aparece (pregunta fuera de los pasos cargados), responde con la
información general que ya tienes arriba — nunca inventes detalles específicos
de documentos, plazos o entregables que no estén en ese bloque.`;

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

// ─── RAG: knowledge retrieval from maria_knowledge ────────────────────────────
// Calls the search_maria_knowledge_fts RPC (Postgres full-text search) to pull
// the top 3 most relevant chunks for the user's question. Returns a single
// concatenated string of "[category] title: content" blocks, or null when
// nothing matches or the RPC fails. Non-blocking by design.
//
// TODO: When embeddings are generated in maria_knowledge.embedding,
// switch to match_maria_knowledge() for semantic similarity search.
// For now, full-text search (FTS) works well for keyword-heavy mining queries.
async function retrieveKnowledge(supabaseClient, userMessage) {
  try {
    const { data: chunks, error } = await supabaseClient.rpc('search_maria_knowledge_fts', {
      query_text: userMessage,
      match_count: 3,
    });
    if (error || !chunks?.length) return null;
    return chunks.map(c => `[${c.category}] ${c.title}: ${c.content}`).join('\n\n');
  } catch (e) {
    console.error('RAG retrieve error:', e);
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
      const expNum = incomingMessage.split(' ')[1];
      const { data: exp } = await supabase
        .from('expedientes')
        .select('*')
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
        supabase.from('conversaciones_whatsapp').select('numero_whatsapp, created_at').gte('created_at', last1h),
        supabase.from('conversaciones_whatsapp').select('numero_whatsapp, role, created_at').gte('created_at', last24h),
        supabase.from('conversaciones_whatsapp').select('numero_whatsapp').gte('created_at', last7d),
        supabase.from('conversaciones_whatsapp').select('*', { count: 'exact', head: true }),
        supabase.from('clientes').select('nombre, municipio, situacion_tierra, tipo_mineral, fecha_registro, telefono_whatsapp').order('created_at', { ascending: false }),
        supabase.from('expedientes').select('estado, tipo, inicio').order('inicio', { ascending: false }),
        supabase.from('transacciones_pendientes').select('estado, created_at, mensaje_original').order('created_at', { ascending: false }),
        supabase.from('hitos').select('estado, monto, trigger_evento').order('created_at', { ascending: false }),
        supabase.from('precios_diarios').select('fecha, oro, usd_hnl, fuente, fetched_at').order('fecha', { ascending: false }).limit(1).maybeSingle(),
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
          ? 'Total expedientes: 0\n→ No hay expedientes registrados. Sistema operativo, esperando piloto Iriona o registros nuevos.'
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
Alcaldia Iriona: Verificar requisitos locales vigentes.
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

    const { data: history } = await supabase
      .from("conversaciones_whatsapp")
      .select("role, content")
      .eq("numero_whatsapp", fromNumber)
      .order("created_at", { ascending: true })
      .limit(40);

    const conversationHistory = history || [];
    console.log('History found:', conversationHistory.length, 'messages');

    // --- Look up miner in clientes table ---
    const cleanNumber = fromNumber.replace('whatsapp:', '');
    const { data: cliente } = await supabase
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
      const { data: cached } = await supabase
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

    const oroLBMA   = preciosHoy?.oro    != null ? `$${Number(preciosHoy.oro).toFixed(2)} USD/oz troy`   : null;
    const oroCompra = (preciosHoy?.oro != null && preciosHoy?.usd_hnl != null)
      ? `L ${(preciosHoy.oro * 0.80 * preciosHoy.usd_hnl / 31.1035).toFixed(2)}/gramo`
      : null;
    const plataLBMA = preciosHoy?.plata  != null ? `$${Number(preciosHoy.plata).toFixed(2)} USD/oz troy` : null;

    // Freshness label for the price block
    let frescuraLabel = '';
    if (preciosHoy?.fetched_at) {
      try {
        const fetchedDate = new Date(preciosHoy.fetched_at);
        const horaHN = fetchedDate.toLocaleTimeString('es-HN', {
          timeZone: 'America/Tegucigalpa',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
        const fechaFetched = fetchedDate.toISOString().slice(0, 10);
        frescuraLabel = fechaFetched === today
          ? `actualizado hoy ${horaHN}`
          : `último registro ${fechaFetched} ${horaHN}`;
      } catch { frescuraLabel = ''; }
    }

    const priceContext = preciosHoy
      ? `\n\nPRECIOS DE REFERENCIA (${preciosHoy.fecha ?? 'hoy'}${frescuraLabel ? ` — ${frescuraLabel}` : ''}):
- Oro LBMA: ${oroLBMA ?? 'no disponible'}
- Precio de compra CHT (80% LBMA): ${oroCompra ?? 'el equipo confirma hoy'}
- Plata LBMA: ${plataLBMA ?? 'no disponible'}
- Tipo de cambio: ${preciosHoy.usd_hnl != null ? `L ${preciosHoy.usd_hnl}/USD` : 'no disponible'}
${preciosHoy.fuente ? `- Fuente: ${preciosHoy.fuente}` : ''}
Cuando el cliente pregunte por precios del oro, usa estos valores. Aclara que CHT paga al 80% del precio LBMA del dia, en lempiras al tipo de cambio BCH.
${frescuraLabel ? `Cuando cites el precio, agregá una línea con "(${frescuraLabel})" para que el cliente sepa qué tan reciente es el dato.` : ''}`
      : `\n\nPRECIOS DE REFERENCIA: No hay datos de precios cargados hoy. Si el cliente pregunta por precio de compra del oro, di: "Hoy no tengo el precio cargado en el sistema. Para precio actualizado escribí a gerencia@mape.legal."`;

    // --- Query expedientes linked to this client ---
    let expedienteContext = '';
    if (cliente) {
      // Sanitize nombre: strip PostgREST or() separator chars to prevent filter injection
      const safeNombre = cliente.nombre.replace(/[,()]/g, ' ').trim();
      const { data: exps } = await supabase
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
        expedienteContext = `\nEXPEDIENTE: Este cliente no tiene expediente activo todavía. Si pregunta por su trámite, explícale el proceso de Fase 0 y el Hito 1 de L 320,000 para iniciarlo.`;
      }
    }

    // --- Build client context for María ---
    const clienteContext = cliente
      ? `
CONTEXTO DEL MINERO ACTIVO:
- Nombre: ${cliente.nombre}
- Municipio: ${cliente.municipio || 'Iriona, Colón'}
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
        await supabase.from("conversaciones_whatsapp").insert([
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
    if (!isAdmin) {
      try {
        const onboardingState = await getOnboardingState(cleanNumber);
        if (!cliente && onboardingState === null) {
          const firstQ = await startOnboarding(cleanNumber);
          await supabase.from("conversaciones_whatsapp").insert([
            { numero_whatsapp: fromNumber, role: "user",      content: incomingMessage },
            { numero_whatsapp: fromNumber, role: "assistant", content: firstQ },
          ]);
          return new Response(
            `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${esc(firstQ)}</Message></Response>`,
            { status: 200, headers: { "Content-Type": "text/xml" } }
          );
        }
        if (onboardingState && onboardingState.estado !== 'COMPLETE') {
          const reply = await handleOnboarding(cleanNumber, incomingMessage);
          await supabase.from("conversaciones_whatsapp").insert([
            { numero_whatsapp: fromNumber, role: "user",      content: incomingMessage },
            { numero_whatsapp: fromNumber, role: "assistant", content: reply },
          ]);
          return new Response(
            `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${esc(reply)}</Message></Response>`,
            { status: 200, headers: { "Content-Type": "text/xml" } }
          );
        }
      } catch (onboardingErr) {
        console.log('Onboarding unavailable, falling through to María:', onboardingErr.message);
        // Fall through to normal María flow
      }
    }

    // --- Manual Operativo 2026 lookup (keyword-triggered, non-blocking) ---
    // Pass the last 6 turns so buildManualContext can tell which service the
    // client has been discussing (formalización vs titulación vs sociedad).
    const recentHistoryText = conversationHistory
      .slice(-6)
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');
    const manualContext = await buildManualContext(incomingMessage, supabase, recentHistoryText);

    // --- RAG: retrieve top-3 relevant chunks from maria_knowledge (FTS) ---
    const knowledgeContext = await retrieveKnowledge(supabase, incomingMessage);
    const ragBlock = knowledgeContext
      ? `\n\nCONTEXTO DEL SISTEMA (información relevante para esta consulta):\n${knowledgeContext}\n\nUsa esta información para responder precisamente. Si no puedes responder con esta información, di que consultarás con el equipo técnico.`
      : '';

    const dynamicPrompt = CHT_SYSTEM_PROMPT + priceContext + clienteContext + expedienteContext + manualContext + ragBlock + (isNewConversation
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

    let assistantReply = claudeResponse.content?.[0]?.text ?? 'Lo siento, no pude procesar tu mensaje en este momento.';
    console.log(`🤖 Claude responds: ${assistantReply}`);

    // --- Auto-create broadcast user if not yet registered ---
    if (!broadcastUser) {
      getOrCreateUserByPhone(cleanNumber, cliente?.nombre ?? undefined).catch(() => {});
    }

    const { error: insertError } = await supabase.from("conversaciones_whatsapp").insert([
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
        let rawText = extractionResponse.content?.[0]?.text ?? '';
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
            const { error: clientInsertError } = await supabase
              .from('clientes')
              .insert([{
                nombre: extracted.nombre,
                telefono_whatsapp: cleanNumber,
                municipio: extracted.municipio || 'Iriona, Colón',
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
      await supabase.from("transacciones_pendientes").insert([{
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
      await supabase.from("transacciones_pendientes").insert([{
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
