# Tasks — Spec 036: Consistencia y limpieza

## Phase 1 — Análisis y preparación

- [P] T001 Identificar las tres variantes (`apeaciones`, `apealaciones`, `apelaciones`) en rutas, imports, URLs y scripts.
  - Comandos: `grep -R "apeactions\|apealaciones\|apelaciones" src/ scripts/ --include="*.ts" --include="*.tsx"`.
- [P] T002 Hacer grep completo de voseo en strings de UI.
  - Comandos: `grep -R "revisá\|clasificá\|gestioná\|mostrá\|copiá\|mostrála\|verificá\|buscá\|enviá\|guardá" src/ --include="*.tsx" --include="*.ts"`.
- [P] T003 Catalogar `console.log` en `src/lib`.
  - Comando: `grep -R "console.log" src/lib --include="*.ts"`.
- [P] T004 Revisar `AdminReportesTable` y endpoint `/api/admin/reportes-revision` para búsqueda.
  - Archivos: `src/components/modules/AdminReportesTable.tsx`, `src/app/api/admin/reportes-revision/route.ts`.
- [P] T005 Verificar `.gitignore` y contenido de `eval-results/`.
  - Archivos: `.gitignore`, `eval-results/`.

## Phase 2 — US1: Renombrar apeaciones → apelaciones

- [P] T011 Renombrar directorios `src/app/api/apeaciones` → `src/app/api/apelaciones` y `src/app/api/admin/apeaciones` → `src/app/api/admin/apelaciones`.
- [P] T012 Renombrar `src/lib/apealaciones.ts` → `src/lib/apelaciones.ts`.
- [P] T013 Actualizar imports de `@/lib/apealaciones` a `@/lib/apelaciones` en todos los consumidores:
  - Rutas API en `src/app/api/apeaciones/**` y `src/app/api/admin/apeaciones/**` (tras renombrar carpetas)
  - `scripts/job-apelaciones-vencimiento.ts`
  - `scripts/smoke-apelaciones.ts`
  - `src/lib/operadores/asignador.ts`
  - `src/lib/operadores/integracion.test.ts`
- [P] T014 Actualizar URLs en llamadas fetch de `/api/apeaciones/*` → `/api/apelaciones/*` y `/api/admin/apeaciones/*` → `/api/admin/apelaciones/*`:
  - `src/app/apelar/page.tsx`
  - `src/components/modules/AdminApelaciones.tsx`
  - `src/proxy.ts` (ruta pública)
  - `scripts/smoke-apelaciones.ts`
- [P] T015 Actualizar tests de rutas y componentes para que usen las nuevas URLs y el módulo renombrado. Verificar que `grep -R "apeaciones\|apealaciones" src/ scripts/ --include="*.ts" --include="*.tsx"` no devuelva coincidencias.
- T016 Commit atómico: `chore: renombrar apeaciones -> apelaciones`.

## Phase 3 — US2: Barrido final de voseo

- T021 Reemplazar "Revisá, clasificá y gestioná los reportes de la comunidad." por texto neutro.
  - Archivo: `src/components/modules/AdminReportesTable.tsx`.
- T022 Reemplazar "Contraseña temporal (mostrála una vez)" en gestión de operadores y comité.
  - Archivos: `src/app/dashboard/admin/operadores/gestion/page.tsx`, `src/app/dashboard/admin/comite/gestion/page.tsx`.
- T023 Reemplazar "copiá la contraseña temporal" en API de operadores.
  - Archivo: `src/app/api/admin/operadores/route.ts`.
- T024 Ejecutar grep completo y corregir cualquier resto.
- T025 Commit: `style: reemplazar voseo por tono neutro en UI`.

## Phase 4 — US3: Logger mínimo con niveles

- T031 Crear `src/lib/logger.ts` con niveles `debug`, `info`, `warn`, `error` y soporte `LOG_LEVEL`.
- T032 Reemplazar `console.log` en `src/lib/queue.ts`.
- T033 Reemplazar `console.log` en `src/lib/email.ts`.
- T034 Reemplazar `console.log` en `src/lib/sms.ts`.
- T035 Reemplazar `console.log` en `src/lib/circulo-confianza.ts`.
- T036 Reemplazar `console.log` en `src/lib/ai/eval-runner.ts`.
- T037 Reemplazar `console.log` en `src/lib/ai/dataset-embedding-backfill.ts`.
- T038 Reemplazar `console.log` en `src/lib/ai/ollama-client.ts`.
- T039 Reemplazar `console.log` en `src/lib/ai/embedder.ts`.
- T040 Reemplazar `console.log` en `src/lib/ai/dataset-anonimizacion-backfill.ts`.
- T041 Actualizar tests que espiaban `console.log`.
- T042 Actualizar `.env.example` con `LOG_LEVEL=info`.
- T043 Commit: `refactor: reemplazar console.log de libs por logger con niveles`.

## Phase 5 — US4: Buscador en bandeja admin

- T051 Agregar input de búsqueda en `AdminReportesTable`.
  - Archivo: `src/components/modules/AdminReportesTable.tsx`.
- T052 Agregar estado `q` y sincronizar con URL.
- T053 Extender `buildQueryString` para incluir `q`.
- T054 Agregar parámetro `q` en `/api/admin/reportes-revision`.
  - Archivo: `src/app/api/admin/reportes-revision/route.ts`.
- T055 Implementar búsqueda parcial en `numeroSeguimiento` e `identificador`.
- T056 Agregar test de búsqueda en el endpoint.
- T057 Commit: `feat: buscador por numero seguimiento e identificador en bandeja admin`.

## Phase 6 — US5: eval-results en .gitignore

- T061 Agregar `eval-results/` a `.gitignore`.
- T062 Commit: `chore: agregar eval-results a .gitignore`.

## Phase 7 — Validación y cierre

- [P] T071 Ejecutar `npm run lint`, `npx tsc --noEmit`, `npm run test`.
- [P] T072 Probar búsqueda en bandeja admin con quickstart.
- [P] T073 Probar flujo de apelaciones tras renombramiento.
- [P] T074 Verificar logger con `LOG_LEVEL=debug` y `LOG_LEVEL=warn`.
- T075 Hacer deploy limpio con `./scripts/dev-restart.sh`.
- T076 Actualizar `spec.md` con sección Implementación.
- T077 Crear `docs/cierre-036.md`.
- T078 Commits: uno por US + uno de docs; push a `feature/001-scaffolding`.
