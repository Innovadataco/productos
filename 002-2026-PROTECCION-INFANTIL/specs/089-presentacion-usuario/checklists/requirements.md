# Checklist de requisitos — Spec 089

**Spec**: `specs/089-presentacion-usuario/spec.md` · **Verificado**: 2026-07-23

- [x] US1: usuario ve solo "En proceso" / "Procesado" (test).
- [x] US2a: OTRO → siempre REVISION_MANUAL, sin importar confianza (test).
- [x] US2b: líder por mayor gravedad, severidad desde `scoring.severity.*` (test 3v2).
- [x] US3: `esReporteAprobado` única fuente de conteo; spam/otro no cuentan (tests unit + integración).
- [x] US4: conductas visibles con nombre; SPAM/OTRO → "No se identifica riesgo"; multi-conducta por gravedad (tests).
- [x] US5: fix "(undefined)", cuadre total, rollup país (anónimo) / depto-ciudad (autenticado), señal parametrizable, detalle siempre, divulgación progresiva (tests).
- [x] US6: cero `nivelRiesgo`/score en consulta, dashboard y seguimiento (tests).
- [x] US7: "Gracias por reportar."; sin ocultamiento propio; gate solo terceros.
- [x] US8: AdminNav un solo activo (test); ComiteSubNav estable.
- [x] No negociable: sin migraciones destructivas; parámetros (severidad, umbral actividad); predicado único; nada expone score/etiqueta.
- [x] Staging explícito solo del 002.
- [ ] Validación funcional del CEO — PENDIENTE.
- [ ] ACTA-VALIDACION de ZEUS — PENDIENTE.
