# Tasks — SPEC-250 · Hotfix loop /consentimiento (I-111)

**Branch**: `work/002-PI-153`  
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

---

## Fase 1 — Fix

- **T001** [P] Extender `SESION_ROUTES` en `src/lib/proxy.ts` con `/consentimiento` y `/api/consentimiento`.
  - Archivo: `src/lib/proxy.ts`
- **T002** [P] Barrido D-37: revisar `src/app/**/page.tsx` y `src/app/api/**/route.ts` recientes para detectar otras rutas post-login huérfanas.

## Fase 2 — Regresión

- **T003** [P] Agregar tests en `src/lib/proxy.test.ts` para `SCHOOL_ADMIN`, `PARENT`, `COMITE_CONVIVENCIA`, `ADMIN` y anónimo sobre `/consentimiento` y `/api/consentimiento/aceptar`.
  - Archivo: `src/lib/proxy.test.ts`

## Fase 3 — Verificación

- **T004** [P] Gate local: `npx tsc --noEmit`, `npm run lint`, `npm run arch:check`, `npm run tokens:check`, `npm run test:unit -- src/lib/proxy.test.ts`, `npm run build`.
- **T005** [P] Regenerar línea base de arquitectura si `arch:check` lo requiere.

## Fase 4 — Entrega

- **T006** [P] Commit + gate pre-push (`git fetch && git rebase origin/feature/001-scaffolding && git diff --name-status origin/feature/001-scaffolding..HEAD`) + push + PR.
- **T007** [P] Actualizar `spec.md` sección Implementación y crear `cierre.md` al mergear.

---

## Notas de coordinación

- Hotfix mínimo sobre `feature/001-scaffolding` HEAD `d070e8c7`; no depende de otros PRs.
- Cero cambios en `src/lib/ai/**`, cero migraciones, cero schema.
