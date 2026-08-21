# Research: SPEC-195 — Motor SPAM + Aprendizaje operativo

## Fuentes consultadas

- `Gestion-de-proyectos/01-PROYECTOS/001-2026-PROTECCION_INFANTIL/03-EJECUCION/02-RADICACIONES/INSTRUCTIVO-002-PI-089-MOTOR-SPAM-Y-APRENDIZAJE.md`
- `Gestion-de-proyectos/01-PROYECTOS/001-2026-PROTECCION_INFANTIL/05-ENTREGABLES/BRIEF-MOTOR-SPAM-Y-APRENDIZAJE.md` v1.1
- `Gestion-de-proyectos/01-PROYECTOS/001-2026-PROTECCION-INFANTIL/03-EJECUCION/01-ACTAS/ACTA_ARQ_08_2026_MESA-ESTRATEGICA-GOBIERNO-FLUJO-SPAM.md`
- `Gestion-de-proyectos/01-PROYECTOS/001-2026-PROTECCION-INFANTIL/05-ENTREGABLES/MODELO-DE-CLASIFICACION.md`
- `productos/002-2026-PROTECCION-INFANTIL/AGENTS.md`
- `productos/002-2026-PROTECCION-INFANTIL/.specify/memory/constitution.md`

## Hallazgos de código relevados

- `src/lib/ai/rubrica-semilla.ts`: no tiene bloque SPAM; las 10 categorías actuales son conductas de riesgo.
- `src/lib/ai/guardas-decision.ts:56`: la guarda `if categoria===SPAM && confianza>=umbralSpam` ya existe; solo falta que el motor produzca SPAM.
- `src/lib/dal/services/reporte-processing/index.ts`: pipeline actual recupera `ejemplosRag` y los pasa a `clasificarReporte`, pero `clasificarReporte` no los inyecta al prompt (RAG retirado consciente).
- `src/lib/dal/repositories/embedding.ts`: ya tiene queries de similitud; se reutilizarán para caché y patrón coordinado.
- `src/app/api/admin/spam/[id]/resolver/route.ts`: endpoint legado con 2 decisiones (`esSpam` boolean); se reemplaza por `resolver-spam` con 3 decisiones.
- `src/components/modules/SpamRevisionPanel.tsx`: actualmente es una cola de revisión; se rediseña como panel de análisis.
- `src/components/modules/ia/IaDocsPanel.tsx`: catálogo de categorías sin SPAM; descripción de RAG dice "se inyectan en el prompt" (requiere ajuste).
- `prisma/seed.ts`: sección `monitoreoNuevos` existe; no hay parámetros de caché/patrón/spam.
- `prisma/schema.prisma`: `PatronInstitucional` no tiene campo `tipo`; la relación con `Colegio` y `Plataforma` es obligatoria. **Corrección ZEUS**: usar `IncidenteInfra` para patrón coordinado.
- `src/lib/monitoreo/incidentes.ts`: servicio existente para crear/notify/resolver `IncidenteInfra` con throttle por señal.
- `src/lib/scoring.ts`: SPAM ya tiene severidad 0 por default; el parámetro `scoring.severity.spam` se siembra pero con valor implícito 0 (se debe agregar explícitamente).

## Decisiones tomadas en la investigación

- RAG activo retirado: se mantiene cálculo de `ejemplosRag` para trace pero no se pasa al LLM.
- Caché humano exacto: umbral 0.98, solo `CORREGIDO` confirmado por default.
- Anti-abuso precede al caché: ráfaga/duplicado no usan caché.
- Patrón coordinado: 5 identificadores distintos, 60 min, similitud 0.90; registro en `IncidenteInfra` con señal `patron_coordinado:<hash-texto>`.
- `MODELO-DE-CLASIFICACION.md` ya actualizado por ZEUS (3718a23 v1.5); esta SPEC solo ajusta catálogo §8 y diagramas §3/§6.

## Dudas resueltas por ZEUS

1. ¿Cómo registrar el patrón coordinado? → Usar `IncidenteInfra` con señal fija y detalle JSON; cierre automático tras 60 min sin matches.
2. ¿El update de `MODELO-DE-CLASIFICACION.md`? → ZEUS ya lo actualizó; ajustar solo catálogo y diagramas.
3. ¿Push de la rama? → Sí, `git push -u origin work/002-pi-089` para que ZEUS revise spec+plan.
