# Checklist de requisitos — SPEC-208

## Funcionales

- [ ] FR-001: `src/lib/format/fecha.ts` con 3 helpers.
- [ ] FR-002: TZ `America/Bogota` en todos.
- [ ] FR-003: Devuelve `"—"` para input null/undefined/inválido.
- [ ] FR-004: Copias locales migradas.
- [ ] FR-005: Uso de `Intl.DateTimeFormat`.
- [ ] FR-006: Sin schema/migración.

## No funcionales

- [ ] NFR-001: Gate local verde.
- [ ] NFR-002: Zero regresión visual.

## Success Criteria

- [ ] SC-001: Cero `function fechaCorta` fuera de helper.
- [ ] SC-002: `toLocaleDateString.*es-CO` solo en helper o excepciones justificadas.
- [ ] SC-003: Tests unitarios del helper.
- [ ] SC-004: UI muestra fechas TZ Bogotá.
