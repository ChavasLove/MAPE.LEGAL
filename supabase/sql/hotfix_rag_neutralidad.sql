-- =============================================================================
-- hotfix_rag_neutralidad.sql — limpieza del RAG de María (maria_knowledge)
-- hotfix/neutralidad-politica, 11-nov-2026
--
-- NO SE EJECUTA DESDE EL REPO NI EN CI. Lo corre UN HUMANO en Supabase Studio →
-- SQL Editor, DESPUÉS del deploy del hotfix (el merge del código no limpia
-- producción). Orden:
--   1. Correr el bloque completo (crea el respaldo antes de tocar nada).
--   2. Revisar la SELECT de vista previa (filas afectadas) — si algo no cuadra,
--      ROLLBACK y consultar a Willis.
--   3. La SELECT diagnóstica final DEBE devolver 0 filas.
--   4. Regenerar embeddings desde /admin/maria/rag-health → "Completar"
--      (las filas modificadas quedan con embedding = NULL a propósito).
--
-- Qué limpia:
--   (a) Respaldo: public.maria_knowledge_backup_hotfix_neutralidad_20261111.
--   (b) Compradores nombrados (Zekaii, Chiopa, Liopa, Alfilo; sin distinguir
--       mayúsculas): se reemplazan en title/content por el término neutro
--       ("el comercializador" para la compradora intermedia; "la refinería de
--       destino" para la refinería) y la fila queda con embedding = NULL.
--   (c) Contenido político partidario: se BORRAN las filas que nombren partidos,
--       candidatos (en contexto electoral), elecciones (generales/presidenciales/
--       primarias/internas) o políticos hondureños (lista abajo, patrones con
--       nombre completo — "Zelaya" a secas es también apellido de datos demo del
--       repo, así que NO se usa solo).
--       DECISIÓN DOCUMENTADA (revisable por Willis): antes del DELETE se REDACTA
--       la mención en los dominios legales ('honduras-ambiental/', 'honduras-
--       mineria/', 'rag-maria/') cuando es FACTUAL: firmante de un decreto,
--       administración emisora, "gobierno de X", "presidencia de X", partido entre
--       paréntesis (p. ej. la firma del Decreto 181-2007, la cabecera del SLAS-2,
--       el marco institucional 2026). Eso es cronología del documento, no opinión
--       partidaria, y borrar esas filas destruiría conocimiento legal (Arts. 28-A
--       / 29-C, los 16 requisitos SLAS-2, marco institucional). Tras la redacción,
--       el DELETE solo alcanza filas con contenido partidario real. Si Willis
--       prefiere borrar también las transcripciones, comentar el bloque (c1).
--   (d) Diagnóstico final: ninguna fila con compradores ni términos políticos.
--
-- Idempotente: re-ejecutable (el respaldo no se pisa; los UPDATE/DELETE no
-- encuentran nada la segunda vez).
-- =============================================================================

begin;

-- (a) Respaldo previo — solo la primera vez.
create table if not exists public.maria_knowledge_backup_hotfix_neutralidad_20261111
  as select * from public.maria_knowledge;

-- Vista previa: qué filas se van a tocar (revisar antes de seguir).
select id, source, title,
       (title || ' ' || content) ~* '\m(zekaii|chiopa|liopa|alfilo)\M'                         as comprador_nombrado,
       (title || ' ' || content) ~* '(jos[eé] manuel zelaya rosales|manuel zelaya rosales|xiomara castro|nasry asfura|salvador nasralla|juan orlando hern[aá]ndez|rixi moncada|luis zelaya)' as politico_nombrado,
       (title || ' ' || content) ~* '(partido nacional|partido liberal|partido libre|libertad y refundaci[oó]n|\(libre\)|partido salvador de honduras|\mPSH\M|\mPINU\M|democracia cristiana|candidat(o|a|os|as|ura)s?\s+(presidencial|a\s+la\s+presidencia|del\s+partido)|elecciones\s+(generales|presidenciales|primarias|internas))' as termino_partidario
  from public.maria_knowledge
 where (title || ' ' || content) ~* '\m(zekaii|chiopa|liopa|alfilo)\M'
    or (title || ' ' || content) ~* '(jos[eé] manuel zelaya rosales|manuel zelaya rosales|xiomara castro|nasry asfura|salvador nasralla|juan orlando hern[aá]ndez|rixi moncada|luis zelaya)'
    or (title || ' ' || content) ~* '(partido nacional|partido liberal|partido libre|libertad y refundaci[oó]n|\(libre\)|partido salvador de honduras|\mPSH\M|\mPINU\M|democracia cristiana|candidat(o|a|os|as|ura)s?\s+(presidencial|a\s+la\s+presidencia|del\s+partido)|elecciones\s+(generales|presidenciales|primarias|internas))'
    or coalesce(metadata::text, '') ~* '(zekaii|chiopa|liopa|alfilo|xiomara castro|nasry asfura|zelaya rosales)'
 order by source, id;

-- (b) Compradores nombrados → término neutro. Primero la razón social completa,
--     luego el nombre suelto; la refinería y sus variantes → "la refinería de destino".
update public.maria_knowledge
   set title   = regexp_replace(
                   regexp_replace(
                     regexp_replace(title, 'Inversiones\s+Zekaii(,?\s*S\.?\s*de\s*R\.?\s*L\.?)?', 'el comercializador', 'gi'),
                     '\mZekaii\M', 'el comercializador', 'gi'),
                   '(Chiopa(\s+Industrias)?|\mLiopa\M|\mAlfilo\M)', 'la refinería de destino', 'gi'),
       content = regexp_replace(
                   regexp_replace(
                     regexp_replace(content, 'Inversiones\s+Zekaii(,?\s*S\.?\s*de\s*R\.?\s*L\.?)?', 'el comercializador', 'gi'),
                     '\mZekaii\M', 'el comercializador', 'gi'),
                   '(Chiopa(\s+Industrias)?|\mLiopa\M|\mAlfilo\M)', 'la refinería de destino', 'gi'),
       metadata = case when metadata is null then null else
                   regexp_replace(
                     regexp_replace(
                       regexp_replace(metadata::text, 'Inversiones\s+Zekaii(,?\s*S\.?\s*de\s*R\.?\s*L\.?)?', 'el comercializador', 'gi'),
                       '\mZekaii\M', 'el comercializador', 'gi'),
                     '(Chiopa(\s+Industrias)?|\mLiopa\M|\mAlfilo\M)', 'la refinería de destino', 'gi')::jsonb end,
       embedding  = null,
       updated_at = now()
 where (title || ' ' || content || ' ' || coalesce(metadata::text, '')) ~* '\m(zekaii|chiopa|liopa|alfilo)\M';

-- (c1) Menciones FACTUALES en los dominios legales (source 'honduras-%' y
--      'rag-maria/%'): firmante de un decreto, administración emisora, "gobierno
--      de X", "presidencia de X", partido entre paréntesis. Se REDACTA el nombre
--      (persona o partido) y se conserva el instrumento legal y la cronología.
--      Esto no es opinión partidaria; borrar la fila destruiría conocimiento
--      legal (Arts. 28-A / 29-C, requisitos SLAS-2, marco institucional 2026).
--      Se aplica también a metadata (los seeds guardan el emisor ahí).
create or replace function pg_temp.neutralizar(t text) returns text language sql immutable as $f$
  select regexp_replace(
           regexp_replace(
             regexp_replace(
               regexp_replace(
                 regexp_replace(
                   regexp_replace(
                     regexp_replace(
                       regexp_replace(t,
                         '\s*\((Partido\s+Nacional|Partido\s+Liberal|Partido\s+Libre|Libertad\s+y\s+Refundaci[oó]n|Libre|PSH|PINU|Democracia\s+Cristiana)\)', '', 'gi'),
                       '(el\s+)?gobierno\s+de\s+(Nasry\s+Asfura|Xiomara\s+Castro|Juan\s+Orlando\s+Hern[aá]ndez|Manuel\s+Zelaya\s+Rosales)', 'el Gobierno de la República', 'gi'),
                     'presidencia\s+de\s+(Nasry\s+Asfura|Xiomara\s+Castro|Juan\s+Orlando\s+Hern[aá]ndez)', 'nueva administración del Poder Ejecutivo', 'gi'),
                   '(President[ea]\s+)?(Xiomara\s+Castro|Nasry\s+Asfura|Salvador\s+Nasralla|Juan\s+Orlando\s+Hern[aá]ndez|Rixi\s+Moncada|Luis\s+Zelaya)', 'titular del Poder Ejecutivo (nombre omitido por neutralidad política)', 'gi'),
                 '(JOS[EÉ]\s+MANUEL\s+ZELAYA\s+ROSALES|Jos[eé]\s+Manuel\s+Zelaya\s+Rosales|Manuel\s+Zelaya\s+Rosales)', 'Presidente de la República (nombre omitido por neutralidad política)', 'g'),
               '(Partido\s+Nacional|Partido\s+Liberal|Partido\s+Libre|Libertad\s+y\s+Refundaci[oó]n|Partido\s+Salvador\s+de\s+Honduras|\mPSH\M|\mPINU\M|Democracia\s+Cristiana)', 'partido político (nombre omitido por neutralidad política)', 'gi'),
             'candidat(o|a|os|as|ura|uras)\s+(presidencial(es)?|a\s+la\s+presidencia|del\s+partido)', 'aspirante (referencia omitida por neutralidad política)', 'gi'),
           'elecciones\s+(generales|presidenciales|primarias|internas)(\s+de\s+\d{4})?', 'el proceso electoral correspondiente', 'gi')
$f$;

update public.maria_knowledge
   set title      = pg_temp.neutralizar(title),
       content    = pg_temp.neutralizar(content),
       metadata   = case when metadata is null then null else pg_temp.neutralizar(metadata::text)::jsonb end,
       embedding  = null,
       updated_at = now()
 where (source like 'honduras-%' or source like 'rag-maria/%')
   and (title || ' ' || content || ' ' || coalesce(metadata::text, '')) ~* '(manuel zelaya rosales|xiomara castro|nasry asfura|salvador nasralla|juan orlando hern[aá]ndez|rixi moncada|luis zelaya|partido nacional|partido liberal|partido libre|libertad y refundaci[oó]n|\(libre\)|partido salvador de honduras|\mPSH\M|\mPINU\M|democracia cristiana|candidat(o|a|os|as|ura)s?\s+(presidencial|a\s+la\s+presidencia|del\s+partido)|elecciones\s+(generales|presidenciales|primarias|internas))';

-- (c2) Contenido político partidario RESTANTE (fuera de los dominios legales, o
--      que la redacción no resolvió) → BORRAR la fila completa.
delete from public.maria_knowledge
 where (title || ' ' || content || ' ' || coalesce(metadata::text, '')) ~* '(partido nacional|partido liberal|partido libre|libertad y refundaci[oó]n|\(libre\)|partido salvador de honduras|\mPSH\M|\mPINU\M|democracia cristiana|candidat(o|a|os|as|ura)s?\s+(presidencial|a\s+la\s+presidencia|del\s+partido)|elecciones\s+(generales|presidenciales|primarias|internas))'
    or (title || ' ' || content || ' ' || coalesce(metadata::text, '')) ~* '(jos[eé] manuel zelaya rosales|manuel zelaya rosales|xiomara castro|nasry asfura|salvador nasralla|juan orlando hern[aá]ndez|rixi moncada|luis zelaya)';

commit;

-- (d) Diagnóstico final — DEBE devolver 0 filas (title + content + metadata).
select id, source, title
  from public.maria_knowledge
 where (title || ' ' || content || ' ' || coalesce(metadata::text, '')) ~* '\m(zekaii|chiopa|liopa|alfilo)\M'
    or (title || ' ' || content || ' ' || coalesce(metadata::text, '')) ~* '(jos[eé] manuel zelaya rosales|manuel zelaya rosales|xiomara castro|nasry asfura|salvador nasralla|juan orlando hern[aá]ndez|rixi moncada|luis zelaya)'
    or (title || ' ' || content || ' ' || coalesce(metadata::text, '')) ~* '(partido nacional|partido liberal|partido libre|libertad y refundaci[oó]n|\(libre\)|partido salvador de honduras|\mPSH\M|\mPINU\M|democracia cristiana|candidat(o|a|os|as|ura)s?\s+(presidencial|a\s+la\s+presidencia|del\s+partido)|elecciones\s+(generales|presidenciales|primarias|internas))';

-- Conteo de filas pendientes de re-embedding (las tocadas arriba).
select count(*) as pendientes_de_embedding
  from public.maria_knowledge
 where embedding is null;
