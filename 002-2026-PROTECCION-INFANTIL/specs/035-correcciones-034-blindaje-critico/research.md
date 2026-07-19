# Research — Spec 035: Correcciones del 034 + blindaje crítico

## Hallazgos por User Story

### US1 — Bandeja del comité

- `src/app/dashboard/admin/layout.tsx` incluye `COMITE_VALIDACION` en `ADMIN_ROLES` (línea 6), por lo que el layout admin teóricamente permite el acceso.
- `src/proxy.ts` define `esRolInterno` solo para `ADMIN`, `SCHOOL_ADMIN` y `OPERADOR` (línea 65), excluyendo a `COMITE_VALIDACION`. Si `src/proxy.ts` se activa como middleware, el comité quedaría fuera.
- `src/components/modules/NavHeader.tsx` tiene el link "Mi bandeja" apuntando a `/dashboard/admin/comite` para el rol `COMITE_VALIDACION` (líneas 127-130 y 198-199).
- No existe `src/middleware.ts`, por lo que la lógica de `src/proxy.ts` no se ejecuta.
- Hipótesis del comportamiento observado: el usuario aterriza en el home público porque alguna guardia adicional o la falta de middleware redirige incorrectamente. Al activar el middleware se debe incluir `COMITE_VALIDACION` como interno.

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
- El usuario admin se busca por email (`adminExists`), pero se usa `create` en lugar de `upsert`.
- `seedEvalFixture` y `seedSpamExamples` verifican por conteo; si se agregan casos manualmente, podrían omitirse futuras semillas. El enfoque idempotente es upsert por clave natural (texto + categoría) o por un campo de fixtureVersion.
- `ADMIN_PASSWORD` debe ser obligatorio si el admin no existe; no debe haber default.
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
