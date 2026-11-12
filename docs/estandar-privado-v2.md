# Estándar privado de debida diligencia MAPE.LEGAL — v2.0-BORRADOR (interno)

Documento interno (no se publica). Brief v2.1, Etapa 2, 12-nov-2026. Rama `feat/estandar-privado-v2`, PR borrador. Nada de lo descrito aquí es definitivo hasta la aprobación de CHT, CAPITÁN LEGAL y LEGAL MINERO.

Fuentes de verdad en código: `lib/content/estandar.ts` (versión, estado, estructura, mapeo OCDE), `lib/content/copy-legal.ts` (identidad, citas, `ESTANDAR_NATURALEZA`), `lib/cadena/types.ts` + `lib/cadena/reglas.ts` + `lib/cadena/hash.ts` (contrato y reglas puras), migración `043` (base de datos) y `tests/cadena.test.ts`.

## 1. Modelo aprobado y roles

MAPE.LEGAL es un **estándar privado de debida diligencia** de la cadena de oro que termina en una planta de beneficio participante. Es propio de esa cadena: no es un portal público de precios del Estado, no es un registro de INHGEOMIN y no está abierto a cualquier comercializador. El modelo público anterior (plataforma abierta a comercializadores, "Modelo B" del 10-nov con un comprador como dueño) quedó superseded por el hotfix de neutralidad del 11-nov y por este brief.

| Rol | Quién | Qué hace | Qué no hace |
|---|---|---|---|
| **Titular y desarrolladora** | Corporación Hondureña Tenka, S.A. (CHT) | Desarrolla y es titular de la plataforma y del estándar; administra roles; publica estructura, política y resumen de auditoría; presta servicios legales y mineros a los productores | No compra, no vende ni intermedia mineral; no es autoridad; no tiene aval de INHGEOMIN |
| **Comercializador** | Una sola organización de la cadena (en el modelo aprobado: Inversiones Zekaii, S. de R.L. — se nombra aquí una única vez; NUNCA en código ni en superficies públicas) | Paga a CHT el mantenimiento de la plataforma; registra fuentes; acopia y transporta lotes; paga al productor por medio bancario | **No funde** (ver §5); no es titular de la plataforma ni del estándar; es solo comercializador |
| **Planta de beneficio participante** | Organización destino de la cadena (nombre: [CONFIRMAR CON WILLIS]; no se nombra en público) | Paga al comercializador; recibe los lotes; accede al expediente del productor **solo con consentimiento informado vigente** | No ve márgenes del comercializador; no accede sin consentimiento |
| **Minero / productor** | Titular del derecho minero (permiso municipal de minería artesanal o permiso de pequeña minería) | Origina el lote; emite el Certificado de Origen oficial que autentica la autoridad; otorga o revoca el consentimiento | No paga la plataforma |
| **Auditor externo** | **Pendiente de nombrar** | Lectura y exportación; ciclo anual; su informe alimenta `/auditoria` | No escribe eventos |

En código, las organizaciones viven en la tabla `organizaciones` y se identifican por `tipo` (`comercializador`, `planta`, `auditor`). Los nombres propios son datos, nunca constantes.

## 2. Superficie pública vs privada

**Pública (sin sesión, ES-only, `PublicNav` + `SiteFooter`):**

| Ruta | Contenido | Fuente |
|---|---|---|
| `/quienes-somos` | CHT titular; propósito; qué hace y qué no; `CONFLICTO_INTERES_CHT` literal; canal de correcciones | `copy-legal.ts`, `estandar.ts` |
| `/estandar` | Versión, fecha y estado; 12 secciones con `[TEXTO PENDIENTE DE APROBACIÓN]`; aviso de borrador; tabla OCDE (5 pasos); referencias de diseño; nota del sello | `estandar.ts` |
| `/politica-de-cadena` | Versión, fecha y estado; 10 secciones (Anexo II OCDE como política privada) con placeholders | `estandar.ts` |
| `/auditoria` | `AUDITORIA_TEXTO_VACIO`; ciclo anual; qué publicará cuando exista informe | `estandar.ts` |
| `/aviso-legal` | Nota "Estándar privado de debida diligencia" (`ESTANDAR_NATURALEZA`) con enlaces | `copy-legal.ts` |

