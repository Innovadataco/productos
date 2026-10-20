# Tasks · SPEC-870

Diseño en [`spec.md`](./spec.md); cambios en [`plan.md`](./plan.md). Todas completadas.

- [x] **T1 · FUENTE** · `borrarReporte` recalcula el agregado propio tras borrar (recalc, no zero+hide
  directo — computa el restante si quedan otros vivos).
- [x] **T2 · Corrector** idempotente `recalcular-agregados-huerfanos.ts` (dry-run/`--confirm`, zero+hide,
  nunca DELETE, atómico por fila, exit≠0 si falla).
- [x] **T3 · Detector** blando `agregados-huerfanos.ts` (DAL) + CLI solo-lectura.
- [x] **T4 · Guard** estructural `no-reporte-delete-directo` + sección (k) de arch:check.
- [x] **T5 · Cerrar la fuente legacy** · retiro de 4 borradores crudos sin caller + ruteo de
  `borrar-simulacion`/`smoke-e2e` por `borrarReporte`.
- [x] **T6 · Candado** de integración (A/A-control/B/C) + ajuste del fake de `borrar-limpieza.test.ts`.
- [x] **T7 · Docs** (spec + Impacto en arquitectura + D-121 + escalación estructural; plan; tasks).

**Aparte del PR (responsable):** DEPLOY del fix de runtime + CORRIDA del corrector contra prod.
**Escalación documentada (no construida):** opción estructural (visibilidad derivada en la consulta) si
el detector muestra drift recurrente.
