-- =============================================================================
-- rag_maria_fichas_v2.sql — 8 fichas de debida diligencia para el RAG de María
-- (ANEXO A del SCRIPT FINAL MAPE.LEGAL v2.1, 11-nov-2026; hotfix/neutralidad-politica)
--
-- NO SE EJECUTA DESDE EL REPO. Lo corre un humano en Supabase Studio → SQL Editor
-- DESPUÉS del deploy del hotfix (Vercel no aplica SQL). Pasos:
--   1. Correr este archivo completo (crea respaldo + reemplaza las 8 fichas).
--   2. Verificar que la SELECT final devuelva 8 filas con embedding IS NULL.
--   3. Regenerar embeddings desde /admin/maria/rag-health → "Completar".
--   4. Smoke test FTS: select title from search_maria_knowledge_fts('CRAFT', 3);
--
-- Esquema real (migración 024): maria_knowledge(id integer identity, category
-- varchar, title varchar, content text, embedding vector(1536), source text,
-- metadata jsonb, created_at, updated_at). No hay unique sobre `source`, así que
-- la idempotencia es delete-por-source + insert (mismo patrón que
-- data/maria-knowledge/seed-*.sql y scripts/chunks-json-to-sql.mjs).
--
-- Contenido = texto EXACTO de docs/rag-maria/*.md (generado programáticamente;
-- dollar-quoting $ficha$ para no escapar comillas). title = h1 de cada ficha;
-- category = 'debida-diligencia'; source = 'rag-maria/<archivo>'; embedding NULL.
-- Idempotente: re-ejecutable sin duplicar.
-- =============================================================================

begin;

-- 1) Respaldo previo (solo si no existe; un segundo run no lo pisa).
create table if not exists public.maria_knowledge_backup_fichas_v2_20261111
  as select * from public.maria_knowledge;

-- 2) Reemplazo idempotente de las 8 fichas.
delete from public.maria_knowledge where source like 'rag-maria/%';

insert into public.maria_knowledge (category, title, content, source, metadata, embedding)
values
  ('debida-diligencia', 'CRAFT, explicado para el minero artesanal', $ficha$# CRAFT, explicado para el minero artesanal

**Uso:** respuestas listas para el RAG de María. Lenguaje claro. No es asesoría legal definitiva.

## ¿Qué es CRAFT?

CRAFT es el *Código de mitigación de riesgos para la minería artesanal y a pequeña escala que quiere entrar al comercio formal*. Lo mantiene la Alianza por la Minería Responsable (ARM) y se elaboró junto con RESOLVE. La versión vigente es la **2.1**, del **16 de octubre de 2024**. Es un estándar abierto, no una ley hondureña.

CRAFT sirve para que un grupo minero artesanal pueda demostrar, paso a paso, que produce de forma responsable y que puede vender a compradores formales que aplican la Guía de la OCDE.

## ¿CRAFT es una certificación del Gobierno o de INHGEOMIN?

No. CRAFT no es un permiso, no es un certificado de origen y no es un aval de INHGEOMIN ni de la municipalidad. Tener un reporte al estilo CRAFT no reemplaza el permiso municipal ni los demás papeles que exige la ley hondureña.

## ¿Cómo está organizado?

Tiene varios tomos. Los tomos 1 a 3 son las reglas de cumplimiento. El tomo 4 solo orienta y no es obligatorio. Para el oro hay que cumplir las reglas generales (tomo 2A) y las reglas propias del oro (tomo 2B), por ejemplo las del mercurio.

Hay **cinco módulos**, en este orden:

1. **Sistema de gestión:** el grupo se organiza, nombra quién decide, adopta una política responsable y tiene un contacto para quejas. En el oro, también se compromete a reducir y, cuando se pueda, eliminar el mercurio.
2. **Legitimidad:** el grupo debe ser «legítimo». En Honduras eso significa, en la práctica, tener el permiso que la ley exige o estar formalizándose de buena fe.
3. **Riesgos graves que no se toleran:** si aparecen, el comprador responsable debe cortar la relación de inmediato. Ejemplos: peores formas de trabajo infantil en la mina, trabajo forzado, tortura, violencia sexual grave, o —en zonas de conflicto— grupos armados que controlan la mina o cobran «impuestos» ilegales.
4. **Riesgos que se pueden corregir, pero no se pueden ignorar:** por ejemplo, problemas con la seguridad, sobornos, lavado de dinero, no pagar impuestos, o no poder rastrear el mineral. Se hace un plan y se debe ver mejora. Si no hay mejora, el comprador puede suspender la compra.
5. **Mejoras que no están en la Guía de la OCDE, pero sí pedirán muchos compradores responsables:** por ejemplo, dejar de amalgamar todo el mineral, no quemar amalgama al aire libre ni en la casa, y no usar cianuro en relaves que todavía tienen mercurio.

## ¿Qué es ser «candidato» y qué es ser «afiliado»?

- **Candidato:** el grupo entrega su información, acredita que es legítimo y puede afirmar que no tiene los riesgos graves del módulo 3.
- **Afiliado:** además, tiene controlados o en mejora medible los riesgos del módulo 4. Si un problema grave reaparece, vuelve a candidato.

El grupo prepara, por lo menos una vez al año, un **reporte** con afirmaciones que se puedan comprobar. CRAFT no obliga al minero a pagar una auditoría internacional; esa verificación la hace, en principio, quien compra o la refinería.

## ¿MAPE.LEGAL es lo mismo que CRAFT?

No. MAPE.LEGAL es un estándar **privado** de debida diligencia. Se inspira en CRAFT 2.1, pero eso no significa que ARM haya certificado la plataforma ni a un minero en particular.

## Fuentes

- Sitio oficial de CRAFT: <http://www.craftmines.org/en/>
- Código CRAFT 2.1 completo (16 de octubre de 2024): <https://www.craftmines.org/wp-content/uploads/2024/11/CRAFT-2.1-Complete.pdf>
- Nota de ARM sobre la versión 2.1: <https://www.responsiblemines.org/en/2024/10/craft-code-2-1/>

## Lo que María NO debe decir

- No afirmar que un minero, un lote o la plataforma están «certificados CRAFT» u «aprobados por ARM», salvo que exista un documento vigente que lo acredite, lo cual María no debe dar por hecho.
- No decir que CRAFT reemplaza el permiso municipal, el certificado de origen o cualquier acto de INHGEOMIN.
- No nombrar compradores (empresas que compran el oro).
- No prometer que, por seguir CRAFT, el minero recibirá un precio, un pago o un contrato.
- No hablar de política partidaria ni de candidatos.
- No dar asesoría legal definitiva («usted ya está legal» o «con esto no le pueden sancionar»). Si el minero necesita un trámite concreto, María lo deriva a un **abogado colegiado en el Colegio de Abogados de Honduras (CAH)** o a la municipalidad o a INHGEOMIN, según corresponda.$ficha$, 'rag-maria/01_craft_explicado.md', '{"origen":"SCRIPT_FINAL_MAPE_LEGAL_v2.1 — ANEXO A","hotfix":"neutralidad-politica","fecha":"2026-11-11","archivo":"docs/rag-maria/01_craft_explicado.md"}'::jsonb, null),
  ('debida-diligencia', 'Qué piden los bancos y los compradores responsables', $ficha$# Qué piden los bancos y los compradores responsables

**Uso:** respuestas listas para el RAG de María. Lenguaje claro. No es asesoría legal definitiva.

## ¿Por qué un banco pregunta tanto si voy a vender oro?

El oro puede usarse para esconder o mover dinero ilícito: tiene valor estable, se puede fundir y es difícil de rastrear si no hay papeles. Por eso los bancos y los compradores formales piden conocer al vendedor, el origen del metal y la forma de pago. El Grupo de Acción Financiera Internacional (GAFI o FATF) considera a los comerciantes de metales preciosos como actividades no financieras que deben prevenir el lavado de activos.

## ¿Qué es la debida diligencia o el «conozca a su cliente» (KYC)?

Es el conjunto de pasos para saber **quién** vende, **de dónde** sale el oro y **cómo** se paga. En la práctica, le pueden pedir:

- Su identidad y su RTN (y, si vende a través de una empresa, la escritura y quién es el dueño real o **beneficiario final**: la persona natural que de verdad es dueña o controla).
- Su permiso para extraer y los papeles de origen del lote.
- Una cuenta bancaria a su nombre para recibir el pago.
- Explicar si los volúmenes que vende coinciden con lo que razonablemente puede producir.

## ¿Qué piden las refinerías que siguen la guía de la LBMA?

La Guía de Oro Responsable de la LBMA, **versión 9** (noviembre de 2021), es obligatoria para los refinadores de la Lista de Buena Entrega de Londres. Si el oro llega a uno de esos refinadores, suelen pedir:

- Identificar a la empresa que les vende y a sus dueños reales.
- Seguir la cadena hasta la mina y comprobar que la minería artesanal es **legítima** (conforme a la ley o en un proceso de formalización de buena fe).
- Saber si se usó **mercurio** y cómo se manejó.
- Pagos por **canales bancarios** oficiales.
- Conservar los registros por lo menos **cinco años**.

El oro de minería artesanal y el oro producido con mercurio se tratan, en esa guía, como de **mayor riesgo**. Eso no significa que esté prohibido; significa que piden más pruebas.

## ¿Y los bancos hondureños?

En Honduras, la Ley Especial contra el Lavado de Activos (Decreto 144-2014) obliga a los sujetos obligados a identificar a sus clientes, a conservar registros por lo menos cinco años y a reportar ciertas operaciones a la Unidad de Inteligencia Financiera (UIF) de la CNBS. Quien se dedica a comprar y vender metales preciosos debe, además, registrarse como APNFD ante la URMOPRELAFT (subsector 07). Eso es una obligación de las empresas comercializadoras y de las plantas, no un trámite que María deba presentar como si el minero ya lo tuviera resuelto.

## ¿Me pueden pagar en efectivo?

Un comprador o un banco formal casi siempre exigirá **pago por transferencia o depósito identificable**, a una cuenta a nombre del minero. María no debe afirmar que «está prohibido todo efectivo en Honduras» sin citar el umbral vigente del Banco Central, que hay que verificar. Sí puede decir que los compradores responsables y los bancos internacionales suelen rechazar el efectivo precisamente para prevenir el lavado de activos, y que el minero debe preguntar las condiciones a su comprador y, si hace falta, a un abogado colegiado en el CAH.

## Fuentes

- GAFI, página oficial de las Recomendaciones (consultada el 11 de noviembre de 2026, con enmiendas de junio de 2026): <https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Fatf-recommendations.html>
- GAFI/APG, riesgos del oro: <https://www.fatf-gafi.org/en/publications/Methodsandtrends/Ml-tf-risks-and-vulnerabilities-gold.html>
- LBMA, Responsible Gold Guidance v.9: <https://www.lbma.org.uk/responsible-sourcing/guidance-documents>
- Decreto 144-2014: <https://pplaft.cnbs.gob.hn/wp-content/uploads/2015/05/LEY-ESPECIAL-CONTRA-EL-LAVADO-DE-ACTIVOS-Decreto-No.-144-2014.pdf>
- Decreto 131-2014 (APNFD): <https://pplaft.cnbs.gob.hn/wp-content/uploads/2015/05/LEY-PARA-LA-REGULACION-DE-ACTIVIDADES-Y-PROFESIONES-NO-FINANCIERAS-DESIGNADAS-APNFD-Decreto-No.-131-2014.pdf>
- URMOPRELAFT, subsector 07: <https://urmoprelaft.cnbs.gob.hn/subsectores/>

## Lo que María NO debe decir

- No nombrar empresas compradoras ni decir «le compra tal compañía».
- No prometer que el banco «le va a abrir la cuenta» ni que «le van a pagar tal día o a tal precio».
- No asegurar que el minero ya cumplió o no cumplió como APNFD; esa calificación la hace la autoridad o un abogado.
- No afirmar aval de INHGEOMIN, de la CNBS, de la LBMA ni del GAFI.
- No hablar de política.
- No dar asesoría legal definitiva. Para trámites bancarios o de registro, derivar a un **abogado colegiado en el CAH** o a la institución competente (banco, CNBS, URMOPRELAFT).$ficha$, 'rag-maria/02_que_piden_bancos_y_compradores.md', '{"origen":"SCRIPT_FINAL_MAPE_LEGAL_v2.1 — ANEXO A","hotfix":"neutralidad-politica","fecha":"2026-11-11","archivo":"docs/rag-maria/02_que_piden_bancos_y_compradores.md"}'::jsonb, null),
  ('debida-diligencia', 'Documentos que necesita un minero para vender legalmente', $ficha$# Documentos que necesita un minero para vender legalmente

**Uso:** respuestas listas para el RAG de María. Lenguaje claro. No es asesoría legal definitiva.

## ¿Puedo vender oro si no tengo permiso?

La ley hondureña no trata la minería artesanal como una actividad «libre de papeles». El artículo 34 del Reglamento MAPE (Acuerdo Ejecutivo 088-B-2018) dice que los actos de comercio de productos mineros de minería artesanal o pequeña minería que **no cuenten con un derecho minero** serán sancionados de acuerdo con la ley. Además, el artículo 38 de la Ley General de Minería (Decreto 238-2012) dispone que **comprar a personas no autorizadas** sujeta al comprador a responsabilidad administrativa, civil y penal, de manera solidaria, y que el comprador está obligado a verificar el origen.

Por eso un comprador formal le pedirá sus papeles antes de comprar.

## ¿Quién me da el permiso de minería artesanal?

Las **municipalidades** son la autoridad competente para otorgar los **permisos de minería artesanal** (artículo 90 de la Ley General de Minería y artículo 18 del Reglamento MAPE). Ese permiso se da en un área que INHGEOMIN delimita, a petición del municipio, en zonas **libres de derechos mineros** y de zonas excluidas. El área máxima que cada municipalidad puede delimitar es de hasta **100 hectáreas**, divididas según las necesidades del municipio (artículo 20 del Reglamento MAPE).

El artículo 19 del Reglamento MAPE indica que la solicitud municipal debe llevar, al menos: nombre y número de identidad; RTN; escritura de constitución (si aplica); sustancia de interés; y cantidades proyectadas de explotación y venta. El permiso es **intransferible** (artículo 24 del mismo reglamento).

## ¿Qué es el certificado de origen?

El artículo 35 del Reglamento MAPE dice que **el titular del derecho minero** debe emitir un **Certificado de Origen**, autenticado y avalado por la **Autoridad Minera o Municipal**, como manera de seguir la trazabilidad del producto minero en toda la cadena de valor, y que ese documento es un requisito para la **exportación** de productos mineros.

Ese certificado lo emite el titular, no una plataforma privada, y lo avala la autoridad. Ningún sello digital lo sustituye.

## ¿Qué más me pueden pedir al vender un lote?

Además del permiso y del certificado de origen, un comprador formal suele pedir:

- Identidad y RTN vigentes.
- Datos del expediente ante la municipalidad o INHGEOMIN.
- Pesos, y si hay ensaye, la ley o el contenido de oro.
- Una cuenta bancaria a su nombre para el pago.
- En su caso, solvencias o constancias de estar al día, porque el comercializador las necesita para su propio registro (artículo 43 del Reglamento de la Ley General de Minería, Acuerdo Ejecutivo 042-2013).

El registro de comercializador (artículos 42 a 44 de ese reglamento y artículo 37 de la Ley General de Minería) es una obligación de **quien compra y vende minerales de forma regular sin ser titular del derecho minero**, no el permiso del minero artesanal. El registro vale **un año** y se renueva.

## ¿Y si el oro se va a exportar?

Para exportar, la Ley General de Minería exige, entre otros, certificado de **análisis**, certificado de **procedencia** y el **registro de comercialización** ante la Autoridad Minera (artículos 33 y 35). Eso lo gestiona quien exporte, no normalmente el minero artesanal, pero el origen tiene que estar documentado desde la mina.

## Fuentes

- Ley General de Minería, Decreto 238-2012, *La Gaceta* n.° 33,088, 2 de abril de 2013: <https://tsc.gob.hn/web/leyes/Ley_de_Mineria.pdf> (artículos 33, 35, 37, 38 y 90).
- Reglamento de la LGM, Acuerdo Ejecutivo 042-2013, *La Gaceta* n.° 33,220, 4 de septiembre de 2013: <https://faolex.fao.org/docs/pdf/hon131570.pdf> (artículos 42 a 44).
- Reglamento MAPE, Acuerdo Ejecutivo 088-B-2018, *La Gaceta* n.° 34,931, 29 de abril de 2019 (artículos 18, 19, 20, 24, 34 y 35).

## Lo que María NO debe decir

- No decir «ya está legal» ni «con este papel puede vender a cualquiera».
- No afirmar que un sello, una ficha o una plataforma reemplazan el permiso municipal o el certificado de origen avalado por la autoridad.
- No afirmar aval o certificación de INHGEOMIN.
- No nombrar compradores ni prometer que le van a comprar o a pagar un precio.
- No hablar de política.
- No dar asesoría legal definitiva. Para tramitar un permiso o un certificado, el minero debe acudir a su **municipalidad**, a **INHGEOMIN** cuando corresponda, y, si necesita representación, a un **abogado colegiado en el CAH**.$ficha$, 'rag-maria/03_documentos_para_vender_legalmente.md', '{"origen":"SCRIPT_FINAL_MAPE_LEGAL_v2.1 — ANEXO A","hotfix":"neutralidad-politica","fecha":"2026-11-11","archivo":"docs/rag-maria/03_documentos_para_vender_legalmente.md"}'::jsonb, null),
  ('debida-diligencia', 'Mercurio y medio ambiente', $ficha$# Mercurio y medio ambiente

**Uso:** respuestas listas para el RAG de María. Lenguaje claro. No es asesoría legal definitiva.

## ¿Honduras está en el Convenio de Minamata?

Sí. El Convenio de Minamata sobre el Mercurio es un tratado internacional para proteger la salud humana y el medio ambiente de los efectos del mercurio. Según la página oficial del Convenio y el registro de tratados de las Naciones Unidas, **Honduras**:

- firmó el 24 de septiembre de 2014;
- **ratificó el 22 de marzo de 2017**;
- y el Convenio **entró en vigor** para Honduras el **16 de agosto de 2017**.

Eso significa que Honduras es **Parte** del Convenio.

## ¿Qué tiene que ver el mercurio con la minería artesanal de oro?

El mercurio se usa a veces para separar el oro de la arena o de la roca (amalgamación). El Convenio se ocupa también de la minería artesanal y a pequeña escala de oro. El artículo 22 del Reglamento MAPE hondureño (Acuerdo Ejecutivo 088-B-2018) dice que las actividades de explotación en minería artesanal que utilicen mercurio en sus procesos de recuperación deben acatar el **artículo 7 del Convenio de Minamata**, en especial la **prohibición de las malas prácticas** que se desprenden del **Anexo C** de ese Convenio, y que esas prácticas se enuncian en el artículo 14 del mismo reglamento. **[VERIFICAR]** el texto íntegro del artículo 14 del Reglamento MAPE, que no se transcribe aquí.

## ¿Cuáles son esas malas prácticas, en palabras sencillas?

El Código CRAFT 2.1, en sus reglas propias del oro, retoma las prácticas del Anexo C del Convenio y pide al grupo minero avanzar hacia:

1. **No amalgamar todo el mineral** (no echar mercurio a toda la tierra o a toda la roca). Primero se concentra (por ejemplo, a mano o con métodos gravimétricos) y, si aún se usa mercurio, solo se amalgama el concentrado. O, mejor, no se usa mercurio.
2. **No quemar la amalgama al aire libre.** La quema, si ocurre, debe hacerse con retortas o campanas que recuperen el mercurio, no a cielo abierto.
3. **No quemar amalgama en la casa ni en zonas residenciales**, ni en pulperías o talleres pegados a viviendas o mercados.
4. **No lixiviar con cianuro** relaves o minerales a los que ya se les puso mercurio, **sin quitar primero el mercurio**.

Estas son metas de mejora y de protección de la salud. María no debe decir que «con dejar el mercurio ya está certificado» ni que «está prohibido de toda forma usar cualquier gramo», sin remitir al texto oficial y a la autoridad ambiental.

## ¿El estándar privado también habla de mercurio?

Sí, como compromiso de mejora: reducir y, cuando sea factible, eliminar el uso de mercurio, en línea con el Convenio y con el Reglamento MAPE. Eso no reemplaza la licencia ambiental ni las órdenes de la municipalidad, de la UMA o de SERNA / MiAmbiente+.

## ¿A quién le pregunto si uso mercurio o quiero dejar de usarlo?

A la **Unidad Municipal Ambiental (UMA)** de su municipio, a la autoridad ambiental (SERNA / MiAmbiente+) y, para el permiso minero, a la municipalidad. Si necesita un criterio jurídico sobre su caso, debe consultar a un **abogado colegiado en el CAH**.

## Fuentes

- Perfil oficial de Honduras en el Convenio de Minamata: <https://minamataconvention.org/en/parties/hnd>
- Estado de tratados de las Naciones Unidas, Convenio de Minamata (Capítulo XXVII-17): <https://treaties.un.org/doc/Publication/MTDSG/Volume%20II/Chapter%20XXVII/xxvii-17.en.pdf>
- Reglamento MAPE, Acuerdo Ejecutivo 088-B-2018, *La Gaceta* n.° 34,931, 29 de abril de 2019, artículo 22.
- CRAFT 2.1, Volumen 2B, requisitos específicos del oro (módulos 1 y 5 sobre mercurio): <https://www.craftmines.org/wp-content/uploads/2024/11/CRAFT-2.1-Complete.pdf>

## Lo que María NO debe decir

- No afirmar que Honduras «no ha ratificado» el Convenio: sí lo ratificó.
- No afirmar que un minero «ya cumple Minamata» solo por una declaración o por un sello privado.
- No dar recetas técnicas de manejo de mercurio o cianuro como si fueran un instructivo de trabajo seguro (eso corresponde a personal técnico y a la autoridad).
- No nombrar compradores ni prometer que «si deja el mercurio le pagan más».
- No afirmar aval de INHGEOMIN ni de SERNA.
- No hablar de política.
- No dar asesoría legal definitiva. Derivar a la UMA, a SERNA / MiAmbiente+ o a un **abogado colegiado en el CAH**.$ficha$, 'rag-maria/04_mercurio_y_medio_ambiente.md', '{"origen":"SCRIPT_FINAL_MAPE_LEGAL_v2.1 — ANEXO A","hotfix":"neutralidad-politica","fecha":"2026-11-11","archivo":"docs/rag-maria/04_mercurio_y_medio_ambiente.md"}'::jsonb, null),
  ('debida-diligencia', 'Señales de alerta en la compraventa de oro', $ficha$# Señales de alerta en la compraventa de oro

**Uso:** respuestas listas para el RAG de María. Lenguaje claro. No es asesoría legal definitiva ni una guía para evadir controles.

## ¿Qué es una señal de alerta?

Es un indicio de que una operación puede estar ligada a un origen ilícito, a lavado de activos, a un abuso grave o a un intento de ocultar de dónde sale el oro. Ver una señal no prueba, por sí sola, un delito. Sí obliga a un comprador o a un banco formal a **parar, preguntar y, si corresponde, reportar** a la autoridad. El minero honesto también se protege si reconoce estas señales y no se presta a ellas.

## ¿Cuáles son señales típicas, según las reglas de debida diligencia?

Con base en la Guía de la OCDE (Anexo II), en la Guía de Oro Responsable de la LBMA (versión 9) y en la lógica de CRAFT 2.1, conviene tratar como alerta, entre otras, las siguientes situaciones:

1. El vendedor **no puede mostrar un permiso** o un derecho minero, o el permiso está vencido, es de otra persona o de otra zona.
2. Pide que le paguen **en efectivo**, a nombre de un tercero, o en una cuenta que no coincide con quien entrega el mineral.
3. Los **volúmenes** que ofrece no coinciden con lo que razonablemente puede producir su mina o su grupo (vende «de más» sin explicación).
4. Cambia la **historia del origen** (dice que es de un municipio y luego de otro; mezcla lotes sin explicar).
5. No quiere **identificarse**, no da RTN, o los documentos parecen alterados o no coinciden entre sí.
6. Hay indicios de **trabajo forzado**, de niñas o niños en trabajos peligrosos de mina, de amenazas, o de gente armada controlando la entrada o el camino.
7. Alguien exige un «impuesto», un «peaje» o una parte del mineral **fuera de la ley**.
8. Se pide **ocultar el uso de mercurio**, o se quema amalgama en la casa o en el pueblo, pese a las reglas de protección.
9. Aparece un nombre coincidente con **listas de sanciones** (por ejemplo, de las Naciones Unidas) o se pide evitar a los bancos a propósito.
10. Se ofrece el oro como si fuera «reciclado» o «de joyería» para **esconder** que sale de una mina.

La Ley Especial contra el Lavado de Activos (Decreto 144-2014, artículo 27) obliga a los sujetos obligados a comunicar de inmediato a la **Unidad de Inteligencia Financiera (UIF)** las operaciones que puedan estar relacionadas con actividades ilícitas, en el formulario de Reporte de Operaciones Sospechosas, se hayan concretado o no.

## ¿Qué debe hacer un minero si le proponen algo así?

No aceptar condiciones que oculten el origen, el peso o el pago. Conservar sus papeles. Si cree que hay un delito, puede acudir a las autoridades competentes. María no investiga casos ni recibe denuncias formales: indica que la denuncia penal corresponde al **Ministerio Público** y que el reporte de operaciones sospechosas lo presentan los sujetos obligados ante la **UIF**. Para orientación jurídica de su caso, el minero debe consultar a un **abogado colegiado en el CAH**.

## Fuentes

- OCDE, Guía de Debida Diligencia, 3.ª ed., 2016, Anexo II: <https://www.oecd.org/content/dam/oecd/en/publications/reports/2016/04/oecd-due-diligence-guidance-for-responsible-supply-chains-of-minerals-from-conflict-affected-and-high-risk-areas_g1g65996/9789264252479-en.pdf>
- LBMA, Responsible Gold Guidance v.9 (clasificación de alto riesgo y KYC): <https://www.lbma.org.uk/responsible-sourcing/guidance-documents>
- CRAFT 2.1, módulos 3 y 4: <https://www.craftmines.org/wp-content/uploads/2024/11/CRAFT-2.1-Complete.pdf>
- Decreto 144-2014, artículos 23 a 27: <https://pplaft.cnbs.gob.hn/wp-content/uploads/2015/05/LEY-ESPECIAL-CONTRA-EL-LAVADO-DE-ACTIVOS-Decreto-No.-144-2014.pdf>
- Informe GAFI/APG sobre riesgos del oro (página oficial; la lista detallada del PDF debe cotejarse): <https://www.fatf-gafi.org/en/publications/Methodsandtrends/Ml-tf-risks-and-vulnerabilities-gold.html>

## Lo que María NO debe decir

- No dar consejos para «pasar» un control bancario o para ocultar el origen, el volumen o el pago.
- No acusar a una persona o a una comunidad de un delito.
- No nombrar compradores ni decir que «esa empresa lava dinero» o «esa empresa paga seguro».
- No prometer precios, pagos ni que «con estos papeles el banco no pregunta».
- No afirmar aval de INHGEOMIN, de la UIF o de la CNBS.
- No hablar de política.
- No dar asesoría legal definitiva. Derivar a un **abogado colegiado en el CAH** o, si hay un posible delito, al **Ministerio Público**.$ficha$, 'rag-maria/05_senales_de_alerta.md', '{"origen":"SCRIPT_FINAL_MAPE_LEGAL_v2.1 — ANEXO A","hotfix":"neutralidad-politica","fecha":"2026-11-11","archivo":"docs/rag-maria/05_senales_de_alerta.md"}'::jsonb, null),
  ('debida-diligencia', 'Qué es y qué no es MAPE.LEGAL', $ficha$# Qué es y qué no es MAPE.LEGAL

**Uso:** respuestas listas para el RAG de María. Lenguaje claro. No es asesoría legal definitiva.

## ¿Qué es MAPE.LEGAL?

MAPE.LEGAL es un **estándar privado de debida diligencia** y una **plataforma digital** de apoyo a la trazabilidad del oro artesanal. Sirve para organizar expedientes, lotes y evidencias de origen, y para publicar, con fecha y versión, el estándar, una política de cadena de suministro y el resumen de una **auditoría externa anual**.

La titular y desarrolladora de la plataforma es **Corporación Hondureña Tenka (CHT)**, que también puede prestar servicios a los mineros. MAPE.LEGAL, como nombre, no es por sí mismo una empresa que compre o venda oro.

## ¿MAPE.LEGAL compra oro o fija el precio al que me lo compran?

No. MAPE.LEGAL **no compra, no vende ni intermedia oro**. Si en el sitio aparece una calculadora con un 75 %, eso es un **precio referencial estimado**, solo informativo. No es una oferta de compra, no es un precio oficial y no es una garantía de pago. Toda venta se negocia entre el productor y su comprador.

## ¿Está certificado o avalado por INHGEOMIN?

No. No debe decirse, sugerirse ni dejarse entender que INHGEOMIN, una municipalidad, SERNA / MiAmbiente+, la OCDE, la LBMA o cualquier otra autoridad haya certificado, avalado o aprobado MAPE.LEGAL o su sello. En las fuentes de trabajo no consta un convenio con INHGEOMIN.

El **Certificado de Origen** que exige el artículo 35 del Reglamento MAPE lo emite el **titular del derecho minero** y lo autentica y avala la **Autoridad Minera o Municipal**. El sello o la ficha de la plataforma **no sustituyen** ese certificado ni el permiso municipal.

## ¿Entonces para qué sirve, si no es un papel del Gobierno?

Sirve como control interno de una cadena privada: ayuda a juntar la identidad del minero, su permiso, el certificado de origen, los pesos, el transporte y el pago bancario, y a conservarlos para una auditoría o para un comprador formal. Eso puede facilitar la venta formal, pero **no legaliza** por sí solo una extracción sin permiso.

## ¿María representa a un comprador?

No. María orienta al público sobre derecho minero y ambiental, en lenguaje claro, y explica este estándar. No negocia ventas, no confirma pagos y no representa a quien compra el mineral.

## Fuentes

- Reglamento MAPE, Acuerdo Ejecutivo 088-B-2018, *La Gaceta* n.° 34,931, 29 de abril de 2019, artículo 35.
- Ley General de Minería, Decreto 238-2012, artículos 35, 37, 38 y 90: <https://tsc.gob.hn/web/leyes/Ley_de_Mineria.pdf>
- Lineamientos del estándar privado MAPE.LEGAL v2.0 (documento interno de CHT, 11 de noviembre de 2026).

## Lo que María NO debe decir

- No decir que MAPE.LEGAL es un certificado oficial, un registro estatal o un aval de INHGEOMIN.
- No decir que MAPE.LEGAL compra, vende o intermedia oro.
- No nombrar empresas compradoras.
- No prometer precios, pagos, ni que «con el sello ya puede exportar».
- No hablar de política partidaria.
- No dar asesoría legal definitiva («usted ya puede vender» o «no le pueden multar»). Derivar a un **abogado colegiado en el CAH**, a la municipalidad o a INHGEOMIN, según el trámite.$ficha$, 'rag-maria/06_que_es_y_que_no_es_mape_legal.md', '{"origen":"SCRIPT_FINAL_MAPE_LEGAL_v2.1 — ANEXO A","hotfix":"neutralidad-politica","fecha":"2026-11-11","archivo":"docs/rag-maria/06_que_es_y_que_no_es_mape_legal.md"}'::jsonb, null),
  ('debida-diligencia', 'La debida diligencia de la OCDE, en cinco pasos', $ficha$# La debida diligencia de la OCDE, en cinco pasos

**Uso:** respuestas listas para el RAG de María. Lenguaje claro. No es asesoría legal definitiva.

## ¿Qué es la Guía de la OCDE?

Es la *Guía de Debida Diligencia de la OCDE para cadenas de suministro responsables de minerales en áreas de conflicto o de alto riesgo*, **tercera edición, 2016**. No es una ley de Honduras, pero es el referente que usan gobiernos, refinerías, bancos y estándares como CRAFT y la guía de la LBMA.

Sirve para que las empresas sepan cómo respetar los derechos humanos y cómo evitar que su compra de minerales financie conflictos o abusos graves.

## ¿Se puede comprar oro de minería artesanal según esa guía?

Sí, si la minería es **legítima** y se hace debida diligencia adecuada. La Guía entiende por legitimidad, entre otras cosas, que la actividad sea compatible con la ley del país y/o que los mineros hagan esfuerzos de buena fe para formalizarse. No se considera legítima si contribuye al conflicto o a los abusos graves que describe el Anexo II (por ejemplo, trabajo forzado, peores formas de trabajo infantil, tortura o apoyo a grupos armados).

La Guía no promete una certeza del 100 %. Pide un proceso de buena fe para encontrar riesgos, reducirlos y mejorar con el tiempo.

## ¿Cuáles son los cinco pasos?

1. **Organizarse.** La empresa tiene una política clara, alguien responsable, un sistema para rastrear el mineral y un canal de quejas.
2. **Identificar riesgos.** Se pregunta de dónde sale el oro, quién interviene y si hay señales de abuso, de conflicto, de soborno o de lavado de dinero.
3. **Actuar.** Se informa a la dirección y se hace un plan. Si el riesgo es muy grave (abusos serios o grupos armados), se debe **cortar de inmediato** la compra. Si el riesgo se puede corregir, se da un tiempo con mejoras medibles; si no hay mejora, se suspende la relación.
4. **Verificar.** En la cadena del oro, la verificación independiente suele recaer en la **refinería**, no en que el minero pague una auditoría internacional.
5. **Informar.** La empresa da cuenta, de forma periódica, de cómo hace su debida diligencia.

## ¿Qué es el Anexo II?

Es el modelo de política de la propia Guía. Resume lo que no se tolera (abusos graves y apoyo a grupos armados) y lo que se debe mitigar (problemas con la seguridad, sobornos, lavado de dinero e impago de impuestos). MAPE.LEGAL adopta esos compromisos como política privada. Eso no significa que la OCDE haya certificado la plataforma ni a un minero.

## Fuentes

- OCDE, Guía de Debida Diligencia, 3.ª ed., 2016: <https://www.oecd.org/content/dam/oecd/en/publications/reports/2016/04/oecd-due-diligence-guidance-for-responsible-supply-chains-of-minerals-from-conflict-affected-and-high-risk-areas_g1g65996/9789264252479-en.pdf>
- OCDE, FAQ sobre abastecimiento de oro de la MAPE: <https://www.oecd.org/content/dam/oecd/en/topics/policy-sub-issues/due-diligence-guidance-for-responsible-business-conduct/minerals/FAQ_Sourcing-Gold-from-ASM-Miners.pdf>

## Lo que María NO debe decir

- No afirmar que un lote o un minero están «certificados por la OCDE» o «libres de conflicto al 100 %».
- No afirmar aval de INHGEOMIN ni de la OCDE.
- No nombrar compradores.
- No prometer precios ni pagos por «cumplir la OCDE».
- No hablar de política.
- No dar asesoría legal definitiva. Derivar a un **abogado colegiado en el CAH** cuando el minero necesite un dictamen sobre su caso.$ficha$, 'rag-maria/07_debida_diligencia_ocde_cinco_pasos.md', '{"origen":"SCRIPT_FINAL_MAPE_LEGAL_v2.1 — ANEXO A","hotfix":"neutralidad-politica","fecha":"2026-11-11","archivo":"docs/rag-maria/07_debida_diligencia_ocde_cinco_pasos.md"}'::jsonb, null),
  ('debida-diligencia', 'Cadena de custodia y pagos identificables', $ficha$# Cadena de custodia y pagos identificables

**Uso:** respuestas listas para el RAG de María. Lenguaje claro. No es asesoría legal definitiva.

## ¿Qué es la cadena de custodia?

Es el registro, paso a paso, de un **lote** de mineral o de metal: de quién salió, cuánto pesó, por dónde viajó, quién lo recibió y cómo se pagó. Sirve para que no se mezcle oro de origen desconocido con oro de un minero formal, y para que un auditor, un banco o una refinería puedan seguir el rastro.

Un sistema privado de trazabilidad (fichas, sellos digitales, fotos o pesajes) **ayuda**, pero **no reemplaza** el Certificado de Origen del artículo 35 del Reglamento MAPE ni el permiso municipal.

## ¿Qué datos suele llevar un lote bien documentado?

- Un número o código único del lote.
- El nombre del productor y su derecho minero (permiso y expediente).
- El certificado de origen autenticado y avalado por la autoridad minera o municipal.
- Pesos en la mina, en el acopio, en el transporte y en la recepción, y, si hay laboratorio, la ley o el contenido de oro.
- Fecha, lugar y responsable de cada entrega.
- El pago, cuando se haga, por un medio que se pueda identificar.

Si hay diferencias grandes de peso entre un punto y otro, eso es una **alerta** que debe explicarse. No todo descuadre es un fraude (puede haber humedad o merma), pero no se puede dejar sin revisar.

## ¿Por qué me piden una cuenta bancaria?

Porque un pago en efectivo, a un tercero o sin recibo dificulta saber quién recibió el dinero y de dónde salió el oro. Los compradores formales y los bancos suelen exigir **pago bancario a nombre del minero**. La Ley Especial contra el Lavado de Activos (Decreto 144-2014) obliga a los sujetos obligados a conocer a su cliente y a guardar los registros por lo menos **cinco años**.

María no debe decir que un porcentaje o una fecha de pago están «garantizados».

## ¿Puedo ver el precio de mi propia venta?

Eso depende del acuerdo y de la plataforma que se use. En el diseño de este estándar, cada productor puede ver el precio de **sus propias** ventas en su expediente, y ese dato no se publica como oferta general. María no cotiza ni confirma montos.

## Fuentes

- Reglamento MAPE, Acuerdo Ejecutivo 088-B-2018, artículo 35.
- OCDE, Guía de Debida Diligencia, 3.ª ed., 2016, Anexo I (controles y transparencia de la cadena).
- CRAFT 2.1, requisito de trazabilidad del oro (registros de al menos cinco años, números únicos de referencia): <https://www.craftmines.org/wp-content/uploads/2024/11/CRAFT-2.1-Complete.pdf>
- LBMA, Responsible Gold Guidance v.9, pagos por canales bancarios y conservación de registros: <https://www.lbma.org.uk/responsible-sourcing/guidance-documents>
- Decreto 144-2014, artículos 7 y 8: <https://pplaft.cnbs.gob.hn/wp-content/uploads/2015/05/LEY-ESPECIAL-CONTRA-EL-LAVADO-DE-ACTIVOS-Decreto-No.-144-2014.pdf>

## Lo que María NO debe decir

- No decir que la ficha o el sello digital «ya es el certificado de origen» o «ya sirve para exportar».
- No afirmar aval de INHGEOMIN.
- No nombrar compradores.
- No prometer precios, plazos de pago ni que «le pagan el mismo día».
- No hablar de política.
- No dar asesoría legal definitiva. Derivar a un **abogado colegiado en el CAH** para revisar contratos o pagos.$ficha$, 'rag-maria/08_cadena_de_custodia_y_pagos.md', '{"origen":"SCRIPT_FINAL_MAPE_LEGAL_v2.1 — ANEXO A","hotfix":"neutralidad-politica","fecha":"2026-11-11","archivo":"docs/rag-maria/08_cadena_de_custodia_y_pagos.md"}'::jsonb, null);

commit;

-- 3) Verificación: deben ser exactamente 8 filas, todas con embedding NULL
--    (pendiente de backfill) y category 'debida-diligencia'.
select id, source, title, length(content) as chars, embedding is null as sin_embedding
  from public.maria_knowledge
 where source like 'rag-maria/%'
 order by source;

select count(*) as fichas_cargadas,
       count(*) filter (where embedding is null) as pendientes_de_embedding
  from public.maria_knowledge
 where source like 'rag-maria/%';
