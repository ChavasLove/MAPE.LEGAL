# Estándar privado de debida diligencia — modelo de datos (migración 043)

Documento interno (no se publica). Brief v2.1, Etapa 2 (11-nov-2026). Rama `feat/estandar-privado-v2`. Migración `supabase/migrations/043_estandar_privado_cadena.sql` — **NO aplicada en producción**: la aplica un humano en Supabase Studio después de 041/042, de un respaldo y de la aprobación de Willis.

Contrato compartido: `lib/cadena/types.ts` (nombres), `lib/cadena/hash.ts` (canónico del hash), `lib/cadena/reglas.ts` (reglas puras). La 043 replica los tres en SQL; el test cruzado es `tests/rls-estandar-privado.test.ts`.

## 1. Quién es quién

| Rol (`user_roles.rol`) | Quién | Qué hace en la BD |
|---|---|---|
| `admin` · `abogado` · `tecnico_ambiental` | Personal de CHT, titular y operadora de la plataforma. **No compra ni vende mineral.** | Lee todo salvo `margenes_comercializador`; escribe fuentes, lotes, eventos, consentimientos, alertas. `is_internal_staff()` (041). |
| `cliente` | Minero / productor | Ve **sus** lotes, eventos, pagos (el precio de sus ventas) y consentimientos. |
| `comercializador` (nuevo) | Organización que registra fuentes, compra, transporta. **No funde.** | CRUD (sin DELETE) de fuentes, lotes, eventos, alertas y márgenes de **su** organización; lee sus pagos. |
| `planta` (nuevo) | Destino de la cadena (planta de beneficio) | Lee los lotes con `planta_org_id` = su org, sus eventos y alertas; inserta eventos en esos lotes; el expediente del minero **solo con consentimiento vigente**; **nunca** pagos ni márgenes. |
| `auditor` (nuevo) | Auditoría (interna o externa) | Lectura de lotes, eventos, fuentes, alertas, consentimientos, pagos y bitácora; exportación vía API. No escribe. **Nunca** márgenes. |

Ninguna empresa se nombra en código ni en la BD: cada comercializador, planta o auditor es una fila de `organizaciones` (`tipo` ∈ comercializador | planta | auditor). `user_roles.organizacion_id` liga al usuario con su organización; para `comercializador` y `planta` es obligatoria (CHECK) y el trigger `trg_user_roles_validar_org` exige que `organizaciones.tipo` coincida con el rol. `perfiles_profesionales` no cambia (sigue siendo personal de CHT).

## 2. Tablas

| Tabla | Propósito | Indelebilidad |
|---|---|---|
| `organizaciones` | Comercializadores, plantas y auditores participantes (nombre, RTN interno, activo). | Sin DELETE; retiro = `activo=false`. |
| `fuentes_comercializador` | Origen que un comercializador registra para comprar: minero (`cliente_id`), mina opcional, permiso municipal + vigencia, dentro de área INHGEOMIN, declaración de mercurio cero, estado CLPI, documentos. Base de la verificación de origen del comprador (Art. 43 incisos c, e y f del Reglamento — Acuerdo Ejecutivo 042-2013 — y Art. 90 LGM; ambos `[VERIFICAR LEGAL MINERO]`). | Sin DELETE; corrección = fila nueva o update por la misma org. |
| `lotes` | Lote con cadena de custodia. `estado` ∈ abierto · bloqueado · conciliado · cerrado; `bloqueo_motivo` (motivos separados por `;`). | Sin DELETE. |
| `lote_eventos` | Cadena de custodia **append-only** encadenada por hash (10 tipos: origen_mina, acopio, transporte, recepcion_planta, laboratorio, fundicion, refinado, pago, correccion, nota). | Sin UPDATE ni DELETE (trigger + revoke, incluso para `service_role`). |
| `pagos_lote` | Pagos bancarios del comercializador al minero (monto, medio, referencia ≥ 4 chars, banco, fecha). El efectivo **no existe** como medio (CHECK). | Sin DELETE. INSERT solo vía `registrar_pago_lote()`. |
| `consentimientos` | Consentimiento informado del minero a una organización (planta): documento + SHA-256, fecha de firma, `alcance` `{expediente, documentos, lotes}`, estado vigente/revocado con constancia y motivo. Texto legal del documento: `[REVISAR CAPITÁN LEGAL]`. | Único UPDATE: vigente → revocado (solo campos de revocación). Sin DELETE. |
| `alertas_lote` | Alertas por lote: conciliacion_peso, umbral_no_configurado, pago_invalido, fuente_no_elegible, mercurio, clpi, fundicion_rechazada. | Se resuelven (`resuelta=true`); sin DELETE. |
| `bitacora_accesos` | Lecturas y exportaciones (quién, rol, org, recurso). | Append-only (trigger + revoke). |
| `margenes_comercializador` | Precio de venta y margen del comercializador por lote. | Sin DELETE. Solo lo ve su propio comercializador. |
| `configuracion_sistema` (+1 fila) | `umbral_conciliacion_peso_pct`, tipo `numero`, **`valor = NULL`** `[POR DEFINIR — WILLIS / LEGAL MINERO]`. | — |

