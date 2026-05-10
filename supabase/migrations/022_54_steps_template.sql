-- 007: Seed plantillas_tareas — Manual Operativo CHT 2026
-- 54 pasos del Paquete Formalización Minera (5 fases)
-- + 8 pasos Titulación de Propiedad
-- + 6 pasos Contrato Sociedad Minera
-- Total: 68 plantillas. The canonical "54 steps" = proceso formalizacion.

insert into plantillas_tareas
  (proceso, fase_numero, numero_paso, nombre, descripcion, rol_responsable, plazo_dias, evidencia_requerida, evidencia_descripcion)
values

-- ═══════════════════════════════════════════════════════════════════
-- PROCESO: FORMALIZACIÓN MINERA (54 pasos)
-- ═══════════════════════════════════════════════════════════════════

-- ─── FASE 0 · ONBOARDING (Pasos 1–6) ────────────────────────────
('formalizacion', 0, 1,
 'Firma contrato de servicios CHT',
 'Firma del contrato de servicios entre el cliente y CHT. Activa el Hito 1 (30%).',
 'admin', 3, true, 'Contrato firmado por ambas partes — original escaneado'),

('formalizacion', 0, 2,
 'Verificación RTN del cliente',
 'Obtención y autenticación del RTN ante la SAR.',
 'tecnico_ambiental', 5, true, 'RTN autenticado en original'),

('formalizacion', 0, 3,
 'Verificación DPI del cliente',
 'Copia autenticada del DPI vigente del minero.',
 'tecnico_ambiental', 3, true, 'DPI vigente — copia autenticada'),

('formalizacion', 0, 4,
 'Verificación escritura del terreno',
 'Revisión jurídica del título de propiedad o derecho de posesión sobre el área a explotar.',
 'abogado', 7, true, 'Escritura o constancia de posesión verificada'),

('formalizacion', 0, 5,
 'Visita de campo — geolocalización UTM',
 'Visita al sitio minero. Registro de coordenadas UTM y fotografías georreferenciadas.',
 'tecnico_ambiental', 10, true, 'Reporte de campo con coordenadas UTM + mínimo 5 fotos GPS'),

('formalizacion', 0, 6,
 'Apertura formal expediente MAPE.LEGAL',
 'Asignación del número EXP-YYYY-NNN, creación del expediente digital y asignación de equipo.',
 'admin', 2, true, 'Número de expediente asignado — confirmación del sistema'),

-- ─── FASE 1 · INHGEOMIN (Pasos 7–19) ────────────────────────────
('formalizacion', 1, 7,
 'Consulta SIMHON — disponibilidad del área',
 'Verificar en el sistema SIMHON que el área no está concesionada ni en trámite.',
 'abogado', 5, true, 'Pantalla o constancia SIMHON firmada'),

('formalizacion', 1, 8,
 'Verificación de no superposición con concesiones activas',
 'Revisión de superposición con concesiones existentes y áreas protegidas.',
 'abogado', 5, true, 'Informe de superposición firmado'),

('formalizacion', 1, 9,
 'Elaboración formulario de solicitud INHGEOMIN (F-1)',
 'Preparación del formulario oficial F-1 de solicitud de concesión de exploración o explotación.',
 'abogado', 7, true, 'Formulario F-1 completado y firmado'),

('formalizacion', 1, 10,
 'Obtención RTN notariado',
 'RTN del cliente autenticado ante notario público.',
 'tecnico_ambiental', 5, true, 'RTN notariado — original'),

('formalizacion', 1, 11,
 'Certificación DPI ante notario público',
 'DPI del cliente certificado ante notario.',
 'tecnico_ambiental', 5, true, 'DPI certificado ante notario'),

('formalizacion', 1, 12,
 'Certificación escritura del terreno',
 'Escritura del terreno certificada ante notario y con sello del RNP.',
 'abogado', 7, true, 'Escritura certificada con sello RNP'),

('formalizacion', 1, 13,
 'Certificación plano catastral del área',
 'Plano catastral del área solicitada, certificado por el catastro municipal.',
 'abogado', 10, true, 'Plano catastral certificado'),

('formalizacion', 1, 14,
 'Obtención garantía bancaria',
 'El cliente obtiene la garantía bancaria exigida por INHGEOMIN para la solicitud.',
 'cliente', 15, true, 'Garantía bancaria original o constancia bancaria'),

('formalizacion', 1, 15,
 'Elaboración memoria descriptiva del área',
 'Documento técnico que describe el área: coordenadas, extensión, minerales esperados.',
 'abogado', 7, true, 'Memoria descriptiva firmada'),

