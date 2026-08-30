# SPEC-030 · Endurecer resolución de BI_BASE_URL · sin fallback silencioso a localhost

## Metadatos

| Campo | Valor |
|---|---|
| **SPEC** | 030 |
| **Nombre** | endurecer-base-url |
| **Origen** | BI · INSTRUCTIVO-017 · F3C 2026-08-29 23:4x COT |
| **Prioridad** | 🟠 Media (endurecimiento · sin urgencia · parche de env ya aplicado en prod) |
| **Estado** | ⏳ spec+plan LISTO · pendiente REVISO |

---

## Objetivo

En el deploy real, `https://bi.innovadataco.com/dashboard` sin sesión generó un redirect con `returnTo=http://localhost:3001/dashboard`, rompiendo el puente de sesión. Causa raíz (verificada por Fábrica vía SSH): `BI_BASE_URL` no existía en `.env.bi.production` del VPS, así que el fallback silencioso `?? "http://localhost:3001"` (patrón presente en 2 archivos) devolvió `localhost` en producción.

Jelkin ya parcheó la env var (E2E desbloqueado). Este SPEC endurece el patrón de fondo para que **en producción nunca se devuelva silenciosamente una URL localhost**: si falta la env y no hay proxy-headers, el sistema debe fallar visible, no degradar a localhost.

---

## Alcance

### Helper único compartido · `src/lib/bi/base-url.ts` (nuevo)

Función `resolveBiBaseUrl(h)` con 3 niveles de resolución (en orden):

| Nivel | Fuente | Detalle |
|---|---|---|
| 1 | `x-forwarded-host` + `x-forwarded-proto` de los headers | Reconstruye `${proto}://${host}`. Es el proxy real en prod (Cloudflare Tunnel). Base de la evidencia empírica D-029.6: estos 2 headers SÍ llegan al Server Component. |
| 2 | `process.env.BI_BASE_URL` | Fallback por configuración explícita. |
| 3 | `NODE_ENV === "production"` → **THROW** explícito. Fuera de producción → `http://localhost:3001` | En prod jamás localhost silencioso. En dev local no rompemos el flujo. |

`h` es cualquier objeto con `.get(name): string | null` — tanto `headers()` de `next/headers` (ReadonlyHeaders) como `req.headers` (Headers) lo cumplen.

**Firma:**
```ts
export function resolveBiBaseUrl(h: { get(name: string): string | null }): string
```

Reglas internas:
- Nivel 1 solo aplica si AMBOS headers están presentes y no vacíos. `proto` se normaliza (toma el primer valor si viene lista `a,b`), default `https` si el header trae solo el host sin proto por alguna razón — pero preferimos exigir ambos.
- La URL resultante nunca lleva trailing slash (se normaliza).
- En Nivel 3 producción el throw lleva un mensaje claro: `"[SPEC-030] BI_BASE_URL no resuelto: falta x-forwarded-host/proto y BI_BASE_URL en producción"`.

### Aplicación en los 2 sitios con el patrón frágil

1. **`src/app/dashboard/layout.tsx`** — reemplazar
   ```ts
   const bi = process.env.BI_BASE_URL ?? "http://localhost:3001";
   ```
   por `const bi = resolveBiBaseUrl(h);` (ya hay `const h = await headers()` arriba).

2. **`src/app/api/auth/link/route.ts`** — reemplazar el helper local
   ```ts
   const biBase = (): string => process.env.BI_BASE_URL ?? "http://localhost:3001";
   ```
   por uso de `resolveBiBaseUrl(req.headers)`. Como `req` está disponible en el handler, se resuelve una vez al inicio de `GET` y se pasa a `sanitizeReturnTo` / `errRedirect` (que hoy llaman `biBase()` directamente).

### Comportamiento en producción

- Con proxy (caso normal Cloudflare): Nivel 1 → `https://bi.innovadataco.com`. Nunca localhost.
- Sin proxy pero con env: Nivel 2.
- Sin ninguno en prod: THROW → error 500 visible en logs (Next.js lo captura). **Preferible a un redirect roto silencioso** que el usuario no puede diagnosticar (la lección de esta noche).

En el endpoint `/api/auth/link`, un throw en `resolveBiBaseUrl` propaga como 500; es aceptable porque significa mala configuración de infraestructura, no input del usuario.

---

## Fuera de alcance

- No se cambia el contrato del JWT ni la lógica del puente de sesión (candado del INSTRUCTIVO).
- No se toca `sesionDeRequest` ni `jwt.ts` (candado 22).
- No se toca `.env.bi.production` del VPS (es de Jelkin · ya parcheado).
- No se resuelve la limitación D-029.6 de sub-rutas (returnTo sigue fijo a `/dashboard`); solo se endurece el HOST base.

---

## Candados aplicables

| # | Candado | Aplicación |
|---|---|---|
| 22 | Rutas SOLO LECTURA | NO se toca `sesionDeRequest`, `jwt.ts`. El helper nuevo vive en `src/lib/bi/base-url.ts`. |
| 15 | Verificar en fuente | La base del fix es la evidencia empírica D-029.6 (x-forwarded-host/proto SÍ llegan · verificado con `next build && next start`). |
| 9 | Fallo visible, nunca silencioso | En prod, falta de config → THROW visible, no localhost silencioso. |
| 14 | Verificación en vivo | Gate local con tests que simulan prod/dev + curl. |
| 17 | spec+plan commiteado antes de implementar | Aplicado. |

---

## Riesgos

- **THROW en producción rompe la página si la infra está mal configurada:** es intencional (la alternativa —redirect a localhost— es peor porque es invisible). Se documenta que un 500 en `/dashboard` o `/api/auth/link` con este mensaje = falta `BI_BASE_URL` o el proxy no envía `x-forwarded-*`. Mitigación: Nivel 1 (proxy) cubre el caso normal; el throw solo dispara si además falta la env.
- **`x-forwarded-proto` con múltiples valores** (`https,http` tras varios proxies): se toma el primero. Documentado en el helper.
- **Coherencia con SPEC-313 (lado PI):** el hotfix PI usa el mismo patrón `x-forwarded-host+proto → env → hardcode`. Este SPEC mirrorea la prioridad pero con throw en prod en vez de hardcode (BI no tiene un host "última garantía" equivalente porque el destino es dinámico). Se documenta la diferencia intencional.

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-29 23:5x COT |
| **Autor** | Dev BI-2 |
| **Aprobado por** | pendiente REVISO Fábrica BI-2 |
