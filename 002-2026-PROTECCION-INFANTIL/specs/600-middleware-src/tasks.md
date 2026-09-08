# Tasks — SPEC-600 · middleware.ts en `src/`

## Fase 1 — Puente
- [x] T001 · `src/middleware.ts`: re-export de `middleware` + `config` con
      matcher literal (Next 16 no reconoce config re-exportado) — `src/middleware.ts`

## Fase 2 — Candado de recaída
- [x] T010 · Test: existe, re-exporta middleware (función), config con matcher
      no vacío idéntico al de la raíz, y middleware es la misma referencia —
      `src/middleware-ubicacion.candado.test.ts`
- [x] T011 · Sumar el candado a los unitarios — `vitest.unit.includes.ts`

## Fase 3 — Verificación de runtime (obligatoria)
- [x] T020 · `rm -rf .next && npm run build` → `.next/server/middleware/` +
      `middleware-manifest.json` existen, el manifest trae el matcher exacto
      (no el default) y el bundle edge contiene el código del guard

## Fase 4 — Compuertas
- [x] T030 · `tsc --noEmit` verde
- [x] T031 · `npm run lint` verde
- [x] T032 · `npm run test` verde (incluye candado nuevo)
- [x] T033 · `npm run arch:check` verde

## Fase 5 — Artefactos y cierre
- [x] T040 · `spec.md` + `plan.md` + `tasks.md` en `specs/600-middleware-src/`
- [x] T041 · Índice `specs/README.md` actualizado
