# Tasks — Spec 089: Presentación al usuario

- [x] T001 US1: "Verificado"→"Procesado" en mapeo visible + tests (23/23).
- [x] T002 US2a: OTRO → siempre REVISION_MANUAL (incl. cascada) + test.
- [x] T002 US2b: ranking por severidad (parámetros) → votos → confianza + tests (3/3).
- [x] T003 US3: `esReporteAprobado`/`whereReporteAprobado` en consulta, scoring, estadísticas públicas + tests unitarios e integración (spam no cuenta, solo-spam → sin reportes).
- [x] T004 US4: categorías multi (principal + secundarias) por gravedad en consulta y seguimiento; SPAM/OTRO → "No se identifica riesgo".
- [x] T005 US5: fix "(undefined)" (total), cuadre total=auth+anon, rollup país anónimo / depto-ciudad autenticado, señal actividad (param `visibility.actividad_alta_min`), detalle siempre, divulgación progresiva.
- [x] T006 US6: nivelRiesgo/score eliminados de `/api/consulta`, `/api/estadisticas-publicas` y seguimiento (route + 3 clientes).
- [x] T007 US7: "Gracias por reportar." + sin ocultamiento en seguimiento; gate de detalle solo en consulta de terceros.
- [x] T008 US8: AdminNav un solo activo (match exacto de raíz) + ComiteSubNav altura estable.
- [x] T009 Gate + dev-restart + docs + commit/push (staging explícito 002).