Lo público describe la cadena **solo** como `CADENA_DESCRIPCION_PUBLICA` ("la cadena de suministro de la planta de beneficio participante"). Sin compradores, sin ™/®, sin "pago el mismo día", sin aval/certificación/convenio de INHGEOMIN, SERNA, BCH, OCDE, LBMA o CRAFT (son referencias de diseño).

**Privada (sesión + rol; fuera de esta etapa de contenido):** registro de fuentes, lotes y eventos de custodia, pagos, consentimientos, alertas y bitácora — tablas de la migración 043, rutas `/api/cadena/*` y UI por rol. Ningún dato de lote, pago, consentimiento ni expediente es público.

## 3. Mapeo a los cinco pasos de la Guía OCDE

Misma tabla que `MAPEO_OCDE` en `lib/content/estandar.ts` (no hay sexto paso).

| Paso OCDE | Módulos / controles de la plataforma |
|---|---|
| 1. Sistemas de gestión | Titularidad de CHT; RBAC; registro de fuentes; cadena de custodia con hash encadenado; pagos bancarios; política publicada |
| 2. Identificar y evaluar riesgos | Bloqueo sin permiso vigente / fuera de área; mercurio cero por fuente; exclusión sin CLPI exigible; conciliación de pesos y alertas; detección de acceso sin consentimiento |
| 3. Estrategia frente a riesgos | Bloqueo de lote (efectivo, sin referencia bancaria, sin permiso, fundición no realizada por el titular de beneficio, diferencia sobre el umbral); bitácora; roles que no ven márgenes ajenos |
| 4. Auditoría independiente | Rol `auditor`; lectura/exportación; ciclo anual; resumen anual cuando exista informe real |
| 5. Informar anualmente | Página pública `/auditoria` con versión y fecha; vacío declarado hasta el primer informe; sin resultados inventados |

## 4. Controles: bloqueos y alertas

Reglas puras en `lib/cadena/reglas.ts` (espejo en los RPC/triggers de la 043):

| Control | Regla | Efecto |
|---|---|---|
| Pago | `validarPago`: medio ∈ {transferencia, depósito, cheque bancario} y referencia ≥ 4 caracteres | Efectivo, medio no admitido o sin referencia → **bloquea el lote** (`pago_invalido`) |
| Elegibilidad del origen | `evaluarElegibilidadFuente`: permiso municipal vigente a la fecha; `dentro_area_inhgeomin = true`; `clpi_estado ≠ pendiente` | Cualquier incumplimiento → **bloquea** (`fuente_no_elegible`, `clpi`); sin declaración de mercurio cero → **alerta** (`mercurio`), no bloquea |
| Fundición | `validarEventoFundicion`: rol ejecutor ≠ comercializador y titular de beneficio identificado (nombre + identificación) | Rechazo del evento (`fundicion_rechazada`) |
| Conciliación de pesos | `conciliarPesos` entre origen → acopio → laboratorio → refinado; umbral en `configuracion_sistema[umbral_conciliacion_peso_pct]` | Umbral `NULL` → nunca concilia y registra `umbral_no_configurado`; diferencia sobre umbral → `conciliacion_peso` y bloqueo |
| Consentimiento | `accesoPorConsentimiento`: vigente, con alcance, otorgado a esa organización; la revocación cierra hacia adelante | Sin consentimiento → sin acceso; lecturas previas quedan en bitácora |
| Cadena de custodia | `hashEvento` / `verificarCadena`: `hash = sha256(canónico + hash_previo)`, génesis `GENESIS` | Alterar o borrar un evento rompe los posteriores; la corrección es un evento nuevo |
| Bitácora | Toda lectura y exportación (`lectura`, `exportacion`) | Base de la auditoría externa |

## 5. Discrepancia de la fundición — VALIDAR

