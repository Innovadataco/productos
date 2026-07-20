# Feature Specification: Capa de datos / servicios (DAL)

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-07-20

**Status**: `PLANEADO`

**Input**: Programa de Saneamiento. Introducir repositorios y servicios incrementales, módulo por módulo, aislando `Prisma` de las rutas API. Es la inversión estructural más grande del proyecto, por lo que se entrega primero el plan para revisión humana antes de `/speckit.implement`.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Módulo Reporte aislado de Prisma (Priority: P1)

El equipo de desarrollo necesita que el módulo Reporte no dependa directamente de `Prisma` en las rutas API, de modo que los cambios en el esquema o en el ORM queden concentrados en repositorios y servicios de dominio, y las pruebas de integración sean más estables.

**Why this priority**: El módulo Reporte es el eje del producto y concentra la mayor cantidad de consultas, transacciones y lógica de estado. Es el candidato natural para validar el patrón antes de extenderlo.

**Independent Test**: Tras el refactor, los tests de `src/app/api/reportes/**` y `src/app/api/reportes/procesar/**` siguen pasando sin importar `prisma` directamente desde las rutas.

**Acceptance Scenarios**:

1. **Given** una ruta de creación de reportes, **When** recibe un POST válido, **Then** delega la persistencia en un `ReporteCreationService` y no ejecuta `prisma.*` directamente.
2. **Given** un flujo de procesamiento de IA, **When** el worker invoca el pipeline, **Then** la orquestación y las transacciones viven en `ReporteProcessingService` con cliente transaccional inyectable.
3. **Given** una operación de baja o reactivación de reporte, **When** el administrador ejecuta la acción, **Then** `ReporteLifecycleService` centraliza las actualizaciones sobre Reporte, Clasificación, Embedding, Dataset y Transición sin exponer Prisma a la ruta.
4. **Given** una consulta de seguimiento o listado de reportes, **When** un usuario autenticado solicita datos, **Then** un `ReporteQueryService` expone DTOs de dominio y no devuelve objetos crudos de Prisma.

---

### User Story 2 — Módulo Consulta pública aislado de Prisma (Priority: P2)

El equipo de desarrollo necesita que la Consulta pública (anónima y detallada) se apoye en un servicio de dominio que encapsule las reglas de agregación, umbral de visibilidad y cálculo de riesgo, sin que las rutas construyan filtros de Prisma.

**Why this priority**: La consulta pública es el segundo flujo más visible del producto y es casi de solo lectura, lo que lo convierte en un ejercicio controlado de migración al patrón DAL.

**Independent Test**: Tras el refactor, `GET /api/consulta` y `GET /api/consulta/detalle` continúan funcionando y las rutas no importan `prisma`.

**Acceptance Scenarios**:

1. **Given** una consulta pública de un identificador, **When** supera el umbral configurado, **Then** el `ConsultaPublicaService` agrega plataformas, ubicaciones y timeline sin que la ruta acceda a `prisma.reporte.findMany`.
2. **Given** una consulta detallada autenticada, **When** el usuario solicita el detalle, **Then** el servicio aplica las reglas de visibilidad y mapea a DTOs de dominio.
3. **Given** un cambio en el umbral de visibilidad, **Then** el servicio lo lee a través de `ParametroSistema` (ya abstraído en `src/lib/parametros.ts`) y no replica la lógica en la ruta.

---

### User Story 3 — Patrón de repositorio y servicio establecido para los módulos restantes (Priority: P2)

El equipo de desarrollo necesita una convención clara de repositorios, servicios de flujo, DTOs e inyección de cliente transaccional, aplicable de forma incremental a Configuración, Autenticación, Apelaciones, Alertas, Círculo de confianza, Operadores, IA y Estadísticas.

**Why this priority**: Establecer el patrón antes de migrar el resto de módulos reduce inconsistencias y evita que las rutas nuevas vuelvan a acoplarse a Prisma.

