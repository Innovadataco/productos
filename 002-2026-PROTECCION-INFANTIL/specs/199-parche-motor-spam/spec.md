# Feature Specification: SPEC-199 — Parche motor SPAM (002-PI-093)

**Feature Branch**: `work/002-pi-093`

**Created**: 2026-08-22

**Status**: `PLANEADO`

**Input**: 002-PI-093. Tras aplicar rúbrica SPAM en prod (I-100 mitigada con UPDATE manual de `ia.rubrica.preguntas`), el reporte de prueba `RPT-B1EGFY` (texto textbook publicitario) clasificó `OFRECIMIENTO_REGALOS` conf 1.0 aunque SPAM votó 2/3 (67%). Causa: OFRECIMIENTO_REGALOS pregunta 2 es demasiado laxa; además SPAM severidad 0 siempre pierde en el desempate. Este parche aplica 2 fixes complementarios (A + C).

Objetivo: endurecer la distinción publicidad/acoso, forzar POSIBLE_SPAM cuando SPAM domina sin categoría grave, y persistir el cambio estructural de la rúbrica en el seed.

Impacto en arquitectura: cambios en `src/lib/ai/rubrica-semilla.ts` (nuevo bloque SPAM + ajuste pregunta OFRECIMIENTO_REGALOS), `src/lib/ai/guardas-decision.ts` (nueva guarda `spam_dominancia`), `src/lib/dal/services/reporte-processing/guardas.ts` (pasar categorías secundarias), `src/lib/ai/sandbox.ts` y sus tests; 2 parámetros nuevos en `prisma/seed.ts`. Cero migraciones destructivas.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Rúbrica SPAM completa y endurecimiento de OFRECIMIENTO_REGALOS (Priority: P1)

Como arquitecto quiero que el código fuente de la rúbrica incluya el bloque SPAM y que OFRECIMIENTO_REGALOS no capture publicidad masiva.

**Why this priority**: cierra el hueco dejado por SPEC-195 y evita que publicidad genérica se clasifique como acoso.

**Independent Test**: `RUBRICA_SEMILLA` tiene 11 categorías incluyendo SPAM; la pregunta 2 de OFRECIMIENTO_REGALOS usa el texto endurecido.

**Acceptance Scenarios**:

1. **Given** `src/lib/ai/rubrica-semilla.ts`, **When** se inspecciona `RUBRICA_SEMILLA`, **Then** existe la clave `SPAM` con 5 preguntas (2 decisivas + 3 contexto).
2. **Given** el bloque `OFRECIMIENTO_REGALOS`, **When** se lee la pregunta 2, **Then** pide individuo específico y descarta campaña masiva/mensaje genérico.
3. **Given** un texto tipo "FELICITACIONES!! Has ganado...", **When** el motor rúbrica vota, **Then** OFRECIMIENTO_REGALOS no cumple pregunta 2 y SPAM queda como categoría principal.

### User Story 2 — Seed forzado de parámetro estructural (Priority: P1)

Como operador de deploy quiero que el seed aplique el nuevo valor de `ia.rubrica.preguntas` aunque el parámetro ya exista, para que producción reciba el bloque SPAM sin UPDATE manual.

**Why this priority**: evita recurrencia de I-100 cuando cambia la estructura de la rúbrica.

**Independent Test**: ejecutar `npx prisma db seed` dos veces → `ia.rubrica.preguntas` contiene 11 categorías ambas veces.

**Acceptance Scenarios**:

1. **Given** un entorno donde `ia.rubrica.preguntas` ya existe con 10 categorías, **When** corre el seed, **Then** se actualiza a las 11 categorías (incluye SPAM).
2. **Given** un CEO que editó preguntas individuales vía UI, **When** corre el seed, **Then** esas ediciones se sobrescriben (excepción documentada: este parámetro es estructural del motor).
3. **Given** otros parámetros como `ia.rubrica.modelos`, **When** corre el seed, **Then** conservan idempotencia con `update: {}`.

