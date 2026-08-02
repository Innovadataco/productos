# Feature Specification: SPEC-135 — Romper el god-module circulo-confianza + matar el N+1 (E-2)

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-08-01

**Status**: IMPLEMENTADO

**Input**: Instructivo 002-PI-056 (BANDA 2, ítem E-2; radica ZEUS). Reverificado en
fuente 2026-08-01: `src/lib/dal/services/circulo-confianza.ts` sigue teniendo **864
líneas** exactas (el conteo de julio no cambió) con 17 símbolos exportados mezclando
cinco responsabilidades (estado de contactos, CRUD de contactos, vista agregada,
preferencias, notificaciones). N+1 verificado: `listarContactos` llama
`determinarEstadoContacto` POR contacto (2 queries por contacto: identificadores +
reportes — `circulo-confianza.ts:159-164`), cuando los identificadores ya vienen en el
`include` inicial y los reportes pueden traerse en UNA query para todos los valores.
Consumidores: 4 rutas `api/circulo-confianza/**`, páginas dashboard, `email.ts`,
`docs/indice.ts`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El módulo se parte por responsabilidad sin cambiar su API pública (Priority: P1)

Como responsable de ingeniería, quiero `circulo-confianza/` como carpeta con un módulo
por responsabilidad y un barrel que reexporta la API actual, de modo que cada parte sea
legible y navegable sin que ningún consumidor cambie un import.

**Why this priority**: 864 líneas con 5 responsabilidades es el punto ciego del
dominio padre: cualquier cambio toca todo. El barrel preserva la frontera pública.

**Independent Test**: `tsc --noEmit` y la suite verdes sin tocar un solo import de los
consumidores; ningún archivo de la carpeta supera ~250 líneas.

**Acceptance Scenarios**:

1. **Given** los consumidores actuales, **When** corre `tsc` y la suite, **Then** pasan
   sin modificar imports ni expectativas.
2. **Given** la carpeta nueva, **When** se lista, **Then** hay un módulo por
   responsabilidad (estado, contactos, agregado, preferencias, notificaciones) + barrel.

---

### User Story 2 — listarContactos sin N+1 (Priority: P1)

Como responsable de rendimiento, quiero que `listarContactos` traiga los reportes de
TODOS los identificadores en una sola query y agrupe en memoria, de modo que el costo
sea constante (2-3 queries) y no 2×N.

**Why this priority**: Es la lista que ve el padre al entrar a su círculo; con el tope
de contactos actual el N+1 es acotado pero es el patrón a erradicar (E-2 lo nombra).

**Independent Test**: test con contador de queries (o afirmación estructural del
código: una sola llamada `reporte.findMany` en el camino) + mismos resultados que
antes (la red existente lo afirma).

**Acceptance Scenarios**:

1. **Given** un usuario con N contactos con reportes, **When** lista, **Then** el
   resultado (estados, conteos, resumen) es idéntico al actual con una sola query de
   reportes.
2. **Given** contactos sin identificadores o sin reportes, **When** lista, **Then** el
   estado `sinReportes` se calcula igual (cobertura de bordes intacta).

---

### Edge Cases

- Contactos inhabilitados: el resumen activos/inhabilitados se conserva exacto.
- Identificadores compartidos entre contactos del mismo usuario: agrupar en memoria por
  valor no puede duplicar reportes en el estado de cada contacto (mismo comportamiento
  que hoy).
- `obtenerVistaAgregada` ya junta valores en una pasada: verificar que no tiene su
  propio N+1 encubierto (revisar `notificarCambioCirculoSiCorresponde` también).
- `email.ts` consume tipos del módulo: el barrel reexporta los tipos también.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `circulo-confianza.ts` DEBE partirse en `circulo-confianza/` con módulos
  por responsabilidad + `index.ts` barrel que reexporta TODA la API pública actual
  (funciones y tipos). Ningún consumidor cambia.
- **FR-002**: Ningún archivo resultante DEBE superar ~250 líneas (guía, no camisa de
  fuerza: si uno queda en 260 por cohesión, se justifica).
