# Requirements Checklist — Spec 035

## User Story 1 — Bandeja del comité
- [ ] `COMITE_VALIDACION` es reconocido como rol interno en `src/app/dashboard/admin/layout.tsx`.
- [ ] `src/proxy.ts` incluye `COMITE_VALIDACION` en roles internos.
- [ ] Tras login, `COMITE_VALIDACION` va a `/dashboard/admin/comite`.
- [ ] "Mi bandeja" en `NavHeader` mantiene al comité en `/dashboard/admin/comite`.
- [ ] `COMITE_VALIDACION` no aterriza en `/`, `/mis-reportes` ni `/dashboard/circulo-confianza`.
- [ ] Middleware permite el acceso de `COMITE_VALIDACION` a `/dashboard/admin/comite`.

## User Story 2 — Persistencia del editor de grupos
- [ ] `CategoriaGruposEditor.tsx` lee `data.valor` (no `data.parametro?.valor`).
- [ ] El valor guardado persiste tras recargar la página.
- [ ] Se invalida cualquier caché de `ui.grupos_categoria` al guardar.
- [ ] Otros consumidores con el patrón incorrecto se corrigen.
- [ ] El fallback se usa solo cuando el parámetro no existe o el JSON es inválido.

## User Story 3 — Índices vectoriales hnsw
- [ ] Nueva migración aditiva recrea ambos índices con `USING hnsw`.
- [ ] `prisma migrate deploy` deja los índices existentes.
- [ ] Script de verificación post-migración comprueba ambos índices.
- [ ] El script falla con código distinto de cero si falta algún índice.
- [ ] Las consultas de similitud no hacen sequential scan.

## User Story 4 — Middleware perimetral
- [ ] Existe `src/middleware.ts` que exporta `middleware`.
- [ ] El matcher cubre rutas protegidas y excluye estáticos.
- [ ] Sin sesión en ruta admin → redirect a `/login`.
- [ ] Sin sesión en API admin → 401.
- [ ] Rol interno en ruta PARENT → redirect a su área.
- [ ] Rutas públicas permiten tráfico anónimo.
- [ ] `verifyAuth` sigue usándose en endpoints.

## User Story 5 — Datos idempotentes
- [ ] `prisma/seed.ts` usa `upsert` para el admin.
- [ ] El seed falla si `ADMIN_PASSWORD` falta y el admin no existe.
- [ ] No hay default hardcodeado de password en ningún entorno.
- [ ] Casos de evaluación SEMILLA son idempotentes.
- [ ] Ejemplos de spam son idempotentes.
- [ ] Ningún script invoca `migrate dev`, `migrate reset` ni `db push`.
- [ ] Documentación de despliegue indica `prisma migrate deploy` como único método.

## User Story 6 — Worker de instancia única
- [ ] El worker intenta obtener un advisory lock de Postgres al inicio.
- [ ] Si no obtiene el lock, el worker sale con código distinto de cero.
- [ ] El lock se libera al recibir SIGTERM/SIGINT.
- [ ] Solo un worker puede estar activo a la vez.

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
