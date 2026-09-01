# /speckit-analyze · SPEC-341

Auditoría cruzada de `spec.md` · `plan.md` · `tasks.md` (2026-09-01, tras
absorber las dos precisiones del CEO sobre parametrizables sembrados y sala
de espera como FR).

## Resumen

| Métrica | Valor |
|---|---|
| FR totales | 27 (23 base + 4 nuevos: 008-bis, 008-ter, 008-quater, 024–027 quedaron declarados como serie) |
| SC totales | 8 |
| Historias | 4 (US1 P1 · US2 P2 · US3 P2 · US4 P3) |
| Tareas | 32 (T001–T097 en 7 fases) |
| Cobertura FR con tarea | 100 % |
| Cobertura SC con tarea | 87 % (1 SC parcialmente cubierta — ver H-1) |
| Constitución | Sin violaciones (ya evaluada en `plan.md`) |
| CRÍTICOS | 0 |
| ALTAS | 1 |
| MEDIAS | 2 |
| BAJAS | 1 |

## Findings

### A1 — Coverage-gap · ALTA · SC-007 (sala de espera útil sola)

**Ubicación**: `spec.md` SC-007 + `tasks.md` fase 3.
**Problema**: SC-007 exige verificar que un padre en estado GENERANDO ve los
TRES bloques (banner con posición real, capa 1 "En vivo" visible, análisis
previo con "N hechos nuevos después" cuando existe). Las tareas cubren cada
bloque por separado (T034/T035/T036) pero NINGUNA los verifica juntos en un
recorrido navegador — el CEO fue explícito en que la UX de espera es de
primera clase.
**Recomendación**: agregar `T038 [US1]` de verificación en vivo del estado
GENERANDO con las tres piezas presentes (screenshot en `cierre.md`).

### A2 — Ambigüedad · MEDIA · Bandera `colaLlena` en `GET`

**Ubicación**: `contracts/analisis-endpoint.md` (GET) y `tasks.md` T031/T032.
**Problema**: el contrato dice *"la cola está llena → devuelve `estado="SIN_ANALISIS"`
con bandera `colaLlena: true`"*, pero el ejemplo JSON del `GET` NO incluye
`colaLlena` como campo del payload. Ambos otros consumidores (POST) sí lo
tienen (`motivo: "cola_llena"`).
**Recomendación**: agregar `colaLlena?: boolean` al ejemplo del `GET` en
`contracts/analisis-endpoint.md`, y mencionar el campo en `T031`.

### A3 — Underspec · MEDIA · Sembrado del prompt sistema y frases prohibidas

**Ubicación**: `tasks.md` T003.
**Problema**: T003 lista los parámetros nuevos incluyendo
`padre.analisis.prompt_sistema` y `padre.analisis.frases_prohibidas_json`
pero NO especifica QUÉ CONTENIDO sembrar. Sin contenido concreto, la
compuerta FR-014 no puede validar nada (lista vacía → jamás rechaza) y el
modelo no tiene guía de voz.
**Recomendación**: extender T003 con el contenido literal a sembrar (borrador
del prompt sistema en 4-6 líneas, y una lista inicial de 5–8 frases
prohibidas típicas del brief: "podría ser un depredador", "sugiere abuso",
"es un caso claro de", etc.).

### A4 — Simplification · BAJA · Duplicación con `route.test.ts`

**Ubicación**: `tasks.md` T033 (US1) y T041 (US2).
**Problema**: ambos test agregan a `route.test.ts`. Editar el mismo archivo
en dos historias distintas puede generar conflictos en paralelo.
**Recomendación**: partir en dos archivos: `route.test.get.ts` (US1) y
`route.test.post.ts` (US2), o dejar claro en T041 que se agrega SIN tocar
lo escrito en T033.

## Cobertura FR → Task (100 %)

| FR | Task(s) |
|---|---|
| FR-001 | T010 · T011 |
| FR-002 | T031 · T032 |
| FR-003 | T031 |
| FR-004 | T003 · T017 · T050 |
| FR-005 | T005 · T019 |
| FR-006 | (NO-task — verificado por ausencia; sin scripts periódicos en Fase 1) |
| FR-007 | T017 · T033 |
| FR-008 | T018 |
| FR-008-bis | T017 · T052 |
| FR-008-ter | T017 · T041 |
| FR-008-quater | T031 |
| FR-009 | T012 · T013 |
| FR-010 | T012 · T013 · T060 |
| FR-011 | T034 |
| FR-012 | T030 · T034 |
| FR-013 | T030 · T034 |
| FR-014 | T015 · T016 |
| FR-015 | T018 |
| FR-016 | T053 |
| FR-017 | T032 · T033 |
| FR-018 | T041 · T042 |
| FR-019 | T040 · T041 |
| FR-020 | T040 · T041 |
| FR-021 | T034 |
| FR-022 | T035 |
| FR-023 | T035 · T054 |
| FR-024 | T035 · T054 |
| FR-025 | T036 |
| FR-026 | T034 |
| FR-027 | T042 |

## Cobertura SC → Task

| SC | Task(s) | Cobertura |
|---|---|---|
| SC-001 | T037 | ✅ |
| SC-002 | T013 · T060 | ✅ |
| SC-003 | T037 | ✅ |
| SC-004 | T051 | ✅ (implícito en el escenario de 3 jobs con max=1) |
| SC-005 | T033 · T041 | ✅ |
| SC-006 | T060 · T061 · T062 | ✅ |
| SC-007 | (falta — ver A1) | ⚠️ parcial |
| SC-008 | T052 | ✅ |

## Precisiones del CEO — trazabilidad

**Precisión 1 (2026-09-01 04:05) · "TODO umbral parametrizable Y sembrado"**:
visible en `spec.md` (bloque "ParametrosSistema" en Key Entities con la lista
literal de 9 parámetros + 3 gemelos colegio) y en `tasks.md` T003 (siembra
completa). Recomendación A3 mejora la trazabilidad del CONTENIDO.

**Precisión 2 (2026-09-01 04:05) · "Sala de espera como FR con SC"**:
visible en `spec.md` FR-024/025/026/027 (bloque *"Estado de espera de
primera clase (mockup ExpedienteGenerando aprobado)"*) + SC-007 dedicada.
Recomendación A1 cierra la verificación de SC-007 en vivo.

## Siguiente paso sugerido

Aplicar A1, A2, A3 (10 min) y arrancar `speckit-implement` — sin CRÍTICOS ni
gates rotos.
