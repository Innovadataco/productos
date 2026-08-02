# Feature Specification: SPEC-136 — Tipado estricto: `as unknown as` ×29, `!.` ×15, tsconfig maximal viable (E-3)

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-08-01

**Status**: IMPLEMENTADO

**Input**: Instructivo 002-PI-056 (BANDA 2, ítem E-3; radica ZEUS). Reverificado en
fuente 2026-08-01 (los conteos de julio cambiaron): **`as unknown as` = 29** (eran 27;
+2 vinieron de SPEC-132, `carga-roster-sesion.ts`), concentrados en el motor:
`reporte-processing/clasificacion.ts` (10), `ia-evals.ts` (8), `pdf-estadisticas.ts`
(3), `test-setup.ts` (2), `carga-roster-sesion.ts` (2), y 4 sueltos. **`!.` = 15**
(eran 13), en 9 archivos. **tsconfig maximal — costo medido en fuente**:
`noFallthroughCasesInSwitch` 0 errores, `noImplicitOverride` 1,
`exactOptionalPropertyTypes` 120, `noPropertyAccessFromIndexSignature` 326,
`noUncheckedIndexedAccess` 565.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Cero `as unknown as` en producto (Priority: P1)

Como responsable de ingeniería, quiero reemplazar los 29 `as unknown as` por tipos
reales (genéricos, type guards, `satisfies`, DTOs de Prisma), de modo que el motor y el
DAL queden bajo la disciplina estricta que AGENTS.md exige y un cambio de schema rompa
en compile-time, no en runtime.

**Why this priority**: `as unknown as` apaga el chequeo de tipos exactamente donde más
importa (clasificación del motor, 10; evals, 8). Es deuda que esconde bugs.

**Independent Test**: `grep -rn "as unknown as" src` (sin tests) = 0; `tsc --noEmit`
y la suite verdes sin tocar expectativas.

**Acceptance Scenarios**:

1. **Given** `clasificacion.ts` e `ia-evals.ts`, **When** se leen, **Then** los casts
   dobles son tipos derivados de Prisma/Zod o guards con `unknown` + narrowing.
2. **Given** un cast que resulte INEVITABLE (interop realmente opaca), **When** se
   documenta, **Then** queda con `// TODO(any): justificación` según AGENTS.md y se
   cuenta en el reporte (objetivo 0; tope 2 justificados).

---

### User Story 2 — Guardas para los 15 `!.` (Priority: P1)

Como responsable de calidad, quiero que cada `!.` se reemplace por una guarda que
falle controlado (AppError/early return/narrowing), de modo que un null inesperado sea
un error legible y no un crash opaco.

**Why this priority**: `reporte.clasificacion!.id` (correcciones) o `acreditacion!`
(apelaciones) crashean feo si la invariante se rompe; la guarda documenta la invariante.

**Independent Test**: `grep -rn "!\." src` (sin tests) = 0; suite verde; las rutas
afectadas conservan sus respuestas (route tests).

**Acceptance Scenarios**:

1. **Given** cada sitio con `!.`, **When** la invariante se cumple, **Then** el
   comportamiento es idéntico; **When** se viola, **Then** hay error controlado (4xx/500
   con código canónico) en vez de TypeError.
2. **Given** los 5 `cuenta!.id` del mismo componente, **When** se resuelven, **Then**
   es con un narrowing compartido (early return/guard), no 5 guards duplicados.

---

### User Story 3 — tsconfig maximal viable (Priority: P2)

Como responsable de ingeniería, quiero activar el conjunto maximal VIABLE de flags
estrictos con los errores resultantes corregidos, dejando documentado qué se difiere y
por qué, de modo que el nivel de tipado suba sin un big-bang de 900 errores.

**Why this priority**: P2 — sube el piso, pero `noUncheckedIndexedAccess` (565) y
`noPropertyAccessFromIndexSignature` (326) son proyectos propios.

**Independent Test**: `tsc --noEmit` verde con los flags nuevos activos en
`tsconfig.json`; la lista de flags diferidos documentada con su conteo.

**Acceptance Scenarios**:

1. **Given** `tsconfig.json`, **When** corre `tsc`, **Then** pasan activos:
   `noFallthroughCasesInSwitch` (0 errores), `noImplicitOverride` (1),
   `forceConsistentCasingInFileNames` y `exactOptionalPropertyTypes` (120 corregidos).
2. **Given** `noUncheckedIndexedAccess` (565) y `noPropertyAccessFromIndexSignature`
   (326), **When** se evalúan, **Then** quedan documentados como DIFERIDOS con su
   conteo en la spec (radicables como ítem aparte si ZEUS lo decide).

---

### Edge Cases

- El motor (`clasificacion.ts`) parsea JSON de Ollama: el tipo correcto es Zod o guard
  sobre `unknown`, no interfaces optimistas (regla 7: NO cambiar la lógica del motor,
  solo su tipado).
- `test-setup.ts` no es producto pero sí suite: se tipa igual (es de la misma
  disciplina; sus casts son 2).
