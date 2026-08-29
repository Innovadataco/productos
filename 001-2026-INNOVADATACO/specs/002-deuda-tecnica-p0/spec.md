# Feature Specification: Deuda técnica P0

**Feature Branch**: `002-deuda-tecnica-p0`

**Created**: 2026-07-22

**Status**: **Terminada (ACTA-VALIDACION 002, 2026-07-23)**. Aprobada por ZEUS (arquitecto)
y Jelkin (CEO) el 2026-07-22 (plan y tasks aprobados el mismo día). El acta lleva fe de
erratas: el criterio 3 se dio por bueno con la suite verde mientras el type check seguía
roto; el gate es `npx tsc --noEmit`, no `npm run build`.

**Input**: User description: "Deuda técnica P0 (alcance decidido por ZEUS):
(a) harness de tests — vitest carga variables de entorno y el test de login queda
verde con fixture/mocks de BD, cerrando el fallo preexistente D-013; (b) contrato
de errores — ninguna ruta API filtra err.message crudo al cliente, respuesta de
error normalizada única, con tests; (c) tipado — eliminar los `any` de src/lib y de
las rutas API, con conteo medible antes/después; (d) cobertura — test Vitest para
cada ruta API crítica sin cobertura (auth, licitaciones, documents, config,
research)."

## Contexto y estado medido

Mediciones reales del repositorio a **2026-07-22** (baseline verificable, no estimado):

| Métrica | Valor actual | Comando de medición |
|---|---|---|
| `any` en `src/lib` (sin tests) | **5** | `grep -rnE ":\s*any\b\|<any>\|as any\|\bany\[\]" src/lib --include="*.ts" \| grep -v ".test.ts" \| wc -l` |
| `any` en rutas API (sin tests) | **29** | igual, sobre `src/app/api` |
| `any` totales en `src` (sin tests) | **62** | igual, sobre `src` (incluye `.tsx`) |
| Rutas API (`route.ts`) | **20** | `find src/app/api -name "route.ts" \| wc -l` |
| Archivos de test de rutas API | **3** | `find src/app/api -name "*.test.ts" \| wc -l` |
| Rutas API que exponen `err.message` al cliente | **13** archivos | `grep -rln "err.message\|error.message" src/app/api --include="route.ts"` |
| Suite Vitest | 13 tests verdes, **1 archivo en rojo** | `npm run test` |
| ESLint | **112 problemas** (90 errores + 22 warnings) | `npm run lint` |

Los 13 archivos que filtran `err.message` al cliente son: `research/analyze`,
`config/apis/[id]/test`, `config/models`, `config/models/discover`,
`config/models/test`, `config/models/[id]`, `config/module-settings`, `auth/login`,
`licitaciones`, `licitaciones/estados`, `licitaciones/[id]`,
`licitaciones/entidades`, `projects`.

Esta deuda **contradice la constitución vigente**: §0.2 (toda ruta API con test
Vitest, suite verde antes de commit), §0.3 (prohibido `any`; errores normalizados
sin filtrar `err.message` crudo) y §2.4. La spec 001 dejó además dos deudas
explícitas: el fallo preexistente del test de login (research 001 → **D-013**) y la
imposibilidad de correr la suite sin BD viva.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Suite unitaria ejecutable sin infraestructura (Priority: P1)

Como desarrollador o agente, quiero ejecutar `npm run test` y obtener una suite
**verde y determinista** sin necesidad de levantar la BD ni configurar secretos a
mano, para que el gate de commit de la constitución (§0.2) sea real y no aspiracional.

**Why this priority**: hoy el gate "suite verde antes de commit" es inaplicable —
hay un archivo permanentemente rojo. Mientras eso siga así, cualquier regresión
futura se confunde con el fallo conocido. Todo lo demás se apoya en esta base.

**Independent Test**: en un clon limpio sin BD levantada, `npm run test` termina en
verde.

**Acceptance Scenarios**:

1. **Given** un clon limpio sin contenedores levantados y sin `.env`, **When** se
   ejecuta `npm run test`, **Then** la suite termina con exit code 0 y ningún
   archivo en rojo.
2. **Given** la suite de tests, **When** un test necesita variables de entorno
   (p. ej. `JWT_SECRET`), **Then** las obtiene de una configuración de entorno de
   test versionada **sin secretos reales** (valores dummy), no del `.env` local.
3. **Given** `src/app/api/auth/login/route.test.ts`, **When** se ejecuta,
   **Then** pasa usando fixture/mocks de BD, sin abrir conexión a PostgreSQL.
4. **Given** el `.env` local de desarrollo, **When** se ejecuta la suite,
   **Then** los valores reales del `.env` no son requeridos ni se filtran a los
   tests (aislamiento entre entorno de test y entorno de desarrollo).

---

### User Story 2 - Errores de API que no filtran interioridades (Priority: P1)

Como responsable de seguridad, quiero que ninguna respuesta de error de la API
incluya `err.message` crudo, stack traces ni detalles internos, y que todas las
rutas usen una **única forma normalizada** de error, para cumplir §0.3 y no exponer
estructura interna del sistema a un cliente potencialmente hostil.

**Why this priority**: es una fuga de información activa en 13 rutas y una
violación directa de la constitución. Riesgo de seguridad, no solo de estilo.

**Independent Test**: forzar un error en cada ruta y verificar que el cuerpo de la
respuesta contiene solo el contrato normalizado, mientras el detalle aparece en los
logs del servidor.

**Acceptance Scenarios**:

1. **Given** cualquier ruta API, **When** ocurre un error interno, **Then** la
   respuesta al cliente contiene únicamente los campos del contrato normalizado
   (mensaje legible + código), sin `err.message`, sin `details` crudos y sin stack.
2. **Given** ese mismo error, **When** se inspecciona el log del servidor,
   **Then** el detalle técnico completo sí está registrado con el formato
   `[Módulo] Acción: resultado — detalle` (constitución §2.5).
3. **Given** el conjunto de rutas API, **When** se buscan filtraciones
   (`grep -rn "err.message\|error.message" src/app/api --include="route.ts"`
   sobre respuestas al cliente), **Then** el resultado es **0 rutas** que lo
   devuelvan en la respuesta.
4. **Given** los códigos HTTP de la constitución §2.4, **When** se revisan las
   rutas migradas, **Then** cada situación devuelve el código correcto
   (400/401/403/404/413/429/500/502/503) y no un 500 genérico.

---

### User Story 3 - Tipado estricto real en lib y rutas API (Priority: P2)

Como mantenedor, quiero **cero `any`** en `src/lib` y en las rutas API, para que el
compilador detecte los errores que hoy se escapan y para que §0.3 sea verificable
con un número, no con una opinión.

**Why this priority**: alto valor de mantenibilidad, pero sin el riesgo inmediato
de seguridad de US2 ni el efecto bloqueante de US1.

**Independent Test**: el comando de conteo devuelve 0 en `src/lib` y `src/app/api`,
y `npm run build` sigue compilando.

**Acceptance Scenarios**:

1. **Given** el código migrado, **When** se cuenta `any` en `src/lib` (excluyendo
   tests), **Then** el resultado es **0** (baseline: 5).
2. **Given** el código migrado, **When** se cuenta `any` en `src/app/api`
   (excluyendo tests), **Then** el resultado es **0** (baseline: 29).
3. **Given** los filtros dinámicos de Prisma, **When** se revisan las rutas,
   **Then** usan tipos de Prisma (`Prisma.XWhereInput`) y no `any`
   (constitución §2.2).
4. **Given** el proyecto migrado, **When** se ejecutan `npm run build` y
   `npm run test`, **Then** ambos terminan en verde (sin regresiones).
5. **Given** ESLint, **When** se ejecuta `npm run lint`, **Then** el número de
   errores `@typescript-eslint/no-explicit-any` es **0** y el total de problemas es
   estrictamente menor que el baseline de 112.

---

