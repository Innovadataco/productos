# Feature Specification: SPEC-170 — Limpieza del Centro de Control IA

**Feature Branch**: `work/002-pi-068`

**Created**: 2026-08-16

**Status**: PLANEADO

Impacto en arquitectura: modifica la configuración de Vitest/CI (Fase 1), retira modelos `EvalRun`/`EvalResultado`/`CasoEval` + enums (Fase 2) y simplifica `src/lib/ai/motor.ts` eliminando el switch legacy/rúbrica (Fase 3).

**Input**: Instructivo 002-PI-068. Contexto: el Centro de Control IA (`/dashboard/admin/ia`) acumula tres deudas técnicas que ralentizan el desarrollo y mantienen código no usado en producción: (1) el job `test` de CI tarda ~26m28s con `singleFork`; (2) el sistema de "Experimentos" (tabs Laboratorio/Historial/Casos) es código muerto — el ciclo real de afinamiento pasa por Simulación; (3) el motor "legacy" de votación quedó atrás tras la decisión D-28 de usar rúbrica multi-modelo. Esta spec unifica la limpieza en tres fases secuenciales, en un solo PR, con un commit por fase para auditoría separada.

## Alcance y fases

| Fase | Objetivo | Entregable principal |
|------|----------|----------------------|
| 1 | Acelerar CI | Split del job `test` en `test-unit` (paralelizable, sin BD) + `test-integration` (`singleFork`, con BD). |
| 2 | Retirar Experimentos | Exportar el banco curado a `fixtures/banco-curado-v2.jsonl`, eliminar endpoints/UI/DAL/modelos de Experimentos, renombrar tab `Eval` → `Simulación`. |
| 3 | Retirar motor Legacy | Eliminar `src/lib/ai/classifier.ts`, simplificar `motor.ts`, limpiar `sandbox.ts` y Playground; solo rúbrica en producción. |

## Aclaraciones técnicas

- **Unit tests** (Fase 1): tests que NO importan `@/lib/prisma` ni el setup con mutex `TestMutex`. Pueden correr en paralelo sin BD.
- **Integration tests** (Fase 1): tests que sí importan Prisma/setup con mutex. Siguen con `singleFork:true` y base de datos compartida.
- **Banco curado** (Fase 2): memoria de casos aprobados por D-20/D-24 (42 disputas humanas adjudicadas + 3 reglas de taxonomía del CEO). Se versiona como fixture antes de borrar las tablas de Experimentos.
- **Motor legacy** (Fase 3): clasificador por votos (`clasificarConVotos` en `classifier.ts`) y todo el switch rúbrica/legacy. Producción ya usa rúbrica (`ia.rubrica.enabled=true`).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El CI del PR completa en menos wall-clock (Priority: P1)

Como desarrollador quiero que el gate `test` no sea el cuello de botella de 26 minutos, para iterar más rápido sin bajar cobertura ni seguridad.

**Why this priority**: el job `test` es el único que supera los 20 min; los demás jobs tardan 1-2 min. Dividirlo reduce wall-clock del PR a ~18 min manteniendo la misma cobertura.

**Independent Test**: en un PR de esta spec, los jobs `test-unit` y `test-integration` corren en paralelo, ambos verdes, y el job `gate` los requiere.

**Acceptance Scenarios**:

1. **Given** un push a `work/002-pi-068`, **When** corre el CI, **Then** existen los jobs `test-unit` y `test-integration` (sin el job `test` único anterior).
2. **Given** el job `test-unit`, **When** se ejecuta, **Then** corre solo tests del project `unit` de Vitest, sin servicio de BD, y genera cobertura.
3. **Given** el job `test-integration`, **When** se ejecuta, **Then** corre solo tests del project `integration` de Vitest con `singleFork:true`, con servicio `pgvector`, y genera cobertura.
4. **Given** ambos jobs, **When** terminan, **Then** el job `gate` requiere ambos para pasar.
5. **Given** la suma de `test-unit` + `test-integration`, **Then** cubre los mismos 2083 tests que `test:coverage` anterior.

---

### User Story 2 — El banco curado se preserva antes de borrar Experimentos (Priority: P1)

Como equipo quiero que los casos curados del sistema de Experimentos no se pierdan, porque son la memoria de fronteras difíciles acordadas con el CEO.

**Why this priority**: el banco representa decisiones humanas (D-20/D-24) que pueden re-usarse en futuras iteraciones del motor; borrarlo sería una pérdida de conocimiento.