## 3. Triggers

| Trigger | Tabla · momento | Qué hace |
|---|---|---|
| `lote_evaluar_elegibilidad` | `lotes` BEFORE INSERT | Deriva `cliente_id` y `comercializador_org_id` de la fuente (si vienen y no coinciden → 23514). Evalúa `fuente_bloqueos()` (réplica de `evaluarElegibilidadFuente`): permiso NULL o vencido → `permiso_municipal_no_vigente`; `dentro_area_inhgeomin ≠ true` → `fuera_de_area_inhgeomin`; `clpi_estado='pendiente'` → `clpi_pendiente`. Con bloqueos: `estado='bloqueado'`, `bloqueo_motivo='a;b;c'`; sin bloqueos: siempre nace `abierto`. |
| `lote_alertas_fuente` | `lotes` AFTER INSERT | Inserta `fuente_no_elegible` (detalle `{fuente_id, bloqueos[]}`) si hubo bloqueos y `mercurio` si `declaracion_mercurio_cero ≠ true` (alerta, **no** bloquea). Va en AFTER porque la FK `alertas_lote.lote_id` exige que el lote exista. |
| `lote_evento_encadenar` | `lote_eventos` BEFORE INSERT | (a) `select … for update` sobre el lote (serializa por lote); `secuencia = max+1`. (b) `hash_previo` = hash del anterior o `GENESIS`. (c) `fecha` truncada a milisegundos; `detalle_canonico` = el enviado por la API o `jsonb_canonico(detalle)`. (d) `hash = sha256(canónico)` con `canonico_evento()`. Si el INSERT trae `secuencia`, `hash_previo` o `hash` y no coinciden → 23514 (`secuencia_no_coincide` / `hash_previo_no_coincide` / `hash_no_coincide`): la API puede mandar su hash JS como verificación cruzada. (e) Fundición: `actor_rol` o `detalle.realizado_por_rol` = comercializador → `fundicion_no_permitida: el comercializador no funde…`; sin `detalle.titular_beneficio.{nombre, identificacion}` no vacíos → `fundicion_no_permitida: sin titular de beneficio identificado`. |
| `lote_eventos_append_only` · `bitacora_accesos_append_only` | BEFORE UPDATE OR DELETE | RAISE 23514. Además `revoke update, delete, truncate` a anon/authenticated/service_role. |
| `consentimientos_solo_revocar` | BEFORE UPDATE OR DELETE | Solo permite vigente → revocado tocando `estado, revocado_en (default now()), revocacion_constancia_path, revocacion_motivo`; todo lo demás RAISE. |
| `trg_user_roles_validar_org` | `user_roles` BEFORE INSERT/UPDATE | `organizaciones.tipo` debe ser igual al rol (comercializador/planta/auditor). |
| `trg_lotes_touch` · `trg_fuentes_touch` | BEFORE UPDATE | `updated_at = now()`. |

Todos los triggers con escritura interna son `SECURITY DEFINER` con owner `postgres` y `search_path = public` (patrón 019/033/041): sus inserts a `alertas_lote` o updates a `lotes` no dependen del rol del invocador.

### Canónico del hash (idéntico a `lib/cadena/hash.ts`)

```
lote_id | secuencia | tipo | actor_user_id ('' si null) | fecha ISO UTC con ms |
lugar ('') | peso_g 'FM999999999990.000' ('') | ley_fino 'FM0.000000' ('') |
detalle_canonico | hash_previo
```

`concat_ws` omite NULLs, por eso cada opcional lleva `coalesce(…, '')` — así el separador vacío (`||`) se conserva como en el `join('|')` de JS. Hash: `encode(sha256(convert_to(canónico,'UTF8')),'hex')` — función de núcleo, **no pgcrypto** (en Supabase `digest()` vive en el esquema `extensions`, invisible con `search_path = public`; el brief pedía pgcrypto, el resultado es idéntico).

Vector de prueba (asegurado en `tests/cadena.test.ts` y en el test SQL): lote `11111111-1111-4111-8111-111111111111`, seq 1, `origen_mina`, actor NULL, `2026-11-12T14:05:06.007Z`, `Iriona`, 1250.5, 0.9165, `{"a":1,"b":"x"}`, `GENESIS` → `a2e60d8d5871069087b5bda166e719a73303777c81a04436633e1938944f09b8`.

