# Requirements Checklist — Spec 036

## User Story 1 — Renombrar apeaciones → apelaciones
- [ ] Renombrada carpeta `src/app/api/apeaciones` a `src/app/api/apelaciones`.
- [ ] Renombrada carpeta `src/app/api/admin/apeaciones` a `src/app/api/admin/apelaciones`.
- [ ] Renombrado `src/lib/apealaciones.ts` a `src/lib/apelaciones.ts`.
- [ ] Actualizados todos los imports en consumidores.
- [ ] Actualizadas todas las URLs en llamadas fetch.
- [ ] Actualizados todos los tests.
- [ ] El commit es atómico (un solo commit con todos los cambios).
- [ ] Los tests de apelaciones pasan.

## User Story 2 — Barrido final de voseo
- [ ] Eliminado "Revisá, clasificá y gestioná" de `AdminReportesTable`.
- [ ] Eliminado "mostrála una vez" de gestión de operadores.
- [ ] Eliminado "mostrála una vez" de gestión de comité.
- [ ] Eliminado "copiá la contraseña temporal" de API de operadores.
- [ ] Grep completo de voseo no devuelve strings de UI.
- [ ] Textos reemplazados mantienen tono neutro y claridad.

## User Story 3 — Logger mínimo
- [ ] Creado `src/lib/logger.ts` con niveles `debug`, `info`, `warn`, `error`.
- [ ] Reemplazados todos los `console.log` de `src/lib`.
- [ ] Nivel por defecto en producción es `warn`.
- [ ] `LOG_LEVEL` configurable por variable de entorno.
- [ ] Tests actualizados si espiaban `console.log`.
- [ ] `console.error`/`console.warn` migrados al logger o justificados.

## User Story 4 — Buscador en bandeja admin
- [ ] Campo de búsqueda agregado en `AdminReportesTable`.
- [ ] Placeholder claro (RPT-XXXX o identificador/nick).
- [ ] Endpoint `/api/admin/reportes-revision` acepta parámetro `q`.
- [ ] Búsqueda por `numeroSeguimiento` (parcial, case-insensitive).
- [ ] Búsqueda por `identificador` (parcial, case-insensitive).
- [ ] Búsqueda combinada con filtros existentes.
- [ ] Estado de búsqueda reflejado en URL (`q=`).

## User Story 5 — eval-results en .gitignore
- [ ] Agregada regla `eval-results/` a `.gitignore`.
- [ ] Archivos nuevos en `eval-results/` se ignoran por Git.

## General
- [ ] Todos los artefactos Spec-Kit están creados.
- [ ] `npm run lint` pasa sin errores.
- [ ] `npx tsc --noEmit` pasa sin errores.
- [ ] `npm run test` pasa.
- [ ] `npm run build` compila exitosamente.
- [ ] `./scripts/dev-restart.sh` levanta la app con un solo worker.
- [ ] Se completó el `quickstart.md` manualmente.
- [ ] Se generó `cierre.md` y se actualizó la sección Implementación en `spec.md`.
- [ ] Se registró deuda técnica si aplica.
- [ ] Se hicieron commits: uno por User Story + uno de docs.
- [ ] Se hizo push a `feature/001-scaffolding`.
