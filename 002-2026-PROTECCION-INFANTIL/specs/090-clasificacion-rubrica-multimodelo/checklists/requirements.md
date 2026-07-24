# Checklist de requisitos — Spec 090

**Spec**: `specs/090-clasificacion-rubrica-multimodelo/spec.md` · **Verificado**: 2026-07-24

## US1 — Motor

- [x] Sets de preguntas como parámetro (`ia.rubrica.preguntas`, semilla por categoría).
- [x] N modelos diversos secuencial, 1 voto c/u, temperatura baja — todo por parámetro.
- [x] % por categoría = 1s/N (test).
- [x] Desacuerdo → REVISION_MANUAL (test).
- [x] Matriz persistida (`clasificacion_rubrica_votos` + preguntas cumplidas).
- [x] Anti-sobre-etiquetado: preguntas estrictas, umbral parametrizable (test sube/baja), embudo (test).

## US2 — Principal

- [x] Mayor gravedad entre presentes (test); ninguna/OTRO → revisión (test).
- [x] 089 intacta: esReporteAprobado, 2 estados, exclusión SPAM/OTRO, OTRO→revisión, sin nivelRiesgo (suite de regresión).

## US3 — Mis reportes

- [x] Tabla categoría×modelo + % (tests).
- [x] Análisis por plantilla determinista (test).
- [x] Sin "% de riesgo" global (test: la palabra "riesgo" ausente).
- [x] PRIVADO: 403 no dueño, 401 sin sesión (tests).

## US3-bis / US3-ter

- [x] Tab Rúbrica con CRUD + config; módulo `ia_rubrica` en catálogo; guards + AuditLog (tests).
- [x] IaDocsPanel actualizado (deduplicación + rúbrica; sin "moda").

## US4 — Validación

- [x] Script de evaluación + sanity en vivo (6/6).
- [ ] Corrida completa banco 200 — EN BACKGROUND al momento del cierre (artefacto `resultados-rubrica-090.json`).

## No negociable

- [x] 089 intacta · todo parametrizable · migraciones aditivas · detalle privado · modelos secuenciales · staging explícito 002.
- [ ] ACTA-VALIDACION de ZEUS — PENDIENTE.
