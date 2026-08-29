# Checklist de requisitos — SPEC-210

## Funcionales

- [ ] FR-001: Schema contiene 7 modelos de pagos del BRIEF §5.1-§5.7.
- [ ] FR-002: Enums en español alineados al BRIEF §3.
- [ ] FR-003: Todos los `DateTime` de modelos de pagos usan `@db.Timestamptz(6)`.
- [ ] FR-004: Migración aditiva sin DROP ni rename destructivo.
- [ ] FR-005: Seed crea 20 planes iniciales (rol × duración × 2026).
- [ ] FR-006: Seed siembra los 11 parámetros `pagos.*`.
- [ ] FR-007: Upsert de planes/parámetros usa `update: { ... }` explícito (anti-I-100).
- [ ] FR-008: `src/lib/dal/repositories/pagos-repository.ts` expone CRUD base.
- [ ] FR-009: Modelos placeholder se conservan sin pérdida de datos.
- [ ] FR-010: No se toca `src/lib/ai/**`.

## No funcionales

- [ ] NFR-001: Gate local completo verde.
- [ ] NFR-002: `npx prisma migrate dev` aplica sin destruir datos.
- [ ] NFR-003: Seed ejecutable dos veces sin duplicados.
- [ ] NFR-004: `arch:check` verde; sin imports de `@/lib/prisma` fuera del repo.

## Criterios de éxito

- [ ] SC-001: 7 modelos + enums + Timestamptz(6).
- [ ] SC-002: Migración aditiva verde.
- [ ] SC-003: Seed idempotente.
- [ ] SC-004: DAL pagos creado.
- [ ] SC-005: Gate local verde.
- [ ] SC-006: CI 6/6 verde.

## Seguridad / datos

- [ ] No se almacena contenido multimedia; solo URL/mime/hash de comprobante.
- [ ] No se expone información financiera sensible en logs.
- [ ] Secrets (API keys futuras) solo por variables de entorno.
