# Tasks: SPEC-136 — tipado estricto (casts + guards + tsconfig)

**Input**: plan.md + spec.md (APROBADO por ZEUS 2026-08-01; difiere
`noUncheckedIndexedAccess`/`noPropertyAccessFromIndexSignature` como E-3b radicable aparte).

## Fase 1 — Casts del motor y DAL (FR-001)

- [x] T001 `reporte-processing/clasificacion.ts` (10 casts → Zod/guards; lógica intacta)
- [x] T002 `ia-evals.ts` (8) + `ia-simulaciones.ts` (1) + `ai/eval-runner.ts` (1)
- [x] T003 `carga-roster-sesion.ts` (2 → Json de Prisma tipado)

## Fase 2 — Casts sueltos (FR-001)

- [x] T004 `pdf-estadisticas.ts` (3), `test-setup.ts` (2), `prisma.ts` (1), `GlassCard.tsx` (1)

## Fase 3 — `!.` → guardas (FR-002)

- [x] T005 `GestionPageClient.tsx` (5 → un narrowing), `ConfigSection.tsx` (2)
- [x] T006 `correcciones/route.ts` (2), `configuracion.ts` (3), `riesgo-consulta.ts` (1),
      `simulaciones/route.ts` (1), `apelaciones/route.ts` (1)

## Fase 4 — tsconfig maximal viable (FR-003/FR-004)

- [x] T007 Activar `noFallthroughCasesInSwitch` + `noImplicitOverride` +
      `forceConsistentCasingInFileNames` (0/1/0 errores)
- [x] T008 Activar `exactOptionalPropertyTypes` y corregir los ~120 errores
      (ojo payloads API: `{ x: undefined }` vs `{}`)
- [x] T009 Documentar E-3b en la spec (diferidos con conteo)

## Fase 5 — Gates y cierre

- [x] T010 Suite completa + tsc (flags nuevos) + lint + build + arch:check verdes;
      greps de control en 0
- [x] T011 Cierre documental: spec.md (Status + §Implementación), checklist, specs/README.md
