# Checklist de requisitos: SPEC-157 — Sistema de diseño de Protección Infantil

**Spec**: [../spec.md](../spec.md) · **Fecha**: 2026-08-03

## Completitud del contenido

- [x] User Stories con Priority, Why, Independent Test y Acceptance Scenarios (US1–US3)
- [x] Edge Cases (alpha sobre tokens, theme-colegio, fuentes faltantes, themeColor,
      pantallas no migradas)
- [x] Functional Requirements "FR-XXX: El sistema DEBE…" (FR-001…FR-010)
- [x] Key Entities (token, primitivo)
- [x] Success Criteria medibles (SC-001…SC-006)
- [x] Assumptions explícitas
- [x] Línea "Impacto en arquitectura" presente (ninguno estructural)

## Alineación con fuentes vinculantes

- [x] Brief v3.0 §4 enlazado sin copiar: §4.0 principios, §4.1 Instrument, §4.2
      paleta con nombre, §4.3 anillos, §4.5 barrido, §4.6 vidrio
- [x] Candados del radicado: prohibido Inter (FR-003) · solo tokens en código nuevo
      (FR-007) · mismo HTML dos temas (FR-008) · una curva + reduced-motion (FR-006) ·
      no tocar motor IA (FR-009) · I-29 (FR-009) · cero tests debilitados (FR-010)
- [x] Alcance exacto del radicado: A tokens · B tipografía · C primitivos ·
      D NO migrar las 114 pantallas viejas
- [x] Cifras verificadas en fuente (109/457/375/165; ~1.119 crudos en ~104 archivos;
      9 usos primary/accent; 1 ref --font-inter)
- [x] Lo no fijado va como decisión a ZEUS (D1–D3), no inventado

## Calidad

- [x] Cada FR es testeable y tiene verificación asociada (quickstart)
- [x] Sin contradicciones internas (D2 deja el ratchet como opción explícita)
- [x] Cero secretos o valores sensibles (I-22)

## Compuerta §4 — RESUELTA (ZEUS, 2026-08-03: REVISO `e6c10fab` → CUMPLE)

- [x] D1 = DM Mono también vendorizada local (builds deterministas, un mecanismo)
- [x] D2 = ratchet `tokens:check` en el gate de CI, solo `src/**` productivo, piso
      sembrado con la medición de ODIN (comando exacto declarado en `cierre.md`)
- [x] D3 = woff2 directo de `fonts.gstatic.com`, latin + latin-ext, OFL.txt
- [x] Candado extra: SC-001 se audita con `git diff --stat` (ninguna pantalla tocada
      salvo `layout.tsx`)
- [x] Sigue: `/speckit.tasks` → `/speckit.analyze` → `/speckit.implement`
