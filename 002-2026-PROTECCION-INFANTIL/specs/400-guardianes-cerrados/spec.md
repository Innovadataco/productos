# SPEC-400 · Guardianes cerrados en /api/** — PR 1: cliente resiliente

**Status**: IMPLEMENTADO (PR 1 de 2)
**Fecha**: 2026-09-03 · **Dev**: PI-1 (`idc-32`) · **Origen**: brief CEO (`idc-a6`) 03-09-2026, cierra parcialmente I-236.

## Para qué

**El bug (I-236)**: los guardianes de consentimiento, cambio-de-password y vigencia viven dentro de `if (estado)` en [middleware.ts:187](../../middleware.ts:187). La cookie firmada `sesion_estado` que produce `estado` **caduca cada 5 minutos** ([vigencia-cookie.ts:20](../../src/lib/routing/vigencia-cookie.ts:20)) sin refresh sliding. Resultado: cada 5 minutos, un usuario autenticado puede evadir cualquiera de los tres muros — consentimiento, cambio de password obligatorio, vigencia de suscripción — hasta que el próximo `POST /api/vigencia/refresh` re-selle la cookie. No hace falta que nadie borre nada; el hueco se abre solo.

**El plan tiene dos PRs, en este orden por seguridad operativa** (decisión CEO 03-09 11:15):

1. **PR 1 (este)** — **solo cliente**: instala un interceptor global que atrapa `401 { code: "SESION_ESTADO_REQUERIDO" }`, dispara `POST /api/vigencia/refresh` una sola vez, y reintenta el request. **NO cierra nada en el servidor** — es inofensivo por construcción: si falla, el servidor sigue tolerante como hoy.
2. **PR 2 (SPEC-400b, no este)** — cerrar el middleware para `/api/**` cuando `estado === null`, con lista blanca explícita (`/api/pagos/**`, `/api/session/ping`, `/api/vigencia/refresh` y las rutas ya exentas por `publicas`/`sesion`). Se despliega **después** de verificar PR 1 en producción.

Este orden evita el fallo catastrófico: un cerrojo del servidor sin cliente resiliente rompe todo el producto cada 5 minutos.

## Qué trae

### 1) `src/lib/http/sesion-refresh-interceptor.ts`

Monkey-patch sobre `globalThis.fetch` con las siguientes propiedades:

- **Transparente** para toda respuesta que no sea `401 { error: { code: "SESION_ESTADO_REQUERIDO" } }` con `content-type: application/json`.
- **Single-flight**: N peticiones concurrentes que reciban ese 401 comparten UN solo `POST /api/vigencia/refresh`.
- **Reintento único**: si el refresh es 2xx, reintenta el request original una vez. Si el reintento vuelve a caer `SESION_ESTADO_REQUERIDO`, se entrega al llamador — no hay bucle.
- **Bypass propio**: llamadas a `/api/vigencia/refresh` nunca disparan el interceptor (no hay recursión).
- **Idempotente**: bandera global evita re-parchar bajo HMR o hidratación doble.
- **Cuida `Request`**: si el `input` es un `Request` con body streaming, lo clona antes del primer envío para que el reintento pueda releerlo.
- **Fallback silencioso**: si el refresh también falla (típicamente JWT expirado → 401), devuelve el 401 original al llamador sin enmascararlo.

### 2) `src/components/modules/SesionRefreshInterceptor.tsx`

Client component `"use client"` con `useEffect` que llama `installSesionRefreshInterceptor()` una vez al montar. Retorna `null`. Se monta en el layout raíz junto a `ServiceWorkerRegister`, para que **cualquier** `fetch("/api/...")` disparado desde el navegador quede detrás del parche — sin tocar los cientos de callsites existentes (`AdminReportesTable`, `ApelacionesClient`, `ConfigPanel`, `useSessionPing`, `PadreHome`, …).

### 3) `src/app/layout.tsx`

Dos líneas: `import { SesionRefreshInterceptor }` y `<SesionRefreshInterceptor />` dentro de `<AuthProvider>`, antes de `<NavHeader />`.

## Candados

