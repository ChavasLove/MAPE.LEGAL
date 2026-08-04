# Runbook — Reparación Plan 2 en producción (Supabase)

**Contexto** (detalle en CLAUDE.md §Reparación del esquema de producción — Plan 2): la base
de producción se construyó a mano con un modelo anterior a la cadena de migraciones.
Consecuencia visible: María nunca reconocía clientes registrados; workflow, minas,
`/verificar` y concesiones inoperantes desde siempre. Decisión de Willis: **Plan 2 —
migrar producción al esquema del repo** con los scripts puente 038→040.

**Quién ejecuta esto:** el operador con acceso a Supabase Studio del proyecto de
producción (Vercel NO aplica migraciones — todo se pega a mano en SQL Editor).

**Estado de validación (2026-08-04):** cadena completa + ambos scripts de este runbook
probados end-to-end contra una réplica PostgreSQL 16 del esquema a-mano inventariado:
diagnóstico pre-reparación reporta FALTA correcto en 37 chequeos; cadena aplica limpia
y re-ejecutable; diagnóstico post = 39/39 OK; verificación = 28 OK + 3 INFO; datos de
muestra fluyeron por renames y backfills (dpi, fase_actual_id, historial, estado).

**Estado real de producción (cierre 2026-08-03):** hubo un intento de aplicación que
se detuvo a la mitad — 032/033 posiblemente aplicadas (corrieron sin error reportado),
035/037 sin confirmar, **034/036 fallaron** (referencian `minas`/`certificados_origen`,
que no existían — con el orden de este runbook eso queda resuelto), 038–040 sin
aplicar. Por eso el paso 2 es obligatorio: el diagnóstico resuelve la incertidumbre
fila por fila; no asumir nada de ese intento.

---

## Paso 0 — Antes de empezar

- La reparación es **aditiva** (sin DROP de columnas, sin DELETE de filas; renames
  gateados y backfills solo-NULL), pero conviene ejecutarla en horario de baja
  actividad de María.
- Tener a mano los archivos de `supabase/migrations/` de la rama
  `claude/plan-2-produccion-imgq78` (o `main` una vez mergeada).

## Paso 1 — Respaldo (obligatorio antes de tocar el esquema)

**Recomendación (aceptada a evaluar en el cierre 2026-08-03): upgrade a Supabase Pro**
(USD 25/mes) — backups automáticos diarios con 7 días de retención (y PITR opcional).
La plataforma ya opera con clientes y autoridades reales, y los registros de
precio/ensayes son indelebles por diseño legal (migraciones 030/031): seguir en un
plan sin backup automático es un riesgo desproporcionado frente al costo. Se activa
en **Dashboard → Settings → Billing**. Si se hace el upgrade, **esperar a que el
primer backup automático exista** antes de aplicar la cadena; si no, hacer el
respaldo manual de abajo antes de tocar el esquema.

**Respaldo manual hoy (elegir a):**

a) `pg_dump` desde cualquier máquina con PostgreSQL client (connection string en
   Dashboard → Settings → Database):

   ```bash
   pg_dump "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" \
     --schema=public -Fc -f respaldo-pre-plan2-$(date +%Y%m%d).dump
   ```

   Los usuarios de Auth se respaldan aparte: Dashboard → Authentication → Users
   (export CSV), o añadiendo `--schema=auth` si el rol lo permite.

b) Sin `pg_dump`: exportar CSV desde Studio (Table Editor → ⋯ → Export) de las tablas
   con datos reales: `clientes`, `expedientes`, `documentos`, `indice_legalidad`,
   `conversaciones_whatsapp`, `transacciones_pendientes`, `onboarding_states`,
   `usuarios_broadcast`, `user_roles`, `contactos`, `precios_diarios`,
   `precios_referencia`, `ensayes`, `maria_knowledge`.

## Paso 2 — Diagnóstico de existencia

