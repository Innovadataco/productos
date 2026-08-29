> Planificado. No se ejecutan hasta aprobación de ZEUS.

# Tareas: SPEC-200 — INFRA · Timezone Bogotá (002-PI-097)

## Fase 1: Preparación

- [ ] T001 [P1] Actualizar `.specify/feature.json` a `specs/200-infra-timezone-bogota`.
- [ ] T002 [P1] Actualizar `specs/README.md` con fila de SPEC-200.

## Fase 2: Infraestructura y dependencias

- [ ] T003 [P1] `docker-compose.prod.yml`: agregar `TZ: America/Bogota` a `app`, `worker`, `monitor` y `simulador-abuso`.
- [ ] T004 [P1] `package.json`: agregar `date-fns` y `date-fns-tz` en `dependencies`; ejecutar `npm install`.

## Fase 3: Modelo de datos

- [ ] T005 [P1] `prisma/schema.prisma`: agregar `@db.Timestamptz(6)` a todos los `DateTime` de momento; unificar `@db.Timestamptz(3)` existentes.
- [ ] T006 [P1] Generar migración aditiva `add_timestamptz_bogota` y verificar SQL.
- [ ] T007 [P1] Ejecutar `npx prisma migrate dev` en local y validar que no destruye datos.

## Fase 4: Helpers de fecha

- [ ] T008 [P1] `src/lib/colegio/fechas-humano.ts`: refactorizar con `date-fns-tz` (`formatInTimeZone`, `toDate`) y `America/Bogota`.
- [ ] T009 [P1] `src/lib/colegio/fechas-humano.test.ts`: añadir tests con 23:59 y 00:01 Bogotá.
- [ ] T010 [P2] Crear helper reutilizable `src/lib/fechas/formato-bogota.ts` (opcional, si varios módulos lo requieren).

## Fase 5: Frontend

- [ ] T011 [P1] `src/lib/colegio/render-informe-mensual.tsx`: agregar `timeZone: "America/Bogota"` a `toLocaleDateString`.
- [ ] T012 [P1] `src/lib/expediente/expediente-forense.ts`: agregar `timeZone: "America/Bogota"` a `toLocaleDateString`.
- [ ] T013 [P1] Grep de `toLocaleString`/`toLocaleDateString`/`toLocaleTimeString`/`Intl.DateTimeFormat` en `src/`; forzar `timeZone: "America/Bogota"` o documentar excepción.

## Fase 6: Aritmética temporal

- [ ] T014 [P1] `src/lib/apelaciones.ts`: reescribir `esDiaHabil`, `sumarDiasHabiles`, `diasHabilesTranscurridos` con `date-fns-tz`/`America/Bogota`.
- [ ] T015 [P1] Revisar y adaptar `src/lib/apelacion-mantenimiento.ts` si usa aritmética de días con timezone.
- [ ] T016 [P1] Revisar y adaptar `src/lib/spam/analitica.ts` y `src/lib/spam/sla.ts` para ventanas de días en Bogotá.
- [ ] T017 [P1] Revisar y adaptar `src/lib/email.ts` (cooldown) si aplica aritmética de día calendario.
- [ ] T018 [P1] Revisar `src/lib/colegio/informe-mensual.ts` y `src/lib/simulacion/progreso.ts`.
- [ ] T019 [P1] Grep de `new Date(` para aritmética temporal; asegurar que use `date-fns-tz` o tenga justificación en comentario.

## Fase 7: Gate de calidad y cierre

- [ ] T020 [P1] Gate local completo: `tsc`, `lint`, `arch:check`, `test:unit`, `test:integration`, `build`.
- [ ] T021 [P1] Push único a `work/002-PI-motor-notif-lote1` y CI verde 6/6.
- [ ] T022 [P1] Completar sección Implementación en `spec.md` y crear `cierre.md` al cerrar.
