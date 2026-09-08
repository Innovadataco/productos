# Tasks — SPEC-596 · Rediseño del resultado vacío de la consulta pública

## Fase 1 — Componente protagonista
- [x] T001 · Rewrite de `ConsultaVaciaBloque`: tarjeta «Señales de alerta y
      qué puedes hacer» expandida (sección `aria-labelledby`, tokens
      ambar/papel/tinta/pino, sin color crudo); salen CTA «Reportar una
      conducta», `<CanalesOficiales />`, modal y enlace previo — props sin
      `identificador` — `src/components/modules/ConsultaVaciaBloque.tsx`
- [x] T002 · Degradación limpia conservada: sección ausente = no renderizada;
      disclaimer sobre la tarjeta — mismo archivo

## Fase 2 — Montajes
- [x] T010 · `ConsultaEnriquecidaClient` deja de pasar `identificador` al
      bloque — `src/components/modules/ConsultaEnriquecidaClient.tsx`
- [x] T011 · `LandingHero` deja de pasar `identificador` al bloque —
      `src/components/modules/LandingHero.tsx`

## Fase 3 — Tests
- [x] T020 · Rewrite del test al nuevo contrato: tarjeta protagonista visible
      sin click (region accesible, ambas secciones, todos los ítems); CTA y
      canales oficiales ausentes; degradación limpia; sección única —
      `src/components/modules/ConsultaVaciaBloque.test.tsx`
- [x] T021 · Verificar verde los tests de los montajes (`LandingHero`,
      `ConsultaEnriquecidaClient`) y los candados `portada-sin-alarma`
      (SPEC-456) y `canales-oficiales-neutro` (SPEC-477) SIN modificarlos
- [x] T022 · Verificar en fuente que `/reportar` sigue montando
      `CanalesOficiales` (restricción de constitución en flujos de reporte)

## Fase 4 — Artefactos y gate
- [x] T030 · Artefactos Spec-Kit: `spec.md`, `plan.md`, `tasks.md` —
      `specs/596-consulta-vacia/`
- [x] T031 · Índice regenerado — `specs/README.md`
      (`npx tsx scripts/specs/generar-readme.ts`)
- [x] T032 · Gate: `npx tsc --noEmit` + `npm run lint` + `npm run test` +
      `npm run build` (con `rm -rf .next` previo)
