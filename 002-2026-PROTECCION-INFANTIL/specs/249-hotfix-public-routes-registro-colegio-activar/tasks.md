# Tasks — SPEC-249 · Hotfix PUBLIC_ROUTES

## Fase 1 · Specify / Plan
- [x] Crear worktree `productos-002-PI-152` desde `origin/feature/001-scaffolding`.
- [x] Escribir `spec.md` con Status PLANEADO, User Stories, FR, SC, Edge Cases, Assumptions e Impacto en arquitectura.
- [x] Escribir `plan.md` con pasos de implementación y verificación.
- [x] Escribir `tasks.md` con checkboxes.
- [ ] Actualizar `specs/README.md` con entrada de SPEC-249.
- [ ] Commit de spec+plan y señal `002-PI-152 · spec+plan LISTO · PARA`.

## Fase 2 · Implement (tras APROBADO §4)
- [ ] Editar `src/lib/proxy.ts`: agregar `/registro-colegio` y `/activar` a `PUBLIC_ROUTES`.
- [ ] Añadir test de regresión en `src/lib/proxy.test.ts`.
- [ ] Ejecutar barrido D-37 sobre rutas públicas del Lote 1.

## Fase 3 · Validate
- [ ] `npx tsc --noEmit`
- [ ] `npm run lint`
- [ ] `npm run arch:check`
- [ ] `npm run tokens:check`
- [ ] `npm run test -- src/lib/proxy.test.ts`
- [ ] `npm run build`

## Fase 4 · Close
- [ ] Gate pre-push: `git fetch && git rebase origin/feature/001-scaffolding && git diff --name-status`.
- [ ] `git push origin work/002-PI-152`.
- [ ] Crear PR con título "SPEC-249 · Hotfix PUBLIC_ROUTES /registro-colegio + /activar (002-PI-152)".
- [ ] Esperar CI verde 11/11 y señal `002-PI-152 · REALIZADO`.
