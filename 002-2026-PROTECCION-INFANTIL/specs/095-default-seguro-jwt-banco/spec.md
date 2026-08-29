# Spec 095 — Default seguro, JWT parametrizado y banco gobernado

**Status**: `FINALIZADO` (pendiente ACTA-VALIDACION de ZEUS → `CERRADA`)
**Rama**: `feature/001-scaffolding`
**Creado**: 2026-07-24
**Origen**: ACTA_ARQ_01 §8 · decisiones D-19, D-20, D-21 (auditoría de la cola nocturna)

**Input**: los 42 "errores silenciosos" del motor rúbrica son las 42 etiquetas del banco en disputa (3/3 modelos contra la etiqueta). Sobre las 158 no discutidas acierta 88% y solo falla hacia el lado seguro. El bloqueo real es el BANCO, no el motor.

## User Stories

### US1 — Default seguro (D-19, P1)

`ia.rubrica.enabled=false` en el seed: el motor por defecto es el legacy (1 modelo × 5 votos). La rúbrica NO se borra ni se desconfigura: sigue en desarrollo, solo sale del camino por defecto. El loader por defecto (sin parámetro) también cae a legacy. Test: con seed limpio, el pipeline enruta al motor legacy.

### US2 — JWT parametrizado (D-21, P1)

`src/lib/auth.ts` lee `security.jwt_ttl_hours` del parámetro (fallback seguro 24h). Barrido de los 4 parámetros muertos de D-094-1: `security.password_min_length`, `system.maintenance_mode`, `reportes.worker.max_retries`, `reportes.worker.stalled_threshold_minutes` — cada uno se CABLEA o se RETIRA del seed (documentado cuál fue cuál).

### US3 — Banco gobernado y arnés de curaduría (D-20, P1)

- **(a)** Unificar los dos bancos en UNA fuente gobernada: el banco de 200 (`fixtureVersion=2`) manda y se siembra en `CasoEval`; el de 110 (`fixtureVersion=1`) queda subordinado (no se borra). Export reproducible del banco desde CasoEval.
- **(b)** Hoja de adjudicación de los 42 casos en disputa (de `specs/092-motor-logica-corregida/cierre.md`): texto, etiqueta actual, voto de cada modelo, y columnas vacías "etiqueta adjudicada" + "razón" (para ZEUS+CEO+experto; NO decidir etiquetas aquí).
- **(c)** Runner dual: corre AMBOS motores (legacy y rúbrica) sobre el MISMO banco, listo para re-medir con las etiquetas adjudicadas.

## Requirements

- **FR-001**: Seed y loader por defecto enrutan a legacy (`ia.rubrica.enabled=false`); la rúbrica y su config se conservan.
- **FR-002**: TTL del JWT desde `security.jwt_ttl_hours` con fallback 24h (test).
- **FR-003**: Los 4 parámetros muertos resueltos (cableados o retirados), documentado.
- **FR-004**: `CasoEval` contiene los 200 casos del banco gobernado con `fixtureVersion=2` y fuente preservada; export reproducible a JSON.
- **FR-005**: Hoja de adjudicación con votos por modelo por caso disputado, columnas vacías para adjudicación.
- **FR-006**: Runner dual funcional (verificado en submuestra) que reporta ambos motores por caso.
- **FR-007**: No decidir etiquetas; migraciones aditivas; no rompe 089-094.

## Success Criteria

- **SC-001**: Test: seed limpio → pipeline usa `clasificarConVotos` (legacy), no la rúbrica.
- **SC-002**: Test: TTL del JWT cambia al cambiar `security.jwt_ttl_hours`.
- **SC-003**: `CasoEval` con 200 casos v2; hoja de adjudicación generada con votos reales por modelo.
- **SC-004**: Runner dual produce comparación por caso en submuestra; gate completo + healthcheck.
