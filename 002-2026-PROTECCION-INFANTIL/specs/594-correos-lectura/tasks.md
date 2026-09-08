# Tasks: Correos de lectura (SPEC-594)

## Fase 1 — Cero correos por lectura interna

- [x] T001 [P] `src/lib/dal/services/auditoria-lectura.ts` — eliminar notificación al padre; queda auditoría fail-loud
- [x] T002 [P] `prisma/seed.ts` — eliminar `padre.reporte.texto_leido` (plantillas + reglas); agregar `padre.stepup.codigo.email`

## Fase 2 — Un solo disparo + aviso externo en acción real

- [x] T003 [P] Verificación: el único aviso de acceso externo sigue siendo `padre.reporte.acceso_canjeado` (una vez, en el canje)
- [x] T004 [P] `src/app/api/reportes/acceso/acceso.test.ts` — «la corrección tampoco notifica» + auditoría interna viva

## Fase 3 — Diagnóstico del correo que no llega (SPEC-592c)

- [x] T005 `Notificacion` mapea a tabla `notificaciones` (documentado en spec.md)
- [ ] T006 Verificación en producción (logs del contenedor `pi-notificaciones` en el VPS) — pendiente de la sesión de cierre/deploy