`jsonb_canonico()` replica `canonicalJson()` (claves ordenadas por bytes, sin espacios, recursivo). Diferencia conocida: `1.0` (jsonb conserva `1.0`, JS emite `1`). **La API siempre manda `detalle_canonico` calculado en JS**; el fallback SQL cubre los inserts hechos desde la propia BD (evento `pago`). Precisión: `fecha` con milisegundos; `peso_g` con ≤ 3 decimales y `ley_fino` con ≤ 6, para que `toFixed()` y `to_char()` redondeen igual.

## 4. RPCs

| Función | Seguridad | EXECUTE | Comportamiento |
|---|---|---|---|
| `current_rol()` · `current_org()` | DEFINER | authenticated, service_role | Rol activo / organización de `auth.uid()`. |
| `planta_tiene_consentimiento(cliente, alcance)` | DEFINER | authenticated, service_role | `current_rol()='planta'` y existe consentimiento de ese cliente a `current_org()` con `alcance->>alcance='true'`, vigente o revocado con `revocado_en > now()` (réplica de `accesoPorConsentimiento`). |
| `fuente_bloqueos(fuente)` | DEFINER | authenticated, service_role | Motivos que bloquean (vacío = elegible). |
| `verificar_cadena_lote(lote)` | **INVOKER** | authenticated, service_role | Recalcula la cadena: `{ok, total, primera_rotura, motivo}` con motivos `secuencia_no_consecutiva` / `hash_previo_no_coincide` / `hash_alterado`. Respeta la RLS del que llama; si no ve el lote → `{ok:null, motivo:'lote_no_visible'}`. |
| `registrar_pago_lote(lote, medio, referencia, monto, banco, fecha, registrado_por)` | DEFINER | **solo service_role** | Lote inexistente / bloqueado / cerrado → `{ok:false, motivo}` sin tocar nada. `efectivo`/`cash` → `efectivo_prohibido`; medio fuera de la lista → `medio_no_admitido`; referencia < 4 → `sin_referencia_bancaria`: en los tres casos **bloquea el lote** (`estado='bloqueado'`, `bloqueo_motivo='pago_invalido: <motivo>'`), inserta alerta `pago_invalido` y devuelve `{ok:false, motivo, lote_bloqueado:true}` **sin excepción** (un RAISE revertiría el bloqueo). OK → inserta `pagos_lote` (beneficiario y pagador derivados del lote) + evento `pago` con `{pago_id, medio, referencia, banco}` (sin monto) → `{ok:true, pago_id}`. No hay excepciones que dejen pasar el lote. |
| `conciliar_lote(lote, actor)` | DEFINER | **solo service_role** | Último `peso_g` por punto (origen_mina → acopio → laboratorio → refinado); `diferencia_pct = |b−a|/a·100` entre puntos presentes consecutivos (réplica de `conciliarPesos`). Umbral NULL/no numérico → `umbral_no_configurado` + alerta (una sola sin resolver) y **no cambia estado**; faltan puntos → `incompleto`; alguna diferencia > umbral → `alerta` + `conciliacion_peso`; todo dentro → `conciliado` (solo desde `abierto`; **nunca desbloquea**). Devuelve `{estado, conciliado, diferencias[], faltan[], umbral_pct, lote_estado}`. |

## 5. Matriz rol × tabla (RLS)

Leyenda: **S** select · **I** insert · **U** update · **—** nada (0 filas o permiso denegado). DELETE está revocado para todos en todas las tablas; `service_role` tiene `FOR ALL` (sin BYPASSRLS en este proyecto) menos los revokes de indelebilidad. `anon`: sin grants.

| Tabla | staff CHT | comercializador | planta | cliente | auditor |
|---|---|---|---|---|---|
| `organizaciones` | S I U | S (la propia) | S (la propia) | — | S |
| `fuentes_comercializador` | S I U | S I U (su org) | — | — | S |
| `lotes` | S I U | S I U (su org) | S (`planta_org_id` = su org) | S (sus lotes) | S |
| `lote_eventos` | S I | S I (lotes de su org) | S I (sus lotes) | S (sus lotes) | S |
| `pagos_lote` | S | S (pagados por su org) | **—** | S (de los que es beneficiario) | S (monto incluido — pendiente) |
| `consentimientos` | S I U* | — | S (otorgados a su org) | S (los suyos) | S |
| `alertas_lote` | S I U | S I (lotes de su org) | S (sus lotes) | — | S |
| `bitacora_accesos` | S (solo `admin`) · I propia | I propia | I propia | I propia | S · I propia |
| `margenes_comercializador` | **—** | S I U (su org) | **—** | **—** | **—** |
| `expedientes` / `documentos` / `clientes` (SELECT adicional) | (041) | — | S **solo** con consentimiento vigente (`expediente` / `documentos`) | (041 / 008) | — |

