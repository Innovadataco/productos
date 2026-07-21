# Checklist: Colegios · Fase 4 — Alertas y Consulta anonimizada

## Modelo y migración

- [x] Migración aditiva crea `AlertaColegio`.
- [x] No se borra ni modifica datos existentes.
- [x] Índices por `colegioId`, `reporteId`, `estado`.
- [x] Restricción `@@unique([colegioId, reporteId, identificadorAlumnoId])`.

## Matching

- [x] Función `notificarColegioSiCorresponde(reporteId)` en `src/lib/colegio/alertas.ts`.
- [x] Busca `IdentificadorAlumno.valor = reporte.identificador` (normalizado).
- [x] Solo identificadores activos y colegios activos/vigentes.
- [x] Crea alertas sin exponer PII.
- [x] Evita duplicados con upsert.
- [x] Integrado en `scripts/worker-reportes.mjs` tras procesar reporte.

## Endpoints

- [x] `GET /api/colegio/alertas` filtra por `colegioId` del SCHOOL_ADMIN.
- [x] `GET /api/colegio/alertas` NO expone texto del reporte ni PII.
- [x] `PATCH /api/colegio/alertas/[id]/estado` valida propiedad del colegio.
- [x] Estados permitidos: `nueva`, `vista`, `gestionada`.
- [x] Auditoría `COLEGIO_ALERTA_CREADA` y `COLEGIO_ALERTA_ESTADO`.

## UI

- [x] Vista `/dashboard/colegio/alertas` con tema verde.
- [x] Lista de alertas con identificador, relación, categoría, estado, fecha.
- [x] Botones para marcar como vista/gestionada.
- [x] Estado vacío cuando no hay alertas.
- [x] No muestra datos crudos del reporte.

## Seguridad y privacidad

- [x] Tests que verifiquen que NO se devuelve texto, ciudad, país, edad, plataforma, ni identificador del denunciante.
- [x] Tests de aislamiento: SCHOOL_ADMIN no ve alertas de otro colegio.
- [x] ADMIN/OPERADOR/COMITE/PARENT reciben 403.
- [x] Reporte dado de baja: alerta no aparece en listado.
- [x] Reporte eliminado: no se genera alerta.

## Notificaciones (P2)

- [x] Email ciego genérico al SCHOOL_ADMIN cuando se genera alerta (si habilitado).
- [x] Cooldown 24h por defecto.
- [x] Respetar preferencia de notificaciones del SCHOOL_ADMIN.

## Tests

- [x] Tests de matching en worker.
- [x] Tests de endpoints (listado, cambio de estado, aislamiento, privacidad).
- [x] Tests de no-duplicados.
- [x] `npx vitest run` pasa (≥678 tests).
- [x] `npx tsc --noEmit` y `npm run lint` pasan.

## Deploy y cierre

- [x] `npm run build` exitoso.
- [x] `./scripts/dev-restart.sh` con healthcheck ok.
- [x] Commit por US + docs.
- [x] Push a `feature/001-scaffolding`.
- [x] `cierre.md` y sección Implementación en `spec.md`.
- [x] Status CERRADA.