### User Story 3 — Guarda de dominancia SPAM (Priority: P1)

Como sistema quiero forzar `POSIBLE_SPAM` cuando SPAM vota fuerte y ninguna categoría grave cumple, para reducir falsos positivos de rúbricas laxas.

**Why this priority**: protege la bandeja de operadores de publicidad clasificada erróneamente como acoso.

**Independent Test**: clasificación ganadora `OFRECIMIENTO_REGALOS` con SPAM secundario score ≥ 0.66 y sin categoría grave → estado final `POSIBLE_SPAM`.

**Acceptance Scenarios**:

1. **Given** un reporte con texto publicitario puro, **When** el motor devuelve `OFRECIMIENTO_REGALOS` como categoría ganadora pero `SPAM` score 0.67, **Then** `decidirGuardasSeguridad` fuerza `POSIBLE_SPAM` con regla `spam_dominancia`.
2. **Given** un reporte de extorsión ("dame $X o publico fotos"), **When** `EXTORSION` cumple con severidad 85, **Then** SPAM no domina y el estado conserva la categoría grave.
3. **Given** `SPAM` score 0.5, **When** se evalúa la guarda, **Then** no fuerza dominancia.

---

## Functional Requirements

FR-001: `RUBRICA_SEMILLA` DEBE incluir la categoría `SPAM` con 5 preguntas según el brief.

FR-002: La pregunta 2 de `OFRECIMIENTO_REGALOS` DEBE exigir individuo específico y descartar campaña masiva/mensaje genérico.

FR-003: El seed de `ia.rubrica.preguntas` DEBE usar `update: { valor: ... }` forzado cuando cambia la estructura (nueva categoría o pregunta decisiva modificada), con comentario justificativo.

FR-004: El seed DEBE añadir los parámetros `spam.dominancia_umbral` (FLOAT, 0.66) y `spam.dominancia_categoria_grave_severidad_min` (INTEGER, 75).

FR-005: `decidirGuardasSeguridad` DEBE recibir las categorías secundarias con sus scores.

FR-006: Si alguna categoría secundaria es `SPAM` con score ≥ `spam.dominancia_umbral` y ninguna categoría presente tiene severidad ≥ `spam.dominancia_categoria_grave_severidad_min`, el estado final DEBE ser `POSIBLE_SPAM` y `reglasAplicadas` DEBE incluir `spam_dominancia`.

FR-007: La guarda de dominancia SPAM DEBE ejecutarse después del guarda de spam por confianza y antes del guarda de doxing.

FR-008: `aplicarGuardasSeguridad` y el sandbox DEBEN pasar las categorías secundarias a `decidirGuardasSeguridad`.

FR-009: Los tests existentes de guardas DEBEN seguir pasando; se añadirán tests para dominancia SPAM.

---

## Success Criteria

- `rubrica-semilla.ts` tiene 11 categorías con SPAM y pregunta 2 de OFRECIMIENTO_REGALOS modificada.
- `guardas-decision.ts` contiene la rama `spam_dominancia`.
- Seed aplica `ia.rubrica.preguntas` forzado y los 2 parámetros nuevos.
- Test de aceptación: texto publicitario → `POSIBLE_SPAM`; texto de extorsión → conserva acoso grave.
- CI verde 6/6.

---

## Assumptions

- El CEO ya aplicó curita manual en prod (`UPDATE ia.rubrica.preguntas` + `scoring.severity.spam=0`); este parche hace el fix estructural y persistente.
- Escala de severidades real: 0-95 (verificada en BD). Umbral 75 deja pasar SPAM frente a OFRECIMIENTO_REGALOS (60), CONTACTO_INSISTENTE (30) y SUPLANTACION_IDENTIDAD (70), pero nunca frente a acoso grave ≥ 75.
- No se modifica el motor de votos ni la lógica de puntuación de la rúbrica; solo se ajustan preguntas y se añade guarda de seguridad.

---

## Implementación

Ver `plan.md` y `tasks.md`. Se completará tras aprobación de ZEUS.
