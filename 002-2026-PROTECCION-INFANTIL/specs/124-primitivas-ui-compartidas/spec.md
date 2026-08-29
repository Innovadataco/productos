# Feature Specification: SPEC-124 — Primitivas UI compartidas (R7)

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-07-29

**Status**: FINALIZADO (ver `cierre.md`)

**Input**: Cola nocturna 002-PI-041, FASE 3, bloque R7 (ZEUS). Deuda D-37: cada
pantalla resuelve por su cuenta cómo pide datos y cómo dibuja una tabla, una
tarjeta de métrica, una alerta o un "cargando". Cada arreglo de interfaz hay que
hacerlo ~20 veces y siempre se olvida una.

## Restricciones del bloque (no negociables)

- Solo se toca `src/components/**` y páginas (`src/app/**/page.tsx` y sus
  componentes de página). NUNCA `src/app/api/**` ni `src/lib/**`.
- **NO se tocan las pantallas de Colegios ni de Comité** (el CEO las está
  probando): quedan fuera `src/components/modules/Comite*`,
  `src/components/modules/colegio/**`, `src/app/dashboard/colegio/**`,
  `src/app/dashboard/admin/colegios/**` y `src/app/dashboard/admin/comite/**`.
- Método ADITIVO: primero las primitivas (commit propio con tests), después
  pantalla por pantalla (un commit por pantalla, sin dejar ninguna a medias).
- Tailwind como úNICA fuente de estilos. Sin ablandar tests. Sin push.

## User Stories

### US1 — Primitivas compartidas en `src/components/ui/` (Priority: P1)

Como mantenedor, quiero primitivas `Tabla`, `TarjetaMetrica`, `Alerta`,
`Cargando` y un hook client de datos (`useFetchJson`) en
`src/components/ui/`, para que el arreglo de un patrón se haga una sola vez.

**Acceptance Scenarios**

1. **Dado** el patrón de tabla copy-paste (`<table className="w-full text-left
   text-sm">` + thead/tbody homogéneos), **cuando** una pantalla usa `Tabla`,
   **entonces** renderiza el mismo marcado y clases que el patrón manual.
2. **Dado** las 4 implementaciones duplicadas de tarjeta de métrica,
   **cuando** se usa `TarjetaMetrica`, **entonces** se conservan textos, datos
   y disposición visual de cada variante original.
3. **Dado** las cajas de alerta inline (`bg-red-50`, `bg-emerald-50`,
   `bg-amber-50`...), **cuando** se usa `Alerta`, **entonces** mantiene tono,
   texto y `role="alert"` accesible.
4. **Dado** los ~25 spinners "Cargando..." duplicados, **cuando** se usa
   `Cargando`, **entonces** mantiene texto visible y anuncio accesible
   (`role="status"`).
5. **Dado** el hook `useFetchJson`, **cuando** una pantalla lo usa, **entonces**
   entrega `{ datos, cargando, error, recargar }` sin repetir la máquina de
   estados del fetch.
6. **Dado** cada primitiva, **cuando** corre `vitest`, **entonces** tiene su
   propio test de componente en `src/components/ui/*.test.tsx`.

### US2 — Migración de pantallas frías (Priority: P1)

Como mantenedor, quiero que las pantallas frías (nunca Colegios ni Comité)
usen las primitivas, con un commit por pantalla y verificación de que renderiza
lo mismo (mismos textos/datos visibles).

**Acceptance Scenarios**

1. **Dado** una pantalla migrada, **cuando** se comparan antes/después,
   **entonces** los textos y datos visibles son idénticos y sus tests de
   componente existentes siguen pasando sin ablandarse.
2. **Dado** una pantalla en zona prohibida (Colegios/Comité), **cuando** se
   revisa el diff, **entonces** no aparece tocada.
3. **Dado** el fin del bloque, **cuando** se reporta, **entonces** se lista
   qué pantallas se migraron y cuántas quedan pendientes (parcial y
   consistente es resultado esperado).

## Functional Requirements

- **FR-001**: El sistema DEBE proveer `Tabla` (contenedor `glass` + scroll-x +
  `<table>` con clases canónicas) y subcomponentes `TablaHead`/`TablaBody` en
  `src/components/ui/Tabla.tsx`, cubriendo las dos variantes de encabezado
  observadas (relleno y borde).
- **FR-002**: El sistema DEBE proveer `TarjetaMetrica` en
  `src/components/ui/TarjetaMetrica.tsx` con disposiciones `centrada` (valor
  arriba, estilo `modules/MetricCard`) y `panel` (etiqueta arriba, estilo
  AdminDashboard), soporte de `tone` ("up"/"down"), `suffix`, `sub` y `mono`.
- **FR-003**: El sistema DEBE proveer `Alerta` en
  `src/components/ui/Alerta.tsx` con tonos `error`, `exito`, `advertencia`,
  `info` y rol accesible.
- **FR-004**: El sistema DEBE proveer `Cargando` en
  `src/components/ui/Cargando.tsx` con formas centrada e inline, tamaños y
  texto configurable.
- **FR-005**: El sistema DEBE proveer `useFetchJson` en
  `src/components/ui/use-fetch-json.ts` (hook client: datos/cargando/error/
  recargar).
- **FR-006**: Cada primitiva DEBE tener tests de componente (Vitest + Testing
  Library) en el primer commit, sin migrar nada todavía.
- **FR-007**: Cada pantalla migrada DEBE ir en su propio commit y sus tests
  existentes DEBEN pasar sin modificarse (salvo actualización de imports si
  aplica).
- **FR-008**: `modules/MetricCard.tsx` y las copias locales de `MetricCard`
  DEBEN eliminarse de las pantallas migradas (sus importadores pasan a
  `TarjetaMetrica`).
- **FR-009**: NO se DEBE tocar ninguna pantalla de Colegios ni de Comité, ni
  rutas API, ni libs.

## Success Criteria

- **SC-001**: Las 5 primitivas existen con tests verdes y commit propio.
- **SC-002**: Al menos 8 pantallas frías migradas, un commit por pantalla,
  suite de tests tocados verde en cada paso.
- **SC-003**: `npx tsc --noEmit`, `npm run lint`, tests y `npm run build`
  verdes bajo candado de gate al final.
- **SC-004**: Reporte con lista de migradas y pendientes.

## Assumptions

- Las pantallas de Colegios y Comité conservarán sus copias locales; su
  migración queda como deuda explícita para cuando el CEO termine sus pruebas.
- Los componentes `src/components/modules/ia/**` tienen su propio
  `MetricCard` especializado (baseline/formato pct); queda fuera de alcance.
- La paridad exigida es de contenido (textos/datos visibles); clases Tailwind
  quedan normalizadas a las canónicas de la primitiva.

## Implementación

Cerrada el 2026-07-29. Primitivas en `src/components/ui/` (`Tabla`,
`TarjetaMetrica`, `Alerta`, `Cargando`, `useFetchJson`) con 21 tests
propios (commit `15c99f2f`). 28 pantallas/archivos migrados en 12 commits
posteriores (`6b0ffbf6`…`c6a64e61`), uno por pantalla/lote, con los tests
de componente existentes verdes sin modificarlos. `modules/MetricCard.tsx`
eliminado (commit `73b96c2f`). Detalle, pendientes y evidencia del gate en
`cierre.md`. Deuda: pantallas de Colegios y Comité (zona en prueba por el
CEO), `modules/ia/**` y copias sueltas listadas en `cierre.md`.
