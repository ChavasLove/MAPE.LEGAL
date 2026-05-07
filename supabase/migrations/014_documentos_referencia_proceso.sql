-- 014: Add `proceso` to documentos_referencia and seed titulación + sociedad
--
-- Migration 012 created the table with a single unique index on paso_numero,
-- which only worked because we only stored the 38 formalización steps. To
-- cover the other two services (titulación de propiedad, contrato de sociedad
-- minera) we need to scope paso numbering by proceso.

-- ─── Schema change ───────────────────────────────────────────────────────────
alter table documentos_referencia
  add column if not exists proceso text;

-- Backfill existing rows: all 38 pre-existing entries are formalización steps.
update documentos_referencia
   set proceso = 'formalizacion'
 where proceso is null;

alter table documentos_referencia
  alter column proceso set not null;

alter table documentos_referencia
  drop constraint if exists documentos_referencia_proceso_check;

alter table documentos_referencia
  add constraint documentos_referencia_proceso_check
  check (proceso in ('formalizacion', 'titulacion', 'sociedad'));

-- The production table has extra NOT NULL columns (e.g. documento_nombre,
-- categoria) added outside the migration system. New process rows don't
-- populate those columns, so drop NOT NULL on every column except the ones
-- this migration actually inserts into.
do $$
declare
  col record;
begin
  for col in
    select column_name
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'documentos_referencia'
       and is_nullable = 'NO'
       and column_name not in (
         'id', 'paso_numero', 'titulo_paso', 'proceso'
       )
  loop
    execute format(
      'alter table documentos_referencia alter column %I drop not null',
      col.column_name
    );
  end loop;
end $$;

-- Replace single-column unique index with composite (proceso, paso_numero).
-- The old index must be dropped BEFORE the dedupe step, otherwise dedupe is
-- a no-op (the old index already prevented duplicate paso_numero values).
drop index if exists idx_documentos_referencia_paso;

-- Dedupe before creating the new unique index. Some deployments accumulated
-- duplicate (proceso, paso_numero) rows because the original migration 012
-- declared the unique index but the table existed earlier without it. Keep
-- one row per pair (arbitrary which — duplicates have identical content).
with ranked as (
  select id,
         row_number() over (
           partition by proceso, paso_numero
           order by id
         ) as rn
    from documentos_referencia
)
delete from documentos_referencia
 where id in (select id from ranked where rn > 1);

create unique index if not exists idx_documentos_referencia_proceso_paso
  on documentos_referencia (proceso, paso_numero);

create index if not exists idx_documentos_referencia_proceso
  on documentos_referencia (proceso);

-- ─── Seed: PROCESO 2 — TITULACIÓN DE PROPIEDAD (9 pasos) ─────────────────────
insert into documentos_referencia
  (proceso, paso_numero, titulo_paso, rol, acciones, documentos, plazo, deliverable, advertencias)
values
  ('titulacion', 1,
   'Clasificación jurídica de la tierra',
   'Abogado CHT',
   'Determinar si la tierra es nacional, ejidal, privada sin catastro, o tenencia por posesión. De esto depende toda la ruta legal.',
   'Mapa de ubicación, datos del solicitante, referencia catastral si existe.',
   '3-5 días hábiles',
   'Dictamen de clasificación jurídica firmado.',
   'Tierra en áreas protegidas o territorios indígenas NO puede titularse. Si el dictamen lo confirma, el proceso se detiene aquí.'),
  ('titulacion', 2,
   'Investigación de antecedentes registrales',
   'Abogado CHT',
   'Consultar Instituto de la Propiedad (IP), municipalidad e INA para detectar títulos previos, gravámenes o conflictos.',
   'Solvencia municipal, dictamen del paso 1, datos del solicitante.',
   '7-15 días hábiles',
   'Reporte de antecedentes con conclusiones de viabilidad.',
   'Si aparece otro título inscrito sobre la misma área, el trámite se complica significativamente — coordinar con el cliente antes de continuar.'),
  ('titulacion', 3,
   'Levantamiento topográfico',
   'Topógrafo habilitado (subcontratado por CHT)',
   'Medición física del terreno, marcado de mojones, generación de plano georreferenciado.',
   'Acceso al terreno, presencia del propietario o representante autorizado.',
   '5-10 días según extensión',
   'Plano topográfico firmado y sellado por topógrafo habilitado.',
   'Sin plano habilitado el INA/IP rechaza la solicitud. Verificar que el topógrafo esté en la lista habilitada vigente.'),
  ('titulacion', 4,
   'Solicitud de titulación',
   'Abogado CHT + Cliente',
   'Redactar la solicitud formal con todos los anexos. El cliente debe presentar mínimo 2 testigos hondureños adultos.',
   'Plano del paso 3, dictamen del paso 1, identidad y RTN del solicitante, identidad de los 2 testigos.',
   '2-3 días para redacción',
   'Expediente de solicitud completo listo para presentar.',
   'Los testigos deben ser hondureños mayores de edad sin parentesco con el solicitante hasta segundo grado. Verificar antes.'),
  ('titulacion', 5,
   'Presentación ante INA o Instituto de la Propiedad',
   'Abogado CHT',
   'Ingresar el expediente en la institución correspondiente según la clasificación del paso 1.',
   'Expediente del paso 4, comprobante de pago de tasas administrativas.',
   '1-2 días hábiles',
   'Constancia de recepción con número de expediente oficial.',
   'INA atiende tierras nacionales y ejidales. IP atiende tierras privadas. No mezclar — el expediente entra por la vía equivocada y se devuelve.'),
  ('titulacion', 6,
   'Acompañamiento en inspección de campo',
   'Abogado CHT + Topógrafo + Cliente',
   'Presencia coordinada el día de la inspección oficial. El cliente debe estar presente o representado.',
   'Plano topográfico, dictamen, expediente de solicitud.',
   'Fecha asignada por la institución (típicamente 30-45 días después del paso 5)',
   'Acta de inspección firmada por el inspector institucional.',
   'Si el cliente no se presenta y no hay representante con poder, la inspección se reprograma y se pierden 30+ días.'),
  ('titulacion', 7,
   'Seguimiento División de Titulación INA',
   'Abogado CHT',
   'Visitas periódicas a la división, respuesta a observaciones técnicas, gestión de dictámenes internos.',
   'Expediente activo en el sistema institucional.',
   '60-120 días proceso interno',
   'Dictamen final favorable de la División de Titulación.',
   'Las observaciones técnicas tienen plazos cortos de respuesta (5-10 días). No responder a tiempo cierra el expediente.'),
  ('titulacion', 8,
   'Inscripción en Registro de la Propiedad',
   'Abogado CHT',
   'Llevar el título emitido al Registro de la Propiedad correspondiente para su inscripción definitiva.',
   'Título emitido del paso 7, comprobante de pago de impuestos de inscripción.',
   '15-30 días hábiles',
   'Asiento de inscripción con número y folio en el Registro.',
   'SIN inscripción el título NO vale para el trámite minero ni para garantía bancaria. Es el paso que muchos clientes intentan saltar — no se permite.'),
  ('titulacion', 9,
   'Entrega del título al cliente',
   'Abogado CHT',
   'Entrega física del título inscrito al cliente, con copia certificada para el archivo CHT.',
   'Título inscrito del paso 8.',
   '1 día',
   'Acta de entrega firmada por el cliente y copia certificada en el expediente CHT.',
   'No entregar el original sin firma de acta. Si el cliente lo pierde después, CHT no responde por reposiciones.')