- **Modelo B (brief del 10-nov-2026):** el comercializador "acopia, funde y transporta".
- **v2.0 (brief v2.1, 12-nov-2026):** el comercializador **NO funde**. La fundición la realiza únicamente el **titular de beneficio identificado** en el evento (`validarEventoFundicion` rechaza `realizado_por_rol = 'comercializador'`; sección 10 del estándar).

El código y el texto público siguen la v2.0. **CAPITÁN LEGAL y LEGAL MINERO deben confirmar** cuál es la operación real y lícita antes de aprobar los textos definitivos. Si se confirma el modelo B, hay que cambiar `validarEventoFundicion`, el trigger de la 043, la sección 10 de `ESTANDAR_SECCIONES` y la fila del paso 3 del mapeo OCDE en el mismo cambio.

## 6. Decisiones pendientes de Willis

1. Textos definitivos de las 12 secciones del estándar y de las 10 de la política (hoy `[TEXTO PENDIENTE DE APROBACIÓN]`).
2. Designación del **auditor externo** (hoy "pendiente de nombrar"; `/auditoria` publica el vacío).
3. **Umbral de conciliación de pesos** (`umbral_conciliacion_peso_pct`, hoy `NULL` = nunca concilia).
4. Redacción literal de la **declaración de conflicto de interés** (`CONFLICTO_INTERES_CHT`, hoy la del hotfix del 11-nov).
5. **Fase 0** (repo privado, rotación de claves, `MARIA_ADMIN_PASSPHRASE`): tareas manuales, no las hace Claude.
6. **Titularidad y marca**: el registro de la marca MAPE.LEGAL ante el Instituto de la Propiedad no está verificado; no se afirma ni se usan símbolos.
7. **Módulo v1.0 "Minted Metal / BCH"**: apagado; decidir si se retira del código o se documenta como histórico.
8. Nombre de la planta participante y domicilio/teléfono operativos (solo para uso interno; nunca en público).
9. Resolver §5 (fundición).

## 7. Citas legales con `[VERIFICAR LEGAL MINERO]`

Ninguna de estas citas se ha confirmado contra La Gaceta por el equipo legal. Contraste contra `LGM_ARTICULOS_ANULADOS` (22, 39, 43, 47, 48, 67, 68 de la Ley) realizado el 2026-11-12: **ninguna cita de la Ley usada por el estándar está anulada**.

| Norma | Artículo | Uso en el estándar | Dónde |
|---|---|---|---|
| Reglamento de la Ley General de Minería (Acuerdo Ejecutivo 042-2013) | Art. 43, incisos c, e y f (del Reglamento, no de la Ley) | Registro de fuentes del comercializador (sección 3) | `CITAS_LEGALES.regLgmArt43`, `ESTANDAR_SECCIONES[2].fundamento` |
| Ley General de Minería | Art. 90 | Permiso municipal de minería artesanal y áreas delimitadas por INHGEOMIN — elegibilidad del origen (sección 4) | `CITAS_LEGALES.leyArt90`, `ESTANDAR_SECCIONES[3].fundamento`, `lib/cadena/reglas.ts` |
| Ley General de Minería | Art. 38 | Responsabilidad solidaria del comprador y verificación del origen | `CITAS_LEGALES.leyArt38` (marca añadida 2026-11-12) |
| Reglamento Especial MAPE (Acuerdo 088-B-2018) | Art. 35 | El Certificado de Origen lo emite el titular y lo autentica la autoridad; el sello es complementario | `SELLO_NOTA_ESTANDAR` (marca); `CERTIFICADO_ORIGEN_NOTA` (copy aprobado previo, sin marca) |
| Convenio 169 de la OIT; sentencia SCO-0090-2014 | — | Consulta previa, libre e informada (CLPI) como condición de elegibilidad; los Arts. 67 y 68 de la Ley están anulados | `lib/legal/vigenciaLGM.ts:NOTA_CONSULTA_PREVIA`, política §9 |

Regla: toda cita nueva lleva la marca hasta que LEGAL MINERO la confirme; al confirmarla, se retira la marca en `copy-legal.ts`/`estandar.ts` y se anota aquí la fecha y la Gaceta.
