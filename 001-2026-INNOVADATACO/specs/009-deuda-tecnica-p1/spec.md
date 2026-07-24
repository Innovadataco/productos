# Feature Specification: Deuda técnica P1 (saneamiento medido)

**Feature Branch**: `009-deuda-tecnica-p1` (el trabajo se commitea en la rama de pruebas
`feature/001-scaffolding`; no se abren ramas por feature — AGENTS.md)

**Created**: 2026-07-24

**Status**: **Implementada — pendiente de gate retroactivo de ZEUS**.

> Corregido en el turno D-068. Decía `Pre-aprobada`, que **no existe en el proceso**: una
> spec está en `Draft`, aprobada, implementada o terminada. La etiqueta inventada tapaba la
> desviación real — el encargo D-060 decía *redactarla* y ODIN además la implementó, saltándose
> el gate de ZEUS entre `specify` e `implement`. No se revierte (rama compartida); el gate se
> hace retroactivo. El alcance sí estaba **medido** por ZEUS (D-063) y ODIN lo verificó antes
> de escribir.

**Input**: Cerrar la deuda técnica P1 acotada y medible que la línea base arrastra: lint,
código muerto, incumplimientos de la constitución, paginación ausente, tests que faltan y
validación de inputs sin librería. **Lo que cambie arquitectura o toque muchos archivos no
entra aquí**: se reporta para que ZEUS lo priorice.

## Contexto: deuda medida, no estimada

Esta spec no descubre deuda: la **cierra**. ZEUS la midió el 2026-07-24 (D-063) y ODIN
verificó la medición antes de escribir una línea, como manda §1.1 (verdad sobre el estado del
código, no de memoria).

### Verificación de la medición de ZEUS (2026-07-24, turno nocturno)

| Regla | ZEUS (D-063) | Verificado por ODIN | Nota |
|---|---|---|---|
| `no-explicit-any` | 26 | **26** ✅ | todos en `.tsx`; `src/lib` y `src/app/api` en **0** |
| `no-unused-vars` | 16 | **16** ✅ | incluye `sanitizeJsonText` en `modelClients.ts` |
| `react-hooks/set-state-in-effect` | 13 | **13** ✅ | **viola §6.2** |
| `react-hooks/exhaustive-deps` | 6 | **6** ✅ | |
| `no-require-imports` | 1 | **1** ✅ en `src/` | **+6 más en `scripts/`** (ver abajo) |
| **Total** | **64** (42 err, 22 warn) | **64** ✅ | medición sobre `src/` |

La medición de ZEUS es **correcta**. Dos precisiones que la verificación añade:

1. **El total de 64 incluye dos reglas que la lista no nombraba**: `react-hooks/refs` (1) y
   `react-hooks/purity` (1), ambas en `BaseTab.tsx`. 26+16+13+6+1+1+1 = 64. Cuadra exacto.
2. **La medición cubre `src/`, no el repositorio entero.** `scripts/` aporta **7 problemas
   más** (6 `no-require-imports` en `verify-home.js` y `verify-ui.js`, 1 `no-unused-vars` en
   `worker.mjs`), que la barrida de ZEUS no incluía. El repo completo da **71**.

> Al arrancar esta spec la cifra de `src/` es **62**, no 64: SPEC-008 ya eliminó por el camino
> un `no-explicit-any` (el `catch (err: any)` de `ProjectForm.tsx`) y un `no-unused-vars`
> (el `submoduleId` que `ProyectosTab` ignoraba).

### Lo que ZEUS dejó cerrado y no se reabre

- **Toda ruta API ya tiene test.** Verificado: esa deuda está cerrada.
- **`src/lib` y `src/app/api` tienen 0 `no-explicit-any`** (SC-009 de la spec 002). Es un
  contrato vigente: esta spec **no puede** bajarlo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - La constitución se cumple donde hoy se incumple (Priority: P1)

Como arquitecto, quiero que desaparezcan los `setState` síncronos dentro de `useEffect`,
porque **§6.2 los prohíbe expresamente** y hoy hay 13.

**Why this priority**: no es estilo, es **incumplimiento constitucional**. Una regla que se
incumple 13 veces y nadie corrige deja de ser una regla.

**Independent Test**: `npx eslint src` no reporta `react-hooks/set-state-in-effect`, o los
casos que queden están **declarados con su razón**, no olvidados.

**Acceptance Scenarios**:

1. **Given** un efecto que solo carga datos al montar, **When** se corrige, **Then** la carga
   sigue ocurriendo una vez y la pantalla muestra lo mismo que antes.
2. **Given** un caso cuya corrección **no** es demostrablemente equivalente, **When** se
   evalúa, **Then** se **declara pendiente con su justificación** en vez de tocarlo a ciegas.

---

### User Story 2 - Cero `any` en los componentes, sin perder el contrato de `src/lib` (Priority: P1)

