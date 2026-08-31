# Implementation Plan: Middleware JSON 403 en guardianes para /api/ (SPEC-329)

**Branch**: `work/pi-SPEC-329-middleware-api-json-guardias` | **Date**: 2026-08-30 | **Spec**: [spec.md](spec.md)

**Radicado**: 002-PI-229 · 🔴 hotfix de producción

## Summary

Hotfix acotado a `middleware.ts` (raíz). En los tres guardianes de estado (Pasos 4/5/6: consentimiento, cambio-de-password, vigencia) se agrega, ANTES del `redirect()`, una rama que distingue rutas de API — espejo del Paso 2 (que ya devuelve JSON 401 para `/api/`). Para `/api/**` gateadas: `NextResponse.json({ error: { message, code, redirectTo } }, { status: 403 })`. Para pantallas (no-api): el `redirect()` queda exactamente como estaba.

## Technical Context

**Language**: TypeScript 5 (strict), Next.js 16 middleware (Edge runtime). **Storage**: N/A (el middleware no toca la BD; lee JWT + cookie de estado firmada por HMAC). **Testing**: Vitest — se importa `middleware` de la raíz y se lo invoca con `NextRequest` + cookies firmadas (`SignJWT` para la sesión, `firmarSesionEstado` para el estado). **Scope**: un archivo de producción + un test + spec + fila README.

## Constitution Check

- Sin cambios de esquema, sin `src/lib/**`, sin tocar `alertas.ts`/motor/CI. ✅
- Ratchets de middleware (`guardia-invariante`, `no-redirect-layout`, `no-self-redirect`) siguen verdes. ✅
- Paso 2, listas de exención, orden de guardianes y lógica de estado NO se tocan. ✅

**Sin violaciones.**

## Design

- **Codes** (legibles por máquina, uno por guardián): `CONSENTIMIENTO_REQUERIDO`, `CAMBIO_PASSWORD_REQUERIDO`, `VIGENCIA_REQUERIDA`.
- **`redirectTo`** = el mismo `destino` del redirect (`GUARDIAS_ACCESO.consentimiento.destino`, `.cambiarPassword.destino`, `destinoVigencia(sesion.rol)`).
- **`message`** humano en español, sin tecnicismos (A-62).
- **403**, no 401: el usuario está autenticado; está gateado por estado.

## Estructura del cambio

```text
middleware.ts                                  # Pasos 4/5/6: rama api→JSON 403, no-api→redirect intacto
src/middleware-api-guardias.test.ts            # 3 guardianes × [POST /api/ → 403 JSON; GET /dashboard → 302]
specs/329-middleware-api-json-guardias/        # spec.md, plan.md, tasks.md
specs/README.md                                # fila 329
```

## Verificación

Gate de calidad local (§53 del instructivo): `tsc` + `lint` + `tokens:check` + `arch:check` + `locks:check` + `ratchets:check` + `specs-discipline.test.ts` + el test nuevo. La §6b en vivo (curl contra prod, `activar-freemium`) la cierra el CEO al desplegar.
