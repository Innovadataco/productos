# Tasks 018 — Operadores de casos

> Derivado de [`diseno.md`](diseno.md).
> Todos los ítems completados el 2026-07-18.

## Fase 1 — Schema, auth y permisos

- [x] Agregar `OPERADOR` a `RolUsuario`.
- [x] Crear modelo `PerfilOperador` con `usuarioId`, `cupoMaximo`, `esRevisorDeApelaciones`, `notasInternas`, `creadoPorId`.
- [x] Agregar `operadorId` a `Reporte` y a `ApelacionIdentificador` con relación a `Usuario`.
- [x] Extender `AccionAudit` con acciones de operadores.
- [x] Generar y aplicar migración `prisma migrate dev` sobre BD poblada.
- [x] Actualizar `verifyAuth` y `requireRol` para aceptar múltiples roles.
- [x] Crear helpers `requireAdmin` y `requireOperadorOAadmin`.
- [x] Verificar `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm test -- --run`.
- [x] Commit + push.

## Fase 2 — CRUD de operadores (admin)

- [x] Endpoints `/api/admin/operadores` (GET, POST) y `/api/admin/operadores/[id]` (PATCH, DELETE).
- [x] Endpoint `/api/admin/operadores/[id]/reactivar` (POST).
- [x] Lógica: alta genera contraseña temporal y envía email de bienvenida.
- [x] Página `/dashboard/admin/operadores` con tabla, formulario de alta y edición inline.
- [x] Agregar link en `AdminNav`.
- [x] AuditLog en alta, edición, activación/desactivación.
- [x] Verificar suite verde y smoke.
- [x] Commit + push.

## Fase 3 — Motor de asignación

- [x] Crear `src/lib/operadores/asignador.ts` con función `asignarOperadorAReporte(reporteId)`.
- [x] Algoritmo aleatorio ponderado por carga inversa; excluye inactivos y operadores sin cupo.
- [x] Hook en `POST /api/reportes/procesar` para asignar cuando el estado final sea `REVISION_MANUAL`.
- [x] Hook en el catch de error de procesamiento.
- [x] Endpoint `POST /api/admin/reportes-revision/[id]/reasignar` para admin/supervisor.
- [x] Manejo "sin operadores activos": caso queda sin asignar.
- [x] AuditLog `OPERADOR_ASIGNADO` y `OPERADOR_REASIGNADO`.
- [x] Verificar suite verde y smoke.
- [x] Commit + push.

## Fase 4 — Trazabilidad e integración

- [x] Extender `GET /api/admin/reportes-revision` con filtro por `operadorId` (admin) y visión propia para operadores.
- [x] Validar en acciones de reportes-revisión que el usuario sea el operador asignado o admin.
- [x] Integrar asignación de apelaciones a operadores con `esRevisorDeApelaciones = true`.
- [x] Actualizar endpoints de apelaciones para mostrar/operar según asignación.
- [x] AuditLog de acciones de operador: `CASO_CONFIRMADO`, `CASO_CORREGIDO`, `CASO_DADO_DE_BAJA`.
- [x] Verificar suite verde y smoke.
- [x] Commit + push.

## Fase 5 — Tests de integración y cierre

- [x] Tests de asignación ponderada con operadores de prueba.
- [x] Test de caso trabado (operador inactivo mantiene caso).
- [x] Test de reasignación manual.
- [x] Test de apelaciones asignadas a revisores.
- [x] Test de permisos implícitos en `asignarOperadorAReporte` (no reasigna si ya tiene operador).
- [x] Actualizar `specs/README.md` a estado CERRADA.
- [x] Escribir `reporte-cierre.md`.
- [x] `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm test -- --run`, `npx tsx scripts/smoke-e2e.ts` verdes.
- [x] Commit + push final.

## Notas

- R7: no toca el pipeline de clasificación; solo asigna reportes ya clasificados como `REVISION_MANUAL`.
- Reutilizar: `verifyAuth`, `AuditLog`, `ParametroSistema`, `AdminNav`, tablas y tarjetas existentes.
