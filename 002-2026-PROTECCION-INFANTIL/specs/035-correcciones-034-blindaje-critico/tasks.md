# Tasks — Spec 035: Correcciones del 034 + blindaje crítico

## Phase 1 — Análisis y preparación

- [P] T001 Leer flujo completo de `COMITE_VALIDACION` (login, NavHeader, AdminLayout, proxy, página destino).
  - Archivos: `src/app/login/page.tsx`, `src/components/modules/NavHeader.tsx`, `src/app/dashboard/admin/layout.tsx`, `src/proxy.ts`, `src/app/dashboard/admin/comite/page.tsx`.
- [P] T002 Confirmar respuesta de `GET /api/config/parametros/[clave]` y encontrar todos los consumidores.
  - Archivos: `src/app/api/config/parametros/[clave]/route.ts`, `src/components/modules/CategoriaGruposEditor.tsx`, `src/components/modules/ConfigPanel.tsx`.
- [P] T003 Verificar estado de índices hnsw y migración que los eliminó.
  - Archivos: `prisma/migrations/20260718094450_add_reintento_reporte/migration.sql`, `prisma/migrations/20260717002004_add_pgvector_hnsw_indexes/migration.sql`.
- [P] T004 Revisar `src/proxy.ts` y documentar cómo convertirlo en middleware.
  - Archivos: `src/proxy.ts`.
- [P] T005 Revisar `prisma/seed.ts` para identificar operaciones no idempotentes.
  - Archivos: `prisma/seed.ts`.
- [P] T006 Revisar scripts del worker para advisory lock.
  - Archivos: `scripts/worker-supervisor.mjs`, `scripts/worker-reportes.mjs`.

## Phase 2 — US4: Middleware perimetral (prerequisito de US1)

- T041 Crear `src/middleware.ts` que exporte `middleware` con matcher adecuado.
  - Archivo: `src/middleware.ts` (nuevo).
- T042 Refactorizar `src/proxy.ts` como helper importable por `src/middleware.ts` (o mover lógica).
  - Archivo: `src/proxy.ts`.
- T043 Incluir `COMITE_VALIDACION` en el conjunto de roles internos del middleware.
  - Archivo: `src/middleware.ts`.
- T044 Definir la matriz de roles de forma que `COMITE_VALIDACION` tenga acceso explícito a `/dashboard/admin/*` y los roles internos sean redirigidos fuera de rutas PARENT.
  - Archivo: `src/middleware.ts`.
- T045 Escribir tests de redirección para los 5 roles: ADMIN, SCHOOL_ADMIN, OPERADOR, PARENT, COMITE_VALIDACION.
  - Archivos: `src/middleware.test.ts` (nuevo) o tests E2E.

## Phase 3 — US1: Bandeja del comité

- T011 Confirmar que `src/proxy.ts`/`src/middleware.ts` incluye `COMITE_VALIDACION` como rol interno (resuelto en Phase 2).
  - Archivo: `src/middleware.ts`.
- T012 Verificar que `src/app/dashboard/admin/layout.tsx` y `src/app/login/page.tsx` ya reconocen `COMITE_VALIDACION`; no modificarlos.
  - Archivos: `src/app/dashboard/admin/layout.tsx`, `src/app/login/page.tsx`.
- T013 Verificar que el link "Mi bandeja" en `NavHeader` apunta correctamente; no modificarlo.
  - Archivo: `src/components/modules/NavHeader.tsx`.
- T014 Ejecutar `rm -rf .next && npm run build` para regenerar el build con el código fuente actual.
  - Comando: `rm -rf .next && npm run build`.
- T015 Probar flujo real con usuario `COMITE_VALIDACION`: login, "Mi bandeja", acceso directo a `/dashboard/admin/comite`, redirección desde `/mis-reportes` y `/dashboard/circulo-confianza`.
  - Archivo: `quickstart.md`.

## Phase 4 — US2: Persistencia del editor de grupos

