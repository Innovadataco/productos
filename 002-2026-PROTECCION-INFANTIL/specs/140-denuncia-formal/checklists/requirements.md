# Checklist de requisitos: SPEC-140

**Fecha**: 2026-08-02 · **Validado por**: ODIN (compuerta §4)

## Completitud del contenido

- [x] Sin restos de plantilla ni placeholders.
- [x] User Stories con Priority, Why, Independent Test y Acceptance Scenarios (US1-US3).
- [x] Edge Cases explícitos (doble clic, reporte eliminado, plantilla genérica, parámetro
      de canales ausente, texto original excluido, lenguaje sin veredictos).
- [x] FR-001..FR-010 verificables; FR-003 fija la no-retención del PDF; FR-007 fija la
      exclusión del texto original.
- [x] Success Criteria medibles (SC-001..SC-006), incluido test de AUSENCIA de identidad
      del denunciante (SC-003).
- [x] Assumptions documentadas (roles por defecto; revisión legal del CEO no bloquea;
      envío directo al canal fuera de alcance; métrica sin tabla nueva).
- [x] Línea "Impacto en arquitectura" presente (con regeneración de docs/architecture).
- [x] `## Data Model` y `## Contracts` completos en plan.md (enum aditivo motivado; 3
      endpoints + contador con códigos canónicos).
- [x] Reverificado en fuente con línea (pdf-estadisticas.ts:94, route pdf :53-77,
      mensaje-padre.ts:36-79/158-173, schema.prisma:45-119/357-381/614/931,
      expediente/route.ts:61-76, seed.ts:1010-1019).

## Calidad

- [x] D-23 explícito (plantilla determinista, nunca IA) y D-22 (auditoría sin contenido).
- [x] Restricciones de constitución verificadas una por una (Constitution Check del plan).
- [x] Migración ADITIVA de enum; verificación de que sea solo ADD VALUE anotada como
      riesgo en research.md.
- [x] Sin secretos ni valores sensibles (I-22).
- [x] Coherente con F2 (PROPUESTA §F2, línea 99) y N-4/F2 (PLAN líneas 72 y 81) del
      instructivo 002-PI-056 (BANDA 3).
- [x] Decisiones de diseño que requieren validación listadas en research.md (roles,
      exclusión de texto original, eventos sin dedup, auditar exportación y no vista).

## Pendiente (compuerta)

- [x] Veredicto de ZEUS: APROBADO 2026-08-02 (BLOQUE B, 5 decisiones registradas en tasks/plan).
