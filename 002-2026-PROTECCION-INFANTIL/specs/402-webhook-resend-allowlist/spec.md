# SPEC-402 · Webhook de Resend en la allowlist del middleware — cierra I-289

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: PI-1 (`idc-32`) · **Origen**: hallazgo en el análisis de I-236 · confirmado por Calidad en producción con `curl` (03-09-2026) · brief CEO (`idc-a6`) 11:05.

## Para qué

**El bug**: `POST https://pi.innovadataco.com/api/webhooks/resend` responde `401 { "error": { "message": "No autenticado" } }` — con o sin cabeceras Svix. Ese cuerpo lo emite [middleware.ts:166](../../middleware.ts:166) al no encontrar JWT válido. La ruta **no** está en [`GUARDIAS_ACCESO.publicas`](../../src/lib/routing/guardias.ts), así que el Paso 2 la corta antes de que el handler pueda validar la firma HMAC-Svix. Un `GET` da el mismo 401; si llegara al handler, respondería 405.

**Por qué es urgente**: Resend reintenta ante cualquier respuesta no-2xx y termina descartando los eventos. **Llevamos casi 5 horas con el correo caído sin poder diagnosticar** (I-283) porque el motivo real del proveedor no lo estamos escribiendo — el webhook es el canal por el que Resend nos avisa de rebotes, entregas, bounces, complaints y hard-fails. Sin él, [`bounces.ts`](../../src/lib/notificaciones/bounces.ts) nunca marca direcciones inválidas → seguimos enviando a buzones malos → cae la reputación del remitente → el proveedor limita o suspende. **Hipótesis del CEO 11:05**: este apagado del webhook puede ser la causa raíz del apagón entero. Se verifica al desplegar mirando qué eventos entran.

## Qué trae

### 1) Una línea en `guardias.ts`

Se agrega `"/api/webhooks/resend"` al array `publicas` con un comentario que explica el modelo de autenticación (firma HMAC-Svix en el handler, no JWT en el borde).

Colocado junto a `/api/health` y `/api/monitor/notif` — los otros endpoints alcanzables por procesos externos que no llevan la sesión del usuario. `matcheaRuta` es prefijo por segmento (`pathname === ruta || pathname.startsWith(ruta + "/")`), así que la entrada cubre `/api/webhooks/resend` exactamente y no expone accidentalmente `/api/webhooks/otro`.

### 2) Test candado en `middleware.test.ts`

Tres casos que ejercitan el middleware directo contra `/api/webhooks/resend`:

- **`(j-webhook-post)`** — `POST` sin JWT → **NO 401**; espera `x-middleware-next: 1` (middleware deja pasar al handler).
- **`(j-webhook-get)`** — `GET` sin JWT → NO 401 (el 405 se lo devuelve el handler, no el borde).
- **`(j-webhook-firmas)`** — `POST` con cabeceras Svix inválidas → middleware deja pasar; el 400/401 legítimo lo decide el handler al verificar la firma.

Cierra el candado que faltaba: cualquier regresión que saque la ruta de `publicas` rompe estos tres tests inmediatamente.

## Candados

- **La autenticación del webhook NO es la sesión del usuario, es la firma HMAC-Svix** que valida `recibirWebhook` en [`webhook-resend.ts`](../../src/lib/notificaciones/webhook-resend.ts). Agregarlo a `publicas` NO lo expone — sigue rechazando firmas inválidas con 401/403 desde el handler.
- **Prefijo por segmento**: `/api/webhooks/resend` en `publicas` cubre exactamente esa ruta y no matchea `/api/webhooks/otro-proveedor` si mañana existe. Cada webhook nuevo se agrega explícito, no por comodín.
- **Test-candado ancla el comportamiento**: si alguien saca la línea de `publicas`, los tres `it()` fallan al instante.

## Verificación

- `npm run test:unit -- src/lib/routing/middleware.test.ts` → **75 tests pasan** (los 72 previos + 3 nuevos).
- `npx tsc --noEmit` verde.
- `eslint` verde en los archivos tocados.
- **Verificación en vivo (post-deploy)**: `curl -X POST https://pi.innovadataco.com/api/webhooks/resend` debe dejar de dar `401 { message: "No autenticado" }` y pasar al handler (que responderá 400/401 por firma faltante, no del middleware).
- **Verificación adicional (hipótesis CEO)**: al desplegar, mirar el flujo de eventos entrantes del proveedor en `Notificacion.deliveredAt/bouncedAt/openedAt/clickedAt` — si empiezan a llegar bounces y complaints acumulados, la caída del correo probablemente sea consecuencia y no causa. Reportar al CEO qué evento aparece primero.

## Impacto en arquitectura:

Confirma la regla de que **cada webhook entrante lleva su propio modelo de autenticación en el handler y va explícito en `publicas`**. La lista `publicas` deja de ser solo «páginas visibles al público» y pasa a incluir también «endpoints con auth propia distinta del JWT». Comentario explicativo en la línea nueva evita futuras «limpiezas» que la remuevan.

Ninguna otra ruta de webhook existe hoy; cuando se agregue una (Wompi, Bold, Stripe, etc.) sigue el mismo patrón: entrada explícita + test candado.

## Fuera de alcance

- **SPEC-400** · cerrar el fail-open de los guardianes de estado en `/api/**` cuando la cookie `sesion_estado` está ausente. Va aparte (PR 1 cliente + PR 2 cerrojo).
- **I-283 · causa del apagón del correo**: este PR desbloquea la observación. Si la hipótesis del CEO se confirma con los eventos que lleguen, se abrirá una ficha aparte con el remedio (rehabilitar reputación, filtrar destinatarios inválidos, notificar al proveedor).

## Referencias

- I-289 (webhook Resend cae 401) · verificado por Calidad con `curl` en producción 03-09-2026.
- I-283 (correo caído sin diagnóstico) — mismo día, hipótesis del CEO sobre relación causal.
- [`middleware.ts:164`](../../middleware.ts:164) — Paso 2 que hoy responde el 401.
- [`guardias.ts`](../../src/lib/routing/guardias.ts) — `GUARDIAS_ACCESO.publicas`.
- [`webhook-resend.ts`](../../src/lib/notificaciones/webhook-resend.ts) — validación HMAC-Svix del handler.
- SPEC-202 (002-PI-099) — introducción del webhook de Resend y su modelo de firma.
