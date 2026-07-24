# Feature Specification: Hotfix de validación funcional

**Feature Branch**: `004-hotfix-validacion-funcional`

**Created**: 2026-07-23

**Status**: **Terminada (ACTA-VALIDACION 003, 2026-07-23)**.

> Corregido en el turno D-068: la spec seguía marcada `Draft` cuando llevaba terminada
> desde el 2026-07-23. Es la spec que **desbloqueó la Regla de Oro 4** para las actas 001 y
> 002, así que dejarla en `Draft` contradecía a otras dos actas, no solo a la suya.

**Input**: Cuatro defectos detectados durante la validación funcional (incidencias
**I-004, I-005, I-006, I-007**) que bloquean la **Regla de Oro 4**. Restricciones de
diseño fijadas por ZEUS (D-033, D-035), no negociables.

## Contexto: accesible ≠ probable

La aplicación responde **HTTP 200 en `http://localhost:5001`**, así que el criterio de
"accesible" se cumple en apariencia. Pero **no es probable**: el CEO no puede iniciar
sesión de forma útil, no hay datos con los que operar y la función de descubrir modelos
falla. Un despliegue que no se puede ejercitar no satisface la Regla de Oro 4.

Este hotfix entra como **spec propia** y no como excepción a §0.1: la Regla de Oro 1 no
admite atajos "por obvio" (D-035).

### Evidencia verificada (2026-07-23)

Los cuatro defectos se confirmaron leyendo el código y consultando la base de datos en
ejecución; no se dan por buenos los reportes.

| Inc. | Defecto | Evidencia directa |
|---|---|---|
| **I-004** | La UI impone un literal de `baseUrl` | `src/app/configuracion/page.tsx:102` (`baseUrl: "http://localhost:11434"` como valor inicial del formulario) y `:289` (`form.baseUrl \|\| "http://localhost:11434"` al invocar *Descubrir*). El literal viaja como parámetro explícito y **tiene precedencia sobre todo lo demás**: dentro del contenedor `localhost` es el contenedor mismo → `fetch failed` |
| **I-005** | La cookie de sesión se marca `Secure` a partir de `NODE_ENV` | `src/app/api/auth/login/route.ts:29`: `secure: process.env.NODE_ENV === "production"`. El `Dockerfile:26` fija `ENV NODE_ENV production`, pero el servicio se consume por `http://localhost:5001`. Safari descarta cookies `Secure` sobre `http` → login responde 200 sin sesión utilizable |
| **I-006** | No existe seed de los catálogos | `scripts/seedApis.mjs` siembra **solo** `AgentApi`; `scripts/seedUser.mjs` **solo** `User`. **No existe** ningún script que siembre `AiModel`, `EntidadLicitacion` ni `LicitacionStatus`. Consulta a la BD viva: `AiModel 0 · AgentApi 0 · EntidadLicitacion 0 · LicitacionStatus 0` |
| **I-007** | `GET /api/projects` no verifica sesión | `src/app/api/projects/route.ts:6-16`: el `GET` no llama a `verifyAuth()`, mientras el `POST` de la misma ruta sí lo exige (`:19-20`) |

### Dos precisiones sobre el alcance real

1. **I-006 no es "volver a ejecutar un seed": es escribirlo.** El seed de esos tres
   catálogos nunca existió. El gap operativo de la spec 001 (D-010, recreación del
   volumen) dejó al descubierto una carencia previa, no rompió algo que funcionaba.
2. **`configuracion/page.tsx:380` no es un defecto.** Ese literal es el `placeholder`
   del campo ("Ej: `http://localhost:11434` para Ollama"): un texto de ayuda, no un
   valor enviado. Debe **conservarse**; solo se corrigen las líneas 102 y 289.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - La sesión persiste en el navegador (Priority: P1)

Como CEO, quiero que al iniciar sesión la sesión se mantenga, para poder usar la
aplicación en lugar de recibir "No autenticado" en cada acción.

