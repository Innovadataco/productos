# Tareas · SPEC-438 — La fecha y la hora del hecho

- [x] T001 Columna `Reporte.horaAproximada` (aditiva, default `false`) + migración que NO reescribe datos viejos.
- [x] T002 `lib/reportes/franja-aproximada.ts`: módulo puro, hora representativa al centro del bloque, en hora de Bogotá.
- [x] T003 Quitar el relleno del wizard (`new Date()`) y exigir la fecha para avanzar de paso.
- [x] T004 Selector de franja en `FechaHoraIncidente`, con una sola emisión (valor + marca) para no pisar la fecha.
- [x] T005 `horaAproximada` de punta a punta: esquema → route → creación → base.
- [x] T006 La marca llega al análisis: `HechoPadre`, la consulta y el payload del modelo.
- [x] T007 Candados con contraprueba + 3 tests de conducta contra la base + 7 del módulo de franja.
- [x] T008 Gate + fila en `specs/README.md` + PR.

## Anotado

- **Punto 4 del radicado** (los reportes ya creados con hora fabricada): la consulta para producción está en la spec, **excluyendo lo sembrado** vía `demo_marcado`. El número de dev no sirve — el poblador fija `creadoEn = fechaIncidente`. Qué hacer con esas filas lo decide el CEO.