Pegar **`scripts/plan2-diagnostico.sql`** completo en SQL Editor → Run.
Es 100% de solo lectura (objetos temporales de sesión únicamente).

Interpretación de la columna `estado`:

| Estado | Significado | Acción |
|---|---|---|
| `OK` | el objeto ya existe con la forma que el código espera | nada |
| `FALTA` | migración pendiente | aplicarla (columna `accion`) |
| `PARCIAL` | migración a medias (p. ej. `fases` con menos de 5 filas) | re-ejecutarla |
| `REVISAR` | ambigüedad — p. ej. columna vieja y nueva coexisten | **detener y consultar** antes de aplicar |
| `N/A` / `INFO` | no aplica / informativo | nada |

Anotar qué salió FALTA — eso define qué archivos correr en el paso 3. Si las filas de
la 038 ya salen OK (aplicada en un intento anterior), seguir igual: todo es
re-ejecutable, los gates la vuelven no-op.

## Paso 3 — Aplicación ordenada

Para cada archivo, pegar el contenido completo en SQL Editor → Run, y esperar
**Success** antes de pasar al siguiente. Orden estricto:

1. `038_reparacion_esquema_nucleo.sql`
2. `039_reparacion_workflow_dashboard.sql`
3. `040_reparacion_piloto_estructura.sql`
4. `020_certificados_origen.sql`
5. `023_concesiones_mineras_registro.sql`
6. `033_expediente_transition_lock.sql`
7. `034_minas_llaves_institucionales.sql`
8. `036_certificados_hash_sha256.sql`
9. `032_maria_tables_rls.sql` — solo si el diagnóstico la marcó FALTA
10. `035_verificaciones_fuente.sql` — solo si FALTA
11. `037_conversaciones_tipo_interlocutor.sql` — solo si FALTA

La cadena re-ejecuta 032/033 aunque el intento del 2026-08-03 las haya aplicado: son
idempotentes, y re-crear la 033 después de la 039 garantiza que el RPC quede válido
contra las tablas reales (un `create function` plpgsql anterior a 039 no valida
tablas hasta la ejecución — re-crearla no daña y elimina la duda).

Notas verificadas contra la réplica:

- Los `NOTICE` son normales (drop-guards e `if exists`). El único NOTICE que exige
  acción es el de 038: *"expedientes.numero_expediente tiene duplicados — constraint
  UNIQUE no creada"* → resolver los duplicados a mano y re-correr 038.
- El seed demo `CO-2026-0001-DEMO` de la 020 se auto-salta con `minas` vacía —
  verificado 0 filas; en producción no debe haber certificados de muestra.
- Todos los archivos son re-ejecutables, con **una excepción**: re-correr la 020
  **después** de la 036 falla con `cannot drop columns from view` (la 036 ensancha la
  vista pública y `create or replace view` no puede quitar columnas). Es benigno: no
  re-correr 020 tras 036. Si hiciera falta rehacer la vista:
  `drop view public.certificados_origen_publicos;` y correr 020 → 036 seguidas.

### Camino alternativo — ejecución por Claude vía Management API

Acordado en el cierre 2026-08-03 como opción (b): en lugar de pegar los archivos a
mano, una sesión remota de Claude Code puede aplicar la cadena completa por HTTPS con
la **Management API de Supabase** (`https://api.supabase.com/v1/projects/{ref}/database/query`).
Requiere pasarle a la sesión: un **Access Token `sbp_…`** (Dashboard → cuenta →
Access Tokens → Generate new token) y el **Project Ref** del proyecto. La connection
string psql directa puede estar bloqueada por el proxy del entorno remoto — la
Management API es el camino que funciona. **Revocar el token al terminar.** El flujo
es el mismo: diagnóstico → cadena en orden → verificación, con los mismos scripts.

## Paso 4 — Verificación post-reparación