('formalizacion', 1, 16,
 'Elaboración programa de trabajo y producción',
 'Plan técnico de las actividades de exploración/explotación y estimados de producción.',
 'tecnico_ambiental', 10, true, 'Programa de trabajo aprobado por CHT'),

('formalizacion', 1, 17,
 'Depósito formal de solicitud ante INHGEOMIN',
 'Presentación física del expediente completo ante las ventanillas de INHGEOMIN.',
 'abogado', 3, true, 'Recibo oficial de depósito INHGEOMIN'),

('formalizacion', 1, 18,
 'Publicación en La Gaceta / periódico de circulación nacional',
 'Publicación del edicto de solicitud según lo exige la Ley de Minería.',
 'abogado', 15, true, 'Ejemplar del periódico con publicación — página completa'),

('formalizacion', 1, 19,
 'Recepción constancia provisional INHGEOMIN',
 'INHGEOMIN emite la constancia provisional de recepción. Activa el Hito 2 (40%).',
 'abogado', 30, true, 'Constancia provisional INHGEOMIN firmada y sellada'),

-- ─── FASE 2 · SERNA / MiAmbiente (Pasos 20–31) ──────────────────
('formalizacion', 2, 20,
 'Categorización ambiental SLAS-2',
 'Elaboración y presentación de la ficha de categorización ambiental SLAS-2 ante SERNA.',
 'tecnico_ambiental', 10, true, 'Ficha SLAS-2 sellada por SERNA'),

('formalizacion', 2, 21,
 'Visita de campo ambiental',
 'Inspección del sitio minero por técnico ambiental. Fotos georreferenciadas y muestras.',
 'tecnico_ambiental', 7, true, 'Informe de campo ambiental + mínimo 10 fotos GPS'),

('formalizacion', 2, 22,
 'Documentación consulta ILO 169',
 'Preparación y registro de la constancia de la Consulta Previa Libre e Informada (ILO 169).',
 'abogado', 14, true, 'Constancia ILO 169 firmada por comunidad y autoridades'),

('formalizacion', 2, 23,
 'Elaboración Estudio de Impacto Ambiental (EIA)',
 'Redacción del EIA completo conforme a los términos de referencia de SERNA.',
 'tecnico_ambiental', 21, true, 'EIA borrador revisado internamente por CHT'),

('formalizacion', 2, 24,
 'Revisión jurídica del EIA',
 'El abogado CHT revisa el EIA antes de presentarlo ante SERNA.',
 'abogado', 5, true, 'EIA revisado y firmado por abogado CHT'),

('formalizacion', 2, 25,
 'Presentación EIA ante SERNA',
 'Entrega formal del EIA y documentos complementarios ante la ventanilla de SERNA.',
 'abogado', 3, true, 'Recibo oficial de presentación SERNA'),

('formalizacion', 2, 26,
 'Seguimiento revisión SERNA',
 'Monitoreo del estado de revisión del EIA por parte de los técnicos de SERNA.',
 'abogado', 30, true, 'Estado de revisión documentado + fecha de próxima acción'),

('formalizacion', 2, 27,
 'Respuesta a observaciones SERNA',
 'Elaboración y presentación de respuestas a las observaciones emitidas por SERNA.',
 'tecnico_ambiental', 14, true, 'Respuestas documentadas + recibo de presentación SERNA'),

('formalizacion', 2, 28,
 'Recepción licencia ambiental',
 'SERNA emite la licencia ambiental definitiva.',
 'abogado', 45, true, 'Licencia ambiental original firmada y sellada por SERNA'),

('formalizacion', 2, 29,
 'Registro de licencia ambiental en el expediente',
 'Digitalización y registro de la licencia en el expediente MAPE.LEGAL.',
 'admin', 2, true, 'Número de licencia ambiental registrado en sistema'),

('formalizacion', 2, 30,
 'Notificación al cliente — licencia ambiental obtenida',
 'Comunicación formal al cliente de la obtención de la licencia ambiental.',
 'admin', 2, true, 'Constancia de notificación enviada (WA o correo)'),

('formalizacion', 2, 31,
 'Verificación vigencia de la licencia ambiental',
 'Confirmación de que la licencia está activa y dentro del plazo de vigencia.',
 'abogado', 3, true, 'Verificación de vigencia confirmada'),

-- ─── FASE 3 · RESOLUCIÓN MINERA INHGEOMIN (Pasos 32–42) ─────────
('formalizacion', 3, 32,
 'Seguimiento expediente en INHGEOMIN',
 'Monitoreo activo del estado del expediente. Visitas a INHGEOMIN según necesario.',
 'abogado', 14, true, 'Reporte de estado actualizado'),