**Independent Test**: existe `fixtures/banco-curado-v2.jsonl` con una línea por caso y un README que documenta origen y aprobación.

**Acceptance Scenarios**:

1. **Given** tablas `CasoEval` con casos activos e inactivos, **When** corre `npm run exportar-banco-curado`, **Then** genera `fixtures/banco-curado-v2.jsonl` con los campos: `id`, `texto`, `categoriaEsperada`, `secundariaEsperada`, `ruido`, `fuente`, `fixtureVersion`, `creadoEn`, `activo`.
2. **Given** el archivo generado, **Then** es válido JSONL (una línea JSON parseable por línea) y contiene todos los casos de `CasoEval`, tanto `activo=true` como `activo=false`.
3. **Given** `fixtures/README.md`, **Then** explica qué es el banco, quién lo aprobó (D-20/D-24) y la fecha del snapshot.

---

### User Story 3 — El sistema de Experimentos desaparece sin romper lo demás (Priority: P1)

Como CEO quiero eliminar las tabs Laboratorio/Historial/Casos del Centro de Control IA, porque no las uso y el ciclo real de afinamiento pasa por Simulación.

**Why this priority**: reduce superficie de mantenimiento, elimina endpoints sin uso y evita confusión en la UI.

**Independent Test**: `/dashboard/admin/ia` muestra solo Documentación, Playground, Rúbrica, Simulación y Configuración; no hay referencias a `EvalRun`, `EvalResultado` ni `CasoEval` en `src/`.

**Acceptance Scenarios**:

1. **Given** `IaEvalManager.tsx`, **When** se abre `/dashboard/admin/ia`, **Then** solo muestra la tab `Simulación` (antes `Eval`).
2. **Given** los endpoints bajo `/api/admin/ia/experimentos` y `/api/admin/ia/evals`, **When** se eliminan, **Then** las rutas restantes (`rubrica`, `playground`, `configuracion`, `simulacion`) siguen funcionando.
3. **Given** los modelos Prisma `EvalRun`, `EvalResultado`, `CasoEval` y enums `EvalRunEstado`, `CasoEvalFuente`, **When** se eliminan con migración DROP, **Then** `npx prisma migrate deploy` sigue siendo idempotente y no afecta otras tablas.
4. **Given** el módulo `ia_eval` en permisos, **When** se retira del catálogo, **Then** la tab `Simulación` usa `ia_simulaciones` y nadie solicita `ia_eval`.

---

### User Story 4 — Solo queda el motor de rúbrica en producción (Priority: P1)

Como CEO quiero eliminar el motor legacy de votos, porque ya decidimos usar rúbrica multi-modelo y mantener ambos motores es deuda técnica innecesaria.

**Why this priority**: simplifica el pipeline de procesamiento, reduce archivos de IA y elimina el switch `ia.rubrica.enabled`.

**Independent Test**: `grep -rE "legacy|clasificarConVotos|VotingConfig|MotorClasificacion" src/lib/ai src/components/modules/ia` devuelve 0 líneas de código productivo; el pipeline clasifica con rúbrica.

**Acceptance Scenarios**:

1. **Given** `src/lib/ai/motor.ts`, **When** se simplifica, **Then** `clasificarConMotorActivo` llama directamente a `clasificarConRubrica` sin switch y sin tipo `MotorClasificacion`.
2. **Given** `src/lib/ai/classifier.ts`, **When** se elimina, **Then** ningún archivo productivo lo importa (solo tests de legacy, que se borran con él).
3. **Given** `src/lib/ai/sandbox.ts` y el Playground, **When** se limpian, **Then** muestran un cartel "Motor activo: RÚBRICA" y solo exponen overrides de rúbrica (temperatura, umbral_presencia, subset de modelos).
4. **Given** el parámetro `ia.rubrica.enabled`, **When** se elimina del seed y del código (Opción 1 recomendada), **Then** el sistema sigue clasificando con rúbrica y se agrega migración que lo borra de BD.
5. **Given** el pipeline de procesamiento de reportes, **When** procesa un reporte, **Then** usa rúbrica exactamente igual que antes de la limpieza.

---

## Edge Cases

