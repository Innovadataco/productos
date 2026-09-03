# SPEC-379 (PR A) · Plan

1. **Diagnóstico 15v5**: leer `INVENTARIO-SENALES-OPERACION.md`, callers
   reales de cada PDF de la lista, componente `SeccionMateriasCurso`,
   endpoints ya existentes de `carga-profesores`, y la UI actual de
   `/dashboard/colegio/profesores`.
2. **Corregir el alcance del ítem 4 con el CEO**: `pdf-denuncia` y
   `pdf-expediente` NO son colegio-scope (aprobado).
3. **D1 · helper compartido `membrete-pdf.ts`** (pdfmake) + JSX equivalente
   en `pdf-informe-mensual.tsx` (react-pdf).
4. **D1 · `SELECT_RESUMEN` amplía** a `nit` + `escudoAssetKey`; propagar por
   `EstadisticasColegio` + `InformeMensualColegio`.
5. **D1 · callers cargan `escudoDataUri`** con `leerEscudoDataUri` y lo
   pasan a `generarPdfEstadisticas` y al `InformeMensualPDF`.
6. **D3 · `SeccionMateriasCurso`**: label sin "(opcional)", sin opción vacía,
   botón deshabilitado, hint accionable.
7. **D5b · extraer `CargaProfesoresExcel`** del camino inicial a componente
   reutilizable; consumirlo en `/dashboard/colegio/profesores` y en el wizard.
8. **Tests**:
   - Unit: `membrete-pdf.test.ts` (con/sin escudo, forma del bloque).
   - Unit: `SeccionMateriasCurso.test.tsx` (5 casos: label, opción, botón,
     hint, sin profesores en el colegio).
9. **Gate**: `tsc --noEmit` limpio, unit verdes, regen baseline arquitectura,
   specs-discipline verde.
