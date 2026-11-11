# Certificado de Origen — documento oficial y sello complementario MAPE.LEGAL

Documento interno (no se publica). Brief 10-nov-2026, §2.4. Migración `042`.

## 1. Quién hace qué

| Acto | Quién | Base |
|---|---|---|
| **Emite y firma** el Certificado de Origen / Certificación de Procedencia | El **titular** del derecho minero (persona natural, jurídica o grupo organizado) | Art. 35 Regl. Especial MAPE (Acuerdo 088-B-2018) |
| **Autentica** el documento | La **Autoridad Minera o Municipal** | Art. 35 Regl. Especial MAPE; art. 43.e Regl. 042-2013 |
| **Registra, digitaliza y asienta el sello complementario** | La plataforma MAPE.LEGAL (dueña: Inversiones Zekaii, S. de R.L.) | Registro voluntario y complementario — no es autoridad emisora ni acto de INHGEOMIN |

La plataforma **no emite** el documento oficial. El texto canónico para superficies públicas es `CERTIFICADO_ORIGEN_NOTA` en `lib/content/copy-legal.ts`; cualquier copy nuevo lo importa, no lo parafrasea.

`/verificar` y `/api/verificar/[numero]` consultan **solo el sello** (el asiento digital): confirman que existe un registro con ese número, su estado y su huella. **No validan el documento oficial** ni la autenticación de la autoridad.

## 2. Flujo físico y digital

```
 TITULAR del derecho minero
   │  emite y firma el Certificado de Origen (papel)
   ▼
 AUTORIDAD Minera o Municipal
   │  autentica el documento (fecha de autenticación)
   ▼
 PLATAFORMA MAPE.LEGAL  — /dashboard/certificados  (admin | abogado)
   ├─ registra los datos del documento oficial  → emisor_titular, autoridad_autentica,
   │                                              numero_documento_oficial, fecha_emision
   ├─ digitaliza (escaneo)                       → escaneo_documento_oficial_path  [subida: PENDIENTE]
   ├─ calcula SHA-256 del escaneo               → escaneo_documento_oficial_hash_sha256 (indeleble)
   ├─ asigna número de sello + folio del talonario pre-numerado
   │                                              → numero_sello, folio_talonario
   ├─ construye la URL del QR                    → qr_url = <site>/verificar/<numero_sello>
   │   (imagen QR + diseño del ejemplar: PENDIENTE)
   ├─ imprime el ejemplar con sello, lo escanea → ejemplar_sello_escaneo_path  [subida: PENDIENTE]
   ├─ calcula SHA-256 del ejemplar con sello    → hash_sha256 (036, indeleble)
   └─ entrega copia al minero con constancia    → copia_minero_estado / _fecha / _constancia_path
   │
   ▼
 PÚBLICO — /verificar/<numero>  (anon, vista certificados_origen_publicos)
      consulta SOLO el sello: estado, fechas, mina, hash_sha256, numero_sello,
      copia_minero_estado. Nunca: nombre del titular, autoridad, rutas, folio, montos.
```

## 3. Migración 042 — columnas de `certificados_origen`

Archivo: `supabase/migrations/042_certificados_documento_oficial_y_sello.sql`. **No se aplica automáticamente**: la aplica un humano en Supabase Studio tras la aprobación de Willis y un respaldo previo (el proyecto no tiene backups automáticos). Idempotente (probada ×3 contra PostgreSQL 16 local con el esquema mínimo de 020 + 036).

### Documento oficial
| Columna | Tipo | Nota |
|---|---|---|
| `emisor_titular` | text | Nombre del titular que emite y firma. **Texto, no `auth.users`**. Dato personal → nunca público |
| `emisor_titular_tipo` | text CHECK | `natural` · `juridica` · `grupo_organizado` |
| `autoridad_autentica` | text | Autoridad Minera o Municipal que autentica |
| `autoridad_autentica_fecha` | date | Distinta de `fecha_emision` (que es la del titular) |
| `numero_documento_oficial` | text | Número en el papel; no es el número de sello |
| `escaneo_documento_oficial_path` | text | Ruta relativa en Storage (sin subida aún) |
| `escaneo_documento_oficial_hash_sha256` | text CHECK hex-64 | Indeleble (trigger) |

### Sello complementario
| Columna | Tipo | Nota |
|---|---|---|
| `numero_sello` | text, único parcial | **Backfill = `numero_certificado`** (misma serie). Columna propia para permitir renumerar el talonario sin romper la clave histórica. Público |
| `folio_talonario` | text, único parcial | Talonario pre-numerado. Interno |
| `qr_url` | text | `<NEXT_PUBLIC_SITE_URL>/verificar/<numero_sello>`; la calcula el servidor (`buildQrUrl`) |
| `ejemplar_sello_escaneo_path` | text | Ruta relativa en Storage (sin subida aún) |
| `hash_sha256` (036) | text CHECK hex-64 `NOT VALID` | Re-documentada: huella del archivo digital del **ejemplar con sello**. Indeleble (trigger) |

### Copia al minero
| Columna | Tipo | Nota |
|---|---|---|
| `copia_minero_estado` | text NOT NULL default `pendiente` CHECK | `pendiente` · `entregada` · `constancia_firmada`. Público |
| `copia_minero_fecha` | date | Obligatoria (validación API) cuando el estado no es `pendiente` |
| `copia_minero_constancia_path` | text | Ruta relativa en Storage (sin subida aún) |

