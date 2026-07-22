# Checklist de requisitos — Spec 083

**Spec**: `specs/083-simulacion-completitud-multimodelo/spec.md` · **Fecha**: 2026-07-22

## Completitud del contenido

- [x] User Stories priorizadas (P1 completitud, P1 métricas, P2 multi-modelo) e independientemente testeables.
- [x] Acceptance Scenarios Given/When/Then (5 + 4 + 5).
- [x] Edge Cases (runs históricas, Ollama caído, embedding seleccionado, cancelación entre modelos, worker reiniciado).
- [x] FRs numerados (FR-001 a FR-010).
- [x] Success Criteria medibles (SC-001 a SC-005), incluida verificación contra cálculo SQL directo.
- [x] Dependencia entre objetivos explícita: multi-modelo requiere completitud fiable.

## Calidad de los requisitos

- [x] Sin [NEEDS CLARIFICATION].
- [x] Causa raíz verificada en código con archivo:línea (executor, progreso, GET detalle, UI).
- [x] Contrato documentado (`contracts/simulaciones-api.md`): cambio POST `modelo` → `modelos[]`, shape de `metricasJson`, job nuevo, parámetro nuevo.
- [x] Sin migraciones de esquema (verificado: no se requieren columnas nuevas).
- [x] Criterio de secuencia verificable (fechaInicio/fechaFin por run).

## Listo para planificación

- [x] Plan generado (`plan.md`) con diseño de 3 cambios, alternativas y riesgos.
- [ ] Aprobación de ZEUS (PENDIENTE — no implementar antes).
