# Reestructura de recepción, acceso y cadena de custodia — inventario de brechas

Fase 1 del encargo del 28-nov-2026. Documento **interno**. Inventario hecho sobre
el árbol de la rama del PR #245 (`claude/eager-franklin-vvl1j7` @ `f17997e`), que
es la base de este trabajo. Las referencias `archivo:línea` se tomaron de ese
árbol; pueden moverse con cambios posteriores.

Lo que no se pudo comprobar está marcado **NO VERIFICADO**. Lo que depende de una
decisión de negocio está marcado **[POR CONFIRMAR]** y no se resuelve aquí.

No se consultó `/workspace/fid` ni el repositorio de referencia (no están
disponibles en el entorno de trabajo): los patrones se reimplementan con las
convenciones de este repositorio, sin copiar código.

## 1. Tabla requisito → existe → falta → decisión

| # | Requisito | Qué existe (archivo:línea) | Qué falta | Decisión |
|---|---|---|---|---|
| 1 | Acceso por código de un solo uso al correo | Acceso por contraseña `app/api/auth/login/route.ts:21`; confirmación **por enlace** `app/api/auth/register/route.ts:52` y `app/api/auth/resend-confirmation/route.ts:40-44`; limitador `lib/rateLimit.ts:26` | Código numérico, control de intentos, espera de reenvío, expiración propia, auditoría | **Crear** `lib/auth/otp*.ts`, rutas `/api/auth/otp/*`, página `/auth/codigo`, migración 045. **Reutilizar** `lib/rateLimit.ts` y el canal de correo (`services/emailService.ts:27`) |
| 2 | Roles de recepción y verificador | 7 roles en `lib/userRoleLookup.ts:23-41`; CHECK en `043:119-121`; alcance por organización `043:128-185` | Roles `verificador` y `recepcion`, bitácora de cambios de rol | **Extender** el CHECK y `fn_user_roles_validar_org` en 045; **extender** `Role`/`KNOWN_ROLES` |
| 3 | Perfiles aprobados uno a uno por el personal | `clientes` (008/038) y `organizaciones` (`043:89-97`) sin estado de aprobación | Máquina de estados, cola, bitácora inmutable, separación de funciones | **Crear** tabla `perfiles` + `aprobaciones_perfil` (046), `lib/perfiles/*`, `/dashboard/aprobaciones` |
| 4 | Usuarios (mineros y organizaciones) solo ven | Portal sin formularios (ver §2); una escritura por API para `cliente` | Cerrar esa escritura y las policies residuales; registro abierto | **Retirar** `cliente` de la revocación por API; **cerrar** el auto-registro; RLS en 046 |
| 5 | Recepción física y custodia hasta el laboratorio | Cadena encadenada por hash `lib/cadena/hash.ts`, trigger `043:554-642`, conciliación `043:944-1059`, reglas `lib/cadena/reglas.ts:121` | Puntos de recepción, recepciones, sobres, cajas, manifiesto, envío y recepción en laboratorio, tipos de evento nuevos | **Extender** tipos de evento (047) sin tocar el canónico; **crear** tablas y `lib/recepcion/*` |
| 6 | Organizaciones, membresías e invitaciones | `organizaciones.tipo` con 3 valores `043:96` | Tipos nuevos, membresías con bitácora, invitaciones de un solo uso | **Extender** el CHECK (047/048); **crear** tablas y `lib/organizaciones/*` (048) |
| 7 | Respaldo de documentos, RAG con control por documento, María de solo lectura, verificación pública mínima | RAG `024` sin ACL (ver §5); María sin herramientas (ver §5); verificación con 14 campos (ver §6) | Interfaz de respaldo, ACL por fragmento aplicada antes de recuperar, reglas de solo lectura y cita, proyección mínima | **Crear** `lib/documentos/*` y 049; **extender** el prompt de María; **reducir** la proyección pública |

## 2. Superficie de escritura hoy disponible para `cliente` y roles externos

### 2.1 Rutas de API

Todas las rutas de `/api/cadena/**` usan `iniciarSesionCadena(...roles)`
(`lib/cadena/apiUtils.ts:36-54`) con el cliente de servicio; la RLS no aplica
ahí y el alcance lo fija `lib/cadena/acceso.ts`.

