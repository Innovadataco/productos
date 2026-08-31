# Tasks · SPEC-322 · Aviso por correo cuando cambia la contraseña

## Callsites (Candado 22 v5 — completos con archivo:línea)

| ID | Archivo | Línea base | Qué cambia |
|---|---|---|---|
| C1 | `src/lib/dal/types/auth.ts` | 34 | `ResultadoRestablecer` — añadir `email: string` al ok:true |
| C2 | `src/lib/dal/services/autenticacion.ts` | ~243 | `restablecerPassword` return `{ ok: true, email }` |
| C3 | `prisma/seed.ts` | ~931 (fin plantillas array) | Plantilla `auth.password_cambiada.email` |
| C4 | `prisma/seed.ts` | ~987 (fin reglas array) | Regla `auth.password_cambiada`, `obligatoria:true`, `rol:"ALL"` |
| C5 | `src/lib/email.ts` | ~100 (nuevo) | Wrapper `enviarEmailCambioPassword(email)` |
| C6 | `src/lib/email.migracion.test.ts` | ~29 (EVENTOS_MIGRADOS) | Sumar `"auth.password_cambiada"` |
| C7 | `src/app/api/auth/recuperar/restablecer/route.ts` | ~33 | try/catch tras ok — camino 1 |
| C8 | `src/app/api/auth/cambiar-password/route.ts` | ~48 | try/catch tras ok — camino 2 |
| C9 | `src/app/api/auth/activar/route.ts` | ~21 | try/catch tras ok — camino 8 |
| C10 | `src/app/api/admin/operadores/[id]/regenerar-password/route.ts` | ~47 | try/catch camino 4 |
| C11 | `src/app/api/admin/colegios/[id]/regenerar-password/route.ts` | ~62 | try/catch camino 6 |
| C12 | `src/app/api/colegio/comite/cuenta/regenerar-password/route.ts` | ~45 | try/catch camino 7 |
| C13 | `specs/README.md` | final | Fila SPEC-322 |

## Phase 1 — Tipo y service

- [ ] T001 Extender `ResultadoRestablecer` en `src/lib/dal/types/auth.ts:34` → `{ ok: true; email: string } | { ok: false; tipo: ... }`
- [ ] T002 Actualizar `restablecerPassword` en `src/lib/dal/services/autenticacion.ts:~243` para devolver `{ ok: true, email: tokenEncontrado.usuario.email }`

## Phase 2 — Motor de notificaciones (seed + email.ts)

- [ ] T003 Agregar plantilla `auth.password_cambiada.email` en `prisma/seed.ts` (después de `motor.deriva.alerta.email`, antes del `];` de plantillas)
- [ ] T004 Agregar regla `auth.password_cambiada` en el array `reglas` de `prisma/seed.ts` (después de `motor.deriva.alerta`, antes del `];`)
- [ ] T005 Agregar wrapper `enviarEmailCambioPassword(email: string): Promise<void>` en `src/lib/email.ts`
- [ ] T006 Sumar `"auth.password_cambiada"` a `EVENTOS_MIGRADOS` en `src/lib/email.migracion.test.ts:~29`

## Phase 3 — Callsites en rutas

- [ ] T007 Camino 1: leer `resultado.email`, llamar `enviarEmailCambioPassword` en try/catch en `src/app/api/auth/recuperar/restablecer/route.ts`
- [ ] T008 Camino 2: usar `user.email` (ya disponible de `verifyAuth()`), llamar wrapper en try/catch en `src/app/api/auth/cambiar-password/route.ts`
- [ ] T009 Camino 8: usar `resultado.user.email`, llamar wrapper en try/catch en `src/app/api/auth/activar/route.ts`

## Phase 4 — Documentación y README

- [ ] T010 Agregar fila SPEC-322 en `specs/README.md`

## Tests a correr (Candado 24 v2)

Archivos tocados → tests a ejecutar:
- `src/lib/dal/types/auth.ts` → tests de `autenticacion.ts` que usan `ResultadoRestablecer`
- `src/lib/dal/services/autenticacion.ts` → `src/lib/dal/services/autenticacion.test.ts` (si existe)
- `prisma/seed.ts` → `src/lib/email.migracion.test.ts` (verifica regla + plantilla)
- `src/lib/email.ts` → `src/lib/email.migracion.test.ts`
- `src/lib/email.migracion.test.ts` → (es el test)
- Rutas → tests de integración relacionados (si existen)
