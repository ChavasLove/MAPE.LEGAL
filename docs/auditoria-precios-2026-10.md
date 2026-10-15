# Auditoría de precios — 2026-10-15

Disparador: reporte del operador "los precios de diésel no se están actualizando".
Alcance: cadena completa del diésel (tabla → servicio → API pública → widget → panel admin → guardián semanal) y, de paso, la captura diaria del oro.

## Hallazgo 1 — `CRON_SECRET` no está configurado en producción (causa raíz)

Verificado desde fuera, sin credenciales, el 2026-10-15:

```
GET https://www.mape.legal/api/cron/diesel-freshness → 500 {"error":"CRON_SECRET not configured"}
GET https://www.mape.legal/api/broadcast/run         → 500 {"error":"CRON_SECRET not configured"}
```

Ambas rutas fallan cerrado por diseño cuando falta el secreto en producción. Consecuencia: **los dos cron de `vercel.json` han estado muertos** en cada tick:

| Cron | Hora HN | Efecto de estar muerto |
|---|---|---|
| `/api/broadcast/run` | 08:00 | No se captura el snapshot del oro a las 8 AM (ver Hallazgo 3). |
| `/api/cron/diesel-freshness` | 08:30 | Nunca se envió el recordatorio diario a gerencia; el operador no supo que el diésel estaba vencido. |

Esto explica la nota de CLAUDE.md del 2026-08-07 ("el operador NO reportó haber recibido los correos del guardián").

**Acción del operador (sin deploy):** Vercel → Project → Settings → Environment Variables (Production) → crear `CRON_SECRET` con un valor aleatorio largo (p. ej. `openssl rand -hex 32`) → Redeploy. Vercel Cron lo inyecta solo como `Authorization: Bearer`. Verificación: volver a abrir las dos URLs de arriba sin credenciales → deben responder **401** (no 500).

## Hallazgo 2 — El diésel publicado es el valor semilla de la migración 028

Producción el 2026-10-15 (`/api/precios/live`): `diesel.precio_hnl = 124.26`, `vigente_desde = 2026-07-27`. Los cuatro combustibles tienen exactamente los valores y la fecha del `INSERT` de la migración 028: **nadie los ha editado nunca** en `/admin/precios`. Son 11 semanas de atraso frente a la estructura SEN.

El código funciona como está diseñado: el diésel es un precio regulado que la SEN fija por decreto cada lunes, sin API, y el modelo es "valor almacenado + `vigente_desde`, editado por admin". El fallo fue operativo y de observabilidad (Hallazgo 1), no de lógica. La automatización por scraping de sen.gob.hn se evaluó y descartó en 2026-07 por frágil; en esta sesión el sitio de la SEN no fue alcanzable desde el entorno, así que no se re-evaluó.

**Acción del operador (cada lunes):** `/admin/precios` → precio nuevo del diésel (y gasolinas/queroseno) → "Usar lunes de esta semana" en vigencia → Guardar. El widget lo refleja en ≤ 60 s.

## Hallazgo 3 — La captura del oro de las 8 AM dependía del boletín (y de un visitante)

`/api/precios/historial` muestra huecos (6, 8, 11 y 13 de octubre) y la fila de hoy tiene `fetched_at` 09:11 a. m., no 08:00. Causa: la única llamada a `fetchAndStorePrices()` del cron vivía dentro de `runDailyBroadcast()`. Con el cron muerto (Hallazgo 1) —o con el gate del boletín en `skip`— el día quedaba sin snapshot hasta que alguien visitaba `/precios`, que lo capturaba a la hora que fuera. Un día sin visitas = un día sin fila.

## Cambios de código en esta rama

1. **Vencimiento visible en público.** `/api/precios/live` agrega a `diesel` y a cada `combustibles[]` los campos `desactualizado` (true si `vigente_desde` < lunes de la semana SEN en curso, hora Honduras) y `semana_sen` (ese lunes). El widget de `/precios` muestra una nota ámbar "Pendiente de actualización…" en la tarjeta del diésel y una frase en "Fuentes y actualización". Un valor viejo ya no se presenta como vigente.
2. **Helpers compartidos** `lunesSemanaSenHN()` y `esVigenciaDesactualizada()` en `lib/types/combustible.ts` (puros). Los usan el cron, la API pública y el panel admin: una sola definición de "vencido". Probados en fronteras de semana, mes y año.
3. **Panel admin** (`/admin/precios`): banner de alerta cuando el diésel está vencido, pill "Vencido · semana SEN del …" por combustible, y botón "Usar lunes de esta semana" junto a la fecha de vigencia. El pill compara contra la fecha **guardada**, no contra el input.
4. **Guardián verificable desde el navegador.** `/api/cron/diesel-freshness` acepta, además del bearer del cron, una sesión de **admin**. Abrir la URL logueado ejecuta la misma verificación (y envía el correo si está vencido) y devuelve `caller`, `cron_secret_configured` y `price_snapshot`. Es el primer diagnóstico cuando "no llegan los avisos del diésel".
5. **Snapshot del oro independiente del boletín.** `ensureDailyPriceSnapshot()` en `services/pricingService.ts`: si falta la fila de la ventana 08:00, hace una captura acotada (8 s) y la persiste. La llaman `/api/broadcast/run` cuando el gate salta el envío y `/api/cron/diesel-freshness` como red de las 08:30. Con `CRON_SECRET` configurado, el precio del día deja de depender de visitantes.

## Lo que NO cambió

- El modelo del diésel sigue siendo manual (SEN no publica API). No hay scraping.
- El precio del oro, tipo de cambio y la aritmética por kilates se verificaron consistentes entre API, historial y widget (mismo helper `mapeGoldBuyLpsPerGram`, factor vigente de la Política de Precios).
- Sin migraciones: los campos nuevos de la API se calculan al vuelo.

## Verificación

- `npm run typecheck`, `npm run check:copy`, `eslint` sobre los archivos tocados y `npm run build` en verde.
- Prueba de fechas (`lunesSemanaSenHN`): 7 instantes incluyendo domingo 23:30 HN, lunes 00:30 HN, cambio de mes y de año — 7/7 correctos; `esVigenciaDesactualizada`: 5/5.
- Pendiente del operador (requiere acceso a Vercel): configurar `CRON_SECRET`, redeploy, abrir `/api/cron/diesel-freshness` logueado como admin y confirmar que llega el correo a gerencia@mape.legal; luego actualizar el diésel del lunes en `/admin/precios`.
