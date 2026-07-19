# Cierre — Spec 035: Correcciones del 034 + blindaje crítico

**Rama**: `feature/001-scaffolding`  
**Fecha de cierre**: 2026-07-19  
**Estado**: COMPLETADO

---

## Resumen de cambios

Se implementaron las 6 User Stories del spec 035 con enfoque en no romper migraciones ni datos existentes.

| US | Descripción | Archivos principales | Resultado |
|----|-------------|----------------------|-----------|
| US4 | Middleware perimetral con `COMITE_VALIDACION` como rol interno | `src/lib/proxy.ts`, `src/proxy.ts` | Middleware intercepta rutas protegidas; 5 roles probados. |
| US1 | Bandeja del comité con build limpio | `src/app/login/page.tsx`, `src/app/dashboard/admin/layout.tsx` (sin cambios), `src/proxy.ts` | Build limpio refleja código fuente; flujo COMITE validado. |
| US2 | Persistencia del editor de grupos | `src/components/modules/CategoriaGruposEditor.tsx` | Lectura desde `data.valor`; no quedan consumidores con `data.parametro?.valor`. |
| US3 | Índices HNSW recreados | `prisma/migrations/20260719095000_recrear_indices_hnsw_embeddings/migration.sql`, `scripts/verify-hnsw-indexes.ts` | Migración aplicada; índices verificados. |
| US5 | Seed idempotente | `prisma/seed.ts`, `package.json` | Seed ejecutado 2 veces sin duplicados; `ADMIN_PASSWORD` obligatorio si admin no existe. |
| US6 | Worker de instancia única | `scripts/worker-reportes.mjs` | Advisory lock con `pg`; segundo worker sale con código 2. |

---

## Nota importante sobre el middleware

El spec pedía `src/middleware.ts`. Next.js 16.2.10 con Turbopack generó una advertencia: el archivo `middleware.ts` está deprecado y la convención recomendada es `src/proxy.ts`. Al usar `src/middleware.ts`, el build parecía correcto pero en ejecución no se aplicaba la lógica actualizada (redirigía a `/` para `COMITE_VALIDACION` en lugar de permitir el acceso).

Se resolvió moviendo el middleware a `src/proxy.ts` siguiendo la convención de Next.js 16:

- `src/lib/proxy.ts`: contiene la lógica de protección de rutas (`proxy`), los roles internos y la redirección por rol.
- `src/proxy.ts`: exporta `proxy` y `config` para que Next.js lo ejecute como middleware.

El comportamiento es idéntico al requerido por el spec: 5 roles probados, `COMITE_VALIDACION` accede a `/dashboard/admin/comite`, roles internos redirigidos fuera de rutas de usuario final, anónimos redirigidos a login/401.

---

## Archivos tocados

- `src/lib/proxy.ts` (nuevo)
- `src/proxy.ts` (refactorizado como entrypoint de middleware)
- `src/components/modules/CategoriaGruposEditor.tsx`
- `prisma/migrations/20260719095000_recrear_indices_hnsw_embeddings/migration.sql`
- `scripts/verify-hnsw-indexes.ts`
- `prisma/seed.ts`
- `scripts/worker-reportes.mjs`
- `package.json`
- `specs/035-correcciones-034-blindaje-critico/spec.md`
- `docs/cierre-035.md` (este archivo)

Archivos **no** modificados según instrucciones del spec:
- `src/app/login/page.tsx`
- `src/app/dashboard/admin/layout.tsx`
- `src/components/modules/NavHeader.tsx`

---

## Validación ejecutada

### Automática

```bash
npx tsc --noEmit        # OK
npm run lint            # OK (0 errores, 2 warnings preexistentes)
npm run test            # OK (77 archivos, 409 tests)
```

### Base de datos

```bash
npx prisma migrate deploy
# Aplicada migración 20260719095000_recrear_indices_hnsw_embeddings
npx tsx scripts/verify-hnsw-indexes.ts
# OK: EmbeddingReporte_vector_idx, EmbeddingDataset_vector_idx
npx prisma db seed
npx prisma db seed
# OK: sin duplicados; admin existe sin cambios
```

### Worker

```bash
# Primer worker: adquiere lock e inicia
# Segundo worker: detecta lock ocupado, imprime mensaje y sale con código 2
```

### Middleware (prueba manual con curl)

- `COMITE_VALIDACION` -> `/dashboard/admin/comite` devuelve `200`.
- `COMITE_VALIDACION` -> `/mis-reportes` devuelve `307` a `/dashboard/admin/comite`.
- `COMITE_VALIDACION` -> `/dashboard/circulo-confianza` devuelve `307` a `/dashboard/admin/comite`.
- Anónimo -> `/dashboard/admin` devuelve `307` a `/login`.
- Anónimo -> `/api/admin/reportes-revision` devuelve `401`.
- Anónimo -> `/consulta` devuelve `200`.
- `ADMIN` -> `/dashboard/admin` devuelve `200`.
- `PARENT` -> `/mis-reportes` devuelve `200`.

---

## Deploy limpio

Ejecutado `./scripts/dev-restart.sh` al final. Healthcheck de `/api/health/worker` responde `200`. Un solo worker levantado.

---

## Commits

Un commit por User Story + uno de documentación:

1. `US4: middleware perimetral con COMITE_VALIDACION como rol interno`
2. `US1: build limpio valida flujo COMITE_VALIDACION` (commit de verificación, sin cambios de código)
3. `US2: persistencia del editor de grupos de categoría`
4. `US3: migración aditiva HNSW y script de verificación`
5. `US5: seed idempotente y scripts de migración seguros`
6. `US6: advisory lock de Postgres para worker único`
7. `docs: cierre-035 y sección Implementación en spec.md`

---

## Deuda técnica

- La advertencia de Next.js 16 sobre `middleware.ts` se resolvió adoptando `src/proxy.ts`. Esto es una desviación menor del nombre de archivo pedido en el spec, pero necesaria para que el framework ejecute el middleware. La lógica y la matriz de roles se mantienen como se especificó.
- No se implementó una prueba E2E automatizada del middleware; la cobertura actual es la prueba manual con curl. Se recomienda añadir tests de middleware cuando Next.js estabilice la convención.
- El script `scripts/verify-hnsw-indexes.ts` se ejecuta manualmente; se agregó el script `db:verify:hnsw` a `package.json` para facilitar su uso.

---

## Próximos pasos

- Monitorear que `./scripts/dev-restart.sh` levante siempre un solo worker.
- Mantener la convención `src/proxy.ts` si Next.js 16 la sigue usando en futuras versiones.
