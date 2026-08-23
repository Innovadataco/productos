# Checklist de requisitos — SPEC-231

## Completitud de la spec

- [x] User Stories con Priority y Acceptance Scenarios.
- [x] Edge Cases documentados.
- [x] Functional Requirements numerados (FR-001 a FR-012).
- [x] Non-Functional Requirements.
- [x] Success Criteria medibles (SC-001 a SC-007).
- [x] Assumptions explícitas.
- [x] Decisiones propuestas / Deuda.

## Cumplimiento de restricciones

- [x] No toca `src/lib/ai/**`.
- [x] No modifica schema Prisma ni crea migraciones destructivas.
- [x] No usa `@/lib/prisma` en endpoints ni servicios (no hay endpoints en esta SPEC).
- [x] Usa color `cielo` para padre (D-74).
- [x] Terminología en criollo (sin códigos técnicos en UI).
- [x] Responsive por defecto.
- [x] Sin `Math.random()` en render.

## Coordinación

- [x] SPEC-231 crea sidebar completo; SPEC-211 solo implementa su página.
- [x] Depende de SPEC-210 y SPEC-230, ambos en `feature/001-scaffolding`.
