# Feature Specification: SPEC-187 — Override de modelo para smoke Ollama (002-PI-082)

**Feature Branch**: `work/002-pi-082`

**Created**: 2026-08-20

**Status**: PLANEADO

**Implementación**: pendiente aprobación de ZEUS (compuerta §4). Ver [plan.md](./plan.md) y [tasks.md](./tasks.md).

Impacto en arquitectura: cambio local en `src/lib/monitoreo/probes.ts` y nuevo parámetro `monitoreo.ollama.smoke.modelo`. Cero cambios en el motor `src/lib/ai/**`.

**Input**: 002-PI-082. Auditoría ZEUS de SPEC-186 (PR #65) CUMPLE, pero se requiere ampliar la selección de modelo en el smoke real para permitir un override operativo sin tocar la rúbrica del motor.

Objetivo: que el smoke real de Ollama pueda usar un modelo distinto al vigente del motor (`ia.rubrica.modelos[0]`), configurado mediante un parámetro opcional. Si no hay override, se conserva el comportamiento actual.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Override por parámetro (Priority: P1)

Como admin quiero poder definir un modelo específico para los smokes reales, para probar un modelo ligero o de guardia sin cambiar el modelo de clasificación de reportes.

**Why this priority**: permite desacoplar el modelo de smoke del modelo de producción; útil para reducir carga de GPU en validaciones o para probar candidatos.

**Independent Test**: con `monitoreo.ollama.smoke.modelo="llama-guard3:8b"`, el smoke real usa ese modelo y registra la fuente "override".

**Acceptance Scenarios**:

1. **Given** el parámetro `monitoreo.ollama.smoke.modelo="llama-guard3:8b"`, **When** se ejecuta `probeOllamaSmoke`, **Then** la llamada a `/api/generate` usa `model: "llama-guard3:8b"`.
2. **Given** el override, **Then** el detalle del probe indica el modelo y la fuente (p. ej. `"smoke real ejecutado, latencia X ms (modelo llama-guard3:8b, override)"`).

### User Story 2 — Fallback al modelo vigente del motor (Priority: P1)

Como admin quiero que, si no configuro override, el smoke siga usando el modelo vigente del motor, para no romper el comportamiento actual de SPEC-186.

**Why this priority**: preserva el default seguro y evita sorpresas tras el despliegue.

**Independent Test**: sin el parámetro (o con valor vacío), el smoke usa `ia.rubrica.modelos[0]` y registra la fuente "motor".

**Acceptance Scenarios**:

1. **Given** que `monitoreo.ollama.smoke.modelo` no existe o está vacío, **When** se ejecuta `probeOllamaSmoke`, **Then** se lee `ia.rubrica.modelos[0]` y se usa ese modelo.
2. **Given** el fallback, **Then** el detalle del probe indica la fuente "motor" (p. ej. `"smoke real ejecutado, latencia X ms (modelo gemma2:27b, motor)"`).

## Edge Cases

- **Parámetro con espacios**: se hace `.trim()`; si tras trim queda vacío, se considera inexistente.
- **Modelo override inválido en Ollama**: el smoke falla con el error que devuelva Ollama; el detalle sigue indicando que se usó el override.
- **Parámetro cifrado o marcado como secreto**: `getParametroSistema` ya descifra; no se requiere lógica adicional.
- **Modelo vigente del motor ausente**: si no hay override y tampoco modelo vigente, el probe falla con `"sin modelo vigente configurado"` (misma guarda actual).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE leer el parámetro `monitoreo.ollama.smoke.modelo` (STRING, opcional) antes de seleccionar el modelo para el smoke real.
- **FR-002**: Si el parámetro tiene valor no vacío tras `.trim()`, el smoke DEBE usar ese modelo y registrar fuente `"override"`.
- **FR-003**: Si el parámetro está vacío o no existe, el smoke DEBE conservar el fallback a `ia.rubrica.modelos[0]` y registrar fuente `"motor"`.
- **FR-004**: El detalle del probe DEBE incluir el modelo usado y la fuente (`override` o `motor`) en mensajes de éxito y error.
- **FR-005**: El parámetro DEBE sembrarse en `prisma/seed.ts` con valor vacío por defecto (`""`) y descripción en criollo, usando `ON CONFLICT DO UPDATE` para no pisar valores existentes.
- **FR-006**: No se DEBE modificar `src/lib/ai/**` ni la rúbrica del motor.

### Key Entities

- `ParametroSistema` (`monitoreo.ollama.smoke.modelo`): override opcional de modelo para smoke.
- `HealthProbe`: registra el smoke con detalle que incluye modelo y fuente.

## Success Criteria *(mandatory)*

- **SC-001**: Con override configurado, el smoke usa el modelo override y el detalle refleja `"override"`.
- **SC-002**: Sin override, el smoke usa `ia.rubrica.modelos[0]` y el detalle refleja `"motor"`.
- **SC-003**: Tests unitarios/integración cubren ambos caminos.
- **SC-004**: Gate local completo verde (tsc, lint --no-cache, arch:check, tests, build).

## Assumptions

- El smoke real sigue siendo el Bloque C de SPEC-186; este cambio solo altera la selección de modelo dentro de ese bloque.
- `getParametroSistema` es la vía canónica para leer parámetros; se reutiliza.
- No se requiere UI de configuración nueva; el parámetro se edita desde ConfigPanel existente (sección Monitoreo).

## Decisiones de compuerta §4 (propuestas)

1. **Nombre del parámetro**: `monitoreo.ollama.smoke.modelo` (STRING, default `""`).
2. **Formato del detalle**: `"(modelo <nombre>, <fuente>)"` en mensajes de éxito y error, manteniendo el prefijo existente (`smoke real ejecutado, latencia X ms` o `HTTP 500` / `respuesta vacía`).
3. **Resiembra**: `ON CONFLICT DO UPDATE` con valor `""`; no pisa overrides ya configurados.
