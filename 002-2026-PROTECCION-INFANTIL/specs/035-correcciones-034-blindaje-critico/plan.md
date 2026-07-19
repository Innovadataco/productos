# Plan — Spec 035: Correcciones del 034 + blindaje crítico

## Fase 1: Análisis y preparación

- P1.1 Revisar el flujo completo de `COMITE_VALIDACION` (login, NavHeader, AdminLayout, proxy, página destino).
- P1.2 Confirmar la forma de respuesta de `GET /api/config/parametros/[clave]` y todos los consumidores.
- P1.3 Verificar el estado actual de los índices hnsw en PostgreSQL y la migración que los eliminó.
- P1.4 Revisar `src/proxy.ts` para convertirlo en `src/middleware.ts` válido.
- P1.5 Revisar `prisma/seed.ts` para identificar operaciones no idempotentes.
- P1.6 Revisar `scripts/worker-supervisor.mjs` y `scripts/worker-reportes.mjs` para agregar advisory lock.

## Fase 2: Implementación por User Story

- P2.1 **US1**: Ajustar `src/app/dashboard/admin/layout.tsx`, `src/proxy.ts` y `src/middleware.ts` para incluir `COMITE_VALIDACION` como rol interno; verificar el link "Mi bandeja" en `NavHeader`.
- P2.2 **US2**: Corregir `CategoriaGruposEditor.tsx` y otros consumidores que lean `data.valor`; invalidar caché si aplica.
- P2.3 **US3**: Crear migración SQL aditiva para recrear índices hnsw; crear script de verificación.
- P2.4 **US4**: Crear `src/middleware.ts` con matcher adecuado; mantener `src/proxy.ts` como helper o refactorizar.
- P2.5 **US5**: Hacer idempotente el seed (admin upsert, casos/dataset upsert); exigir `ADMIN_PASSWORD`.
- P2.6 **US6**: Agregar advisory lock en el worker; asegurar graceful release.

## Fase 3: Tests y validación

- P3.1 Escribir/actualizar tests de API para middleware y parámetros.
- P3.2 Probar manualmente el flujo de COMITE_VALIDACION con el quickstart.
- P3.3 Ejecutar `npx tsc --noEmit`, `npm run lint`, `npm run test`.
- P3.4 Ejecutar `prisma migrate deploy` y el script de verificación de índices.
- P3.5 Probar inicio de segundo worker.

## Fase 4: Cierre

- P4.1 Actualizar `spec.md` con sección Implementación.
- P4.2 Validar checklist de requisitos.
- P4.3 Commits: uno por User Story + uno de docs.
- P4.4 Deploy limpio y pruebas con `quickstart.md`.