### User Story 4 - Cobertura de las rutas API críticas (Priority: P2)

Como equipo, quiero que cada ruta API crítica tenga su archivo de test Vitest, para
que un cambio futuro no rompa silenciosamente auth, licitaciones, documents, config
o research.

**Why this priority**: es la red de seguridad que hace sostenibles US2 y US3; se
apoya en el harness de US1, por eso va después.

**Independent Test**: cada ruta del listado tiene su `route.test.ts` y la suite
completa pasa sin BD viva.

**Acceptance Scenarios**:

1. **Given** los módulos críticos, **When** se listan sus rutas, **Then** cada una
   tiene un archivo de test asociado que cubre, como mínimo: caso feliz,
   rechazo por falta de autenticación (401) y validación de input inválido (400).
2. **Given** la suite completa, **When** se ejecuta en un entorno sin BD,
   **Then** pasa en verde (los tests usan mocks/fixtures, coherente con US1).
3. **Given** el conteo de archivos de test de rutas API, **When** se mide al
   cerrar la spec, **Then** es **≥ 15** (baseline: 3) cubriendo los módulos
   auth, licitaciones, documents, config y research.

### Edge Cases

- ¿Qué pasa si una ruta necesita datos reales de BD para tener sentido (p. ej.
  búsquedas con `pgvector`)? → Se cubre con mocks del cliente Prisma en la suite
  unitaria; las pruebas que exijan BD real se marcan como suite de integración
  separada y **no** bloquean `npm run test`.
- ¿Qué pasa si eliminar un `any` revela un bug latente de tipos? → Se corrige el
  bug si es trivial; si implica cambio de comportamiento, se documenta y se
  escala a ZEUS en vez de silenciarlo con un cast.
- ¿Qué pasa con los `any` fuera de `src/lib` y `src/app/api` (componentes `.tsx`,
  ~28 restantes)? → Fuera del alcance de esta spec; quedan para una spec posterior.
- ¿Y si normalizar un error cambia el contrato que consume el frontend? → Los
  componentes que lean `details`/`message` crudos deben ajustarse en la misma
  spec; ninguna pantalla puede quedar mostrando "undefined".
- ¿Cómo se evita que la deuda vuelva a entrar? → El gate de commit (suite verde +
  conteo de `any` = 0 en las zonas saneadas) queda documentado; hacerlo automático
  (CI/hook) es candidato a spec propia, fuera de este alcance.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La configuración de Vitest MUST cargar variables de entorno para los
  tests desde una fuente versionada **sin secretos reales** (valores dummy), de modo
  que la suite no dependa del `.env` local del desarrollador.
- **FR-002**: `src/app/api/auth/login/route.test.ts` MUST pasar en verde **sin
  conexión a PostgreSQL**, usando fixture o mock del cliente Prisma. Cierra el
  fallo preexistente documentado en la constitución §8.1 y en la spec 001 (D-013).
- **FR-003**: `npm run test` MUST terminar con exit code 0 y **cero archivos en
  rojo** en un entorno sin BD levantada y sin `.env`.
- **FR-004**: Ninguna respuesta de error de ninguna ruta API MUST incluir
  `err.message` crudo, `details` con texto de excepción, ni stack traces. El
  detalle técnico MUST registrarse solo en logs del servidor.
- **FR-005**: MUST existir una **única** forma normalizada de respuesta de error,
  usada por todas las rutas API (helper compartido), con los códigos HTTP de la
  constitución §2.4.
- **FR-006**: MUST existir tests que verifiquen FR-004 y FR-005: al forzar un
  error, la respuesta contiene solo el contrato normalizado.
- **FR-007**: El conteo de `any` (excluyendo archivos de test) MUST ser **0** en
  `src/lib` (baseline 5) y **0** en `src/app/api` (baseline 29).
- **FR-008**: Los filtros dinámicos de Prisma MUST tiparse con los tipos generados
  (`Prisma.XWhereInput`), conforme a la constitución §2.2.