('formalizacion', 3, 33,
 'Gestión de oposiciones de terceros',
 'En caso de oposición de terceros, elaborar y presentar el escrito de respuesta.',
 'abogado', 10, false, 'Escrito de oposición presentado (si aplica)'),

('formalizacion', 3, 34,
 'Audiencia ante INHGEOMIN',
 'Representación legal en la audiencia de resolución de oposiciones (si aplica).',
 'abogado', 5, false, 'Acta de audiencia firmada (si aplica)'),

('formalizacion', 3, 35,
 'Recepción resolución definitiva INHGEOMIN',
 'INHGEOMIN emite la resolución administrativa aprobando o denegando la concesión.',
 'abogado', 60, true, 'Resolución definitiva INHGEOMIN — original'),

('formalizacion', 3, 36,
 'Notificación al cliente — resolución minera',
 'Comunicación formal al cliente de la resolución recibida.',
 'admin', 2, true, 'Constancia de notificación enviada'),

('formalizacion', 3, 37,
 'Registro de resolución en el expediente',
 'Digitalización y registro de la resolución.',
 'admin', 2, true, 'Resolución registrada en sistema'),

('formalizacion', 3, 38,
 'Recepción credencial / licencia minera',
 'Recepción física de la credencial o licencia minera emitida por INHGEOMIN.',
 'abogado', 14, true, 'Credencial / licencia minera original'),

('formalizacion', 3, 39,
 'Inscripción en el Registro Nacional de Minería',
 'Trámite de inscripción de la concesión en el RNM.',
 'abogado', 10, true, 'Constancia de inscripción RNM'),

('formalizacion', 3, 40,
 'Elaboración plan de producción inicial',
 'Documento técnico con el plan de extracción y procesamiento de minerales.',
 'tecnico_ambiental', 14, true, 'Plan de producción aprobado'),

('formalizacion', 3, 41,
 'Verificación operación legalmente habilitada',
 'Revisión legal de que todos los permisos están activos y en regla.',
 'abogado', 5, true, 'Informe de verificación legal firmado'),

('formalizacion', 3, 42,
 'Cierre Fase 3 — informe de progreso',
 'Informe interno de cierre de la Fase 3 y preparación para Fase 4.',
 'admin', 3, true, 'Informe de cierre Fase 3'),

-- ─── FASE 4 · MUNICIPAL + COMERCIALIZADOR (Pasos 43–54) ─────────
('formalizacion', 4, 43,
 'Solicitud de permiso municipal de operación',
 'Presentación de solicitud de permiso ante la Alcaldía Municipal correspondiente.',
 'abogado', 7, true, 'Solicitud firmada con sello de recibido'),

('formalizacion', 4, 44,
 'Presentación de documentos ante la Municipalidad',
 'Entrega del paquete completo de documentos exigidos por la municipalidad.',
 'abogado', 5, true, 'Recibo de presentación municipal'),

('formalizacion', 4, 45,
 'Inspección municipal del sitio minero',
 'Acompañamiento a los técnicos municipales en visita de inspección.',
 'tecnico_ambiental', 14, true, 'Acta de inspección municipal (si aplica)'),

('formalizacion', 4, 46,
 'Recepción permiso municipal',
 'La Alcaldía emite el permiso de operación municipal.',
 'abogado', 30, true, 'Permiso municipal original firmado y sellado'),

('formalizacion', 4, 47,
 'Registro de permiso municipal en el expediente',
 'Digitalización y registro del permiso municipal.',
 'admin', 2, true, 'Permiso municipal registrado en sistema'),

('formalizacion', 4, 48,
 'Solicitud de registro como comercializador de oro',
 'Presentación de solicitud de registro como comercializador ante autoridad competente.',
 'abogado', 7, true, 'Solicitud de registro como comercializador'),

('formalizacion', 4, 49,
 'Documentos para el registro como comercializador',
 'Preparación y entrega del paquete documental para el registro de comercializador.',
 'abogado', 7, true, 'Paquete documental entregado — recibo de presentación'),

('formalizacion', 4, 50,
 'Seguimiento aprobación registro de comercializador',
 'Monitoreo del estado de aprobación del registro.',
 'abogado', 21, true, 'Estado de trámite documentado'),

('formalizacion', 4, 51,
 'Recepción certificado de comercializador autorizado',
 'Recepción del certificado que habilita al cliente para comercializar oro.',
 'abogado', 30, true, 'Certificado de comercializador original'),

('formalizacion', 4, 52,
 'Cierre del expediente — informe final y Hito 3',
 'Cierre formal del proceso de formalización. Activa el Hito 3 (30%). Entrega de todos los originales.',
 'admin', 5, true, 'Informe final + acta de entrega de originales firmada por cliente'),

