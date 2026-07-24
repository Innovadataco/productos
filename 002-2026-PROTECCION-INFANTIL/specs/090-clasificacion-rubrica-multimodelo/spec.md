# Spec 090 — Clasificación por rúbrica multi-etiqueta + multi-modelo + "Mis reportes"

**Status**: `FINALIZADO` (pendiente ACTA-VALIDACION de ZEUS → `CERRADA`; validación banco 200 en background)
**Rama**: `feature/001-scaffolding`
**Creado**: 2026-07-24
**Origen**: decisión del CEO en mesa técnica (post-ADR_006)

**Input**: el clasificador actual hace un juicio holístico (una categoría, 5 votos del MISMO modelo, gana la moda) — no auditable, y 5 votos del mismo modelo miden auto-consistencia. Motor nuevo: OBJETIVO (rúbrica de preguntas factuales), MULTI-ETIQUETA y MULTI-MODELO. Todo parametrizable (ADR_004). NO rompe la Spec 089.

## User Stories

### US1 — Motor por rúbrica multi-etiqueta + votación multi-modelo (P1)

**Como** plataforma, **quiero** clasificar aplicando sets de preguntas factuales por categoría respondidas por varios modelos diversos (1 voto c/u, secuencial), **para** tener decisiones auditables y detectar el sesgo de cada modelo.

- Rúbrica: cada categoría tiene un set de preguntas (indicadores factuales), almacenado como **parámetro del sistema** editable por expertos (sin desplegar).
- Votación: N modelos diversos (familias distintas), 1 voto c/u, temperatura baja, **secuencial** (RAM). N y cuáles = parámetros (default 3: gemma2:27b, qwen2.5:14b, aya-expanse:32b).
- % por categoría = modelos que marcaron 1 / N. **Desacuerdo** entre modelos = señal de revisión humana (mejor que el umbral de confianza).
- Persistencia aditiva de la matriz categoría × modelo × 0/1, el % por categoría y las preguntas cumplidas.
- **Reglas anti-sobre-etiquetado**: (1) preguntas estrictas, denegar por defecto (1 solo con evidencia CLARA); (2) umbral de presencia parametrizable (default 60%) — una categoría cuenta solo si supera el umbral; (3) embudo: un pase barato descarta categorías sin señal y el set completo solo corre en las plausibles.

### US2 — Conducta principal pública (P1)

Principal = la de mayor GRAVEDAD entre las que superan el umbral de presencia. La 089 queda intacta: ninguna supera umbral → REVISION_MANUAL; OTRO → revisión; `esReporteAprobado`, 2 estados de usuario y exclusión SPAM/OTRO se conservan.

### US3 — Detalle "Mis reportes" (P1, PRIVADO)

**Como** padre autenticado dueño del reporte, **quiero** ver la tabla categoría × modelo (0/1), el % por categoría y un "Análisis" por plantilla determinista, **para** entender la clasificación de MI reporte. Sin "% de riesgo" global. Nunca público ni anónimo.

### US3-bis — UI de configuración de la rúbrica (P1)

**Como** ADMIN experto, **quiero** un tab "Rúbrica" en el Centro de Control IA con CRUD de preguntas por categoría (agregar, listar, activar/desactivar, filtrar) y configuración de modelos/umbral/temperatura, **para** afinar la clasificación sin desplegar. Módulo `ia_rubrica` en el catálogo de permisos (spec 086), endpoints con guard.

### US3-ter — Documentación del pipeline actualizada (P2)

`IaDocsPanel` refleja el flujo real post-090: Embedding → Deduplicación → RAG → Rúbrica multi-etiqueta/multi-modelo (embudo → preguntas → 0/1 por modelo → % por categoría → umbral de presencia) → PII → Guardas → Decisión (principal por gravedad+umbral; ninguna/OTRO/desacuerdo → revisión humana).

### US4 — Validación con el banco de la 085 (P1)

Correr el motor nuevo contra los 200 casos y reportar aciertos de la principal, errores silenciosos, subestimaciones y ESPS, junto a las del motor anterior (mismo formato). Pregunta a responder: ¿3 modelos diversos aciertan más que 5 votos del mismo?

## Requirements

- **FR-001**: Sets de preguntas por categoría en `ParametroSistema` (`ia.rubrica.preguntas`, JSON), sembrados con un set inicial por categoría (derivado de los casos eval existentes).
- **FR-002**: Votación secuencial de N modelos diversos (`ia.rubrica.modelos`, JSON), temperatura (`ia.rubrica.temperatura`, default 0.2). Ollama por `OLLAMA_BASE_URL` (ADR_001).
- **FR-003**: % por categoría = 1s/N; umbral de presencia `ia.rubrica.umbral_presencia` (default 0.6) — solo categorías que lo superan cuentan/muestran.
- **FR-004**: Desacuerdo (ninguna categoría supera el umbral, o empate sin mayoría clara) → REVISION_MANUAL.
- **FR-005**: Embudo: pase barato (modelo rápido) selecciona categorías plausibles; la rúbrica completa solo corre en esas.
- **FR-006**: Persistencia aditiva: tabla `ClasificacionRubricaVoto` (clasificacionIAId, modelo, categoria, cumple, preguntasJson) + % en `ClasificacionIA` (o JSON relacionado).
- **FR-007**: Principal = mayor severidad (`scoring.severity.*`) entre las que superan el umbral; ninguna → REVISION_MANUAL; OTRO → revisión (089 intacta).
- **FR-008**: Detalle "Mis reportes": tabla categoría × modelo + % + análisis por plantilla determinista; solo dueño autenticado; sin "% de riesgo" global.
- **FR-009**: Tab "Rúbrica" en IA_TABS con CRUD de preguntas por categoría + config (modelos, umbral, temperatura); módulo `ia_rubrica` en catálogo de permisos; endpoints `/api/admin/ia/rubrica/*` con `requireModulo`.
- **FR-010**: `IaDocsPanel` actualizado al flujo real.
- **FR-011**: `ia.rubrica.enabled` (param, default true) permite alternar motor nuevo/legacy sin desplegar.
- **FR-012**: Migraciones aditivas; tests de cada regla (matriz 0/1, %, umbral, desacuerdo→revisión, principal por gravedad+umbral, plantilla, privacidad del detalle, 089 intacta).

## Success Criteria

- **SC-001**: Motor nuevo clasifica end-to-end en el pipeline real con persistencia de la matriz.
- **SC-002**: Tabla comparativa motor nuevo (3 diversos) vs anterior (5 mismo) sobre los 200 casos: aciertos de principal, silenciosos, subestimaciones, ESPS.
- **SC-003**: Detalle de "Mis reportes" visible solo para el dueño autenticado (403/404 para otros).
- **SC-004**: Gate completo + app en `:5005` + push con staging explícito del 002.