**Independent Test**: Cualquier módulo nuevo o refactorizado sigue la estructura de `src/lib/dal/` sin requerir decisiones ad-hoc.

**Acceptance Scenarios**:

1. **Given** un módulo candidato, **When** se diseña su capa de datos, **Then** se crean repositorios de agregado bajo `src/lib/dal/repositories/` y servicios de flujo bajo `src/lib/dal/services/`.
2. **Given** un repositorio que escribe en varias tablas, **When** se invoca dentro de una transacción, **Then** acepta un `Prisma.TransactionClient` inyectado y comparte la misma unidad de trabajo con otros repositorios.
3. **Given** una consulta que requiere `pgvector` o `pg-boss`, **Then** la raw query permanece en un adaptador de infraestructura dedicado (`EmbeddingRepository`, `QueueRepository`, `RateLimitRepository`) y no en la ruta.

---

## Edge Cases

- ¿Qué ocurre con las transacciones cruzadas entre Reporte, Clasificación, Embedding y Dataset? El patrón debe propagar un `tx` común; de lo contrario se perderá atomicidad.
- ¿Cómo se manejan las raw queries de `pgvector` y los `Unsupported("vector")`? Deben quedar encapsuladas en repositorios especializados, no en rutas.
- ¿Qué pasa con los tests que crean fixtures directamente con `prisma.*`? Se mantienen funcionales en esta fase; eventualmente se podrán migrar a helpers de test basados en repositorios.
- ¿Cómo se evita que los tipos de `@prisma/client` sigan filtrándose a las rutas? Los enums y tipos simples pueden seguir importándose, pero las rutas no deben construir objetos `Prisma.*` ni invocar métodos del cliente.
- ¿Qué ocurre si un servicio llama a otro servicio dentro de una transacción? Se debe definir una `UnitOfWork` o pasar `tx` explícitamente para evitar anidar transacciones.
- ¿Cómo se preserva el orden de migración sin tocar SPEC-050 ni SPEC-060? El Spec 053 se ejecuta de forma independiente; no modifica artefactos de esos specs ni sus rutas asociadas.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE definir repositorios por agregado del módulo Reporte (`Reporte`, `IdentificadorReportado`, `ClasificacionIA`, `EmbeddingReporte`, `TransicionReporte`, `ReintentoReporte`) que expongan operaciones tipadas con DTOs de dominio.
- **FR-002**: Las rutas del módulo Reporte NO DEBEN importar ni utilizar directamente el cliente `prisma` de `@/lib/prisma`; solo pueden usar servicios, repositorios y DTOs.
- **FR-003**: Todos los repositorios y servicios de flujo DEBEN aceptar un cliente transaccional opcional (`Prisma.TransactionClient`) para conservar la atomicidad de las operaciones.
- **FR-004**: Las operaciones complejas de ciclo de vida del reporte (creación, baja, reactivación, procesamiento, fallback, anonimización) DEBEN quedar encapsuladas en servicios de dominio (`ReporteCreationService`, `ReporteLifecycleService`, `ReporteProcessingService`).
- **FR-005**: El módulo Consulta pública DEBE disponer de un `ConsultaPublicaService` y un `RiesgoConsultaService` que aislen las consultas agregadas y el cálculo de riesgo de las rutas API.
- **FR-006**: Los repositorios de infraestructura específica (embeddings, estadísticas con `pgvector`, colas, rate-limit) DEBEN mantener las raw queries encapsuladas y no exponerlas en las rutas.
- **FR-007**: La capa de rutas DEBE recibir DTOs de dominio; los objetos de Prisma (`include`, `select`, modelos crudos) NO DEBEN llegar a las respuestas HTTP.
- **FR-008**: Los tests existentes DEBEN seguir pasando tras cada migración de módulo; no se permite regresión de funcionalidad.
- **FR-009**: El código nuevo DEBE ubicarse bajo `src/lib/dal/` con subdirectorios `repositories/`, `services/` y `types/` (o equivalente acordado en el plan), siguiendo la convención de nombres del proyecto.
- **FR-010**: No se DEBEN realizar cambios destructivos en el esquema de Prisma ni en los datos existentes; las migraciones, si las hubiera, serán aditivas.
- **FR-011**: No se DEBEN modificar los artefactos ni el código de SPEC-050 ni SPEC-060.