### Trazabilidad del asiento
| Columna | Nota |
|---|---|
| `registrado_por uuid → auth.users` | Quien asentó el registro en la plataforma. **No es el emisor**. Backfill desde `emitido_por` |
| `emitido_por` (020) | **LEGACY**. Comentario SQL lo marca; el flujo nuevo no lo escribe |

### Indelebilidad y RLS
- `revoke delete, truncate` para `anon`, `authenticated` y `service_role` (la 020 no lo hacía). El retiro es `estado = revocado | expirado | suspendido`.
- Trigger `trg_certificados_hash_inmutable` (BEFORE UPDATE, SQLSTATE 23514): rechaza cambios a `hash_sha256` y `escaneo_documento_oficial_hash_sha256` cuando el valor previo no es NULL. Permite el primer llenado.
- Policy `service_role_all_certificados` FOR ALL TO service_role (el service_role del proyecto no tiene BYPASSRLS). El revoke prevalece: tampoco puede borrar.
- Vista `certificados_origen_publicos`: se agregan **al final** `numero_sello` y `copia_minero_estado` (gotcha: `create or replace view` no puede quitar ni reordenar columnas).

### `hash_verificacion` (020, NOT NULL) — provisional
El POST lo calcula como `sha256("mape.legal/certificado-origen/v0|numero_certificado|mina_id|fecha_emision|peso_oro_g(3 dec)|numero_documento_oficial")` (`lib/certificados/registroValidation.ts:buildHashVerificacion`). Es un formato **provisional** para satisfacer el NOT NULL de la 020 sin datos personales; la Fase 2B debe fijar el cuerpo canónico definitivo (y, si cambia, versionar el prefijo `v0`).

## 4. Código

| Pieza | Archivo |
|---|---|
| Tipos, `buildQrUrl`, estados, proyección pública | `lib/certificados/sello.ts` |
| Validación POST/PATCH, hash de verificación provisional | `lib/certificados/registroValidation.ts` |
| SHA-256 (ya existía) | `lib/certificados/hash.ts` |
| API lista + registro | `app/api/certificados/route.ts` — GET (`admin|abogado|tecnico_ambiental`), POST (`admin|abogado`) |
| API detalle + edición | `app/api/certificados/[id]/route.ts` — GET, PATCH. **Sin DELETE** |
| Página interna | `app/dashboard/certificados/page.tsx` + `CertificadosClient.tsx` (nav "Certificados" en `app/dashboard/layout.tsx`) |
| JSON público | `app/api/verificar/[numero]/route.ts` — `select('*')` sobre la vista + proyección con `CERTIFICADO_PUBLICO_FIELDS` (funciona antes y después de la 042) |

Comportamiento sin la 042 aplicada: el GET de la lista responde `migracion_aplicada: false` (la página muestra el aviso); POST/PATCH responden **503 `MIGRATION_PENDING`**; la ruta pública no cambia.

**proxy.ts**: `/api/certificados` debe agregarse a `isProtectedApi()` y al `matcher` (`'/api/certificados/:path*'`). Mientras no esté, `requireRole` dentro de cada handler protege igual (defensa en profundidad).

## 5. Pendientes (fuera de este PR)

1. **Subida a Storage**: bucket privado (p. ej. `certificados-origen`, patrón 026/029 con subida server-mediated y service-role; policy `FOR ALL TO service_role`), con cálculo de `sha256Hex` sobre el `Buffer` al subir y escritura de `*_path` + hash en la misma operación. Hoy los `*_path` se registran como texto validado (`isStoragePathSafe`).
2. **Imagen del QR**: `qr_url` ya existe; falta generar la imagen (sin dependencias nuevas hasta decidirlo) e incrustarla en el ejemplar impreso.
3. **Diseño gráfico del ejemplar con sello**: requiere diseño aprobado por el dueño de marca (DESIGN.md) y revisión legal del texto impreso (debe incluir la nota de que el sello es complementario y no sustituye el documento oficial).
4. **Talonario pre-numerado**: definir serie, rango y custodia del talonario físico; hoy `folio_talonario` es texto libre único.
5. **Demo `CO-2026-0001-DEMO`** (seed de la 020): decisión de Willis sobre si debe existir en producción. Está prohibido sembrar certificados de muestra en producción; si existe, debería pasar a `estado = 'revocado'` o documentarse como demo visible. Con la 042 aplicada, el demo recibe `numero_sello = 'CO-2026-0001-DEMO'` por backfill y `copia_minero_estado = 'pendiente'`.
6. **Cuerpo canónico definitivo de `hash_verificacion`** (Fase 2B) — ver §3.
7. **Copy público de `/verificar`** (otro agente): alinear el texto a "se verifica el sello, no el documento oficial"; el campo `numero_sello` y `copia_minero_estado` ya están disponibles en el JSON tras la 042.
8. **Enlace a `verificaciones_fuente`** (035): registrar contra qué documento se verificó el certificado (`entidad_tipo = 'certificado'`) desde la UI de registro — hoy solo se lee en `/verificar/[numero]`.
9. **"Manual del Estándar"**: no está en el repo; cuando exista, este documento debe remitir a él en lugar de describir el flujo por su cuenta.
