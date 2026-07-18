# Cierre — Spec 026: Pipeline de spam

## Resumen

Se implementó el pipeline de spam según la Spec 026:

- `SPAM` se agregó como categoría válida de `CategoriaConducta`.
- Se ejecutó la migración `npx prisma migrate dev --name add_spam_categoria` (nunca `db push`).
- Se agregó el parámetro `clasificacion.umbral_spam` (default `0.7`) en seed y utilidades de test.
- Se quitó el juicio de spam por contenido de la heurística rápida de ingreso; ahora solo frena volumen (rate-limit/fingerprint).
- El clasificador reconoce `SPAM` como categoría válida. Cuando la IA devuelve `SPAM` con confianza >= `umbral_spam`, el reporte pasa a `POSIBLE_SPAM` para revisión humana.
- Se sembraron 8 ejemplos de spam anonimizados en `DatasetEntrenamiento` con `fuente = spam_revisado`.
- Se implementaron los endpoints:
  - `GET /api/admin/spam/pendientes`
  - `POST /api/admin/spam/[id]/resolver`
- Se creó la UI `/dashboard/admin/spam` (`SpamRevisionPanel`) y se agregó el link en `AdminNav`.
- Se registran transiciones en `TransicionReporte` cuando el operador resuelve un caso.
- Se ajustaron los scripts de evaluación y `scoring.ts` para que `SPAM` compile sin romper el resto del sistema.

## Archivos tocados

- `prisma/schema.prisma`
- `prisma/migrations/20260718111049_add_spam_categoria/migration.sql` (nuevo)
- `prisma/migrations/20260718190000_add_rol_comite_validacion/migration.sql` (renombrado desde `20260718104515...`)
- `prisma/seed.ts`
- `src/lib/reporte-test-utils.ts`
- `src/lib/scoring.ts`
- `src/lib/ai/classifier.ts`
- `src/app/api/reportes/route.ts`
- `src/app/api/reportes/route.test.ts`
- `src/app/api/reportes/procesar/route.ts`
- `src/app/api/reportes/procesar/route.test.ts`
- `src/app/api/admin/spam/pendientes/route.ts` (nuevo)
- `src/app/api/admin/spam/pendientes/route.test.ts` (nuevo)
- `src/app/api/admin/spam/[id]/resolver/route.ts` (nuevo)
- `src/app/api/admin/spam/[id]/resolver/route.test.ts` (nuevo)
- `src/components/modules/SpamRevisionPanel.tsx` (nuevo)
- `src/app/dashboard/admin/spam/page.tsx` (nuevo)
- `src/components/modules/AdminNav.tsx`
- `src/components/modules/AdminReporteDetalle.tsx`
- `src/components/modules/AdminReportesTable.tsx`
- `scripts/eval-classifier-*.ts` (8 archivos, agregar SPAM a la lista de categorías)

## Resultados de la suite

- `npm run lint`: ✅ sin errores (1 warning preexistente en `src/lib/sms.ts`).
- `npx tsc --noEmit`: ✅ sin errores.
- `npm run build`: ✅ build exitosa.
- `npm run test`: ✅ 343 tests pasados, 68 archivos de test.
- `npm run smoke-e2e`: no existe en `package.json`; no se ejecutó.

## Decisiones y notas

- **Estado de spam confirmado**: se usó baja con `motivoBaja = RETIRO_LIMPIEZA`, según lo propuesto en `research.md`.
- **Sembrado de RAG**: los ejemplos de spam se insertan con embedding si Ollama está disponible; si no, se registra el texto y se deja un log de advertencia. No se entrenó el modelo (queda para SPEC-050).
- **Heurística de ingreso**: solo protege contra volumen. El rate-limit por identificador puede seguir marcando `POSIBLE_SPAM` o `REVISION_MANUAL` por exceso de reportes, pero eso es un control de volumen, no de contenido.
- **Migración preexistente**: se renombró `20260718104515_add_rol_comite_validacion` a `20260718190000_add_rol_comite_validacion` y se actualizó el registro en `_prisma_migrations` del entorno de desarrollo, porque su timestamp anterior rompía el orden de aplicación en el shadow database de `prisma migrate dev`. El SQL de la migración no cambió.

## Hash del commit principal

`75df38d30c3cb2e6624ba60198e00b99282fee8b`