| Ruta | Método | Roles externos admitidos | Qué escribe | Destino |
|---|---|---|---|---|
| `/api/cadena/consentimientos/[id]/revocar` | POST | **cliente** (`route.ts:18`, solo su fila `:28`) | UPDATE `consentimientos` → revocado (`:46-54`) | **Se retira** `cliente`: la revocación la registra el personal a solicitud del titular, con bitácora |
| `/api/cadena/fuentes` | POST | comercializador (`route.ts:53`) | INSERT `fuentes_comercializador` | Se mantiene (043); no se amplía |
| `/api/cadena/lotes` | POST | comercializador (`route.ts:51`) | INSERT `lotes` | Se mantiene (043) |
| `/api/cadena/lotes/[id]/eventos` | POST | comercializador, planta (`route.ts:61`) | INSERT `lote_eventos` | Se mantiene (043); los tipos de evento nuevos de recepción **no** se abren a estos roles |
| `/api/cadena/lotes/[id]/pagos` | POST | comercializador (`route.ts:33`) | RPC `registrar_pago_lote` | Se mantiene sin tocar — ver §7 |
| `/api/cadena/lotes/[id]/conciliar` | POST | comercializador (`route.ts:21`) | RPC `conciliar_lote` | Se mantiene (043) |
| `/api/auth/register` | POST | público | Crea usuario con rol `cliente` (`route.ts:52`) | **Se cierra** — ver §4 |

`auditor` no tiene ninguna ruta de escritura. `/api/expedientes` (POST
`route.ts:25`), `/api/expedientes/[id]/transition` (`route.ts:11`) y
`/api/documentos/[id]` (PATCH `route.ts:16`) ya son solo para personal: un
`cliente` recibe 403.

### 2.2 Páginas del portal

| Página | Formularios, subidas o llamadas no-GET |
|---|---|
| `app/portal/layout.tsx:47` | Solo el formulario de cierre de sesión |
| `app/portal/page.tsx:27` | GET `/api/expedientes` — esa ruta es solo de personal, así que el cliente recibe 403 y la página muestra error (inferido del código; **NO VERIFICADO** en ejecución) |
| `app/portal/lotes/PortalLotesClient.tsx:35,56` | Solo GET |
| `app/expedientes/page.tsx:12` | Solo GET |

`components/marketplace/DocumentUpload.tsx` se usa en un único lugar,
`app/admin/mercado/[projectId]/page.tsx:7`, solo para administradores.

**Brecha:** el portal del cliente no tiene hoy una lectura funcional de su
expediente (la ruta que consume lo rechaza). Se crea una ruta de solo lectura
propia.

### 2.3 Policies RLS con escritura para `authenticated`

| Policy | Tabla | Quién | Línea | Destino |
|---|---|---|---|---|
| `*_staff_all` | 12 tablas operativas | personal | `041:121-126` | Sin cambios |
| `fuentes_comercializador_org` | `fuentes_comercializador` | comercializador de la misma organización | `043:1166-1171` | Sin cambios |
| `lotes_comercializador_org` | `lotes` | ídem | `043:1183-1188` | Sin cambios |
| `lote_eventos_comercializador_org` | `lote_eventos` | ídem (solo INSERT efectivo) | `043:1210-1219` | Sin cambios; un trigger nuevo reserva los tipos de recepción al personal |
| `lote_eventos_planta_lotes` | `lote_eventos` | planta del lote | `043:1221-1230` | Ídem |
| `alertas_lote_comercializador_insert` | `alertas_lote` | comercializador | `043:1299-1304` | Sin cambios |
| `margenes_comercializador_org` | `margenes_comercializador` | comercializador | `043:1329-1334` | Sin cambios |
| `bitacora_self_insert` | `bitacora_accesos` | **cualquier autenticado**, incluido `cliente` | `043:1323-1325` | No es dato de trazabilidad (deja constancia de la propia lectura). Se conserva; se anota |
| "Allow default cliente role self-insert" | `user_roles` | el propio usuario, solo `rol='cliente'` | `019:48-54` | Necesaria para el alta automática; se conserva |
| `publicaciones_autor_insert_own` / `_update_own` | publicaciones del marketplace | cualquier autenticado que no sea personal | `044:394-406` | Es del #245 (marketplace de publicaciones, no trazabilidad). **Fuera de alcance**; se anota |

`cliente` y `auditor` no tienen ninguna policy de escritura sobre tablas de
trazabilidad en 041 ni en 043.

## 3. Cómo se validan el rol y el tipo de organización

- `user_roles.rol` es `text` con CHECK (no es un enum). La última definición es
  `user_roles_rol_check` en `043:119-121`; el bloque `043:106-118` elimina antes
  cualquier CHECK previo sobre `rol`. **Para agregar valores:** repetir ese mismo
  patrón (eliminar y volver a crear con la lista ampliada). No hay filas que
  puedan quedar fuera, porque la lista solo crece.
