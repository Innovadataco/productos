# Spec 085 — Evaluación por error silencioso y modelo por defecto

**Status**: `FINALIZADO` (pendiente ACTA-VALIDACION de ZEUS → `CERRADA`)
**Rama**: `feature/001-scaffolding`
**Creado**: 2026-07-23
**Origen**: ADR_006 (ACEPTADO por el CEO, 2026-07-23)

**Input**: La simulación de 5 modelos sobre 50 casos no permitió decidir (IC Wilson 95% solapados; etiqueta #43 errada; #45/#27 multi-etiqueta forzadas a única; 83% de los errores con confianza=1.00 = auto-consistencia, no calibración → errores silenciosos). Directriz del CEO: acertar pesa más que responder rápido.

## User Stories

### US1 — Banco saneado (P1)

**Como** equipo de producto, **quiero** un banco de evaluación con etiquetas correctas y soporte multi-etiqueta, **para** que las métricas midan a los modelos y no los errores del banco.

- **Given** el caso #43 (adulto pide videollamada privada con cámara a un menor), **When** se sanea, **Then** su etiqueta es `SOLICITUD_MATERIAL` (justificado en research.md).
- **Given** #45 y #27 (legítimamente multi-etiqueta), **When** se evalúa, **Then** `secundariaEsperada` cuenta como acierto si el modelo asigna la secundaria.
- **Given** cualquier etiqueta contradicha por 3+ modelos, **When** se audita, **Then** queda documentada la resolución (corregida o confirmada y por qué).

### US2 — Métricas por error silencioso (P1)

**Como** ADMIN, **quiero** errores silenciosos, subestimaciones y ESPS en simulación y comparación, **para** decidir por seguridad y no por accuracy bruto.

- **Given** fallos con `confianza >= umbral_revision`, **When** se calculan métricas, **Then** cuentan como `erroresSilenciosos` (métrica principal, mostrada primero).
- **Given** fallos con Δseveridad < 0, **Then** cuentan como `subestimaciones` con su severidad total perdida.
- **Given** ESPS = Σ|Δseveridad| sobre fallos NO señalados a revisión, con subestimaciones ×3, **Then** se persiste en `metricasJson` y se muestra en la comparación.
- **Given** la severidad, **When** se consulta, **Then** sale de `scoring.severity.*` (parámetros), nunca duplicada en código.
- Accuracy se muestra pero deja de ser el titular.

### US3 — Modelo por defecto gemma2:27b (P1)

**Como** plataforma, **quiero** el modelo de clasificación por defecto en `gemma2:27b` vía parámetro del sistema, **para** aplicar la directriz del CEO sin tocar código. Reversible por parámetro; documentado en cierre.md.

### US4 — Banco ≥200 casos (P2)

**Como** equipo, **quiero** un banco de ≥200 casos con adversariales/limítrofes, cobertura de todas las categorías y procedencia marcada (`fuente`, `fixtureVersion`), **para** evaluaciones con potencia estadística real, sin mezclar bancos en una comparación.

## Requirements

- **FR-001**: Corrección de #43 a `SOLICITUD_MATERIAL` con justificación documentada.
- **FR-002**: `secundariaEsperada` (opcional) en casos del banco; acierto si categoría asignada = esperada O secundaria.
- **FR-003**: Auditoría de etiquetas contradichas por 3+ modelos con resolución documentada.
- **FR-004**: Métricas nuevas persistidas: `erroresSilenciosos` (conteo + casos), `subestimaciones` (conteo + `severidadPerdida`), `esps`, matriz por categoría (ya existe).
- **FR-005**: Severidad desde `scoring.severity.*` vía el cargador de parámetros existente (sin mapa nuevo en código); sembrar los parámetros.
- **FR-006**: `reportes.classification_model = gemma2:27b` vía parámetro (seed default + update en vivo), sin tocar código; reversión documentada.
- **FR-007**: Banco ≥200 con `fuente` por caso y `fixtureVersion` del banco; la comparación no mezcla versiones.
- **FR-008**: Migraciones aditivas; tests para ESPS, errores silenciosos y multi-etiqueta.
- **FR-009**: NO incluir compuerta por severidad ni contraste entre modelos distintos (ADR §3.2/§3.3 — spec aparte).

## Success Criteria

- **SC-001**: Tabla comparativa de los 5 modelos con métricas nuevas sobre el banco saneado (recalculada desde las clasificaciones existentes, sin re-correr modelos).
- **SC-002**: Tests verdes: ESPS, silenciosos, multi-etiqueta como acierto.
- **SC-003**: Si el ranking por errores silenciosos cambia y gemma2:27b deja de ser el mejor, se REPORTA sin cambiar el default (decisión de ZEUS+CEO).
- **SC-004**: Gate completo + app en `:5005` + push con staging explícito solo del 002.

## Pregunta abierta (ZEUS) — reporte previo

Casos clasificados "en producción" bajo la etiqueta vieja de #43: **verificado 2026-07-23 — no hay reportes reales** (dataset vacío, 0 reportes no-SIM en dev). Solo artefactos de simulación. Detalle en research.md.
