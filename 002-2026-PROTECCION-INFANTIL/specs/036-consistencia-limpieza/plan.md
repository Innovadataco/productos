# Plan — Spec 036: Consistencia y limpieza

## Fase 1: Análisis y preparación

- P1.1 Identificar todas las rutas, archivos e imports que contienen "apeaciones" o "apealaciones".
- P1.2 Hacer grep completo de voseo en `src` (textos de UI, mensajes, no comentarios técnicos).
- P1.3 Contar y catalogar los `console.log` en `src/lib`.
- P1.4 Revisar `AdminReportesTable` y el endpoint `/api/admin/reportes-revision` para agregar búsqueda.
- P1.5 Verificar `.gitignore` y contenido de `eval-results/`.

## Fase 2: Implementación por User Story

- P2.1 **US1**: Renombrar `apeaciones` → `apelaciones` en rutas, módulos, librerías, tests y consumidores en un commit atómico.
- P2.2 **US2**: Reemplazar textos en voseo por neutros.
- P2.3 **US3**: Crear `src/lib/logger.ts` y reemplazar `console.log` de `src/lib`.
- P2.4 **US4**: Agregar campo de búsqueda en `AdminReportesTable` y parámetro `q` en `/api/admin/reportes-revision`.
- P2.5 **US5**: Agregar `eval-results/` a `.gitignore`.

## Fase 3: Tests y validación

- P3.1 Ejecutar `npm run test` tras el renombramiento de apelaciones.
- P3.2 Ejecutar `npm run test` tras el logger.
- P3.3 Probar búsqueda por número de seguimiento e identificador.
- P3.4 Ejecutar `npx tsc --noEmit`, `npm run lint`.

## Fase 4: Cierre

- P4.1 Actualizar `spec.md` con sección Implementación.
- P4.2 Validar checklist de requisitos.
- P4.3 Commits: uno por User Story + uno de docs.
- P4.4 Deploy limpio y pruebas con `quickstart.md`.
