# Data Model: SPEC-157 — Sin cambios de datos

**Fecha**: 2026-08-03 · **Spec**: [spec.md](./spec.md)

Esta SPEC es exclusivamente de sistema visual (CSS, fuentes, componentes de
presentación). **No toca el schema de Prisma, no crea migraciones, no altera
entidades ni flujos de datos.**

- Sin impacto en `prisma/schema.prisma`.
- Sin impacto en `docs/architecture/01-modelo-datos.md`.
- `arch:check` se corre igualmente como parte del gate (debe quedar VERDE sin
  regeneración).