**a) SQL** — pegar **`scripts/plan2-verificacion.sql`** completo → Run (solo lectura).
Resultado esperado: **todas las filas OK** (las `INFO` no son errores). Incluye la
query de 10 columnas del contrato, los seeds/backfills del workflow y sondas con las
queries exactas del código (lookup de María, finalise, dashboard, minas, vista pública).

**b) Funcional** — en producción:

1. **María reconoce a un cliente registrado (por primera vez desde el lanzamiento):**
   desde un número que YA existe en `clientes`, enviar "hola" → María no re-pide
   datos; "¿ya tienes mis datos?" → responde con los campos guardados. Con un número
   nuevo: completar el onboarding y verificar en Studio que la fila apareció:
   `select nombre, dpi, municipio from clientes order by created_at desc limit 5;`
2. **`/verificar`** → muestra el aviso de carga inicial del registro (no un error).
3. **`/dashboard/minas`** (login admin) → carga sin error, con lista vacía y
   "+ Nueva mina" disponible.
4. `/admin/concesiones` → carga con KPIs en 0 (hasta el seed del paso 6).

## Paso 5 — Prueba conductual del guardarriel institucional (key real)

- **WhatsApp** — desde un número NO registrado como cliente:

  > Buenas tardes, le escribo de la UMA de la municipalidad de El Corpus. ¿Qué
  > requisitos exige INHGEOMIN para un permiso de pequeña minería?

  Esperado: trato de "usted", solo marco legal general con cita de artículo, **sin
  precios ni oferta de servicios**, deriva a gerencia@mape.legal, NO inicia
  onboarding, NO crea fila en `clientes`. Verificar la persistencia pegajosa:
  `select tipo_interlocutor, content from conversaciones_whatsapp where
  numero_whatsapp like '%<numero>%' order by created_at desc limit 4;` →
  `institucional`. Enviar un segundo mensaje ("¿y cuánto cobran por formalizar?") →
  sigue institucional: sin precios.
- **Widget web** (mape.legal) — mismo mensaje UMA → misma conducta (el bloque de
  precios se suprime en la conversación).
- Diagnóstico si falla: logs de Vercel, `grep '[maria]'` — el gate determinístico
  loggea sus decisiones.

## Paso 6 — Seed opcional de las 587 concesiones INHGEOMIN

Desde una máquina con el repo clonado y las env vars de producción:

```bash
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  node scripts/seed-concesiones-mineras.mjs
```

Idempotente (upsert por `(categoria, numero_registro)` en chunks de 200). Verificar:
`select count(*) from concesiones_mineras_registro;` → 587. Con eso `/registro`,
`/admin/concesiones` y María empiezan a responder consultas de concesiones.

## Paso 7 — `indice_legalidad_legacy` (decisión abierta)

Los datos viejos del índice (modelo por-expediente con booleanos) quedaron intactos en
`indice_legalidad_legacy`. El modelo nuevo es por-mina (`mina_id` + `componente`,
puntaje 0–20) y migrar exige minas vinculadas a clientes, que aún no existen.
Recomendación: conservar la legacy como archivo histórico; cuando las minas reales
estén cargadas, transcribir a mano los componentes por mina desde
`/dashboard/minas/[id]` → pestaña Legalidad (el volumen actual no justifica script).

## Estado del código y pendientes de gobernanza

- PRs #220, #221 y #222 ya están mergeados en `main` — las migraciones 038–040 están
  en `main` desde el #222. Los scripts de diagnóstico/verificación + este runbook
  viven en el **PR #223** (rama `claude/plan-2-produccion-imgq78`) — mergear cuando
  Willis lo ordene (son SQL y docs: no afectan el build y Vercel no aplica
  migraciones).
- Recomendaciones abiertas: **branch protection en `main` con el check de CI
  obligatorio** (cuatro incidentes de build roto llegaron a producción por saltarse
  el gate); **Vercel Pro** si se quiere hora configurable del boletín diario.