- **Fase 1**: un test que importa indirectamente Prisma (por ejemplo, a través de un helper) debe clasificarse como `integration`. El criterio es explícito: import directo de `@/lib/prisma` o de `src/lib/test-setup.ts`.
- **Fase 1**: la cobertura se reporta por separada en cada job; Vitest 3 mergea cobertura cuando se usa `--coverage.enabled` en ambos projects y se agregan los outputs. Si no es posible, se suben ambos reportes y se deja el agregador `test:coverage` local.
- **Fase 2**: si `fixtures/banco-curado-v2.jsonl` ya existe, el script es idempotente y lo sobreescribe.
- **Fase 2**: la migración DROP usa `DROP TABLE IF EXISTS` y `DROP TYPE IF EXISTS` para ser segura en ambientes donde las tablas ya podrían no existir.
- **Fase 3**: si algún script administrativo aún importa `classifier.ts` o usa opciones legacy, se reporta HALLAZGO y no se borra hasta resolver.
- **Fase 3**: el campo `posibleAgresorPar` sigue existiendo en el resultado de rúbrica cuando la rúbrica lo produzca; mientras tanto, `leerPosibleAgresorPar` devuelve `false` (comportamiento actual).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE dividir el job `test` de CI en `test-unit` y `test-integration` paralelos.
- **FR-002**: El project `unit` de Vitest DEBE contener tests sin dependencia de Prisma/BD.
- **FR-003**: El project `integration` de Vitest DEBE contener tests con Prisma/BD y mantener `singleFork:true`.
- **FR-004**: El script `exportar-banco-curado` DEBE generar `fixtures/banco-curado-v2.jsonl` con todos los casos de `CasoEval` (activos e inactivos), incluyendo el campo `activo` en cada línea.
- **FR-005**: El sistema DEBE eliminar endpoints, componentes, DAL y modelos Prisma del sistema de Experimentos.
- **FR-006**: El sistema DEBE renombrar la tab `Eval` a `Simulación` en el Centro de Control IA.
- **FR-007**: El sistema DEBE eliminar `src/lib/ai/classifier.ts` y todo el switch legacy/rúbrica.
- **FR-008**: El Playground DEBE mostrar "Motor activo: RÚBRICA" y solo permitir overrides de rúbrica.
- **FR-009**: El pipeline de procesamiento de reportes DEBE seguir clasificando con rúbrica sin cambios de comportamiento.

### Non-Functional Requirements

- **NFR-001**: Wall-clock del CI DEBE bajar de ~26m a ~18m manteniendo cobertura.
- **NFR-002**: Cada fase DEBE tener su propio commit para auditoría separada.
- **NFR-003**: No DEBE haber código muerto de Experimentos ni legacy en `src/lib/ai` ni `src/components/modules/ia` al finalizar.
- **NFR-004**: Las migraciones DEBEN ser seguras (`DROP IF EXISTS`) y no afectar datos reales fuera de las tablas de Experimentos.

---

## Success Criteria

- [ ] CI verde con jobs `test-unit` + `test-integration` + `gate`.
- [ ] `fixtures/banco-curado-v2.jsonl` versionado con README.
- [ ] `grep -rE "EvalRun|EvalResultado|CasoEval|ExperimentCard|LaboratorioTab|HistorialTab|CasosTab" src/` devuelve 0 resultados productivos.
- [ ] `grep -rE "legacy|clasificarConVotos|VotingConfig|MotorClasificacion" src/lib/ai src/components/modules/ia` devuelve 0 resultados productivos.
- [ ] Pipeline de procesamiento clasifica reportes con rúbrica idénticamente a antes.
- [ ] Gate local verde: tsc, lint, test:unit, test:integration, arch:check, build.

---

## Assumptions

- Producción ya usa rúbrica (`ia.rubrica.enabled=true`) y no depende del legacy.
- El CEO no usa Experimentos; Simulación es el ciclo real de afinamiento.
- Vitest 3 soporta múltiples projects en un mismo `vitest.config.ts`.
- Los tests unitarios no requieren base de datos ni el singleton de Prisma.

---

## Notes

- **Opción para `ia.rubrica.enabled` (Fase 3)**: se recomienda Opción 1 (eliminar del seed y del código, con migración que borre el parámetro de BD) porque el CEO confirmó que rúbrica es el único motor en uso. Si durante la implementación surge alguna dependencia no prevista, se reporta como HALLAZGO.
- **Impacto en arranque**: tras Fase 3, `src/lib/ai/motor.ts` ya no consulta `ia.rubrica.enabled`, por lo que el primer reporte procesado no necesita leer ese parámetro.