on conflict (proceso, paso_numero) do nothing;

-- ─── Seed: PROCESO 3 — CONTRATO DE SOCIEDAD MINERA (7 pasos) ─────────────────
insert into documentos_referencia
  (proceso, paso_numero, titulo_paso, rol, acciones, documentos, plazo, deliverable, advertencias)
values
  ('sociedad', 1,
   'Due diligence de ambas partes',
   'Abogado CHT',
   'Verificar identidad, capacidad legal, y antecedentes de minero y dueño de tierra.',
   'Identidad y RTN de minero, identidad y título de dueño de tierra, solvencia de ambos.',
   '3-5 días hábiles',
   'Dictamen de viabilidad del contrato.',
   'Si una parte tiene gravámenes o conflictos legales pendientes, no se debe firmar el contrato hasta resolverlos.'),
  ('sociedad', 2,
   'Reunión de acuerdo de términos',
   'Abogado CHT + ambas partes',
   'Acordar participación, obligaciones, plazos y condiciones de salida. Participación referencial 20-30% para el dueño de tierra.',
   'Datos del paso 1, propuesta inicial de términos.',
   '1 reunión (2-3 horas)',
   'Memorando de términos acordados firmado por ambas partes.',
   'NO comprometer porcentajes específicos sin entender la productividad estimada del área. La cifra 20-30% es referencial, no obligatoria.'),
  ('sociedad', 3,
   'Redacción del contrato',
   'Abogado CHT',
   'Redactar el contrato con las 13 cláusulas obligatorias y los términos acordados en el paso 2.',
   'Memorando del paso 2.',
   '3-5 días hábiles',
   'Borrador del contrato listo para revisión.',
   'Las 13 cláusulas obligatorias son no-negociables — incluyen distribución de utilidades, resolución de conflictos, salida anticipada, y cumplimiento normativo.'),
  ('sociedad', 4,
   'Revisión por ambas partes',
   'Ambas partes (con apoyo del abogado CHT)',
   'Lectura completa, observaciones, ajustes. Hasta 2 rondas de revisión incluidas en el precio.',
   'Borrador del paso 3.',
   '5-10 días según disponibilidad de las partes',
   'Versión final del contrato consensuada.',
   'A partir de la 3ra ronda de revisión hay costo adicional. Comunicarlo al cliente al inicio para evitar fricción.'),
  ('sociedad', 5,
   'Notarización',
   'Notario público + ambas partes',
   'Firma ante notario con presencia obligatoria de ambas partes con cédula vigente.',
   'Versión final del paso 4, cédulas vigentes de ambas partes.',
   '1 día (cita con notario)',
   'Contrato notariado en escritura pública.',
   'Sin presencia personal de AMBAS partes el notario no firma. No se acepta poder notarial salvo casos médicos documentados.'),
  ('sociedad', 6,
   'Registro en Instituto de la Propiedad',
   'Abogado CHT',
   'Inscribir la escritura pública en el Instituto de la Propiedad para que sea oponible a terceros.',
   'Escritura del paso 5, comprobante de pago de impuestos.',
   '15-30 días hábiles',
   'Asiento de inscripción en el Instituto de la Propiedad.',
   'Sin registro, el contrato vale entre las partes pero NO frente a terceros — riesgo si una parte vende su derecho a otra persona.'),
  ('sociedad', 7,
   'Entrega de copias certificadas',
   'Abogado CHT',
   'Entrega de copias certificadas a cada parte y archivo de copia en el expediente CHT.',
   'Escritura registrada del paso 6.',
   '1-2 días hábiles',
   'Acta de entrega firmada por cada parte y copia certificada en el archivo CHT.',
   'No entregar copias sin acta firmada. Si una parte solicita copias adicionales después, hay costo de certificación notarial.')
on conflict (proceso, paso_numero) do nothing;