Como arquitecto, quiero que los 26 `no-explicit-any` de los `.tsx` se tipen, **sin** que
`src/lib` ni `src/app/api` dejen de estar en 0 (SC-009 de la spec 002).

**Independent Test**: `npx eslint src` sin errores `no-explicit-any`, y `npx eslint src/lib
src/app/api` sigue en 0.

**Acceptance Scenarios**:

1. **Given** un `catch (err: any)`, **When** se corrige, **Then** queda `catch (err: unknown)`
   con el estrechamiento que corresponda (§2.1).
2. **Given** un estado tipado como `any[]`, **When** se corrige, **Then** declara la forma
   real de lo que guarda.
3. **Given** el gate de `src/lib` y `src/app/api`, **When** termina la spec, **Then** sigue
   en **0**: el contrato de la spec 002 no se toca.

---

### User Story 3 - Fuera el código muerto (Priority: P1)

Como equipo, quiero que desaparezcan las 16 variables e importaciones sin usar —incluida
`sanitizeJsonText` en `modelClients.ts`, señalada desde la línea base— porque el código muerto
hace dudar de lo vivo.

**Acceptance Scenarios**:

1. **Given** un import sin usar, **When** se elimina, **Then** nada que lo usara deja de
   funcionar (lo prueba la suite).
2. **Given** un parámetro exigido por la firma pero no usado, **When** no se puede eliminar,
   **Then** se marca de la forma que la regla admite, sin desactivar la regla entera.

---

### User Story 4 - Las listas que pueden crecer se paginan (Priority: P2)

Como usuario, quiero que `GET /api/documents` y `GET /api/licitaciones` paginen, porque **§3.3
lo exige** y hoy devuelven todo. `GET /api/config/audit` es la referencia.

**Independent Test**: pedir `?page=2&pageSize=10` devuelve la segunda página y el total.

**Acceptance Scenarios**:

1. **Given** una lista larga, **When** se pide sin parámetros, **Then** devuelve la primera
   página con el tamaño por defecto y los metadatos de paginación (§3.3).
2. **Given** un `pageSize` disparatado, **When** se pide, **Then** se acota al máximo, sin error.
3. **Given** las pantallas que consumen esas listas, **When** cambia la forma de la respuesta,
   **Then** **siguen funcionando**: ninguna se queda en blanco.

---

### User Story 5 - Los dos tests que faltan existen (Priority: P2)

Como equipo, quiero `src/lib/audit.test.ts` y `src/lib/documentProcessor.test.ts`, las dos
casillas sin marcar de §4.4.

**Acceptance Scenarios**:

1. **Given** `auditLog`, **When** se prueba, **Then** se verifica que persiste el registro y
   —lo importante— que **un fallo de auditoría no tumba la operación** que la invocó.
2. **Given** los extractores de `documentProcessor`, **When** se prueban, **Then** cubren
   título, número, fecha, entidad y párrafos con texto real de norma colombiana.

---

### User Story 6 - Sin `require()` (Priority: P2)

Como arquitecto, quiero que el `require("pdf2json")` desaparezca (§8.1, objetivo **0**).

**Acceptance Scenarios**:

1. **Given** `extractPdfText`, **When** se convierte a importación dinámica, **Then** sigue
   extrayendo texto igual y `no-require-imports` baja a 0 en `src/`.
2. **Given** el módulo, **When** se importa desde un test, **Then** **no** carga pdf2json si
   no se llama a `extractPdfText` (la carga pasa a ser perezosa).

---

### User Story 7 - Validación con Zod donde más entra input (Priority: P3)

Como arquitecto, quiero empezar la migración a Zod (§5.2) **acotada**: las rutas que más input
reciben. El resto queda **declarado como pendiente**, no migrado a medias.

**Acceptance Scenarios**:

1. **Given** una ruta migrada, **When** llega un cuerpo inválido, **Then** responde 400 con
   mensaje legible, **sin** filtrar detalle técnico ni la traza de Zod.
2. **Given** el contrato actual de esas rutas, **When** se migra, **Then** los códigos y
   mensajes que ya devolvía **no cambian**: la migración es interna.

### Edge Cases

- ¿Y si corregir un `useEffect` cambia el comportamiento de una pantalla sin test? → Se
  **declara pendiente**. El criterio de la noche es: si no se puede probar que no se rompió
  nada, no entra.
- ¿La paginación rompe a quien consume la lista? → Los consumidores se adaptan en la misma
  spec y con lectura tolerante a las dos formas.
- ¿`scripts/` entra? → **No.** Queda reportado: es decisión de ZEUS si `scripts/` debe estar
  bajo la misma vara de lint que `src/`.

## Requirements *(mandatory)*

### Restricciones (no negociables)

