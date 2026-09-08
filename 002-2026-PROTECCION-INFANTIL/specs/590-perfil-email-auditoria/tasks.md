# Tasks — SPEC-590 · Perfil del padre: email editable + historial de cambios

## Fase 1 — Schema y migración (aditiva)
- [x] T001 · `Usuario.googleSub String? @unique` (con comentario SPEC-590 tras
      `email`) — `prisma/schema.prisma`
- [x] T002 · Valor `PERFIL_CAMBIO` al final del enum `AccionAudit` —
      `prisma/schema.prisma`
- [x] T003 · Migración `spec590_perfil_email_auditoria`: `ADD COLUMN googleSub`
      + `CREATE UNIQUE INDEX "Usuario_googleSub_key"` + `ALTER TYPE "AccionAudit"
      ADD VALUE 'PERFIL_CAMBIO'` —
      `prisma/migrations/20260908003050_spec590_perfil_email_auditoria/migration.sql`
      (aplicada con `prisma migrate deploy` contra la BD de test; `migrate dev`
      no corre en entorno no interactivo)
- [x] T004 · `prisma generate` — cliente con `googleSub` y `PERFIL_CAMBIO`

## Fase 2 — Lógica compartida y API
- [x] T010 · `ETIQUETAS_CAMPO_PERFIL` + `detectarCambiosPerfil` (normaliza
      fechaNacimiento a YYYY-MM-DD; null/""/undefined → null) — fuente única
      campo→etiqueta para PATCH y GET — `src/lib/padre/perfil-cambios.ts` (nuevo)
- [x] T011 · DAL: `obtenerPerfilPadre` selecciona `email`;
      `actualizarPerfilPadre` acepta `email` — `src/lib/dal/repositories/usuario.ts`
- [x] T012 · PATCH `/api/padre/perfil`: schema Zod con `email` (trim +
      lowercase + email + max 255); unicidad 409 si lo tiene OTRO usuario;
      detección de cambios contra el valor anterior; una fila `AuditLog`
      `PERFIL_CAMBIO` por campo cambiado; aviso al correo nuevo no bloqueante —
      `src/app/api/padre/perfil/route.ts`
- [x] T013 · GET `/api/padre/perfil/auditoria`: scope SIEMPRE el usuario de la
      sesión (nunca por query), paginación estándar (page/pageSize 25/100),
      orden `creadoEn` desc, shape `{items:[{id,campo,etiqueta,anterior,nuevo,
      creadoEn}], pagination}` — `src/app/api/padre/perfil/auditoria/route.ts`
      (nuevo; el proxy ya cubre `/api/padre/**` por prefijo)

## Fase 3 — OAuth y email
- [x] T020 · Resolución OAuth: 1) por `googleSub` (findUnique), 2) por email
      con backfill del sub cuando es null (NUNCA pisa un sub distinto); al crear
      persiste `googleSub` — `src/lib/dal/services/autenticacion-oauth.ts`
- [x] T021 · `enviarAvisoCambioEmail` (evento `padre.perfil.email_cambiado`,
      variable `urlLogin`, throw si 0 reglas) re-exportado en `src/lib/email.ts`
      — `src/lib/email-padre.ts`
- [x] T022 · Plantilla `padre.perfil.email_cambiado.email` (obligatoria) + regla
      del evento para rol PARENT en el seed — `prisma/seed.ts`

## Fase 4 — UI
- [x] T030 · Campo «Correo electrónico» (type=email) en el formulario, SOLO
      fuera del camino guiado; prefill desde el perfil; se envía en el body
      cuando no es camino — `src/components/modules/padre/PerfilPadreForm.tsx`
- [x] T031 · Sección «Historial de cambios»: fetch `/api/padre/perfil/auditoria
      ?pageSize=50`, etiqueta + anterior→nuevo + fecha hora Bogotá, valor null
      como «vacío» — `src/components/modules/padre/HistorialCambiosPerfil.tsx`
      (nuevo)
- [x] T032 · Montar el historial bajo el formulario —
      `src/app/dashboard/padre/perfil/page.tsx`

## Fase 5 — Tests y compuertas
- [x] T040 · Tests del PATCH: email guardado en minúsculas + aviso disparado,
      409 cuando lo tiene otro, aceptación del propio sin auditoría ni aviso,
      rechazo de email inválido, AuditLog por campo cambiado, PATCH sin cambios
      sin filas, GET devuelve email — `src/app/api/padre/perfil/route.test.ts`
- [x] T041 · Tests OAuth: resolución por sub con email distinto (no duplica),
      backfill del sub, no pisa sub distinto, creación persiste sub + auditoría
      USER_CREATE — `src/lib/dal/services/autenticacion-oauth.test.ts` (nuevo)
- [x] T042 · Tests del GET auditoría: 401 sin sesión, scope propio (ruido de
      otro usuario y otra acción), etiqueta legible, paginación y orden DESC,
      pageSize fuera de rango → 400 —
      `src/app/api/padre/perfil/auditoria/route.test.ts` (nuevo)
- [x] T043 · Evento migrado en `src/lib/email.migracion.test.ts`; callback
      OAuth SPEC-587 sigue verde
- [x] T044 · Regenerar línea base `docs/architecture/01-modelo-datos.md`
      (`npx tsx scripts/arch/generar-modelo-datos.ts` vía arch:check)
- [x] T045 · Compuertas: `tsc --noEmit`, vitest de archivos tocados,
      `npm run arch:check`, ESLint de archivos tocados — VERDES

## Fase 6 — Artefactos y cierre
- [x] T050 · `spec.md` + `tasks.md` en `specs/590-perfil-email-auditoria/`
- [x] T051 · Índice `specs/README.md` actualizado
