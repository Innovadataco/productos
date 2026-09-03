# SPEC-379 (PR A) · Tasks

- [X] T001 Diagnóstico 15v5: callers de cada PDF, componente materias-curso, wizard profesores.
- [X] T002 Reportar al CEO el ajuste de alcance del ítem 4 (padre/admin PDFs quedan fuera).
- [X] T003 Ampliar `SELECT_RESUMEN` con `nit` + `escudoAssetKey` (aditivo, no rompe consumidores).
- [X] T004 Extender `EstadisticasColegio` + `InformeMensualColegio` con `colegioNit` + `escudoAssetKey`.
- [X] T005 Crear `src/lib/colegio/membrete-pdf.ts` (helper compartido pdfmake).
- [X] T006 Adaptar `pdf-estadisticas.ts` para usar el helper + recibir `escudoDataUri`.
- [X] T007 Adaptar `pdf-informe-mensual.tsx` con cabecera JSX equivalente (react-pdf).
- [X] T008 Actualizar `render-informe-mensual.tsx` + `/api/colegio/estadisticas/pdf` para cargar `escudoDataUri`.
- [X] T009 Ajustar `SeccionMateriasCurso.tsx` (label sin opcional, sin opción vacía, botón deshabilitado, hint).
- [X] T010 Extraer `CargaProfesoresExcel` del camino inicial a `src/components/modules/colegio/`.
- [X] T011 Consumir el componente en `/dashboard/colegio/profesores` y en el wizard.
- [X] T012 Test unit `membrete-pdf.test.ts` (3 casos).
- [X] T013 Test unit `SeccionMateriasCurso.test.tsx` (5 casos).
- [X] T014 Registrar los tests en `vitest.unit.includes.ts`.
- [X] T015 Regenerar línea base de arquitectura (nuevo helper no cambia rutas — verificar diff mínimo).
- [X] T016 Gate: tsc, unit verdes.
- [ ] T017 [Post-merge] verificación en vivo del CEO: bajar `informe mensual` y `estadísticas` de un colegio con escudo cargado y otro sin escudo.