- `exactOptionalPropertyTypes` cambia la semántica de `{ x: undefined }` vs `{}`:
  revisar que los fixes no alteren payloads de API (route tests como red).
- Flags nuevos vs Next.js: verificar que el build de Next acepta el tsconfig (build verde).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `as unknown as` en `src` (excl. tests) DEBE quedar en 0 (tope: 2 con
  `// TODO(any): justificación` documentada en la spec de cierre).
- **FR-002**: `!.` en `src` (excl. tests) DEBE quedar en 0; cada sitio con guarda o
  narrowing (errores controlados con códigos canónicos donde aplique).
- **FR-003**: `tsconfig.json` DEBE activar `noFallthroughCasesInSwitch`,
  `noImplicitOverride`, `forceConsistentCasingInFileNames` y
  `exactOptionalPropertyTypes`, con los errores resultantes corregidos.
- **FR-004**: `noUncheckedIndexedAccess` y `noPropertyAccessFromIndexSignature` DEBEN
  quedar documentados como diferidos (conteo incluido) — NO se activan en esta spec.
- **FR-005**: Comportamiento preservado: suite + journeys verdes SIN tocar
  expectativas; la lógica del motor NO cambia (solo tipos).
- **FR-006**: Si al tipar se descubre un bug real (p.ej. un cast que ocultaba un caso
  no manejado), se PARA y se reporta a ZEUS (regla 2 del prompt único).

### Key Entities *(include if feature involves data)*

N/A — no cambia schema ni entidades; es tipado del código existente.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `grep -c "as unknown as"` (sin tests) = 0 (o ≤ 2 justificados);
  `grep -c "!\."` (sin tests) = 0.
- **SC-002**: `tsc --noEmit` verde con los 4 flags nuevos activos.
- **SC-003**: Suite completa + lint + build + `arch:check` verdes; piso de cobertura
  intacto.
- **SC-004**: El cierre documenta: casts eliminados por archivo, flags activados y los
  2 diferidos con su conteo.

## Assumptions

- El motor se TIPA pero no se toca su lógica (candado global del 056: el motor solo se
  toca si el ítem lo dice — E-3 dice "tipar el motor", no cambiarlo).
- Los `!.` en tests quedan fuera (disciplina de tests aparte; el grep de control excluye
  `*.test.*`).
- `exactOptionalPropertyTypes` (120 errores) es asumible en esta spec; los otros dos
  flags grandes no (contados y diferidos).

## Impacto en arquitectura

Impacto en arquitectura: tipado y tsconfig — no toca schema, rutas, proxy ni
navegación; `arch:check` no debería requerir regeneración (`06-stack.md` lista
"TypeScript 5 strict" — actualizar la mención a los flags si el generador la deriva).

## Implementación (cierre)

Implementada el 2026-08-01 en `feature/001-scaffolding` (APROBADA por ZEUS; E-3b
diferido: `noUncheckedIndexedAccess` 565 y `noPropertyAccessFromIndexSignature` 326,
radicable aparte).

- **Casts (`ac6f2339`)**: 29/29 eliminados, 0 justificados. Motor tipado con tipos
  reales (ensanchado honesto de `ClasificacionResult`, guards `in`, Json con el helper
  nuevo `src/lib/dal/json.ts` — `aJson()`/`esJsonValue`); evals con guards Zod
  tolerantes (bloques opcionales, mismo nivel que el cast previo); roster con
  `filasRosterSchema.parse`; pdfmake con `declare module` augmentation (runtime
  idéntico — el route test del PDF cazó la hipótesis falsa inicial del vfs);
  `prisma.ts` con `declare global` canónico.
- **Guards (`378af084`)**: 15/15. Narrowing compartido en GestionPageClient; invariantes
  de BD con AppError canónico (correcciones 409, configuracion 404, simulaciones 400).
  Hallazgo: TypeError latente en `configuracion.ts` (crear parámetro sin defaults y sin
  `categoria` → 500) ahora 404 controlado — camino que ningún test ejercitaba; único
  cambio de comportamiento en camino de error, endurecimiento documentado.
- **tsconfig (`553d59e3`)**: 4 flags activos; 122 errores corregidos (ensanchar
  `| undefined` ~55, conditional spreads ~45, narrowing local). 1 `@ts-expect-error`
  justificado (executor de simulación: el test afirma la FORMA del argumento con claves
  `undefined` presentes — imposible satisfacer ambos sin tocar el test). 18 fixes
  mecánicos en código de SIEMBRA/REQUEST de 15 archivos de test (`?? null` ≡ campo
  omitido en FK nullable; conditional spread en helpers) — **cero aserciones tocadas**;
  estaban dentro del conteo de ~120 aprobado. Verificado: esos 16 archivos / 120 tests
  verdes.
- **Gates**: `tsc --noEmit` 0 errores con los 4 flags (src + tests), lint, build,
  arch:check verdes; greps de control (`as unknown as`, `!.`) en 0.