\* UPDATE solo vigente → revocado (trigger). El INSERT en `pagos_lote` es exclusivo de `registrar_pago_lote()` (service_role): la escritura directa saltaría el bloqueo por efectivo y el evento de la cadena.

## 6. Decisiones y pendientes

- **Márgenes solo del comercializador.** Ni CHT, ni planta, ni auditor, ni cliente los ven. `[DECISIÓN PENDIENTE — WILLIS]`: si el personal de CHT debe verlos para mantenimiento de la plataforma (hoy solo `service_role` desde la API, bajo `requireRole`).
- **Pagos visibles al auditor** con monto: implementado el SELECT completo; `[DECISIÓN PENDIENTE — WILLIS]` si debe ver solo existencia/medio/referencia.
- **Fundición rechazada en BD, alerta desde la API.** El trigger aborta el INSERT (23514) y no puede insertar la alerta `fundicion_rechazada` en la misma transacción: la API captura el error y la registra con `service_role`.
- **Umbral sin valor.** `umbral_conciliacion_peso_pct` se siembra con `valor = NULL`; mientras siga así ningún lote se concilia y cada intento deja/mantiene una alerta `umbral_no_configurado`. El número lo pone Willis / LEGAL MINERO (no se inventa).
- **Pagos sobre lotes bloqueados o cerrados se rechazan** (`lote_bloqueado` / `lote_cerrado`) sin tocar nada: el desbloqueo es decisión del personal de CHT (update de `estado`), no de un pago posterior.
- **Eventos sobre lotes bloqueados sí se admiten** (`nota`, `correccion`, pesajes): la cadena es evidencia y bloquear la evidencia la empobrece; lo que se bloquea es el pago y la conciliación.
- **`verificar_cadena_lote` es SECURITY INVOKER** a propósito: la RLS del que llama decide qué lote ve, y todas las policies exponen la cadena completa del lote visible.
- **Hash de núcleo (`sha256`) en vez de pgcrypto** — ver §3.
- **Texto legal del consentimiento** `[REVISAR CAPITÁN LEGAL]`; **artículos citados** `[VERIFICAR LEGAL MINERO]`.
- **Discrepancia sobre la fundición.** El modelo B del 10-nov-2026 describía al comercializador como quien *acopia, funde y transporta*; el brief v2.1 (esta Etapa 2) dice expresamente que el comercializador **no funde** — solo un titular de beneficio identificado. La 043 implementa v2.1 (rechazo en BD). **Validar con CAPITÁN LEGAL / LEGAL MINERO** antes de aplicar en producción; si prevalece el modelo B hay que relajar la rama (e) de `fn_lote_evento_encadenar()` y `validarEventoFundicion()` en el mismo PR.
- **No aplicada en producción.** Orden: 041 → 042 → 043. Verificación post-aplicación al final del archivo SQL (§16).

## 7. Cómo correr los tests

```bash
npm test                      # toda la suite node:test, incluida la RLS
# o solo la RLS:
node --experimental-strip-types --no-warnings --import ./tests/register-loader.mjs \
     --test tests/rls-estandar-privado.test.ts
```

`tests/rls-estandar-privado.test.ts` busca la base de datos en este orden:

1. `PGTEST_URL` (CI: `postgres://postgres:postgres@localhost:5432/postgres`, job `rls` de `.github/workflows/ci.yml` con `services: postgres:16` + `postgresql-client`).
2. Un clúster PostgreSQL 16 efímero local (`/usr/lib/postgresql/*/bin/pg_ctl`): `initdb` + `pg_ctl` en un directorio temporal, solo socket Unix; como root corre vía `su postgres`. Se destruye al terminar.
3. Si no hay nada → la suite se **omite** (skip) con mensaje claro; nunca da verde falso ni toca Supabase.

Secuencia: `tests/sql/043_fixtures.sql` (esquema stub: `auth.users`, `auth.uid()` leyendo `app.uid`, roles `anon`/`authenticated`/`service_role`, `user_roles`, `clientes`, `minas`, `expedientes`, `documentos`, `configuracion_sistema`, `roles`, `is_internal_staff()` de 041) → **043 dos veces** (idempotencia) → `tests/sql/043_seed.sql` → 16 casos con `set role` + `set app.uid`: hash del vector y `verificar_cadena_lote`; append-only y detección de manipulación; elegibilidad; fundición; conciliación (NULL / 5 / 10); pagos (efectivo, referencia corta, válido); RLS de staff, comercializador, planta (incluido consentimiento → revocación), cliente, auditor, anon y service_role; bitácora.
