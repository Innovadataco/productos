# Research — Spec 036: Consistencia y limpieza

## Hallazgos por User Story

### US1 — Renombrar apeaciones → apelaciones

Hay **tres variantes** en el repo: `apeaciones`, `apealaciones` y `apelaciones`. El objetivo es unificar todas a `apelaciones` en un commit atómico.

- **Variante `apeaciones` (rutas API y consumidores)**:
  - `src/app/api/apeaciones/solicitar/route.ts` (y su test)
  - `src/app/api/apeaciones/verificar/route.ts` (y su test)
  - `src/app/api/apeaciones/[token]/route.ts`
  - `src/app/api/admin/apeaciones/route.ts` (y su test)
  - `src/app/api/admin/apeaciones/[id]/resolver/route.ts` (y su test)
  - `src/app/api/admin/apeaciones/[id]/route.ts`
  - `src/app/api/admin/apeaciones/[id]/rehabilitar/route.ts`
  - `src/app/api/admin/apeaciones/[id]/vencer/route.ts`
  - URLs de fetch en `src/app/apelar/page.tsx` y `src/components/modules/AdminApelaciones.tsx`
  - `src/proxy.ts` (ruta pública `/api/apeaciones`)
  - `scripts/smoke-apelaciones.ts`
  - Documentación y specs históricos (no se cambian, son históricos).

- **Variante `apealaciones` (módulo de negocio con doble error)**:
  - `src/lib/apealaciones.ts` (renombrar a `src/lib/apelaciones.ts`)
  - Imports en todas las rutas API anteriores
  - `scripts/job-apelaciones-vencimiento.ts`
  - `scripts/smoke-apelaciones.ts`
  - `src/lib/operadores/asignador.ts` (import + textos)
  - `src/lib/operadores/integracion.test.ts` (import + textos)

- **Variante `apelaciones` (forma correcta, ya en uso parcial)**:
  - `src/components/modules/AdminApelaciones.tsx` (nombre del componente y título)
  - `src/components/modules/AdminNav.tsx` (href `/dashboard/admin/apelaciones`)
  - `src/app/dashboard/admin/operadores/gestion/page.tsx` (textos "Apelaciones")
  - `src/lib/operadores/asignador.ts` (textos "revisores de apelaciones")
  - `src/lib/apealaciones.ts` (textos dentro del archivo)
  - `scripts/job-apelaciones-vencimiento.ts` (nombre del job)
  - `scripts/smoke-apelaciones.ts` (nombre del archivo y textos)

- **Cambios necesarios**:
  - Renombrar directorios `src/app/api/apeaciones` → `src/app/api/apelaciones` y `src/app/api/admin/apeaciones` → `src/app/api/admin/apelaciones`.
  - Renombrar `src/lib/apealaciones.ts` → `src/lib/apelaciones.ts`.
  - Actualizar todos los imports de `@/lib/apealaciones` a `@/lib/apelaciones`.
  - Actualizar todas las URLs de fetch de `/api/apeaciones/*` a `/api/apelaciones/*` y `/api/admin/apeaciones/*` a `/api/admin/apelaciones/*`.
  - Actualizar tests para que usen las nuevas URLs.
  - Actualizar `src/proxy.ts` para que la ruta pública sea `/api/apelaciones`.
  - Actualizar `scripts/smoke-apelaciones.ts` y `scripts/job-apelaciones-vencimiento.ts`.
  - El commit debe ser atómico: todos los cambios anteriores en un solo commit para evitar estados intermedios rotos.

### US2 — Barrido final de voseo

- Ocurrencias encontradas:
  - `src/components/modules/AdminReportesTable.tsx` línea 162: "Revisá, clasificá y gestioná los reportes de la comunidad."
  - `src/app/dashboard/admin/comite/gestion/page.tsx` línea 376: "Contraseña temporal (mostrála una vez)"
  - `src/app/dashboard/admin/operadores/gestion/page.tsx` línea 248: "Contraseña temporal (mostrála una vez)"
  - `src/app/api/admin/operadores/route.ts` línea 203: "copiá la contraseña temporal que se muestra arriba."
- Se recomienda un grep con patrones de terminación en voseo para asegurar que no queden textos en la interfaz.
- Nota: comentarios técnicos y mensajes de commit no son objetivo del barrido; solo strings visibles por usuarios.

### US3 — Logger mínimo con niveles

- 22 `console.log` en `src/lib` (9 archivos):
  - `src/lib/queue.ts`: 2
  - `src/lib/email.ts`: 2
  - `src/lib/sms.ts`: 1
  - `src/lib/circulo-confianza.ts`: 8
  - `src/lib/ai/eval-runner.ts`: 2
  - `src/lib/ai/dataset-embedding-backfill.ts`: 2
  - `src/lib/ai/ollama-client.ts`: 2
  - `src/lib/ai/embedder.ts`: 1
  - `src/lib/ai/dataset-anonimizacion-backfill.ts`: 2
- Se propone un logger simple con niveles y variable de entorno `LOG_LEVEL`.
- Los tests que espían `console.log` deben actualizarse.

### US4 — Buscador en la bandeja admin

- `src/components/modules/AdminReportesTable.tsx` tiene filtros por estado, plataforma, categoría, fecha y eliminados, pero no búsqueda textual.
- El endpoint `/api/admin/reportes-revision` tampoco acepta parámetro de búsqueda.
- El tipo `ReporteListItem` incluye `numeroSeguimiento` e `identificador` (a través de la relación con plataforma/identificador).
- Se recomienda agregar un input de búsqueda con placeholder "Buscar por RPT-... o identificador".
- El filtro debe ser server-side para soportar paginación y grandes volúmenes.

### US5 — Agregar eval-results a .gitignore

- `.gitignore` actual no incluye `eval-results/`.
- Se observan archivos `eval-results/f7-guardas-classifier-*.json` generados localmente.
- La regla debe ser `eval-results/` para ignorar la carpeta completa.

## Referencias

- `src/app/api/apeaciones/**`
- `src/app/api/admin/apeaciones/**`
- `src/components/modules/AdminApelaciones.tsx`
- `src/lib/apealaciones.ts`
- `src/components/modules/AdminReportesTable.tsx`
- `src/app/api/admin/reportes-revision/route.ts`
- `.gitignore`
- `src/lib/queue.ts`, `src/lib/email.ts`, `src/lib/circulo-confianza.ts`, `src/lib/ai/*`