- T021 Corregir lectura en `CategoriaGruposEditor.tsx` para usar `data.valor`.
  - Archivo: `src/components/modules/CategoriaGruposEditor.tsx`.
- T022 Buscar y corregir otros consumidores con `data.parametro?.valor`.
  - Archivos: `src/components/modules/ConfigPanel.tsx` y otros.
- T023 Invalidar caché específica de `ui.grupos_categoria` si aplica.
  - Archivos: `src/lib/config-cache.ts`, `src/app/api/config/parametros/[clave]/route.ts`.
- T024 Agregar test de persistencia para el editor.
  - Archivo: `src/components/modules/CategoriaGruposEditor.test.tsx` (nuevo) o tests de API.

## Phase 5 — US3: Índices vectoriales hnsw

- T031 Crear migración SQL aditiva para recrear índices hnsw.
  - Archivo: `prisma/migrations/20260719095000_recrear_indices_hnsw_embeddings/migration.sql` (nuevo).
- T032 Crear script de verificación post-migración.
  - Archivo: `scripts/verify-hnsw-indexes.ts` (nuevo).
- T033 Actualizar `package.json` si es necesario para ejecutar el script de verificación.
  - Archivo: `package.json`.
- T034 Agregar test o verificación manual de uso del índice.
  - Archivo: `scripts/verify-hnsw-indexes.ts`.

## Phase 6 — US5: Datos idempotentes

- T051 Convertir `usuario.create` del admin en `upsert` y exigir `ADMIN_PASSWORD` si no existe.
  - Archivo: `prisma/seed.ts`.
- T052 Hacer idempotentes las inserciones de casos de evaluación SEMILLA. Como `prisma.casoEval.createMany` no soporta `upsert` y `CasoEval` no tiene índice único sobre la clave natural, usar un loop de `findFirst` + `create`/`update` por (`texto`, `fuente`, `fixtureVersion`).
  - Archivo: `prisma/seed.ts`.
- T053 Hacer idempotentes los ejemplos de spam del dataset. Como `DatasetEntrenamiento` no tiene índice único sobre la clave natural, usar un loop de `findFirst` + `create`/`update` por (`texto`, `fuente`).
  - Archivo: `prisma/seed.ts`.
- T054 Actualizar documentación de despliegue para usar `prisma migrate deploy`.
  - Archivos: `docs/despliegue.md`, `scripts/dev-restart.sh`.
- T055 Verificar que ningún script invoque `migrate dev`, `migrate reset` ni `db push`.
  - Archivos: `scripts/*.sh`, `package.json`.

## Phase 7 — US6: Worker de instancia única

- T061 Agregar advisory lock en el worker al inicio.
  - Archivo: `scripts/worker-reportes.mjs`.
- T062 Asegurar liberación del lock en graceful shutdown.
  - Archivo: `scripts/worker-reportes.mjs`.
- T063 Verificar que el supervisor no reinicie un worker que falló por lock (o que el mensaje sea claro).
  - Archivo: `scripts/worker-supervisor.mjs`.
- T064 Probar inicio de segundo worker.
  - Comando: `npm run worker` en dos terminales.

## Phase 8 — Validación y cierre

- [P] T071 Ejecutar `npm run lint`, `npx tsc --noEmit`, `npm run test`.
- [P] T072 Ejecutar `npx prisma migrate deploy` y `scripts/verify-hnsw-indexes.ts`.
- [P] T073 Ejecutar `npx prisma db seed` dos veces y verificar idempotencia.
- [P] T074 Probar flujo manual con `quickstart.md` (incluye los 5 roles para middleware).
- T075 Hacer deploy limpio con `./scripts/dev-restart.sh`.
- T076 Actualizar `spec.md` con sección Implementación.
- T077 Crear `docs/cierre-035.md`.
- T078 Commits: uno por US + uno de docs; push a `feature/001-scaffolding`.
