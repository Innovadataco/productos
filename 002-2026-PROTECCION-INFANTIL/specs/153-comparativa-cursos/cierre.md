# Cierre: SPEC-153 — Comparativa entre cursos

## Estado

🟢 Implementada (integrada en `feature/001-scaffolding`).

## Resumen

Se implementó la comparativa agregada de cursos para el rol SCHOOL_ADMIN, con agrupación por grado o año lectivo y exportación a Excel. No expone PII.

## Cambios entregados

Por completar tras la integración.

## Gate de calidad

- `npx tsc --noEmit` ✅
- `npm run lint` ✅
- `npm run tokens:check` ✅
- `npm run arch:check` ✅
- `npm run test:coverage` ✅
- `npm run build` ✅

## Evidencia de integración

- Rama: `work/002-pi-058`
- PR a `feature/001-scaffolding`: #TODO
- Hash de merge en `feature/001-scaffolding`: #TODO
- CI-PUSH verde: #TODO

## Notas

- No se modificó `src/lib/ai/**` (I-29 intacto).
- No se realizaron migraciones de datos.
