# SPEC-442 · Plan

## Fases

1. **Verificar el hueco vivo con grep** — 2 callers reales de `Colegio.create` en `src/` (registro público sí sembraba; admin NO). Reportar al CEO antes de codificar.
2. **`sembrarSemillaColegio`** — un solo lugar; materias + cursos + onboarding.
3. **3 callers pasan por el helper** — admin, registro público, smoke-prod-safe.
4. **Pantalla paso 4** — conteo real, título dinámico, CTA in-place, botón atrás.
5. **Paso 3 «Agregar profesor»** in-place con validación de año de nacimiento.
6. **Selector año nacimiento** — UI (`min/max`), submit (rango real) y backend (Zod + Excel).
7. **Layouts** — colapsar footer duplicado (padre delega al hijo), ancho excepcional para paso plan.
8. **Candado por conducta** — 2 tests integración; sacar la llamada al helper → rojo.
9. **Script idempotente** — `scripts/spec-442-reparar-colegios-sin-cursos.ts` con `--dry-run`.
10. **arch:check + tokens + lint + specs + PR**.

## Reutilización

- `seedMateriasPorDefecto` (SPEC-162) y `crearCursosPorDefecto` (SPEC-344) intactos; el helper compone.
- `OnboardingColegioRepository` sigue vivo para otros callers; el helper hace `findUnique → create` directo para no pasar por el repo dentro de la transacción.
- `PlanesSelector`, `CargaProfesoresExcel`, `Input`, `Select`, `GlassCard`, `Alerta` reusados.

## Riesgos y candados

- El candado del helper cubre admin + registro público; smoke corre contra prod (no en tests), su cobertura es el propio diff del PR.
- El helper mantiene compatibilidad hacia atrás: si un caller ya tiene onboarding, `sembrarSemillaColegio` lo detecta y no duplica.
- Migrar callsites obligados a pasar por el helper cierra la clase; futuro debe hacer lo mismo. Documentado en `spec.md`.