**Why this priority**: sin sesión no hay nada que probar. Bloquea la validación completa
de la Regla de Oro 4 y deja inertes los otros tres arreglos.

**Independent Test**: iniciar sesión por `http://localhost:5001` en Safari y ejecutar
después una acción autenticada.

**Acceptance Scenarios**:

1. **Given** la aplicación servida por `http://localhost`, **When** el usuario inicia
   sesión, **Then** el navegador conserva la cookie y las peticiones siguientes se
   reconocen como autenticadas (incluido **Safari**).
2. **Given** la configuración de la bandera `Secure`, **When** no se define valor alguno,
   **Then** el default es **`true`** (seguro por defecto).
3. **Given** el `.env` local con la bandera apagada explícitamente, **When** se sirve por
   `http`, **Then** la cookie se emite sin `Secure` y la sesión funciona.
4. **Given** la resolución de esa bandera, **When** se determina su valor, **Then**
   **no** depende de `NODE_ENV` en ningún caso.
5. **Given** las demás propiedades de la cookie, **When** se emite, **Then** conserva
   `httpOnly` y `sameSite` como hoy: este cambio afecta **solo** a `Secure`.

---

### User Story 2 - Descubrir modelos funciona dentro del contenedor (Priority: P1)

Como administrador, quiero que el botón *Descubrir* liste los modelos de Ollama, para
poder configurar el sistema desde la interfaz.

**Why this priority**: es la puerta de entrada a toda la configuración de IA; sin ella no
se pueden registrar modelos y el módulo queda inservible.

**Independent Test**: pulsar *Descubrir* desde la aplicación en contenedor, sin escribir
nada en el campo de URL.

**Acceptance Scenarios**:

1. **Given** el formulario de modelos recién abierto, **When** se inspecciona el campo de
   URL base, **Then** está **vacío**: la UI no propone ni impone ningún literal.
2. **Given** el campo vacío, **When** se pulsa *Descubrir*, **Then** la petición viaja
   **sin** parámetro `baseUrl` y el backend aplica la precedencia de §0.7 / FR-010 de la
   spec 001 (valor de BD/UI → `OLLAMA_BASEURL` → default), devolviendo los modelos del
   host.
3. **Given** un usuario que escribe una URL propia, **When** se pulsa *Descubrir*,
   **Then** se usa esa URL: el valor explícito sigue mandando.
4. **Given** el campo de URL, **When** se muestra vacío, **Then** conserva su texto de
   ayuda (`placeholder`) indicando el formato esperado.

---

### User Story 3 - Datos semilla reproducibles (Priority: P1)

Como operador, quiero un seed que deje la base utilizable tras recrear el volumen, para
que la aplicación tenga catálogos con los que trabajar sin intervención manual.

**Why this priority**: sin catálogos, licitaciones no tiene entidades ni estados, y
configuración no tiene modelos. La aplicación se ve pero no opera.

**Independent Test**: partir de una base recién migrada y vacía, ejecutar el seed y
comprobar que los cuatro catálogos quedan poblados.

**Acceptance Scenarios**:

1. **Given** una base migrada y vacía, **When** se ejecuta el seed, **Then**
   `AiModel`, `AgentApi`, `EntidadLicitacion` y `LicitacionStatus` quedan con al menos un
   registro cada uno.
2. **Given** una base ya sembrada, **When** se ejecuta el seed **por segunda vez**,
   **Then** el número de registros de cada catálogo **no cambia** y la operación termina
   sin error (idempotencia).
3. **Given** una configuración modificada por el usuario (por ejemplo, un modelo marcado
   como activo o una API desactivada), **When** se vuelve a ejecutar el seed, **Then**
   esa configuración **no se destruye**.
4. **Given** el procedimiento de recreación de volumen, **When** se consulta la
   documentación del proyecto, **Then** el paso de seed está documentado como parte
   obligatoria del arranque limpio.
