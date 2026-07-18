# Tasks 018 — Operadores de casos

> Derivado de [`diseno.md`](diseno.md).

## Fase 1 — Schema, auth y permisos

- [ ] Agregar `OPERADOR` a `RolUsuario`.
- [ ] Crear modelo `PerfilOperador` con `usuarioId`, `cupoMaximo`, `esRevisorDeApelaciones`, `notasInternas`, `creadoPorId`.
- [ ] Agregar `operadorId` a `Reporte` y a `ApelacionIdentificador` con relación a `Usuario`.
- [ ] Extender `AccionAudit` con acciones de operadores.
- [ ] Generar y aplicar migración `prisma migrate dev` sobre BD poblada.
- [ ] Actualizar `verifyAuth` y `requireRol` para aceptar múltiples roles.
- [ ] Crear helpers `requireAdmin` y `requireOperadorOAadmin`.
- [ ] Verificar `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm test -- --run`.
- [ ] Commit + push.

## Fase 2 — CRUD de operadores (admin)

- [ ] Endpoints `/api/admin/operadores` (GET, POST) y `/api/admin/operadores/[id]` (PATCH, DELETE).
- [ ] Endpoint `/api/admin/operadores/[id]/reactivar` (POST).
- [ ] Lógica: alta genera contraseña temporal y envía email de bienvenida (reutilizar flujo de recuperación).
- [ ] Página `/dashboard/admin/operadores` con tabla, formulario de alta y edición inline.
- [ ] Agregar link en `AdminNav`.
- [ ] AuditLog en alta, edición, activación/desactivación.
- [ ] Verificar suite verde y smoke.
- [ ] Commit + push.

## Fase 3 — Motor de asignación

- [ ] Crear `src/lib/operadores/asignador.ts` con función `asignarOperador(reporteId)`.
- [ ] Algoritmo aleatorio ponderado por carga inversa; excluye inactivos y operadores sin cupo.
- [ ] Hook en `POST /api/reportes/procesar` para asignar cuando el estado final sea `REVISION_MANUAL`.
- [ ] Hook opcional en reclasificación manual admin.
- [ ] Endpoint `POST /api/admin/reportes-revision/[id]/reasignar` para admin/supervisor.
- [ ] Manejo "sin operadores activos": caso queda sin asignar + alerta admin configurable.
- [ ] AuditLog `OPERADOR_ASIGNADO` y `OPERADOR_REASIGNADO`.
- [ ] Verificar suite verde y smoke.
- [ ] Commit + push.

## Fase 4 — Trazabilidad e integración

- [ ] Extender `GET /api/admin/reportes-revision` con filtros (`mios`, `sinOperador`, `prioridadAlta`).
- [ ] Validar en acciones de reportes-revisión que el usuario sea el operador asignado o admin.
- [ ] Endpoint `GET /api/admin/mis-casos` para operadores.
- [ ] Integrar asignación de apelaciones a operadores con `esRevisorDeApelaciones = true`.
- [ ] Actualizar `AdminApelaciones` para mostrar operador asignado y permitir resolver si es el asignado/admin.
- [ ] AuditLog de acciones de operador: `CASO_CONFIRMADO`, `CASO_CORREGIDO`, `CASO_DADO_DE_BAJA`, `CASO_ESCALADO`, `CASO_NOTA_AGREGADA`.
- [ ] Verificar suite verde y smoke.
- [ ] Commit + push.

## Fase 5 — Tests de integración y cierre

- [ ] Tests de asignación ponderada con operadores de prueba.
- [ ] Test de caso trabado (operador inactivo mantiene caso).
- [ ] Test de reasignación manual.
- [ ] Test de apelaciones asignadas a revisores.
- [ ] Test de permisos (operador no ve caso ajeno).
- [ ] Actualizar `specs/README.md` a estado CERRADA.
- [ ] Escribir `reporte-cierre.md`.
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm test -- --run`, `npx tsx scripts/smoke-e2e.ts` verdes.
- [ ] Commit + push final.

## Notas

- R7: no toca el pipeline de clasificación; solo asigna reportes ya clasificados como `REVISION_MANUAL`.
- Reutilizar: `verifyAuth`, `AuditLog`, `ParametroSistema`, `AdminNav`, tablas y tarjetas existentes.