- **FR-009**: Cada ruta API de los módulos críticos (auth, licitaciones, documents,
  config, research) MUST tener archivo de test Vitest cubriendo al menos: caso
  feliz, 401 sin autenticación y 400 con input inválido. El número de archivos de
  test de rutas API MUST ser **≥ 15** (baseline 3).
- **FR-010**: `npm run build` y `npm run lint` MUST ejecutarse sin regresiones: el
  total de problemas de ESLint MUST ser **< 112** (baseline) y los errores
  `@typescript-eslint/no-explicit-any` MUST ser **0**.
- **FR-011**: Ningún cambio de esta spec MUST alterar el comportamiento funcional
  observable de la aplicación (es saneamiento, no funcionalidad nueva): las rutas
  MUST seguir devolviendo los mismos datos en los casos de éxito.
- **FR-012**: Ningún cambio de esta spec MUST tocar archivos, contenedores,
  volúmenes o puertos de `002-2026-PROTECCION-INFANTIL` ni `003-2026-SICOV-OTPC`
  (ADR_002; puertos 5005/5433/5010/5434 intocables).

### Key Entities

- **Helper de errores API**: módulo único que construye la respuesta de error
  normalizada (mensaje legible + código HTTP) y registra el detalle en logs.
- **Configuración de entorno de test**: fuente versionada de variables dummy para
  Vitest (sin secretos reales), aislada del `.env` de desarrollo.
- **Fixtures/mocks de Prisma**: utilidades de test que permiten ejercitar rutas sin
  BD viva.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `npm run test` termina en verde (exit 0, 0 archivos fallidos) en un
  entorno sin BD ni `.env`. Baseline: 1 archivo en rojo.
- **SC-002**: `grep -rln "err.message\|error.message" src/app/api --include="route.ts"`
  no reporta ninguna ruta que devuelva ese valor al cliente. Baseline: 13 archivos.
- **SC-003**: Conteo de `any` = **0** en `src/lib` (baseline 5) y **0** en
  `src/app/api` (baseline 29), medido con el comando de la tabla de contexto.
- **SC-004**: Archivos de test de rutas API **≥ 15** (baseline 3), cubriendo los
  cinco módulos críticos.
- **SC-005**: `npm run lint` reporta **< 112** problemas totales y **0** errores
  `no-explicit-any`. Baseline: 112 (90 errores + 22 warnings).
- **SC-006**: `npm run build` compila sin errores.
- **SC-007**: Las rutas saneadas devuelven, en casos de éxito, exactamente los
  mismos datos que antes de la spec (sin regresión funcional observable).
- **SC-008**: Los puertos 5005/5433/5010/5434 permanecen sin cambios (PI y SICOV
  intactos).

## Assumptions

- La suite unitaria usa **mocks/fixtures**; no se introduce una BD de test
  dedicada en esta spec (si más adelante se quiere suite de integración con BD
  real, será spec aparte).
- Las variables de entorno de test llevan valores dummy versionables (p. ej. un
  `JWT_SECRET` de 32+ caracteres claramente falso); no se commitea ningún secreto
  real, coherente con la spec 001 y §0.4.
- El alcance de tipado se limita a `src/lib` y `src/app/api`. Los ~28 `any`
  restantes en componentes `.tsx` quedan fuera y se tratarán después.
- El módulo Financials sigue permanentemente fuera de scope (constitución §1.2).
- Esta spec **no se implementa** hasta ser aprobada por ZEUS y Jelkin (§0.1); el
  plan (`/speckit-plan`) se ejecutará tras la aprobación.

## Out of Scope

- `any` en componentes React (`.tsx`) y en scripts (`scripts/*.mjs`).
- Suite de integración contra BD real; automatización en CI de los gates.
- Migración a Zod para validación de inputs (constitución §5.2) — spec aparte.
- Rate limiting (§5.4), paginación pendiente (§3.3) y demás deuda no listada aquí.
- Pipeline de embeddings/RAG (hallazgo H-05 de la spec 001) — spec aparte.
- Cualquier cambio en 002-Protección Infantil o 003-SICOV.