5. **Given** el seed, **When** se ejecuta, **Then** informa qué creó y qué omitió por ya
   existir.

> **Nota sobre el escenario 3**: el `scripts/seedApis.mjs` actual hace `deleteMany()` y
> luego `createMany()`. Eso es idempotente en el recuento, pero **destruye** cualquier
> ajuste del usuario en cada ejecución. El seed nuevo debe conseguir la idempotencia sin
> borrar.

---

### User Story 4 - El listado de proyectos exige sesión (Priority: P2)

Como responsable de seguridad, quiero que `GET /api/projects` verifique la sesión igual
que su `POST`, para que la información de proyectos no sea accesible sin autenticar.

**Why this priority**: es una fuga de información real, pero de menor alcance que los tres
defectos que impiden usar la aplicación.

**Independent Test**: invocar el listado sin cookie de sesión y con ella.

**Acceptance Scenarios**:

1. **Given** una petición sin sesión válida, **When** se invoca `GET /api/projects`,
   **Then** responde **401** y **no** devuelve datos de proyectos.
2. **Given** una sesión válida, **When** se invoca `GET /api/projects`, **Then** responde
   200 con la misma lista que devolvía antes: sin regresión funcional.
3. **Given** las demás rutas del módulo, **When** se revisan, **Then** el criterio de
   autenticación es coherente entre métodos de la misma ruta.

### Edge Cases

- ¿Qué pasa si la bandera de cookie se define con un valor no booleano ("sí", "1", vacío)?
  → El plan debe fijar cómo se interpreta; ante un valor ambiguo **debe prevalecer el
  comportamiento seguro** (`Secure` activado).
- ¿Y si mañana se sirve por HTTPS? → Basta con no apagar la bandera: el default seguro ya
  es el correcto, sin tocar código.
- ¿Qué pasa si el seed corre contra una base **sin migrar**? → Debe fallar de forma
  explícita indicando que faltan migraciones, no dejar la base a medias.
- ¿Y si el seed se ejecuta concurrentemente (dos veces a la vez)? → No debe producir
  registros duplicados; la unicidad la debe garantizar la base, no el orden de ejecución.
- ¿Qué pasa si Ollama no responde al pulsar *Descubrir*? → Debe informarse con el
  contrato de error de la spec 002 (mensaje legible, **sin** `err.message` crudo).
- ¿El cambio de `GET /api/projects` rompe alguna pantalla que hoy liste proyectos sin
  sesión? → El plan debe verificar los consumidores antes de aplicar el cambio.

## Requirements *(mandatory)*

### Restricciones de ZEUS (no negociables)

- **RZ-1 (I-004)**: la UI **no** impone literal de `baseUrl`. Campo vacío por defecto; la
  precedencia la aplica el **backend** (§0.7 / FR-010 de la spec 001).
- **RZ-2 (I-005)**: la bandera `Secure` de la cookie sale de **configuración propia**, no
  de `NODE_ENV`. Default `true`; se apaga **explícitamente** en el `.env` local (D-033).
- **RZ-3 (I-006)**: seed **reproducible** de `AiModel`, `AgentApi`, `EntidadLicitacion` y
  `LicitacionStatus`. Hoy **no existe**: hay que escribirlo. Idempotente y ejecutable tras
  recrear el volumen.
- **RZ-4 (I-007)**: `GET /api/projects` exige `verifyAuth`, igual que su `POST`.

### Functional Requirements

- **FR-001**: `src/app/configuracion/page.tsx` MUST dejar de imponer
  `http://localhost:11434` como valor: el estado inicial del campo (`:102`) MUST ser
  vacío y la invocación de *Descubrir* (`:289`) MUST NOT sustituir el campo vacío por un
  literal.
