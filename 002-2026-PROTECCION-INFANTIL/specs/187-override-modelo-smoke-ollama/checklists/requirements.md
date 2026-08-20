# Checklist de requisitos: SPEC-187 — Override de modelo para smoke Ollama

## Funcionales

- [ ] FR-001: Existe parámetro `monitoreo.ollama.smoke.modelo`.
- [ ] FR-002: Override no vacío se usa y se reporta fuente `override`.
- [ ] FR-003: Fallback a `ia.rubrica.modelos[0]` cuando no hay override.
- [ ] FR-004: Detalle incluye modelo y fuente en éxito y error.
- [ ] FR-005: Seed siembra el parámetro con default vacío.
- [ ] FR-006: No se modifica `src/lib/ai/**`.

## Tests

- [ ] Test override usa modelo configurado.
- [ ] Test sin override usa modelo vigente del motor.
- [ ] Test override vacío (espacios) triggerea fallback.

## Calidad

- [ ] `npx tsc --noEmit` verde.
- [ ] `npm run lint -- --no-cache` verde (sin errores nuevos).
- [ ] `npm run arch:check` verde.
- [ ] `npm run test` verde en archivos afectados.
- [ ] `npm run build` verde.
