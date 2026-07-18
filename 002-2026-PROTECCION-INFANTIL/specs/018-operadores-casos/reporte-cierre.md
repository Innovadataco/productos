# Reporte de cierre — Spec 018: Operadores de casos

> Fecha de cierre: 2026-07-18.
> Rama: `feature/001-scaffolding`.
> Tag de seguridad previo: `pre-018-20260718`.

## Resumen

Se implementó el rol `OPERADOR` y todo el flujo de revisión humana de casos:
- Schema y auth (Fase 1).
- CRUD de operadores en el panel admin (Fase 2).
- Motor de asignación automática ponderada por carga inversa (Fase 3).
- Trazabilidad e integración con reportes-revision y apelaciones (Fase 4).
- Tests de integración y documentación Spec-Kit (Fase 5).

## Decisiones respetadas

- Los operadores son empleados creados por admin.
- Asignación aleatoria por integridad al entrar a `REVISION_MANUAL`.
- Caso trabado con el operador hasta que vuelva o un admin reasigne.
- Pool de revisores de apelaciones marcados con `esRevisorDeApelaciones`.

## Archivos creados/modificados por fase

### Fase 1 — Schema/auth
- `prisma/schema.prisma`: `OPERADOR`, `PerfilOperador`, `operadorId` en `Reporte`/`ApelacionIdentificador`, nuevas `AccionAudit`.
- `prisma/migrations/20260718130000_operadores_casos_fase1/migration.sql`
- `src/lib/auth.ts`: `verifyAuth`/`requireRol` multirol, `requireAdmin`, `requireOperadorOAdmin`.
- `src/lib/test-utils.ts`: limpieza de `perfilOperador` antes que usuarios.

### Fase 2 — CRUD operadores
- `src/lib/email.ts`: `enviarEmailBienvenidaOperador`.
- `src/app/api/admin/operadores/route.ts` (GET/POST).
- `src/app/api/admin/operadores/[id]/route.ts` (PATCH/DELETE).
- `src/app/api/admin/operadores/[id]/reactivar/route.ts`.
- `src/app/dashboard/admin/operadores/page.tsx`.
- `src/components/modules/AdminNav.tsx`: link "Operadores".

### Mejora post-cierre — Plan B de contraseñas (2026-07-18)
- `prisma/migrations/20260718140000_operador_debe_cambiar_password/migration.sql`: agrega `Usuario.debeCambiarPassword` y acciones `OPERADOR_PASSWORD_REGENERADA`, `OPERADOR_EMAIL_REENVIADO`.
- `src/app/api/admin/operadores/route.ts`: ahora retorna `passwordTemporal` y `emailEnviado`; mensaje honesto si el email falla.
- `src/app/api/admin/operadores/[id]/regenerar-password/route.ts`: genera nueva contraseña temporal, la muestra una sola vez y marca `debeCambiarPassword=true`.
- `src/app/api/admin/operadores/[id]/reenviar-email/route.ts`: genera nueva contraseña, reenvía email de bienvenida y registra audit sin exponer la contraseña.
- `src/app/dashboard/admin/operadores/page.tsx`: muestra contraseña temporal con botón copiar, badge "Debe cambiar contraseña", botones "Regenerar contraseña" y "Reenviar email".
- `src/app/api/admin/operadores/[id]/regenerar-password/route.test.ts`.
- `src/app/api/admin/operadores/[id]/reenviar-email/route.test.ts`.

### Fase 3 — Motor de asignación
- `src/lib/operadores/asignador.ts`: `asignarOperadorAReporte` con ponderación inversa.
- `src/app/api/reportes/procesar/route.ts`: hook de asignación en `REVISION_MANUAL` y en error.
- `src/app/api/admin/reportes-revision/[id]/reasignar/route.ts`.

### Fase 4 — Trazabilidad e integración
- `src/lib/operadores/permisos.ts`: helpers `puedeGestionarReporte`/`puedeGestionarApelacion`.
- `src/app/api/admin/reportes-revision/route.ts`: visión por rol + filtro `operadorId`.
- `src/app/api/admin/reportes-revision/[id]/route.ts`: permite OPERADOR sobre su caso.
- `src/app/api/admin/reportes-revision/[id]/confirmar/route.ts`: `CASO_CONFIRMADO`.
- `src/app/api/admin/correcciones/route.ts`: `CASO_CORREGIDO`.
- `src/app/api/admin/reportes/[id]/baja/route.ts`: `CASO_DADO_DE_BAJA`.
- `src/lib/reporte-lifecycle.ts`: `accionAudit` configurable.
- `src/lib/apealaciones.ts`: asignación automática a revisor de apelaciones.
- `src/app/api/admin/apeaciones/route.ts` y `[id]/resolver/route.ts`: visión/resolución por asignación.
- `src/lib/validators.ts`: `operadorId` en `reportesRevisionQuerySchema`.

### Fase 5 — Tests y documentación
- `src/lib/operadores/asignador.test.ts`.
- `src/lib/operadores/integracion.test.ts`.
- `specs/018-operadores-casos/spec.md`.
- `specs/018-operadores-casos/tasks.md` (actualizado).
- `specs/018-operadores-casos/reporte-cierre.md` (este archivo).
- `specs/README.md` (actualizado).

## Verificaciones

| Check | Resultado |
|-------|-----------|
| `npm run lint` | ✅ (1 warning preexistente en `src/lib/sms.ts`) |
| `npx tsc --noEmit` | ✅ |
| `npm run build` | ✅ |
| `npm test -- --run` | ✅ 239 tests |
| `npx tsx scripts/smoke-e2e.ts` | ✅ |

## Nota de seguridad / causa raíz del email de bienvenida

**Diagnóstico:** el email de bienvenida se generaba de forma sincrónica en `POST /api/admin/operadores` y se enviaba directamente vía Resend (sin pasar por el worker). En entorno de desarrollo Resend rechaza destinatarios de dominios de prueba (`example.com`) con `422 validation_error`; en producción con dominio/destinatario verificado funcionaría. El bug de UX era que el endpoint siempre respondía "Se envió la contraseña temporal por email" aunque el envío fallara.

**Mitigación implementada:**
- El endpoint de alta devuelve la contraseña temporal en la respuesta HTTP (única vez que se expone) junto a `emailEnviado: boolean` y un mensaje que refleja el resultado real.
- El admin puede regenerar la contraseña o reenviar el email desde la ficha del operador.
- La contraseña temporal nunca se almacena en claro ni se loguea; solo persiste su hash con bcrypt.
- AuditLog registra quién regeneró/reenvió, sin incluir la contraseña.

## R7

No aplica: esta spec no modifica el pipeline de clasificación. Solo asigna reportes que ya fueron clasificados como `REVISION_MANUAL`.

## Deuda técnica / próximos pasos

- UI de la cola de operador (`/dashboard/operador/mis-casos`) no se construyó; se puede agregar cuando el owner lo priorice.
- Métricas de carga por operador: disponibles vía `/api/admin/operadores` (conteos incluidos).
