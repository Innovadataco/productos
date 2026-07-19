# Research — Spec 035: Correcciones del 034 + blindaje crítico

## Hallazgos por User Story

### US1 — Bandeja del comité

- `src/app/dashboard/admin/layout.tsx` incluye `COMITE_VALIDACION` en `ADMIN_ROLES` (línea 6), por lo que el **código fuente** del layout admin ya permite el acceso.
- `src/app/login/page.tsx` redirige a `COMITE_VALIDACION` hacia `/dashboard/admin/comite` (línea 33).
- `src/components/modules/NavHeader.tsx` tiene el link "Mi bandeja" apuntando a `/dashboard/admin/comite` para el rol `COMITE_VALIDACION` (líneas 127-130 y 198-199).
- `src/proxy.ts` define `esRolInterno` solo para `ADMIN`, `SCHOOL_ADMIN` y `OPERADOR` (línea 65), excluyendo a `COMITE_VALIDACION`. Si `src/proxy.ts` se activa como middleware sin corregir, el comité quedaría fuera.
- **Reproducción verificada**: se creó un usuario `COMITE_VALIDACION` real, se inició sesión y se comprobó con `curl` que:
  - `GET /dashboard/admin/comite` devuelve `307 Temporary Redirect` a `/` para el comité.
  - `GET /dashboard/admin` también devuelve `307` a `/` para el comité.
  - `GET /dashboard/admin/comite` devuelve `200 OK` para un usuario `ADMIN` con la misma sesión.
  - `GET /api/admin/comite/pendientes` devuelve `403 Forbidden` para el comité, aunque el endpoint verifica `user.rol !== "COMITE_VALIDACION"`.
- **Causa raíz**: la build actual `.next` está desactualizada. Inspección de `.next/server/chunks/ssr/_09ak6tp._.js` muestra que el set de roles internos del layout admin solo incluye `ADMIN` y `SCHOOL_ADMIN`; `COMITE_VALIDACION` no aparece en el set de roles permitidos. El código fuente del layout sí lo incluye, pero el build no refleja esa versión. Esto explica que `ADMIN` acceda y `COMITE_VALIDACION` sea redirigido a `/`.
- **Fix real**: ejecutar `rm -rf .next && npm run build` (deploy limpio) para que el build refleje el código fuente actual. Como defensa en profundidad, US4 debe activar `src/middleware.ts` incluyendo `COMITE_VALIDACION` en roles internos, de modo que el comportamiento no dependa únicamente del layout.
- **Cuidado**: no se deben modificar `src/app/dashboard/admin/layout.tsx` ni `src/app/login/page.tsx` porque ya están correctos.

### US2 — Persistencia del editor de grupos

- `src/components/modules/CategoriaGruposEditor.tsx` línea 70: `const parsed = JSON.parse(data.parametro?.valor || "{}");`.
- `src/app/api/config/parametros/[clave]/route.ts` devuelve `NextResponse.json({ ...param, valor: param.esSecreto ? null : param.valor })` (línea ~141 en 034), es decir, `valor` está en el nivel superior.
- Por tanto, `data.parametro?.valor` siempre es `undefined` y el editor cae al fallback.
- Se debe buscar `data.parametro?.valor` en otros componentes para corregir el mismo patrón.
- El caché de parámetros (`src/lib/config-cache.ts`) invalida `public_params` pero no una clave específica; si existe `getParametroSistema` con cache, se debe invalidar al guardar.

### US3 — Índices vectoriales hnsw

- `prisma/migrations/20260718094450_add_reintento_reporte/migration.sql` contiene `DROP INDEX "EmbeddingDataset_vector_idx";` y `DROP INDEX "EmbeddingReporte_vector_idx";` sin recrearlos.
- `prisma/migrations/20260717002004_add_pgvector_hnsw_indexes/migration.sql` muestra el patrón correcto: `CREATE INDEX ... USING hnsw (vector vector_cosine_ops)`.
- `prisma/schema.prisma` comenta explícitamente que los índices hnsw se crean por migración SQL manual y Prisma no los gestiona.
- Es necesario crear una nueva migración aditiva que recree ambos índices con `CREATE INDEX IF NOT EXISTS`.

### US4 — Middleware perimetral

- `src/proxy.ts` exporta `proxy` y `config`, pero no existe `src/middleware.ts`.
- Next.js App Router requiere un archivo `src/middleware.ts` (o `middleware.ts` en raíz) que exporte `middleware`.
- El matcher en `src/proxy.ts` (`config.matcher`) es el formato correcto para Next.js middleware.
- Se puede mover/refactorizar `src/proxy.ts` a `src/middleware.ts` o importar la lógica desde `src/middleware.ts`.
- Se debe mantener `verifyAuth` en endpoints para defensa en profundidad.

### US5 — Datos idempotentes

- `prisma/seed.ts` línea 27: `await prisma.usuario.create(...)` con password default `"Admin123!Secure"` si no está en producción.
- El usuario admin se busca por email (`adminExists`), pero se usa `create` en lugar de `upsert`. Debe convertirse a `upsert` por email.
- `seedEvalFixture` usa `prisma.casoEval.createMany` (línea 1072). `createMany` no soporta `upsert`. Como `CasoEval` no tiene un índice único sobre la clave natural (`texto + fuente + fixtureVersion`), `skipDuplicates: true` no sería efectivo. La opción segura es convertir el `createMany` en un loop de `findFirst` + `create`/`update` por registro.
- `seedSpamExamples` usa `prisma.datasetEntrenamiento.create` dentro de un loop (línea 1098). Debe convertirse a `findFirst` por `texto + fuente` y luego `create` o `update`, o bien usar `upsert` si se agrega un índice único. Dado que no hay índice único actual, se recomienda el loop manual.
- `ADMIN_PASSWORD` debe ser obligatorio si el admin no existe; no debe haber default en ningún entorno.
- Ningún script actual invoca `migrate dev` o `migrate reset`, pero se debe documentar formalmente.

### US6 — Worker de instancia única

- `scripts/worker-supervisor.mjs` usa `spawn` para iniciar `worker-reportes.mjs` y reinicia hasta 5 veces.
- `scripts/worker-reportes.mjs` conecta con `pg-boss` y Prisma.
- No existe mecanismo de lock para evitar dos instancias simultáneas.
- Postgres soporta advisory locks (`pg_advisory_lock`). El lock es de sesión y se libera al cerrar la conexión, ideal para graceful shutdown.
- El lock debe obtenerse con un ID numérico fijo (por ejemplo, `12345678`) antes de iniciar `pg-boss`.

## Referencias

- `src/app/dashboard/admin/layout.tsx`
- `src/components/modules/NavHeader.tsx`
- `src/components/modules/CategoriaGruposEditor.tsx`
- `src/app/api/config/parametros/[clave]/route.ts`
- `src/proxy.ts`
- `prisma/seed.ts`
- `prisma/migrations/20260718094450_add_reintento_reporte/migration.sql`
- `prisma/migrations/20260717002004_add_pgvector_hnsw_indexes/migration.sql`
- `scripts/worker-supervisor.mjs`
- `scripts/worker-reportes.mjs`
