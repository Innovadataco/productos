# Cierre — Spec 050: Mejora del prompt del clasificador

## Resumen

Se implementó la mejora quirúrgica del system prompt en `src/lib/ai/classifier.ts`, corrigiendo dos fallos sistemáticos detectados en simulación: la confusión de `SOLICITUD_MATERIAL` con `OFRECIMIENTO_REGALOS`, y el bajo recall de `CONTACTO_INSISTENTE` frente a señales tempranas de grooming.

## User Story cubierta

- **US1 (P1)**: Ajuste quirúrgico del prompt de clasificación.
  - Regla de prioridad `SOLICITUD_MATERIAL` sobre `OFRECIMIENTO_REGALOS` cuando hay solicitud de material íntimo + ofrecimiento.
  - Ejemplo corregido: `"te compro un celular si me mandas fotos" → SOLICITUD_MATERIAL`.
  - Ampliación de `CONTACTO_INSISTENTE` con grooming temprano y ejemplos contrastivos.

## Archivos tocados

- `src/lib/ai/classifier.ts` — reemplazo del `basePrompt` por el texto aprobado.
- `src/lib/ai/classifier.test.ts` — smoke tests de contenido del prompt.
- `specs/050-mejora-prompt-clasificador/spec.md` — sección Implementación, Status `CERRADA`.
- `docs/PRE-PRODUCCION.md` — registro de la deuda de validación formal contra datos humanos.

## Commits

- `a9d8bd7` docs(050): plan Spec-Kit completo de mejora del prompt del clasificador
- (Pendiente en esta sesión) test(050): smoke tests del prompt ajustado
- (Pendiente en esta sesión) prompt(050): ajuste quirúrgico del system prompt del clasificador
- (Pendiente en esta sesión) docs(050): cierre + PRE-PRODUCCION.md

## Validación

- `npx vitest run src/lib/ai/classifier.test.ts`: 10/10 tests OK.
- `npm run test`: 600/600 tests OK (meta ≥ 595).
- `npx tsc --noEmit`: OK.
- `npm run lint`: OK.
- `npm run build`: OK.

## Deploy

- `./scripts/dev-restart.sh` ejecutado tras el build: app en :5005, healthcheck OK, un solo worker.

## Deuda técnica

- La validación formal de recall/precisión contra un set de referencia de casos reales corregidos por humanos queda pendiente. Los smoke tests cubren la presencia textual del prompt, no la métrica real del modelo. Registrado en `docs/PRE-PRODUCCION.md` (Sección 3 — Verificaciones finales).

## Estado

Status: **CERRADA**.
