# Checklist de requisitos: SPEC-139

**Fecha**: 2026-08-02 · **Validado por**: ODIN (compuerta §4)

## Completitud del contenido

- [x] Sin restos de plantilla ni placeholders.
- [x] User Stories con Priority, Why, Independent Test y Acceptance Scenarios
      (US1-US3).
- [x] Edge Cases explícitos (idempotencia ante reintentos, mismo denunciante,
      mixto autenticado/anónimo, históricos sin huella, corrección humana,
      eliminación posterior, sin IA).
- [x] FR-001..FR-010 verificables; FR-001/FR-010 fijan que clasificación,
      visibilidad, scoring y dedup NO cambian (post-hook aditivo).
- [x] Success Criteria medibles (SC-001..SC-006).
- [x] Assumptions documentadas (BL-5/S-1 cerrados; trigger = post-hook del worker;
      alerta al círculo = mecanismo existente; entidad global sin tenant; consulta
      pública sin cambios).
- [x] Línea "Impacto en arquitectura" presente (schema nuevo → regenerar
      `docs/architecture` + `arch:check` verde en el mismo PR).
- [x] `## Data Model` con la entidad `EventoMatch` (migración aditiva) y
      `## Contracts` con endpoints concretos (en plan.md).
- [x] Dependencias de arranque (BL-5, S-1) reverificadas en fuente con línea
      (`visibility.ts:23-33`, `fuente-reporte.ts:7-10`, `schema.prisma:757-774`,
      `reporte-aprobado.ts:14-25`).

## Calidad

- [x] Regla de "denunciante distinto" definida en plan (usuarioId / huella S-1;
      conservadora ante ausencia de huella; §1.3 invocado explícitamente).
- [x] Predicado único D-08 como ÚNICA fuente de conteo (nunca `totalReportes`
      crudo — la lección de BL-5).
- [x] Idempotencia anclada en `reporteNuevoId @unique` (no en el orden del
      worker).
- [x] Sin secretos ni valores sensibles (I-22).
- [x] Coherente con F5 del instructivo 002-PI-056 (PROPUESTA §F5 + PLAN línea 82).

## Pendiente (compuerta)

- [x] Veredicto de ZEUS: APROBADO 2026-08-02 (BLOQUE B, 5 decisiones registradas en tasks/plan).
      match también desde la corrección humana (Edge Cases) o solo post-hook del
      worker; (2) forma del distintivo inter-ciudad en la bandeja del comité
      (sección propia vs. etiqueta); (3) endpoint admin propio
      `/api/admin/eventos-match` (propuesto) vs. extender uno existente.