### Key Entities

- **ReporteRepository**: encapsula CRUD y búsquedas del agregado Reporte.
- **IdentificadorReportadoRepository**: encapsula `upsert` y actualización de visibilidad pública.
- **ClasificacionIARepository**: encapsula lectura/escritura de clasificaciones IA.
- **EmbeddingRepository**: encapsula inserción y búsqueda de vectores (`pgvector`).
- **TransicionReporteRepository**: encapsula el registro de transiciones de estado.
- **ReintentoReporteRepository**: encapsula CRUD de reintentos.
- **ReporteCreationService**: orquesta validación, deduplicación, cifrado, persistencia y encolado.
- **ReporteProcessingService**: orquesta el pipeline de IA (seguridad, duplicados, ráfagas, clasificación, embedding, anonimización, finalización).
- **ReporteLifecycleService**: centraliza baja, reactivación, anonimización y fallback.
- **ReporteQueryService**: expone listados, detalle y seguimiento con DTOs.
- **ConsultaPublicaService**: agrega datos públicos de un identificador.
- **RiesgoConsultaService**: calcula nivel de riesgo a partir de parámetros y datos agregados.
- **UnitOfWork / transacción inyectada**: mecanismo para compartir cliente transaccional entre repositorios.

---

## Success Criteria *(mandatory)*

- **SC-001**: Cero llamadas `prisma.*` en las rutas del módulo Reporte (`src/app/api/reportes/**/*.ts`) tras su migración.
- **SC-002**: Todos los tests del módulo Reporte (`src/app/api/reportes/**/*.test.ts` y `src/lib/reporte-*.test.ts`) pasan tras el refactor.
- **SC-003**: Las rutas de Consulta pública (`src/app/api/consulta/**`) no importan `prisma` y pasan sus tests.
- **SC-004**: El patrón de repositorios, servicios y DTOs se documenta y se aplica en al menos tres módulos (Reporte, Consulta pública y uno adicional) sin regresión de build o tests.
- **SC-005**: Las raw queries de `pgvector` y adaptadores de infraestructura quedan encapsuladas en repositorios dedicados, no en rutas.
- **SC-006**: `npm run build` y `npm run test` siguen ejecutándose correctamente tras cada fase de migración.
- **SC-007**: No se introducen dependencias nuevas para implementar el DAL; se usa el stack existente (TypeScript, Prisma, Next.js).

---

## Assumptions

- Prisma sigue siendo el ORM del proyecto; el DAL es una capa delgada sobre él, no un reemplazo.
- No se requieren cambios de esquema para esta refactorización; si surge alguno, será aditivo y justificado.
- La migración es incremental por módulo; no se hace un big-bang de todo el código base.
- Los tests existentes que crean fixtures con `prisma` se mantienen; la refactorización de tests se hará de forma opcional y posterior.
- Las operaciones de IA y estadísticas que usan `pgvector` seguirán requiriendo raw queries, encapsuladas en repositorios específicos.
- SPEC-050 y SPEC-060 permanecen congelados; este spec no interfiere en sus artefactos ni su implementación.
- La aprobación humana del plan es requisito previo para iniciar la implementación (`/speckit.implement`).
- Este spec es un ítem de pre-producción registrado en `docs/PRE-PRODUCCION.md`; se implementará de forma incremental y no bloquea el lanzamiento inicial.

---

## Implementación

*Se documentará al cerrar el spec. Esta sección permanece vacía mientras el status sea `PLANEADO`.*