- **FR-002**: cuando el campo esté vacío, la petición a `/api/config/models/discover`
  MUST enviarse **sin** el parámetro `baseUrl`, para que el backend aplique la precedencia
  ya implementada (FR-010 de la spec 001).
- **FR-003**: el `placeholder` del campo de URL MUST conservarse (es ayuda visual, no un
  valor).
- **FR-004** *(precisado por D-036)*: la bandera `Secure` de la cookie de sesión MUST
  resolverse desde una **variable de entorno**, con **default `true`**, y MUST NOT
  depender de `NODE_ENV`. MUST NOT leerse de `ModuleSetting` ni de ningún ajuste editable
  desde la interfaz: es una **característica de despliegue, no un parámetro de negocio**,
  y un control de seguridad no puede poder apagarse desde la UI de la aplicación.
  Esta es la **excepción explícita** a la precedencia general de §0.7 (BD/UI > entorno >
  default): aquí el entorno es la única fuente admitida.
- **FR-005**: esa variable MUST documentarse en `.env.example` con su significado y su
  default, y MUST quedar apagada en el `.env` local de desarrollo (que no se commitea).
- **FR-006**: las demás propiedades de la cookie (`httpOnly`, `sameSite`, `maxAge`) MUST
  permanecer sin cambios.
- **FR-007**: MUST existir un seed que pueble `AiModel`, `AgentApi`,
  `EntidadLicitacion` y `LicitacionStatus`, ejecutable con un comando documentado.
- **FR-008**: el seed MUST ser **idempotente**: ejecutarlo N veces MUST dejar el mismo
  estado que ejecutarlo una vez.
- **FR-009**: el seed MUST NOT destruir configuración existente del usuario (no puede
  resolver la idempotencia borrando y recreando).
- **FR-010**: el seed MUST informar por consola qué creó y qué omitió.
- **FR-011**: el procedimiento de arranque limpio (recrear volumen → migrar → sembrar)
  MUST quedar documentado en el `README.md`, cerrando el gap operativo que dejó la
  spec 001 (D-010).
- **FR-012**: `GET /api/projects` MUST invocar `verifyAuth()` y responder **401** sin
  sesión, sin devolver datos.
- **FR-013**: `GET /api/projects` con sesión válida MUST devolver exactamente los mismos
  datos que hoy (sin regresión).
- **FR-014**: toda ruta API modificada MUST llevar test Vitest (§0.2). En particular
  `src/app/api/projects/route.ts`, que **hoy no tiene ninguno**.
- **FR-015**: los cambios MUST respetar los contratos de la spec 002: **cero `any`
  nuevos** y **cero fugas de `err.message`** al cliente.
- **FR-016**: la suite MUST seguir ejecutándose **sin BD y sin Ollama**, y MUST NO bajar
  de **107** tests verdes.
- **FR-017**: ningún cambio MUST tocar archivos, contenedores, volúmenes o puertos de
  `002-2026-PROTECCION-INFANTIL` ni `003-2026-SICOV-OTPC` (ADR_002). El *staging* MUST
  ser **explícito por ruta**: prohibido `git add -A`.

### Key Entities

- **Bandera de cookie segura**: parámetro de configuración con default seguro, que
  sustituye la inferencia por `NODE_ENV`.
- **Catálogos semilla**: `AiModel`, `AgentApi`, `EntidadLicitacion`, `LicitacionStatus` —
  datos de referencia sin los cuales los módulos de licitaciones y configuración no operan.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: iniciar sesión en **Safari** por `http://localhost:5001` y ejecutar una
  acción autenticada funciona (baseline: la acción devuelve "No autenticado").
- **SC-002**: `grep -n "11434" src/app/configuracion/page.tsx` devuelve **una sola**
  ocurrencia, la del `placeholder` (baseline: 3).
- **SC-003**: `grep -rn "NODE_ENV" src/app/api/auth/` **no** devuelve ninguna línea que
  determine la bandera `Secure` (baseline: 1).