- `user_roles_org_requerida_check` (`043:141-147`) exige organización para
  comercializador y planta. Ojo: su definición también contiene `rol … in (`,
  así que el bucle de reemplazo debe **excluirlo por nombre**.
- `organizaciones.tipo`: CHECK `organizaciones_tipo_check` en `043:96`
  (comercializador, planta, auditor). Se amplía eliminando y recreando.
- `fn_user_roles_validar_org()` (`043:156-179`): si hay organización, el rol
  debe ser uno de los tres de cadena y el tipo debe coincidir con el rol. Para
  los roles nuevos hay que reemplazar la función.
- El código espeja la lista en `lib/userRoleLookup.ts:23-41`; `isKnownRole`
  rechaza en el acceso cualquier rol que no esté ahí.

## 4. Dónde se acopla el registro abierto con "los usuarios no llenan datos"

- `app/auth/registro/page.tsx` pide nombre, correo, teléfono y contraseña y
  llama a `/api/auth/register` (`:49-52`).
- `app/api/auth/register/route.ts:52-60` crea el usuario y guarda `nombre` y
  `telefono` autodeclarados en los metadatos; el trigger de la 015 le asigna
  `cliente`.
- `app/login/page.tsx:427` enlaza a `/auth/registro`.
- `lib/userRoleLookup.ts:104-109` asigna `cliente` a cualquier sesión sin fila
  de rol (también por acceso con Google).

**Decisión:** `/auth/registro` pasa a "solicitud de acceso" (solo correo y nombre
de contacto, sin crear cuenta); `/api/auth/register` deja de crear cuentas. El
alta real la hace el personal. **[POR CONFIRMAR]** si se mantiene la solicitud
pública o se pasa a solo invitación.

El acceso con Google sigue creando una sesión con rol `cliente` para cualquier
cuenta de Google. Ese rol no puede escribir nada y, sin perfil aprobado, no ve
nada; aun así queda señalado como **[POR CONFIRMAR]** (mantener o retirar el
acceso con Google).

## 5. Estado del RAG y de María

- Tabla `maria_knowledge` (`024:30-57`): `id`, `category`, `title`, `content`,
  `embedding vector(1536)`, `source`, `metadata jsonb`, fechas. **No tiene
  noción de documento, expediente, organización ni nivel de acceso.**
- Lectura pública: `to anon, authenticated using (true)` (`024:93-98`). Hoy
  contiene solo conocimiento general (leyes, manual); no hay documentos de
  expedientes indexados.
- Las dos funciones de búsqueda (`024:164-174` y `024:206-217`) no reciben
  ningún parámetro de quien consulta.
- Recuperación: `app/api/maria/chat/route.ts:157-219` y
  `app/api/whatsapp/route.js:245`.
- María **no tiene herramientas**: ninguna llamada al modelo pasa `tools`
  (`app/api/maria/chat/route.ts:557-562`, `app/api/whatsapp/route.js:1106-1113`).
- El canal web no escribe en la base. El canal de WhatsApp **sí** escribe, desde
  código determinista y no desde el modelo: historial (`route.js:944`), alta de
  `clientes` (`:1267`) y `transacciones_pendientes` (`:1297`, `:1313`).

**Brecha y límite:** el alta de `clientes` desde WhatsApp choca con "los usuarios
no llenan datos". Ese archivo está fuera del alcance pedido y es el canal en
producción; **no se modifica** en este PR. Con la 046, una fila de `clientes`
sin perfil aprobado no participa en lotes ni recepciones. **[POR CONFIRMAR]**
retirar o no ese registro por WhatsApp.

**Decisión:** el conocimiento general queda donde está. Los documentos de
expedientes van a un índice **separado** con ACL por fragmento (049), filtrado
dentro de la función de búsqueda.

## 6. Verificación pública: qué devuelve hoy

`GET /api/verificar/[numero]` (`app/api/verificar/[numero]/route.ts`), con
límite de 20 por minuto por IP (`:11-12`), devuelve
`{ found, certificado }` con hasta **14 campos**
(`lib/certificados/sello.ts:114-129`): `numero_certificado`, `fecha_emision`,
`peso_oro_g`, `estado`, `valido_hasta`, `hash_verificacion`, `mina_nombre`,
`mina_codigo`, `mina_municipio`, `mina_departamento`, `hash_sha256`,
`certificado_id`, `numero_sello`, `copia_minero_estado`.

La página `app/verificar/[numero]/page.tsx` hace su propia consulta (`:46-58`),
**sin límite de frecuencia**, y muestra fechas, peso, huellas, mina, municipio,
departamento y la última verificación documental (`:302-378`).

