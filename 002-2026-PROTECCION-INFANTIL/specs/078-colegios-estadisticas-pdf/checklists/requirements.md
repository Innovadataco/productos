# Checklist de requisitos: Colegios · Fase 5 — Estadísticas e informe PDF institucional

## User Story 1 — Estadísticas agregadas

- [ ] El endpoint `GET /api/colegio/estadisticas` existe y requiere `SCHOOL_ADMIN`.
- [ ] El endpoint devuelve solo datos del colegio del usuario autenticado.
- [ ] El resumen incluye totales de cursos, alumnos, identificadores y alertas.
- [ ] El desglose por curso incluye nombre, alumnos, identificadores y alertas.
- [ ] Las alertas asociadas a reportes dados de baja se excluyen del conteo.
- [ ] La UI muestra tarjetas de totales y tabla/tarjetas por curso.
- [ ] Existe estado vacío para colegio sin datos.
- [ ] Hay tests de integración del endpoint.

## User Story 2 — PDF institucional

- [ ] El endpoint `GET /api/colegio/estadisticas/pdf` existe y requiere `SCHOOL_ADMIN`.
- [ ] El PDF incluye el nombre del colegio, fecha de generación y totales.
- [ ] El PDF incluye tabla por curso con cursos, alumnos, identificadores y alertas.
- [ ] El PDF aplica estilo verde institucional.
- [ ] El botón "Descargar PDF" en la UI funciona.
- [ ] Se registra auditoría `COLEGIO_ESTADISTICAS_PDF_DESCARGADO`.
- [ ] Hay tests de integración del endpoint de PDF.

## Seguridad y privacidad

- [ ] Ningún endpoint expone datos de otro colegio.
- [ ] La UI y el PDF no muestran nombres de alumnos, identificadores ni textos de reportes.
- [ ] El SCHOOL_ADMIN no puede acceder a datos de admin/operador/comité/padre desde estas rutas.

## Calidad y validación

- [ ] `npx tsc --noEmit` pasa.
- [ ] `npm run lint` pasa.
- [ ] `npx vitest run` pasa (meta: ≥704 tests verdes).
- [ ] `npm run build` pasa.
- [ ] `./scripts/dev-restart.sh` pasa con healthcheck ok y un solo worker.
- [ ] Quickstart.md ejecutado y verificado.

## Spec-Kit y cierre

- [ ] Todos los artefactos del spec están creados.
- [ ] Sección "Implementación" en `spec.md` completada.
- [ ] `cierre.md` creado con evidencia.
- [ ] Status actualizado a `CERRADA`.
- [ ] Commits por US + docs, push a `feature/001-scaffolding`.