- **FR-003**: `listarContactos` DEBE resolver estados con UNA query de reportes para
  todos los valores (groupBy en memoria), resultado idéntico.
- **FR-004**: Se DEBE revisar y eliminar cualquier otro N+1 real en el módulo
  (`notificarCambioCirculoSiCorresponde`, `obtenerVistaAgregada`); si el "N+1" es un
  loop legítimo de envío de emails (no de queries), se documenta y queda.
- **FR-005**: Comportamiento preservado: suite completa verde SIN tocar expectativas;
  el test del módulo (423 líneas) se reorganiza solo si la estructura lo exige, con
  las MISMAS afirmaciones.
- **FR-006**: NO se toca lógica de negocio, ni umbrales, ni consumidores, ni schema.
  Si aparece un defecto real (resultado incorrecto hoy), se PARA y se reporta a ZEUS.

### Key Entities *(include if feature involves data)*

N/A — no cambia schema ni entidades (`ContactoConfianza`, `IdentificadorContacto`,
`Reporte`). Es reorganización de código + reducción de queries.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `circulo-confianza.ts` deja de existir como archivo único; la API pública
  sigue importándose igual (`@/lib/dal/services/circulo-confianza`).
- **SC-002**: `listarContactos` ejecuta ≤ 3 queries independientemente de N (test).
- **SC-003**: Suite completa + `tsc --noEmit` + lint + build + `arch:check` verdes sin
  tocar expectativas existentes.
- **SC-004**: Ningún archivo de la carpeta > ~250 líneas.

## Assumptions

- El barrel mantiene la ruta de import (`…/services/circulo-confianza`) — TypeScript
  resuelve `circulo-confianza/index.ts` transparente para los consumidores.
- El N+1 de `listarContactos` es el único de queries del módulo (a verificar en
  implementación; FR-004 cubre el resto).
- Partir el archivo NO es cambiar comportamiento: misma lógica, misma firma, distinto
  archivo.

## Impacto en arquitectura

Impacto en arquitectura: reorganización interna de `src/lib/dal/services/` (un archivo
→ carpeta con barrel) + reducción de queries en `listarContactos`. NO toca schema,
rutas, proxy, navegación ni stack; `arch:check` no debería requerir regeneración.

## Implementación (cierre)

Implementada el 2026-08-01 en `feature/001-scaffolding` (APROBADA por ZEUS en el prompt
único de BANDA 2, reglas 1-7).

- **Split (FR-001/FR-002)**: 864 L → carpeta `circulo-confianza/` con `tipos.ts` (43),
  `estado.ts` (98), `contactos.ts` (167), `contactos-mutaciones.ts` (247 — desviación
  menor del plan: juntar mutaciones con lecturas daba ~390 L; se separaron para
  respetar el límite), `agregado.ts` (209), `preferencias.ts` (21), `notificaciones.ts`
  (173) + `index.ts` barrel (14 exports). Consumidores y test existente sin tocar una
  línea (el import resuelve al barrel).
- **N+1 (FR-003/FR-004)**: TRES N+1 reales eliminados y candados con tests de conteo
  (`circulo-confianza-n1.test.ts`, 4 tests, Proxy transparente sobre el client):
  `listarContactos` 2+2N → 2 queries; `notificarCambioCirculoSiCorresponde` 1 query de
  novedades por usuario → 1 global (el loop restante son envíos de email + timestamp,
  documentado — no es N+1 de lectura); `obtenerDetalleContacto` 2+N → 3 constantes
  (estado por identificador derivado del mismo arreglo, misma equivalencia por
  construcción). `obtenerVistaAgregada` no tenía N+1 (verificado).
- **Regla 1**: cero tests existentes tocados; 16 del módulo + 8 route tests + journeys
  verdes. **Regla 2**: el N+1 de `obtenerDetalleContacto` se reportó y se confirmó en
  alcance (FR-004 cubre "cualquier otro N+1 real en el módulo").
- **Gates**: suite completa + cobertura, tsc, lint, build y arch:check verdes.
