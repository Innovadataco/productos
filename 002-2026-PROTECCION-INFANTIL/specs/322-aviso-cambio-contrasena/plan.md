# Plan · SPEC-322 · Aviso por correo cuando cambia la contraseña

## Stack y restricciones

- Next.js 14 App Router · TypeScript · Prisma · Vitest
- Motor de notificaciones existente: `src/lib/notificaciones/motor.ts`
- Patrón a replicar: `usuario.credenciales.padre` (seed.ts:836-985 + email.ts:84-89)
- Cero migraciones · cero dependencias nuevas

## Archivos a modificar / crear

| Archivo | Acción | Motivo |
|---|---|---|
| `src/lib/dal/types/auth.ts` | Editar | Extender `ResultadoRestablecer` con `email` en éxito |
| `src/lib/dal/services/autenticacion.ts` | Editar | Devolver `email` en `restablecerPassword` |
| `prisma/seed.ts` | Editar | Plantilla + regla `auth.password_cambiada` |
| `src/lib/email.ts` | Editar | Wrapper `enviarEmailCambioPassword` |
| `src/lib/email.migracion.test.ts` | Editar | Sumar a `EVENTOS_MIGRADOS` |
| `src/app/api/auth/recuperar/restablecer/route.ts` | Editar | Llamada try/catch camino 1 |
| `src/app/api/auth/cambiar-password/route.ts` | Editar | Llamada try/catch camino 2 |
| `src/app/api/auth/activar/route.ts` | Editar | Llamada try/catch camino 8 |
| `specs/README.md` | Editar | Fila SPEC-322 |

## Decisión `rol` en la regla del seed

`upsertNotificacionRegla` exige `rol: string` (no nullable). El motor (`programar()`) filtra por
`evento` + `canal`, no por `rol` — el campo es solo metadata para el panel admin. Una sola regla
con `rol: "ALL"` cubre todos los roles sin necesidad de sembrar 5 reglas. Único key
`evento_canal_plantillaClave` garantiza idempotencia.

## Callsites (Candado 22 v5)

| # | Archivo | Línea aproximada | Función modificada |
|---|---|---|---|
| C1 | `src/lib/dal/types/auth.ts` | 34 | `ResultadoRestablecer` (tipo) |
| C2 | `src/lib/dal/services/autenticacion.ts` | ~243 | `restablecerPassword` return |
| C3 | `src/lib/email.ts` | ~100 (nuevo) | `enviarEmailCambioPassword` |
| C4 | `prisma/seed.ts` | ~836 (nuevo bloque) | plantilla `auth.password_cambiada.email` |
| C5 | `prisma/seed.ts` | ~971 (nuevo bloque) | regla `auth.password_cambiada` |
| C6 | `src/lib/email.migracion.test.ts` | ~29 | `EVENTOS_MIGRADOS` array |
| C7 | `src/app/api/auth/recuperar/restablecer/route.ts` | ~30 | try/catch post-ok camino 1 |
| C8 | `src/app/api/auth/cambiar-password/route.ts` | ~45 | try/catch post-ok camino 2 |
| C9 | `src/app/api/auth/activar/route.ts` | ~20 | try/catch post-ok camino 8 |

## Fase 1 — Tipo y service

1. `ResultadoRestablecer` → `{ ok: true; email: string } | { ok: false; tipo: ... }`
2. `restablecerPassword` → return `{ ok: true, email: tokenEncontrado.usuario.email }`

## Fase 2 — Motor de notificaciones

3. Plantilla en seed.ts: `auth.password_cambiada.email` (asunto, cuerpo con fecha/hora COT)
4. Regla en seed.ts: evento `auth.password_cambiada`, canal EMAIL, `obligatoria: true`, `rol: "ALL"`
5. Wrapper `enviarEmailCambioPassword(email: string): Promise<void>` en email.ts

## Fase 3 — Callsites en rutas

6. Camino 1 (`restablecer/route.ts`): leer `resultado.email`, llamar wrapper en try/catch
7. Camino 2 (`cambiar-password/route.ts`): usar `user.email` de `verifyAuth()`, llamar wrapper en try/catch
8. Camino 8 (`activar/route.ts`): usar `resultado.user.email`, llamar wrapper en try/catch

## Fase 4 — Tests

9. Sumar `auth.password_cambiada` a `EVENTOS_MIGRADOS` en `email.migracion.test.ts`
10. Correr suite completa: `email.migracion`, `autenticacion`, rutas afectadas

## Impacto en arquitectura

Nuevo evento `auth.password_cambiada` en el motor de notificaciones; extensión de tipo `ResultadoRestablecer`;
3 callsites de envío en rutas auth. Cero campos nuevos en BD, cero migraciones.
