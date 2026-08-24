# Cierre: SPEC-236 — Motor de estados + worker + 11 eventos Motor Notif

**Fecha**: 2026-08-24
**Rama**: `work/002-PI-mega-cola-restante` (mega-lote; commits serializados por el coordinador)

## Alcance entregado

- Whitelist de transiciones + guards (FR-001 a FR-011) en `src/lib/expediente/estados/`.
- Aplicador transaccional con AuditLog y publicación fail-open a Motor Notif (FR-002).
- Endpoint `POST /api/interno/expediente/[id]/transicionar` (ADMIN / service-account / PARENT solo reapertura propia) con validación Zod (FR-020/021).
- Worker `scripts/worker-expediente-motor.mjs` (advisory lock **123456793**, TZ America/Bogota, tick por parámetro, `--run-once`): auto-cierre por inactividad, SLA comité 48h/12h con idempotencia, recálculo de gravedad 24h con alerta ROJO, purga de retención `[retenido]` sin borrar filas (FR-009, FR-012 a FR-016).
- Seed idempotente: 2 parámetros nuevos + 11 eventos × (plantilla EMAIL + IN_APP) + reglas Motor Notif (FR-018/019/022).
- Servicio `pi-expediente-motor` en `docker-compose.prod.yml` (FR-017).
- Migración aditiva: 4 valores `AccionAudit` + índice `Expediente(estado, ultimoEventoEn)`.

## Hallazgos y desviaciones (detalle en spec.md §Implementación)

1. **Motor Notif real ≠ interfaz asumida**: SPEC-201 expone `NotificacionPlantilla`/`NotificacionRegla` + `programar()`; no existen `EventoNotificacion`/`NotificacionTemplate`. La integración se hizo contra la API estricta real; publicación post-commit fail-open (el motor no acepta tx).
2. **`AclaracionExpediente` no existe aún en el schema** (la define SPEC-238): los guards de aclaración usan `aclaracion-consulta.ts` (stub que devuelve 0 → 409 seguro). Reemplazar al aterrizar SPEC-238.
3. **Parámetros ya sembrados por SPEC-230**: `consolidacion_min_reportes` (default 2, no 3 como sugería el plan), `auto_cierre_meses`, `padre.comite.sla_horas_*` — no se duplican ni pisan.
4. **Reloj del SLA desde `updatedAt`** (entrada al estado), no `createdAt` como decía el plan §3.2 — evita alertas espurias en expedientes viejos.
5. **Retención desde `fechaCierre`** (fallback `createdAt`), según data-model.md ("meses tras cierre"), no `creadoEn` del plan.
6. **Sin `EventoExpediente` por transición**: corrompería `numEventos`; motivo/actor en `AuditLog.metadatos`.
7. **`dev-restart.sh` no modificado**: quickstart §3 define arranque manual del worker en dev.
8. **Advisory lock 123456793** (791 = SPEC-220, 792 = SPEC-213, 789/790/987654321/923456789 preexistentes).

## Gate

- `npx tsc --noEmit`: limpio en archivos de la spec (2 errores ajenos en `src/lib/pagos/*`, SPEC-213/216 en progreso).
- `npx prisma generate`: OK.
- Unit tests puros: **11/11 verdes** (incluye frontera 23:59/00:01 Bogotá, whitelist, hard guard CERRADO).
- Integración BD (`aplicar-transicion.test.ts` 12 casos, `route.test.ts` 9 casos, `worker-expediente-motor.test.ts` 8 casos, `seed-expediente-motor.test.ts` 3 casos): escritos; los ejecuta el coordinador (BD compartida).
- Pendientes del gate global del coordinador: lint, build, dev-restart, quickstart manual, commits/push.
