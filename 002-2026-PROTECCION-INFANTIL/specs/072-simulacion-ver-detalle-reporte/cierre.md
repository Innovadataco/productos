# Cierre — Spec 072: Simulación — Ver detalle del reporte

## Resumen

Se implementó el botón "Ver detalle" en cada fila de `TablaResultadosSimulacion`. Al hacer clic se abre `AdminReporteDetalle` (dentro del `Modal` reusable del Spec 054) con el `reporteId` del caso seleccionado. No se creó un nuevo modal ni vista de detalle; no se tocó el endpoint de resultados, el modelo `Reporte` ni el pipeline de simulación.

## User Story cubierta

- **US1 (P1)**: Botón "Ver detalle" en resultados de simulación.
  - El botón aparece en la columna "Acciones" de cada fila.
  - Al hacer clic se abre `AdminReporteDetalle` con el `reporteId` correcto.
  - El modal cierra con el botón "Cerrar" de `AdminReporteDetalle`, clic en overlay o tecla Escape (comportamiento del `Modal` del Spec 054).

## Archivos tocados

- `src/components/modules/ia/simulacion/TablaResultadosSimulacion.tsx` — botón y render condicional de `AdminReporteDetalle`.
- `src/components/modules/ia/simulacion/TablaResultadosSimulacion.test.tsx` — tests del botón/apertura/cierre.
- `specs/072-simulacion-ver-detalle-reporte/spec.md` — sección Implementación, Status `CERRADA`.
- `specs/072-simulacion-ver-detalle-reporte/cierre.md` — este archivo.

## Commits

- `6e92ed4` docs(072): plan Spec-Kit completo para ver detalle de reporte en simulación
- (Pendiente en esta sesión) ui(072): botón Ver detalle en TablaResultadosSimulacion + tests
- (Pendiente en esta sesión) docs(072): cierre e implementación

## Validación

- `npx vitest run src/components/modules/ia/simulacion/TablaResultadosSimulacion.test.tsx`: 5/5 tests OK.
- `npm run test`: 605/605 tests OK (meta ≥ 600).
- `npx tsc --noEmit`: OK.
- `npm run lint`: OK.
- `npm run build`: OK.

## Deploy

- `./scripts/dev-restart.sh` ejecutado tras el build: app en :5005, healthcheck OK, un solo worker.

## Deuda técnica

- Ninguna identificada. El modal cierra por los tres mecanismos del componente `Modal` (botón, overlay, Escape).

## Estado

Status: **CERRADA**.
