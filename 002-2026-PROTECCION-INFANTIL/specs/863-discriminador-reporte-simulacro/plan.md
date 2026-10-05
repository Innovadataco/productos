# Plan · SPEC-863

Diseño y decisiones completas en [`spec.md`](./spec.md). Este plan es el mapa de cambios + verificación.

## Orden de implementación (write-side primero)

1. **Predicado canónico** — `src/lib/dal/demo-exclusion.ts`: `marcarReporteSimulacro`, `esReporteNoReal`,
   `whereExcluirReportesNoReales`, `idsReportesNoReales` (demo_marcado ∪ simulacion_reportes).
2. **Marca atómica** — `crear-reporte-con-texto.ts` escribe la marca en la tx del reporte; `reporte-creation.ts`
   la forwardea desde la ruta (`route.ts` la pasa cuando hay `x-simulacion-secret`).
3. **Write-side público** — `reporte-creation.ts` NO incrementa `IdentificadorReportado` para simulacro;
   `scoring.ts` excluye simulacro en `calcularScore` + wrapper `recalcularYGuardarScoreSiReporteReal` cableado
   en sus 8 llamadores.
4. **Guards por consumidor** — avisos (hijos, colegio, círculo), patrón, match (vía `ReporteRepository.esNoReal`).
5. **Lecturas** — consulta pública (resumen/detalle), estadísticas públicas, admin, seguimiento, apelaciones
   (merge `whereExcluirNoReales` / `idsNoReales`).
6. **Candado** — `simulacro-exclusion.candado.test.ts` (A–D, control positivo).

## Verificación (gate local)

- `tsc --noEmit` ✅ (0 errores).
- `arch:check` ✅ VERDE (incl. (f) worker sin alias, (g) reporte.create único en el factory, (i) sin huérfanos).
- `eslint .` ✅ 0 errores (warnings pre-existentes tolerados por CI).
- `test` (candado de integración) — corre contra la base por-worktree (`proteccion_infantil_pi_863_test`);
  también en CI.
- `build` — ver cierre.

> No desplego (lo hace el CEO). Verde en CI ≠ funciona: el candado C prueba la invariante central
> («un simulacro no mueve el agregado público de un id real») con control positivo.

## Exentos / diferidos / hermano 006

Ver `spec.md` (§EXENTOS, §DIFERIDO, §HERMANO a 006). El hermano de 006 queda **parqueado** con la dependencia
anotada; no se implementa en esta rama.
