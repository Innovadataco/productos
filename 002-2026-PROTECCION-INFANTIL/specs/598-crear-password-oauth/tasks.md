# Tasks — SPEC-598 · «Crear contraseña» para cuentas Google

## Fase 1 — Schema y migración (aditiva)
- [x] T001 · `Usuario.passwordCreadaEn DateTime?` con comentario del criterio
      (googleSub + hash aleatorio no distinguen; este timestamp sí) —
      `prisma/schema.prisma`
- [x] T002 · Migración `spec598_password_creada_en`: `ADD COLUMN
      "passwordCreadaEn" TIMESTAMPTZ(6)` —
      `prisma/migrations/20260908090000_spec598_password_creada_en/migration.sql`
      (aplicada con `prisma migrate deploy`)
- [x] T003 · `prisma generate` — cliente con `Usuario.passwordCreadaEn`

## Fase 2 — Sello y DAL
- [x] T010 · Helper genérico `firmarCodigoEmail`/`leerCodigoEmail` con claim
      `proposito` + wrappers `firmarCodigoCrearPassword`/`leerCodigoCrearPassword`
      (los del step-up delegan, firma intacta) — `src/lib/routing/stepup-sello.ts`
- [x] T011 · `AutenticacionService.crearPassword`: titularidad OAuth-sin-clave
      en el DAL + escribe hash/`passwordCreadaEn`/limpia flag —
      `src/lib/dal/services/autenticacion.ts`
- [x] T012 · `passwordCreadaEn` en registrar/completarRegistro/
      cambiarPassword/restablecerPassword — `src/lib/dal/services/autenticacion.ts`

## Fase 3 — API
- [x] T020 · `POST /api/auth/crear-password/codigo`: 409 si no aplica, rate-limit
      `crear_password_codigo`, firma + envío fail-closed vía motor de
      notificaciones — `src/app/api/auth/crear-password/codigo/route.ts`
- [x] T021 · `POST /api/auth/crear-password`: 409/400/401 en orden, persistencia
      vía DAL, aviso de seguridad con rastro (SPEC-415), audit
      USUARIO_CAMBIO_PASSWORD — `src/app/api/auth/crear-password/route.ts`
- [x] T022 · `/api/me` expone `googleSub` + `passwordCreadaEn` —
      `src/app/api/me/route.ts`

## Fase 4 — UI
- [x] T030 · Menú: «Crear contraseña» cuando `googleSub && !passwordCreadaEn` —
      `src/components/modules/NavHeader.tsx`, tipo `User` en
      `src/lib/contexts/AuthContext.tsx`
- [x] T031 · Página en modo crear: código + reenvío + nueva + confirmar, sin
      contraseña actual; refresca sesión al terminar —
      `src/app/cambiar-password/page.tsx`

## Fase 5 — Seed y candados
- [x] T040 · Plantilla + regla `auth.crear_password.codigo` —
      `prisma/seed.ts`
- [x] T041 · Ruta nueva en el grupo B del candado de avisos de seguridad —
      `src/lib/errores-no-mudos.test.ts`
- [x] T042 · Test unitario del sello en `vitest.unit.includes.ts` +
      `src/lib/routing/stepup-sello.test.ts`

## Fase 6 — Tests y compuertas
- [x] T050 · 10 tests del endpoint: happy path (hash + passwordCreadaEn + audit
      + login con la nueva), código inválido/vencido/de otro propósito (401),
      confirmación distinta (400), no-OAuth (409), OAuth con clave (409), sin
      auth (401), código enviado (200/409) —
      `src/app/api/auth/crear-password/route.test.ts`
- [x] T051 · 3 tests del menú según googleSub/passwordCreadaEn —
      `src/components/modules/NavHeader.test.tsx`
- [x] T052 · Regenerar `docs/architecture/01-modelo-datos.md`; `arch:check` VERDE
- [x] T053 · Compuertas: `tsc --noEmit`, `npm run lint`, `npm run test`,
      `npm run build` — VERDES

## Fase 7 — Artefactos y cierre
- [x] T060 · `spec.md` + `plan.md` + `tasks.md` en `specs/598-crear-password-oauth/`
- [x] T061 · Índice `specs/README.md` actualizado
