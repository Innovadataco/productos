# Tareas: SPEC-153 — Comparativa entre cursos

## T001 [P] Servicio de comparativa agregada
**Archivo**: `src/lib/colegio/comparativa.ts`  
Implementar `calcularComparativaCursos(colegioId, agruparPor)` que llame a `calcularEstadisticasColegio` y agrupe los cursos por `grado` o `anioLectivo`, devolviendo totales y promedios sin PII.

## T002 [P] Endpoint JSON de comparativa
**Archivo**: `src/app/api/colegio/analisis/comparativa/route.ts`  
`GET /api/colegio/analisis/comparativa?agruparPor=grado|anioLectivo`. Auth SCHOOL_ADMIN, vigencia, rate limit, validación de query, respuesta 200/400/403.

## T003 [P] Tests endpoint JSON
**Archivo**: `src/app/api/colegio/analisis/comparativa/route.test.ts`  
Tests: agrupación por grado, por año lectivo, criterio inválido 400, ADMIN 403, sin cursos vacío.

## T004 [P] Exportación Excel
**Archivos**: `src/lib/colegio/export-comparativa-excel.ts`, `src/app/api/colegio/analisis/comparativa/excel/route.ts`  
Generar `.xlsx` con columnas: Grupo, Cursos, Estudiantes, Identificadores, Alertas, Prom. estudiantes/curso. Endpoint con auth y vigencia.

## T005 [P] Tests export Excel
**Archivo**: `src/app/api/colegio/analisis/comparativa/excel/route.test.ts`  
Tests: descarga no vacía, content-type correcto, ADMIN 403.

## T006 [P] UI de comparativa
**Archivo**: `src/app/dashboard/colegio/analisis/comparativa/page.tsx`  
Página con selector de criterio, tabla de grupos, totales y botón "Exportar Excel". Usar componentes existentes.

## T007 [P] Regenerar matriz de arquitectura
**Archivo**: `docs/architecture/02-roles-capacidades.md`  
Correr `npm run arch:generate` o el comando que aplique y verificar `arch:check` verde.

## T008 [P] Documentación y registro Spec-Kit
**Archivos**: `specs/README.md`, `.specify/feature.json`, `specs/153-comparativa-cursos/cierre.md`  
Actualizar estado a Implementada, añadir filas en README, cambiar feature.json a 154, completar cierre.md con PR/hash/run.

## Orden de dependencias

T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008
