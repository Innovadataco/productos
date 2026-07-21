# Cierre: Colegios · Fase 4 — Alertas y Consulta anonimizada

**Spec**: 077-colegios-alertas-consulta  
**Rama**: `feature/001-scaffolding`  
**Fecha de cierre**: 2026-07-21

## Resumen

Se implementó la generación de alertas anonimizadas para colegios cuando un reporte visible menciona un identificador registrado por el colegio, y la consulta de esas alertas para el SCHOOL_ADMIN con estricto filtro de privacidad.

## Evidencia de cambios

### Archivos tocados

- `prisma/schema.prisma` — modelo `AlertaColegio`, relaciones inversas, campo `Usuario.ultimaNotificacionColegioEn`, valores `COLEGIO_ALERTA_*` en `AccionAudit`.
- `prisma/migrations/20260721090000_add_alerta_colegio/migration.sql` — migración aditiva.
- `src/lib/colegio/alertas.ts` — lógica de matching, listado, cambio de estado y notificaciones.
- `src/lib/colegio/alertas.test.ts` — tests unitarios de matching, duplicados, privacidad, notificaciones.
- `src/lib/email.ts` — `enviarAlertaColegio`.
- `src/lib/schemas/index.ts` — `alertaEstadoSchema`, `alertaIdParamsSchema`, `alertaQuerySchema`.
- `src/lib/test-utils.ts` — borrar `AlertaColegio` en `resetDatabase`.
- `scripts/worker-reportes.mjs` — llamada a `notificarColegioSiCorresponde` tras círculo de confianza.
- `src/app/api/colegio/alertas/route.ts` — GET listado de alertas.
- `src/app/api/colegio/alertas/route.test.ts` — tests de integración de listado y privacidad.
- `src/app/api/colegio/alertas/[id]/estado/route.ts` — PATCH cambio de estado.
- `src/app/dashboard/colegio/alertas/page.tsx` — UI de alertas con tema verde.
- `src/app/dashboard/colegio/page.tsx` — enlace activo a Alertas.

### Backup de base de datos

- Ruta: `/tmp/backup-pre-077.dump`
- Tamaño: 1.8M
- Método: `pg_dump` desde el contenedor PostgreSQL.

## Resultados de validación

| Validación | Comando | Resultado |
|------------|---------|-----------|
| Type check | `npx tsc --noEmit` | ✅ Sin errores |
| Lint | `npm run lint` | ✅ Sin errores |
| Tests | `npx vitest run` | ✅ 704 tests verdes |
| Build | `npm run build` | ✅ Exitoso |
| Deploy limpio | `./scripts/dev-restart.sh` | ✅ Healthcheck OK, un worker |
| Quickstart | requests HTTP manuales | ✅ Flujo punta a punta validado |

## Quickstart ejecutado

1. Login como ADMIN y creación de colegio "Colegio Quickstart 077" con SCHOOL_ADMIN.
2. Login como SCHOOL_ADMIN, creación de curso `6A`, alumno "María Quickstart" e identificador `+57300777077`.
3. Creación anónima de reporte con identificador `+57300777077`.
4. Worker procesó el reporte a estado `REVISION_MANUAL`.
5. `GET /api/colegio/alertas` devolvió alerta con: identificador, relación `ALUMNO`, categoría `OFRECIMIENTO_REGALOS`, estado del reporte, estado de alerta `nueva`, fecha.
6. `PATCH /api/colegio/alertas/{id}/estado` con `{estado: "vista"}` y luego `{estado: "gestionada"}` funcionó.
7. Login como ADMIN e intento de `GET /api/colegio/alertas` → `403`.
8. Baja del reporte como ADMIN → alerta desapareció del listado del colegio.

## Regla dura de privacidad

La respuesta de `/api/colegio/alertas` no incluye: `texto`, `ciudad`, `pais`, `edadVictima`, `plataforma`, `identificadorDenunciante`, `textoAnonimizado`, ni el `reporteId`. Solo expone el identificador del alumno (que ya es propiedad del colegio) y metadata no sensible del reporte.

## Migración

- Migración aditiva: `20260721090000_add_alerta_colegio`.
- Aplicada en `proteccion_infantil` y `proteccion_infantil_test`.
- Sin `prisma migrate reset`; datos preservados.

## Commits

A continuación se generan los commits:
- Uno por User Story 1 (matching/alertas).
- Uno por User Story 2 (consulta/endpoints/UI).
- Uno por User Story 3 (notificaciones).
- Uno de documentación/cierre.

Hash final: `31d8572`.

## Deuda técnica

- Matching exacto normalizado; posible mejora con normalización canónica de teléfonos en Fase 5.
- Notificación a un solo SCHOOL_ADMIN; soportar múltiples admins si se requiere en el futuro.
- Estado de alerta ante reporte dado de baja: actualmente se oculta del listado; Fase 5 puede definir estado `retirada`.
