# Feature Specification: SPEC-111 — D-28: el motor de rúbrica pasa a ser el predeterminado

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-07-28

**Status**: FINALIZADO (SIN desplegar, pendiente release + ACTA)

**Input**: "Ejecutar la D-28: ia.rubrica.enabled pasa a true de verdad (seed + parámetro en
producción), con test que prueba el EFECTO (rúbrica con true, legacy con false),
procedimiento de reversión en caliente, y medición de capacidad obligatoria: (a) legacy
punta a punta, (b) rúbrica punta a punta, (c) reportes/hora del worker con rúbrica."

## Contexto (medido, no opinado — ACTA_VALIDACION_08)

Sobre el banco curado, misma corrida, ambos motores: legacy 74,5% acc · ESPS 1240 · **9
silenciosos GRAVES**; rúbrica 70,5% acc · ESPS 595 · **0 silenciosos graves**. La medición
ya es reproducible: dos corridas idénticas byte a byte y 20/20 tras reiniciar Ollama.

**Capacidad medida (2026-07-28, pipeline real, no estimada):**
- (a) LEGACY punta a punta: **37.7 s** por reporte.
- (b) RÚBRICA punta a punta: **52.0 s** por reporte (bajo el tope de 3 min).
- (c) Throughput con rúbrica: **~69 reportes/hora** (1 worker) · **~138/hora** a
  concurrencia=2 (parámetro `worker.concurrencia` actual).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - La rúbrica es el motor predeterminado de verdad (Priority: P1)

Como responsable del producto, quiero que `ia.rubrica.enabled` quede en `true` en el seed y
en la base de producción ya operada, de modo que todo reporte nuevo se clasifique por el
motor que no esconde casos graves (0 silenciosos graves medidos).

**Why this priority**: la I-27 nació de una recomendación registrada y no aplicada; esta
vez el cambio queda APLICADO, no "recomendado".

**Independent Test**: con el parámetro en `true`, un reporte procesado termina clasificado
POR RÚBRICA (votos en `ClasificacionRubricaVoto`); con el parámetro en `false`, por legacy
(sin votos de rúbrica). El test verifica el efecto, no la existencia del parámetro.

**Acceptance Scenarios**:

1. **Given** `ia.rubrica.enabled=true`, **When** se procesa un reporte, **Then** la
   clasificación proviene de la rúbrica (existen filas de `ClasificacionRubricaVoto` para
   ese reporte y el pipeline las registra).
2. **Given** `ia.rubrica.enabled=false`, **When** se procesa un reporte, **Then** la
   clasificación proviene del legacy (no se crean votos de rúbrica).
3. **Given** el seed en una base nueva, **When** corre, **Then** `ia.rubrica.enabled` queda
   en `true`.

---

### User Story 2 - El parámetro queda en true también en producción (Priority: P1)

Como operador, quiero un procedimiento (o migración) que fije `ia.rubrica.enabled=true` en
la base de producción YA operada, porque el seed es upsert no destructivo y no basta.

**Why this priority**: sin este paso, el cambio solo existiría en bases nuevas (el error
de la I-27 otra vez).

**Independent Test**: el procedimiento/script aplicado en una BD existente deja el
parámetro en `true` y es idempotente.

**Acceptance Scenarios**:

1. **Given** una BD operada con `enabled=false`, **When** se aplica el procedimiento,
   **Then** el parámetro queda en `true` y una segunda aplicación es no-op.
2. **Given** el despliegue del lote, **When** el CEO autorice, **Then** el procedimiento
   está documentado paso a paso para ejecutarse sin improvisación.

---

### User Story 3 - Reversión en caliente documentada (Priority: P2)

Como operador, quiero un procedimiento en `docs/runbook.md` para volver a legacy en
caliente (un parámetro, sin desplegar) si algo sale mal en producción.

**Why this priority**: encender un motor nuevo en prod exige una salida rápida y segura.

**Independent Test**: el procedimiento indica el parámetro exacto a cambiar, el efecto
inmediato esperado y cómo verificar que la reversión surtió efecto.

**Acceptance Scenarios**:

1. **Given** la rúbrica activa en prod, **When** el operador aplica la reversión, **Then**
   los reportes siguientes se clasifican por legacy sin reiniciar ni desplegar.

---

### Edge Cases

- La BD ya tiene `enabled=true` (idempotencia del procedimiento: no-op).
- Ollama caído con la rúbrica activa: el pipeline degrada a revisión manual (comportamiento
  ya existente, no cambia).
- El texto de las preguntas, la terna y el umbral 60% quedan INTACTOS (restricción dura).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El seed debe crear/actualizar `ia.rubrica.enabled` con valor `true` en bases
  nuevas.
- **FR-002**: Debe existir un procedimiento (script o migración documentada) que fije
  `ia.rubrica.enabled=true` en una BD ya operada, idempotente, con evidencia de ejecución.
- **FR-003**: Debe existir un test que pruebe el EFECTO: con `enabled=true` el reporte se
  clasifica por rúbrica (votos persistidos) y con `enabled=false` por legacy.
- **FR-004**: `docs/runbook.md` debe incluir la reversión en caliente a legacy (un
  parámetro, sin desplegar) con verificación incluida.
- **FR-005**: NO se tocan los textos de las preguntas, la terna de modelos, ni el umbral
  60%. NO se despliega (lo autoriza el CEO por lote).

### Key Entities

- **`ia.rubrica.enabled`** (parámetro booleano): el interruptor del motor (default LEGACY
  hasta esta spec).
- **`ClasificacionRubricaVoto`**: evidencia persistida de que un reporte fue clasificado
  por rúbrica.

## Success Criteria *(mandatory)*

- **SC-001**: seed en base nueva deja `enabled=true` (verificado).
- **SC-002**: procedimiento aplicado en BD operada deja `enabled=true`, idempotente.
- **SC-003**: el test de efecto pasa en ambos sentidos (true→rúbrica, false→legacy).
- **SC-004**: la reversión está documentada en el runbook con su verificación.
- **SC-005**: capacidad medida reportada: (a) 37.7 s, (b) 52.0 s, (c) ~69/h (~138/h a
  concurrencia 2) — y (b) < 3 min, verificado antes de aprobar.
- **SC-006**: gate verde (lint + test + tsc + build); diff sin tocar textos/terna/umbral.

## Assumptions

- La rúbrica ya está validada (medición reproducible, 0 silenciosos graves): esta spec solo
  la enciende y mide lo que cuesta.
- El despliegue a producción NO es parte de esta spec (lo autoriza el CEO por lote); el
  procedimiento de FR-002 queda listo para ejecutarse en ese momento.
- El throughput medido es de referencia (un caso representativo, máquina actual, modelos en
  frío tras reinicio): se reporta como medición puntual, no como SLA.