('formalizacion', 4, 53,
 'Emisión Certificate of Origin (CoO)',
 'Generación automática del Certificate of Origin con toda la evidencia compilada.',
 'admin', 3, true, 'Certificate of Origin firmado y sellado CHT'),

('formalizacion', 4, 54,
 'Archivado digital del expediente',
 'Archivado definitivo de todos los documentos en el sistema MAPE.LEGAL.',
 'admin', 3, true, 'Confirmación de archivado digital completo'),

-- ═══════════════════════════════════════════════════════════════════
-- PROCESO: TITULACIÓN DE PROPIEDAD (8 pasos)
-- ═══════════════════════════════════════════════════════════════════
('titulacion', 0, 1,
 'Estudio de título y situación registral',
 'Investigación del historial de propiedad y estado en el Registro Nacional de la Propiedad.',
 'abogado', 10, true, 'Informe de estudio de título'),

('titulacion', 0, 2,
 'Elaboración demanda/solicitud de titulación',
 'Redacción del escrito legal para iniciar el proceso de titulación ante el IP.',
 'abogado', 7, true, 'Demanda o solicitud redactada'),

('titulacion', 0, 3,
 'Presentación ante el Instituto de la Propiedad (IP)',
 'Depósito formal de la solicitud ante el IP.',
 'abogado', 3, true, 'Recibo oficial del Instituto de la Propiedad'),

('titulacion', 0, 4,
 'Inspección del IP en el predio',
 'Los técnicos del IP realizan la inspección y medición del terreno.',
 'externo', 30, true, 'Acta de inspección del IP'),

('titulacion', 0, 5,
 'Resolución definitiva del IP',
 'El IP emite la resolución aprobando la titulación.',
 'externo', 60, true, 'Resolución definitiva del IP'),

('titulacion', 0, 6,
 'Elaboración escritura de propiedad',
 'Redacción de la escritura pública de propiedad por notario asignado por CHT.',
 'abogado', 7, true, 'Escritura de propiedad redactada'),

('titulacion', 0, 7,
 'Firma escritura ante notario público',
 'Firma de la escritura por el propietario ante el notario.',
 'cliente', 5, true, 'Escritura firmada — original'),

('titulacion', 0, 8,
 'Registro en el RNP e inscripción catastral',
 'Inscripción de la escritura en el Registro Nacional de la Propiedad y catastro municipal.',
 'abogado', 14, true, 'Escritura inscrita con folio real del RNP'),

-- ═══════════════════════════════════════════════════════════════════
-- PROCESO: CONTRATO SOCIEDAD MINERA (6 pasos)
-- ═══════════════════════════════════════════════════════════════════
('sociedad_minera', 0, 1,
 'Análisis de estructura societaria',
 'Revisión de los términos entre minero y propietario: distribución de beneficios, plazos, cláusulas.',
 'abogado', 5, true, 'Informe de análisis societario'),

('sociedad_minera', 0, 2,
 'Redacción del contrato de sociedad minera',
 'Elaboración del contrato con cláusulas de distribución, permanencia y resolución.',
 'abogado', 7, true, 'Borrador del contrato'),

('sociedad_minera', 0, 3,
 'Revisión y firma del minero',
 'El minero revisa y firma el contrato de sociedad.',
 'cliente', 5, true, 'Contrato firmado por el minero'),

('sociedad_minera', 0, 4,
 'Revisión y firma del propietario del terreno',
 'El propietario revisa y firma el contrato de sociedad.',
 'cliente', 5, true, 'Contrato firmado por el propietario'),

('sociedad_minera', 0, 5,
 'Legalización notarial del contrato',
 'El contrato es protocolizado ante notario público.',
 'abogado', 5, true, 'Contrato protocolizado — original notariado'),

('sociedad_minera', 0, 6,
 'Registro del contrato en el sistema MAPE.LEGAL',
 'Archivado digital y registro del contrato en el expediente.',
 'admin', 2, true, 'Contrato registrado en sistema — número de referencia asignado')

on conflict (proceso, numero_paso) do nothing;

-- ─── tipos_tramite catalog ────────────────────────────────────────────────────
insert into tipos_tramite (id, nombre, descripcion, total_pasos) values
  ('formalizacion',   'Paquete Formalización Minera',   'INHGEOMIN + SERNA + Municipal + Comercializador. 5 fases, 54 pasos.', 54),
  ('titulacion',      'Titulación de Propiedad',        'Proceso de regularización del derecho de propiedad ante el IP. 8 pasos.', 8),
  ('sociedad_minera', 'Contrato de Sociedad Minera',    'Estructura legal entre minero y propietario. 6 pasos.', 6)
on conflict (id) do nothing;
