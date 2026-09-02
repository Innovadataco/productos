# SPEC-363 · Tasks

- [X] T001 Reproducir el rojo de CI #241 (documento "3003" muy corto corta el submit) y arreglarlo en su rama (payload real: documento válido + apellidos); verificar que el happy path dispara el POST
- [X] T002 [FR-004] `src/lib/padre/tope-hijos.ts`: maximoHijosActivos + plantillaMensajeTope + resolverMensajeTope
- [X] T003 [FR-003] `cambiarEstadoHijo`: cupo inyectado al reactivar (cuenta solo si estaba inactivo); reafirmar activo no consume
- [X] T004 [FR-001/002] `[id]/route.ts`: estado → cambiarEstadoHijo, correcciones → actualizarHijo
- [X] T005 [FR-004] POST route usa el helper compartido (quita la duplicación inline)
- [X] T006 [FR-005] Tests por el route real: BUG1 (409 + menor sigue inactivo), BUG2 (audit {estado}, no {campos}), PATCH mixto
- [X] T007 Gate: tsc, lint 0, unit 1942, integración hijos 21/21 + hijos.ts 13/13, build, arch:check
- [X] T008 [I-259] hijos.ts: cambiarEstadoIdentificador y desvincularIdentificador auditan hijoId (nunca el valor PII) + tests por las rutas reales
- [X] T009 Disciplina de specs + PR
