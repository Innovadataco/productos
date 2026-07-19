# Research — Spec 036: Consistencia y limpieza

## Hallazgos por User Story

### US1 — Renombrar apeaciones → apelaciones

- Rutas afectadas:
  - `src/app/api/apeaciones/solicitar/route.ts`
  - `src/app/api/apeaciones/verificar/route.ts`
  - `src/app/api/apeaciones/[token]/route.ts`
  - `src/app/api/admin/apeaciones/route.ts`
  - `src/app/api/admin/apeaciones/[id]/resolver/route.ts`
  - `src/app/api/admin/apeaciones/[id]/route.ts`
  - `src/app/api/admin/apeaciones/[id]/rehabilitar/route.ts`
  - `src/app/api/admin/apeaciones/vencer/route.ts`
  - Tests en `src/app/api/apeaciones/**/route.test.ts` y `src/app/api/admin/apeaciones/**/route.test.ts`.
- Consumidores identificados:
  - `src/components/modules/AdminApelaciones.tsx`
  - `src/app/dashboard/admin/operadores/gestion/page.tsx`
  - `src/proxy.ts` (lista de rutas públicas)
  - `src/components/modules/AdminNav.tsx`
  - `src/lib/operadores/asignador.ts`
  - `src/lib/operadores/integracion.test.ts`
  - `src/lib/apealaciones.ts` (módulo con doble error: `apealaciones` en lugar de `apelaciones`)
  - `src/app/apelar/page.tsx`
- El renombramiento debe ser atómico: todos los archivos, imports, URLs y tests en un solo commit.

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