- **PR 1 no cierra ninguna ruta.** Si el interceptor tiene un defecto, el servidor sigue tolerante y nada se rompe. Este es el candado principal — de ahí el orden partido.
- **Single-flight con `finally` que resetea la promesa** — sin él, dos oleadas concurrentes de 401 dispararían dos refreshes seguidos, no uno.
- **Bypass explícito de `/api/vigencia/refresh`** — sin él, un refresh que devuelva 401 lanzaría otro refresh, bucle infinito.
- **Reintento único (no reintento del reintento)** — un servidor que sigue devolviendo `SESION_ESTADO_REQUERIDO` tras un refresh OK indica un bug del servidor; el cliente devuelve el 401 y confía en el error boundary de la app.
- **Solo cliente-side**: SSR usa `undici`/`node-fetch`, otro objeto, no lo pisamos. Nunca hay un `fetch` de Node parchado dentro de un handler `route.ts`.
- **Sin toques a `fetch-retry.ts`** — es una utilidad para 5xx transitorios, ortogonal.

## Verificación

**10 tests unit** en [sesion-refresh-interceptor.test.ts](../../src/lib/http/sesion-refresh-interceptor.test.ts) (todos pasan · jsdom):

1. 200 pasa sin tocar.
2. 401 sin `code=SESION_ESTADO_REQUERIDO` pasa sin tocar.
3. 401 con code captura → refresca → reintenta → 200.
4. Refresh falla (401 sin JWT) → devuelve 401 original SIN reintento.
5. Reintento vuelve a caer 401 con code → devuelve al llamador, NO bucle.
6. Llamada a `/api/vigencia/refresh` nunca dispara refresh (no recursión).
7. 3 requests concurrentes que reciben 401 → UN solo refresh compartido (single-flight).
8. Instalar dos veces es no-op (idempotencia).
9. `Request` con body → se clona para que el reintento pueda releerlo.
10. 401 con `content-type: text/html` → no se toca (no se intenta parsear JSON binario).

**Verificación en vivo pendiente** (siguiente turno): abrir el producto en producción, esperar 5 minutos, ejecutar cualquier acción que pegue a `/api/**` y verificar en DevTools que:
- llega un 401 SESION_ESTADO_REQUERIDO,
- inmediatamente sale un POST a `/api/vigencia/refresh`,
- inmediatamente después re-sale el request original y devuelve 200.

## Impacto en arquitectura:

Cambia el **contrato implícito de errores** del middleware: `401 + code=SESION_ESTADO_REQUERIDO` es ahora una señal que el cliente maneja de forma transparente. Cualquier ruta futura que devuelva ese código con `application/json` participa automáticamente del refresco silencioso. Otros códigos 401 (JWT ausente, JWT inválido, etc.) siguen visibles al llamador tal cual.

El interceptor **no acopla** los callsites al mecanismo — sigue existiendo la posibilidad de que un consumidor específico maneje `SESION_ESTADO_REQUERIDO` por su cuenta si lo necesita (no lo hará: el parche ya lo resuelve antes).

## Fuera de alcance

- **Cerrar el middleware** (guardianes 2/3/4) cuando `estado === null` para `/api/**`. Va en SPEC-400b, después de que PR 1 esté en producción y verificado.
- **Hallazgos colaterales del análisis** (fuera de I-236):
  - `/api/publico/**` era una falsa alarma: mi lectura inicial vino de un clon principal stale; en `origin/main` fresco ya está exento por SPEC-346. Sin acción.
  - `/api/webhooks/resend` sí estaba caído (los rebotes de Resend nos rebotaban con 401 del borde). Se sacó SPEC-402 aparte (PR #307) — puede ser una pieza del misterio del correo caído (I-283).
- **Refresh sliding de la cookie**: el TTL de 5 min no se cambia. El fix del cerrojo (PR 2) sumado al interceptor (PR 1) hace que la ventana ya no importe — el usuario nunca la ve.

## Referencias

- I-236 (fail-open guardianes) · Traspaso CEO 03-09-2026.
- [middleware.ts](../../middleware.ts) · [vigencia-cookie.ts](../../src/lib/routing/vigencia-cookie.ts) · [guardias.ts](../../src/lib/routing/guardias.ts) · [api/vigencia/refresh/route.ts](../../src/app/api/vigencia/refresh/route.ts).
- SPEC-287 (D-24 de julio) — introducción de la cookie firmada y del middleware unificado.
- I-109 / D-82 — un Dev, un worktree. Este PR arranca desde `origin/main d832ec3db` en `.worktrees/pi-SPEC-400`.