- **RZ-1**: `src/lib` y `src/app/api` siguen en **0** `no-explicit-any` (SC-009, spec 002).
- **RZ-2**: **no se trocean** los componentes gigantes (`BaseTab.tsx` 1378 líneas,
  `LicitacionesTab.tsx` 924, `configuracion/page.tsx` 684). Tienen spec propia y revisión de
  ZEUS. Tiparlos y corregir sus efectos **sí**; partirlos **no**.
- **RZ-3**: la suite nunca queda en rojo; ningún commit baja la cuenta de pruebas.
- **RZ-4**: lo que cambie arquitectura o toque muchos archivos **se reporta**, no se toca.
- **RZ-5**: no se toca Base Oficial (los datos), el pipeline RAG ni otro producto.

### Functional Requirements

- **FR-001**: `react-hooks/set-state-in-effect` MUST bajar a **0** en `src/`, o cada caso
  restante MUST quedar **declarado con su razón** en esta spec.
- **FR-002**: `no-explicit-any` MUST bajar a **0** en `src/`; `src/lib` y `src/app/api` MUST
  seguir en 0.
- **FR-003**: `no-unused-vars` MUST bajar a **0** en `src/`, eliminando el código muerto real
  (no silenciando la regla).
- **FR-004**: `GET /api/documents` y `GET /api/licitaciones` MUST paginar según §3.3
  (`page`, `pageSize`, tope máximo, respuesta con `items` + `pagination`).
- **FR-005**: los consumidores de esas dos listas MUST seguir funcionando tras el cambio de
  forma de la respuesta.
- **FR-006**: MUST existir `src/lib/audit.test.ts` y `src/lib/documentProcessor.test.ts`.
- **FR-007**: `no-require-imports` MUST bajar a **0** en `src/`.
- **FR-008**: Zod MUST instalarse y aplicarse **solo** a las rutas de mayor entrada; el resto
  MUST quedar declarado como pendiente.
- **FR-009**: toda ruta tocada MUST conservar `verifyAuth`, el contrato `apiError` y sus
  códigos actuales; MUST NOT filtrar `err.message`.
- **FR-010**: `npx tsc --noEmit` y `npm run build` MUST quedar limpios.
- **FR-011**: ningún cambio MUST tocar archivos/puertos de `002-2026-PROTECCION-INFANTIL` ni
  `003-2026-SICOV-OTPC` (ADR_002).

## Success Criteria *(mandatory)*

- **SC-001**: `npx eslint src` reporta **0 errores**.
- **SC-002**: `npx eslint src/lib src/app/api` sigue en **0** `no-explicit-any`.
- **SC-003**: `react-hooks/set-state-in-effect` = 0 en `src/`, o los restantes declarados.
- **SC-004**: `GET /api/documents` y `GET /api/licitaciones` responden con `items` +
  `pagination` y respetan el tope de `pageSize`, con test.
- **SC-005**: las pantallas que consumen esas listas siguen mostrando datos.
- **SC-006**: existen los dos tests de §4.4 y pasan.
- **SC-007**: `grep -rn "require(" src/` sin resultados.
- **SC-008**: la suite pasa sin BD ni Ollama y **no baja** de la línea base (330).
- **SC-009**: `npx tsc --noEmit` limpio y `npm run build` compila.
- **SC-010**: los puertos 5005/5433/5010/5434 y el RAG permanecen sin cambios.

## Definición de terminado

| # | Regla de Oro | Cómo se acredita |
|---|---|---|
| 1 | Spec Kit aplicado | `specs/009-deuda-tecnica-p1/` con spec, plan, tasks |
| 2 | Código a la rama de pruebas | Commits scopeados a `001-2026-INNOVADATACO/`, push en el mismo acto |
| 3 | Pruebas escritas y pasando | SC-006, SC-008 |
| 4 | Despliegue accesible y probable | SC-005: el CEO abre la app y las listas siguen ahí |
| 5 | Revisión de arquitectura de ZEUS | SC-001…SC-003 medibles con un comando; lo no hecho, declarado |

## Assumptions

- La deuda **mecánica y de bajo riesgo** se arregla; la que cambia arquitectura se **reporta**.
- Los componentes gigantes se **tipan y corrigen**, no se trocean (RZ-2).
- La suite sigue el patrón de mocks (spec 002): sin BD ni red.

## Out of Scope

- **Trocear** `BaseTab.tsx`, `LicitacionesTab.tsx` y `configuracion/page.tsx` (spec propia).
- `scripts/` bajo la vara de lint de `src/` (decisión de ZEUS; queda reportado).
- Migrar **todas** las rutas a Zod (solo las de mayor entrada; el resto, declarado).
- Rate limiting (§5.4), RBAC (§2.4, 403) y demás "futuros" de la constitución.
- Base Oficial (datos), pipeline RAG, 002-Protección Infantil, 003-SICOV.