- **SC-004**: con el campo vacío, la petición de *Descubrir* no incluye `baseUrl` y
  devuelve la lista de modelos del host desde dentro del contenedor (baseline: `fetch
  failed`).
- **SC-005**: tras ejecutar el seed sobre base vacía,
  `AiModel > 0 ∧ AgentApi > 0 ∧ EntidadLicitacion > 0 ∧ LicitacionStatus > 0`
  (baseline: los cuatro en 0).
- **SC-006**: ejecutar el seed dos veces seguidas deja los mismos recuentos que
  ejecutarlo una vez.
- **SC-007**: `GET /api/projects` sin sesión responde **401**; con sesión responde 200
  con la misma lista (baseline: 200 sin sesión).
- **SC-008**: `npm run test` termina en verde **sin BD ni Ollama**, con **≥ 107** tests, e
  incluye pruebas nuevas de `projects` (baseline: 107, sin cobertura de `projects`).
- **SC-009**: `npx eslint src/lib src/app/api` reporta **0** errores `no-explicit-any`, y
  ninguna ruta devuelve `err.message` al cliente.
- **SC-010**: `npm run build` compila sin errores.
- **SC-011**: `git diff --cached --name-only` del commit contiene **solo** rutas bajo
  `001-2026-INNOVADATACO/`.
- **SC-012**: los puertos 5005/5433/5010/5434 permanecen sin cambios.

## Definición de terminado

Cerrada la implementación, la spec se considera terminada cuando se cumplen las
**5 Reglas de Oro**:

| # | Regla | Cómo se acredita aquí |
|---|---|---|
| 1 | Spec Kit aplicado | `specs/004-hotfix-validacion-funcional/` con spec, plan y tasks |
| 2 | Código subido a la **rama de pruebas** | Commits convencionales scopeados a `001-2026-INNOVADATACO/`, en **`feature/001-scaffolding`**. `main` es **producción** y solo recibe merges de liberación previa auditoría de ZEUS (METODOLOGIA-OPERATIVA §10): esta spec **no** llega a `main` |
| 3 | Pruebas escritas y pasando | SC-008: suite verde sin infraestructura, con cobertura nueva de `projects` |
| 4 | **Despliegue accesible y probable** | SC-001, SC-004, SC-005, SC-007: sesión útil, *Descubrir* operativo, catálogos poblados y listado protegido |
| 5 | Revisión de arquitectura de ZEUS | Verificación de RZ-1…RZ-4 y de los contratos de la spec 002 |

## Assumptions

- El defecto de Safari es de comportamiento del navegador, no de la aplicación: Chrome y
  Firefox toleran `Secure` en `localhost` y Safari no. Por eso la solución es de
  configuración y **no** se introduce HTTPS local (descartado en D-033).
- Los catálogos semilla son datos de referencia acordados con negocio; su contenido
  concreto (qué entidades y qué estados) se define en el plan.
- La aplicación seguirá sirviéndose por `http://localhost` en desarrollo; en un despliegue
  con HTTPS bastará con no apagar la bandera.
- La suite se mantiene unitaria con mocks (spec 002): estos arreglos **no** introducen
  dependencia de BD ni de Ollama en las pruebas.
- Esta spec **no se implementa** hasta ser aprobada por ZEUS y Jelkin (§0.1).

## Out of Scope

- Migrar los `any` restantes de componentes `.tsx` (deuda conocida de la spec 002).
- Introducir HTTPS local o certificados de desarrollo.
- Pruebas de componentes React para `configuracion/page.tsx` (no existe hoy ninguna
  prueba `.tsx`; montar ese arnés es un frente propio).
- El pipeline RAG (spec 003) y el OCR de los documentos escaneados (D-025).
- Rediseñar el módulo de configuración más allá de quitar el literal.
- Cualquier cambio en 002-Protección Infantil o 003-SICOV.
