# Checklist de requisitos: SPEC-143 — Home operativo del rector

**Spec**: [../spec.md](../spec.md) · **Fecha**: 2026-08-03

## Completitud del contenido

- [x] User Stories con Priority, Why, Independent Test y Acceptance Scenarios (US1–US4)
- [x] Edge Cases (sin profesores, sin alertas, delta cero, skeleton, tenant por
      construcción)
- [x] Functional Requirements "FR-XXX: El sistema DEBE…" (FR-001…FR-014)
- [x] Key Entities (DTO HomeRector, AlertaColegio)
- [x] Success Criteria medibles (SC-001…SC-007)
- [x] Assumptions explícitas
- [x] Línea "Impacto en arquitectura" presente (cambia stack: recharts+lucide-react
      ⇒ regenerar `06-stack.md`)

## Alineación con fuentes vinculantes

- [x] Brief §5.1/§5.2 (mockups obligatorios), §4.3 anillos, §4.5 barrido, §4.6
      vidrio, §3 terminología, §4.0 principios — enlazados, no copiados
- [x] Anclaje §10: reemplaza page.tsx, conserva layout, homeRector en UNA llamada,
      supera C2/C3 de SPEC-129 (documentado FR-001)
- [x] Exploración en fuente verificada (qué existe, qué falta, trampas tenant/PII) —
      research D-R1
- [x] SPEC-157 montada completa: tokens, Instrument, 4 primitivos como consumidores
      por primera vez
- [x] Candados: multi-tenant (FR-002/SC-001), cero N+1 (FR-002), I-29 (FR-013), no
      tocar motor IA (FR-013), ratchet tokens (FR-012)
- [x] Lo no fijado va como decisión a ZEUS (D1–D3), no inventado

## Calidad

- [x] Cada FR es testeable (quickstart por bloque)
- [x] Sin contradicciones internas (D2 deja explícito que la tendencia usa la misma
      métrica que el KPI)
- [x] Cero secretos o valores sensibles (I-22)

## Compuerta §4 — RESUELTA (ZEUS, 2026-08-03: REVISO `262721f7` → CUMPLE)

- [x] D1 = aceptada con ajuste: ámbar = **72 h** + CONDICIÓN DE COPY (en ámbar el
      texto dice que ya está atendido)
- [x] D2 = `COUNT(DISTINCT reporteId)` (KPI y tendencia con la misma métrica)
- [x] D3 = DOS hechos: última señal del colegio (`max(AlertaColegio.creadoEn)`,
      "sin señales aún" si nunca) + última revisión del sistema (heartbeat del
      worker, global y verdadero). Regla de la franja: SOLO VERDADES
- [x] Sigue: `/speckit.tasks` → `/speckit.analyze` → `/speckit.implement`
