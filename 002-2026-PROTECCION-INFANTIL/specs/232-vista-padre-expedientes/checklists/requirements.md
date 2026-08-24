# Checklist de requisitos — SPEC-232

## Completitud de la spec

- [x] User Stories con Priority y Acceptance Scenarios.
- [x] Edge Cases documentados.
- [x] Functional Requirements numerados (FR-001 a FR-016).
- [x] Non-Functional Requirements.
- [x] Success Criteria medibles (SC-001 a SC-007).
- [x] Assumptions explícitas.
- [x] Decisiones propuestas / Deuda.

## Cumplimiento de restricciones

- [x] No toca `src/lib/ai/**`.
- [x] No modifica schema Prisma ni crea migraciones destructivas.
- [x] No usa `@/lib/prisma` en endpoints ni servicios (usa `ExpedienteRepository`).
- [x] Usa color `cielo` para padre (D-74).
- [x] Terminología en criollo (sin códigos técnicos en UI).
- [x] Ley 1581: vista padre solo ve sus propios expedientes; agregado anónimo queda para SPEC-233.
- [x] Timezone Bogotá (D-69) con `date-fns-tz`.

## Coordinación

- [x] SPEC-232 usa sidebar/layout de SPEC-231.
- [x] No toca `/dashboard/padre/suscripcion` (SPEC-211).
- [x] No implementa búsqueda por identificador (SPEC-233).
