# Tasks: Deuda técnica P1 (saneamiento medido)

**Input**: Design documents from `specs/009-deuda-tecnica-p1/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md) (**Pre-aprobada, D-063**)

**Rama**: `feature/001-scaffolding` (PRUEBAS). Staging explícito por ruta, commit + push en el
mismo acto. **Sin migración. No es trabajo pesado.**

**Orden por riesgo creciente** (plan §"Principio"): cada bloque queda verde y commiteado antes
de empezar el siguiente.

---

## Phase 1: Verificación de la medición (§1.1)

- [x] T001 Medir el lint **antes de tocar nada** y contrastar con D-063. Resultado: la
      medición de ZEUS es **correcta** (64 en `src/`). Dos matices: el total incluía
      `react-hooks/refs` y `purity`, que la lista no nombraba, y la barrida cubría `src/`, no
      el repo — `scripts/` aporta **7 más**. → spec §Verificación

---

## Phase 2: Riesgo nulo — los tests que faltaban (US5)

- [x] T002 [P] [US5] `src/lib/audit.test.ts`: persiste acción/entidad/usuario, atribuye a
      `system` sin usuario, serializa metadata y —lo que importa— **un fallo de auditoría no
      tumba la operación auditada**. → FR-006
- [x] T003 [P] [US5] `src/lib/documentProcessor.test.ts`: título, número, fecha (3 formatos),
      entidad, secciones y párrafos, con texto con forma de norma colombiana. → FR-006

---

## Phase 3: Riesgo bajo — `require()` y código muerto (US6, US3)

- [x] T004 [US6] `extractPdfText` pasa a importación dinámica de pdf2json. El paquete aporta
      sus tipos, así que el manejador de error sigue al suyo. → FR-007
- [x] T005 [US3] `no-unused-vars` a **0**: `sanitizeJsonText` (línea base), `parseDate`,
      `ProcessingDoc`, `isExpanded`, `setQueue`, `Settings`, `Eye`/`X`, `submoduleId` de
      `InvestigacionTab` y el `req` de tres `GET`. → FR-003

**Commit 1** — `d9956cf2`. Push.

---

## Phase 4: Riesgo medio — cero `any` (US2)

- [x] T006 [US2] `src/lib/mensajeError.ts` + test: estrechamiento único para los 18
      `catch (err: any)`. **No** se reutiliza `detalleDeError` (es de servidor, su salida va al
      log y arrastraría `next/server` al bundle de cliente). → FR-002
- [x] T007 [US2] Tipos que faltaban: `ApiTestResult`, `ApiDocs`/`ApiDocParam`, `LogDocumento`,
      y `as AiModel["provider"]`/`["scope"]` en los dos selects. → FR-002
- [x] T008 [US2] **Gate RZ-1**: `src/lib` y `src/app/api` siguen en **0** `no-explicit-any`.
      → SC-002

**Commit 2** — `e903a62d`. Push.

---

## Phase 5: Riesgo alto — §6.2 (US1)

- [x] T009 [US1] Las 11 cargas al montar pasan a ejecutarse dentro de una función asíncrona
      propia del efecto. Mismo momento, mismo resultado, sin setState síncrono. → FR-001
- [x] T010 [US1] **Declarar** los 2 que no se tocan con su razón: `ThemeContext.tsx:13`
      (hidratación; la corrección es `useSyncExternalStore`) y `BaseTab.tsx:729` (posiciones
      del grafo que luego se arrastran; convertirlo rompe el arrastre). → FR-001

**Commit 3** — `3a41b15d`. Push.

---

## Phase 6: Riesgo alto — paginación (US4)

- [x] T011 [US4] `src/lib/paginacion.ts` + test: topes en un solo sitio; una URL con basura
      no produce 400, se acota. → FR-004
- [x] T012 [US4] `GET /api/licitaciones` y `GET /api/documents` paginan con
      `{ items, pagination }` y `count` en paralelo. → FR-004
- [x] T013 [US4] `itemsDeCuerpo` en `respuestaApi.ts`: los consumidores aceptan lista pelada
      **o** paginada, así que paginar otra ruta no volverá a romper pantallas. 5 consumidores
      actualizados. → FR-005
- [x] T014 [US4] `fetchProcessingDocs` deja de traerse todo para filtrar en cliente: pide los
      dos estados **al servidor**. Con paginación habría visto solo la primera página. → FR-005
- [x] T015 [US4] Tests de las dos rutas sobre la forma nueva, el salto y el tope. → SC-004

**Commit 4** — `c055f754`. Push.

---

## Phase 7: Riesgo medio — Zod acotado (US7)

- [x] T016 [US7] Instalar `zod` (§5.2 lo pedía; no estaba).
- [x] T017 [US7] `src/lib/esquemas.ts` + test: los dos esquemas y `validar`, que devuelve
      **mensaje legible**, nunca el `ZodError` (§0.3). → FR-008
- [x] T018 [US7] Aplicar a `POST /api/documents/search` y `POST /api/research/analyze`,
      conservando mensajes y códigos actuales. → FR-008, FR-009
- [x] T019 [US7] Los topes de §2.6 (query 500, prompt 16000) quedan **implementados**: ninguna
      de las dos rutas los aplicaba. → §2.6

**Commit 5** — `cc6c352d`. Push.

---

## Phase 8: Gates

- [x] T020 Suite verde y por encima de la línea base. → SC-008
- [x] T021 `npx tsc --noEmit` limpio y `npm run build` compila. → SC-009
- [x] T022 `npx eslint src/lib src/app/api` sin `no-explicit-any`. → SC-002
- [x] T023 Aislamiento: 5005/5433/5010/5434, Base Oficial y RAG intactos. → SC-010

---

## Resultado (2026-07-24, turno nocturno D-060)

| Regla | Antes (ZEUS, D-063) | Después | |
|---|---|---|---|
| `no-explicit-any` | 26 | **0** | ✅ |
| `no-unused-vars` | 16 | **0** | ✅ |
| `react-hooks/set-state-in-effect` | 13 | **2** | ⚠️ declarados |
| `react-hooks/exhaustive-deps` | 6 | **6** | ⚠️ declarados (warnings) |
| `no-require-imports` (`src/`) | 1 | **0** | ✅ |
| `react-hooks/refs` / `purity` | 1 / 1 | **1 / 1** | ⚠️ declarados (RZ-2) |
| **Total `src/`** | **64** | **10** (4 errores + 6 warnings) | **−84 %** |

> **SC-001 no se cumple al pie de la letra** y conviene decirlo claro: pedía **0 errores** en
> `src/` y quedan **4** (los 2 `set-state-in-effect` declarados, `refs` y `purity`). Los cuatro
> están dentro de lo que el plan declaró como "no demostrable esta noche" —tres de ellos en el
> componente que RZ-2 protege— y FR-001 contempla expresamente declararlos en vez de tocarlos.
> No se cierra la casilla: se deja abierta y nombrada, para ZEUS.

| Gate | Resultado |
|---|---|
| Suite sin BD ni Ollama | **373 verdes / 49 archivos** (línea base 330/44) |
| `npx tsc --noEmit` | limpio |
| `npm run build` | compila |
| `npx eslint src/lib src/app/api` | **0** `no-explicit-any` (contrato spec 002 intacto) |
| `require(` real en `src/` | **0** (los 2 restos del grep son menciones en comentarios) |
| §4.4 | las dos casillas, marcadas |
| Migración | **ninguna** |
| Puertos 5005/5433/5010/5434 + RAG | intactos |

## Phase 9: La deuda declarada, ya con red (turno D-068, radicado 001-IDC-014)

> Regla 3 en su forma estricta: **primero el test que fija el comportamiento actual, después el
> cambio**. El motivo de haber frenado en el turno anterior era correcto —no había red—, así que
> la red se construyó primero.

- [x] **T-a** `ThemeContext` → `useSyncExternalStore`.
      `src/context/ThemeContext.test.tsx` (7 casos) se escribió **contra la implementación
      vieja** y pasó; luego se refactorizó y **pasó igual**. Cubre justo lo que el efecto
      evitaba: el servidor pinta `dark` aunque el navegador tenga `light` guardado, e hidratar
      no produce ninguna queja de desajuste de React. **Primer test de componente del
      proyecto** (`jsdom` por archivo, como `vitest.config.ts` ya contemplaba).
      De regalo, el tema ahora se sincroniza entre pestañas: sale del patrón, no se buscó.
- [x] **T-b** Grafo de `BaseTab`. **Sí se pudo**, y sin tocar el arrastre a ciegas: se separó lo
      que estaba mezclado en un solo estado — la **disposición inicial**, que es función pura de
      los documentos, y las **posiciones que el usuario movió**, que es lo único que es estado.
      `src/lib/grafoPosiciones.ts` + 10 tests. El efecto sembrador desaparece.
      Corrige además un defecto que nadie había nombrado: al llegar un documento nuevo se
      **perdían todas las posiciones arrastradas**, porque el efecto reescribía el estado
      entero. Ahora se conservan.
- [x] **T-c** `exhaustive-deps`: de 6 a **2 declarados**.
      Arreglados los cuatro donde la equivalencia es demostrable: `configuracion/page.tsx`,
      `ParametrizacionTab.tsx` y `Repositorio` de `BaseTab` estabilizan sus cargas con
      `useCallback`, de modo que declarar la dependencia **no cambia cuándo corre el efecto** —
      sigue siendo una vez al montar (o al cambiar el filtro), pero ahora la lista dice la
      verdad.
- [x] **Errores `refs` y `purity`**, que no estaban en el encargo pero bloqueaban SC-001:
      `queueRef.current = queue` se escribía **durante el render** (prohibido); pasa a un
      efecto. `Date.now()` en render se sustituye por el momento de la última lectura, que
      además es más honesto: la antigüedad que se muestra es "según la última consulta", no una
      cuenta que cambia sola en cada repintado.

### Estado del lint tras esta fase

`npx eslint src` → **0 problemas** (antes 64 en la medición D-063).

> **Qué significa ese 0 exactamente**, para que nadie lo lea de más: **62 se arreglaron** y
> **2 son supresiones declaradas** con su razón escrita en el propio sitio
> (`eslint-disable-next-line` + justificación). No son un olvido silenciado; son las dos que
> ZEUS anticipó como peligrosas:
>
> | Sitio | Por qué se declara |
> |---|---|
> | `BaseTab.tsx` efecto de **sondeo** | `startPolling` se recrea en cada render: declararlo haría correr la limpieza `stopPolling()` en **cada repintado**, parando y arrancando el sondeo sin descanso y relanzando dos peticiones por render. Es **el bucle** que ZEUS advirtió. Arreglarlo es estabilizar cuatro funciones encadenadas del monitor de ingesta, que no tiene ni un test. |
> | `BaseTab.tsx` efecto de **cola de subida** | Declarar `queue` haría reentrar en el motor de la cola con **cada cambio de estado de un elemento** —y la subida los cambia: pending → uploading → processing → done— mientras suben ficheros reales. El guarda `processingRef` probablemente lo contendría, pero "probablemente" no es criterio para algo que mueve documentos del CEO. |
>
> Ambas entran con el **troceado** de `BaseTab.tsx`, que es su frente natural.

---

### Lo que NO se hizo, y por qué

1. ~~`ThemeContext.tsx`~~ — **hecho** en el turno D-068 (T-a), con red de tests primero.
2. ~~Grafo de `BaseTab`~~ — **hecho** en el turno D-068 (T-b), separando disposición inicial
   (pura) de posiciones arrastradas (estado).
3. **`exhaustive-deps`**: 4 de 6 hechos; **2 declarados** (sondeo y cola de subida de
   `BaseTab`), con su razón en el código y en la tabla de arriba.
4. ~~`react-hooks/refs` y `purity`~~ — **hechos** en el turno D-068.
5. **`scripts/` (7 problemas)** — decisión de ZEUS si `scripts/` va bajo la misma vara.
6. **Zod en el resto de rutas** — acotado a propósito (FR-008). Ver la nota de
   `POST /api/licitaciones` en la auditoría: su migración exige cuidado con la coerción de
   campos numéricos que llegan como `""`.