Mínimo pedido: **número de sello y estado**. Sobran 12 campos en la API y casi
todo lo que muestra la página. No existían pruebas de esta superficie.

**Decisión:** proyección nueva `{ numero, estado }`; respuesta 404 uniforme; la
página deja de mostrar el resto. Es un cambio incompatible para quien consuma la
API.

## 7. Dónde existe `pago` (solo informativo)

- Migración 043: tipo de evento `'pago'` (`:505`); tabla `pagos_lote`
  (`:706-728`); función `registrar_pago_lote` (`:730-806`); permisos y policies
  (`:1095`, `:1136`, `:1148`, `:1244-1262`).
- Código: `lib/cadena/types.ts:38`, `:48-50` (`MEDIOS_PAGO`), `:145`;
  `lib/cadena/reglas.ts:21`; `lib/cadena/validacion.ts:199-209`, `:388-393`.
- API y UI: `app/api/cadena/lotes/[id]/pagos/route.ts`;
  `app/api/cadena/lotes/[id]/route.ts:37`; `app/api/cadena/exportar/route.ts`;
  `app/dashboard/cadena/[id]/LoteDetalleClient.tsx:343-438`;
  `app/portal/lotes/PortalLotesClient.tsx:184` (lectura).
- No existe ninguna tabla ni columna llamada `medios_pago`: los medios son la
  constante `MEDIOS_PAGO` y el CHECK `pagos_lote_medio_check` (`043:719`).
- Aparte y más antiguo: tabla `pagos` e `hitos` de honorarios del expediente
  (`041:101`).

**[POR CONFIRMAR]** El registro de pagos por lote dentro de la plataforma puede
chocar con "CHT no administra fondos". En este PR **no se extiende, no se usa y
no se borra**: el flujo de recepción no llama a `registrar_pago_lote`, no emite
el evento `pago` y no agrega campos de monto, medio ni comprobante.

## 8. Qué se reutiliza para la custodia de recepción

| Pieza | Dónde | Uso |
|---|---|---|
| Canónico y hash del evento | `lib/cadena/hash.ts` · `043:520-552` | Sin cambios. Los tipos nuevos usan el mismo canónico; los campos nuevos van en `detalle` |
| Trigger de encadenado | `043:554-642` | Sin cambios |
| Solo-agregar | `fn_append_only` `043:645-658` | Reutilizado en todas las bitácoras nuevas |
| Conciliación de pesos | `conciliarPesos` `lib/cadena/reglas.ts:121` · `conciliar_lote` `043:944-1059` | Misma semántica y **mismo umbral** (`umbral_conciliacion_peso_pct`, sin valor). `conciliar_lote` compara cuatro puntos fijos del lote y no sabe de manifiestos: se agrega una función hermana para manifiesto ↔ recepción en laboratorio que emite la misma alerta `umbral_no_configurado` |
| Alertas | `alertas_lote` `043:308-326` | Reutilizada |
| Bitácora de lecturas | `bitacora_accesos` `043:894-916` · `lib/cadena/bitacora.ts` | Reutilizada para la lectura de documentos |
| Sello y QR | `lib/certificados/sello.ts:155` (`buildQrUrl`) | El sobre se etiqueta con el número de sello existente. No se crea un QR nuevo |
| Huella de documentos | `lib/certificados/hash.ts:16` (`sha256Hex`) | Manifiesto y respaldo de documentos |
| Ensayes | `031_ensayes` · `lib/precio/ensayes.ts` | **No se reutiliza:** está atado a la liquidación por precio. El análisis de recepción guarda solo la ley en el evento, sin calcular precio |
| Lote | `lotes` `043:281-294` | Reutilizado tal cual: la recepción se asienta sobre un lote existente |

**Límite que hay que conocer:** un lote de la 043 exige una fuente
(`fuentes_comercializador`) cuya organización es de tipo `comercializador`
(`043:286`, `043:371-374`). El flujo de recepción lo reutiliza sin modificarlo.
Si el operador de la recepción resulta no ser un comercializador, ese modelo
habrá que revisarlo: **[POR CONFIRMAR]** junto con quién opera la recepción.

## 9. Lo que no se pudo verificar

- Qué migraciones están aplicadas en producción (041 a 044 figuran como no
  aplicadas en la documentación del repositorio).
- El contenido de `metadata` en las filas de `maria_knowledge`.
- El comportamiento real de Supabase Auth con el código de un solo uso: no hay
  proyecto de pruebas en el entorno. Ver `docs/reestructura/runbook-aplicacion.md`.
