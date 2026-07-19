# Feature Specification: Consistencia y limpieza

**Feature Branch**: `[036-consistencia-limpieza]`

**Created**: 2026-07-19

**Status**: EN PLANIFICACIÓN

**Input**: Tareas de consistencia y deuda técnica acumulada: (1) la ruta API se llama `apeaciones` en lugar de `apelaciones` (error ortográfico) y afecta endpoint, consumidores y tests; (2) quedan textos en voseo en la interfaz; (3) las librerías usan `console.log` directamente; (4) falta búsqueda por número de seguimiento e identificador en la bandeja admin; (5) los resultados de evaluación generan archivos que no deben commitearse.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Renombrar apeaciones → apelaciones (Priority: P1)

La ruta de la API y el componente admin están escritos como "apeaciones" en lugar de "apelaciones". Esto afecta la consistencia, la corrección ortográfica y la claridad del código. Se requiere un renombramiento atómico en un solo commit.

**Why this priority**: Aunque no cambia funcionalidad, el error ortográfico se propaga en rutas, imports y tests. Corregirlo en un commit atómico evita fragmentación y deuda de nomenclatura.

**Independent Test**: Después del renombramiento, todas las URLs, imports y tests usan "apelaciones" y la funcionalidad de apelaciones sigue operando.

**Acceptance Scenarios**:

1. **Given** el endpoint `GET /api/apeaciones/solicitar`, **When** se renombra, **Then** pasa a `GET /api/apelaciones/solicitar`.
2. **Given** el endpoint `GET /api/admin/apeaciones`, **When** se renombra, **Then** pasa a `GET /api/admin/apelaciones`.
3. **Given** el componente `src/components/modules/AdminApelaciones.tsx`, **When** se renombra, **Then** se ajustan los imports y la funcionalidad se mantiene.
4. **Given** todos los consumidores de la ruta (7 aproximadamente), **When** se renombra, **Then** se actualizan en el mismo commit.
5. **Given** los tests de apelaciones, **When** se renombra, **Then** se actualizan y pasan.
6. **Given** el archivo `src/lib/apealaciones.ts` (con doble error ortográfico), **When** se renombra, **Then** pasa a `src/lib/apelaciones.ts` y se actualizan sus imports.

### User Story 2 - Barrido final de voseo (Priority: P1)

Quedan textos en voseo en la interfaz ("Revisá, clasificá y gestioná", "mostrála una vez", "copiá"). El tono del producto debe ser neutro, sin voseo, según AGENTS.md.

**Why this priority**: La consistencia de tono es parte de la calidad del producto y de las reglas del proyecto. El voseo resta profesionalismo y rompe el contrato de tono.

**Independent Test**: Un grep de patrones de voseo en `src` no devuelve resultados; todos los textos de UI están en tercera persona o infinitivo neutro.

**Acceptance Scenarios**:

1. **Given** la bandeja de reportes con subtítulo "Revisá, clasificá y gestioná los reportes de la comunidad", **When** se corrige, **Then** usa un texto neutro como "Revisar, clasificar y gestionar los reportes de la comunidad".
2. **Given** la alerta de contraseña temporal "mostrála una vez" en gestión de operadores y comité, **When** se corrige, **Then** usa "muéstrela una vez" o "mostrar una vez" según contexto formal.
3. **Given** el mensaje de API "copiá la contraseña temporal", **When** se corrige, **Then** usa "copie la contraseña temporal" o "copiar la contraseña temporal".
4. **Given** un grep completo de terminaciones en voseo, **When** se ejecuta, **Then** no hay coincidencias en strings de UI o mensajes de error.

### User Story 3 - Logger mínimo con niveles (Priority: P1)

Las librerías de `src/lib` usan `console.log` directamente (22 ocurrencias). Se requiere un logger mínimo con niveles (`debug`, `info`, `warn`, `error`) que permita controlar el ruido en producción y mantener trazas útiles en desarrollo.

**Why this priority**: Depender de `console.log` dificulta el monitoreo, filtrado por severidad y desactivación de trazas en producción. Un logger centralizado mejora la observabilidad.

**Independent Test**: Reemplazar los `console.log` de `src/lib` por llamadas al logger; el output en desarrollo se mantiene y en producción solo se muestran `warn` y `error` por defecto.

**Acceptance Scenarios**:

1. **Given** 22 `console.log` en `src/lib`, **When** se implementa el logger, **Then** todos se reemplazan por llamadas al logger con nivel adecuado.
2. **Given** el logger en desarrollo, **When** se usa `logger.info`, **Then** imprime en consola.
3. **Given** el logger en producción, **When** se usa `logger.info`, **Then** no imprime por defecto (solo `warn`/`error`).
4. **Given** una variable de entorno `LOG_LEVEL`, **When** se configura en `debug`, **Then** se muestran todos los niveles.
5. **Given** un mensaje de error, **When** se usa `logger.error`, **Then** se mantiene visible en todos los entornos.
6. **Given** los tests existentes, **When** se reemplazan los `console.log`, **Then** los tests siguen pasando.

### User Story 4 - Buscador en la bandeja admin (Priority: P2)

La bandeja de reportes (`AdminReportesTable`) permite filtrar por estado, plataforma, categoría y fecha, pero no por número de seguimiento (RPT-XXXX) ni por identificador/nick reportado. Los operadores y admins necesitan localizar reportes rápidamente.

**Why this priority**: Mejora la eficiencia operativa al permitir buscar reportes directamente por su número de seguimiento o por el identificador que reportaron.

**Independent Test**: Un operador escribe un número de seguimiento o un identificador en el buscador; la tabla muestra solo los reportes que coinciden.

**Acceptance Scenarios**:

1. **Given** la bandeja de reportes, **When** se agrega un campo de búsqueda, **Then** filtra por número de seguimiento parcial o completo (RPT-XXXX).
2. **Given** un identificador/nick reportado, **When** se escribe en el buscador, **Then** la tabla muestra los reportes que coinciden con ese identificador.
3. **Given** un texto que no coincide, **When** se busca, **Then** la tabla muestra "No hay reportes que coincidan".
4. **Given** la búsqueda combinada con filtros existentes, **When** se aplican, **Then** se respetan todos los criterios.
5. **Given** la URL con parámetro `q`, **When** se carga la página, **Then** el buscador muestra el valor y los resultados filtrados.
6. **Given** el endpoint `/api/admin/reportes-revision`, **When** recibe `q`, **Then** busca en `numeroSeguimiento` e `identificador` (case-insensitive, parcial).

### User Story 5 - Agregar eval-results a .gitignore (Priority: P2)

La carpeta `eval-results/` contiene salidas generadas por evaluaciones locales. Hoy no está en `.gitignore`, por lo que los archivos pueden accidentalmente commitearse.

**Why this priority**: Los resultados de evaluación son artefactos de ejecución, no código fuente. Incluirlos en el repo genera ruido y posibles filtraciones.

**Independent Test**: Después de agregar `eval-results/` a `.gitignore`, un archivo nuevo en esa carpeta no aparece como untracked en `git status`.

**Acceptance Scenarios**:

1. **Given** `.gitignore` actual, **When** se agrega `eval-results/`, **Then** los archivos de esa carpeta se ignoran.
2. **Given** archivos existentes ya trackeados en `eval-results/`, **When** se agrega la regla, **Then** Git sigue rastreando los archivos ya trackeados (la regla solo afecta archivos nuevos).

---

## Edge Cases

- **US1**: ¿Qué pasa con los bookmarks antiguos a `/api/apeaciones/...`? Se actualizan en el código; no se mantiene compatibilidad hacia atrás porque es un error ortográfico interno.
- **US2**: ¿Qué pasa con comentarios de código que usan voseo? El barrido debe incluir strings y mensajes visibles, no comentarios técnicos.
- **US3**: ¿Qué pasa si un test espía `console.log`? Se debe actualizar el test para espiar el método del logger.
- **US4**: ¿Qué pasa si el identificador es muy corto (1-2 caracteres)? Se debe establecer un mínimo de 3 caracteres para la búsqueda.
- **US5**: ¿Qué pasa si alguien necesita commitear un resultado de evaluación? Debe hacerlo explícitamente con `git add -f`.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Renombrar `src/app/api/apeaciones` a `src/app/api/apelaciones` (incluyendo subrutas y tests).
- **FR-002**: Renombrar `src/app/api/admin/apeaciones` a `src/app/api/admin/apelaciones` (incluyendo subrutas y tests).
- **FR-003**: Renombrar `src/lib/apealaciones.ts` a `src/lib/apelaciones.ts` y actualizar todos los imports.
- **FR-004**: Actualizar todos los consumidores de las rutas y del módulo de apelaciones en un solo commit atómico.
- **FR-005**: Reemplazar todos los textos en voseo en la interfaz por textos neutros (sin voseo).
- **FR-006**: Crear un logger mínimo en `src/lib/logger.ts` con niveles `debug`, `info`, `warn`, `error`.
- **FR-007**: Reemplazar los `console.log` de `src/lib` por llamadas al logger.
- **FR-008**: El nivel por defecto en producción debe ser `warn` (mostrar `warn` y `error`).
- **FR-009**: El nivel debe ser configurable por variable de entorno `LOG_LEVEL`.
- **FR-010**: Agregar campo de búsqueda en `AdminReportesTable` que filtre por `numeroSeguimiento` e `identificador`.
- **FR-011**: El endpoint `/api/admin/reportes-revision` debe aceptar el parámetro `q` y buscar en `numeroSeguimiento` e `identificador` (case-insensitive, parcial).
- **FR-012**: Agregar `eval-results/` a `.gitignore`.
- **FR-013**: Mantener `console.error` y `console.warn` solo donde sean realmente necesarios (errores y advertencias), o migrarlos al logger.

### Key Entities

- **Rutas API**: `api/apeaciones/*` → `api/apelaciones/*`, `api/admin/apeaciones/*` → `api/admin/apelaciones/*`.
- **Componentes UI**: `AdminReportesTable`, `AdminApelaciones`, páginas de gestión de operadores y comité.
- **Logger**: `src/lib/logger.ts`.
- **Configuración**: `.gitignore`, `LOG_LEVEL` en `.env.example`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Todas las rutas, imports y tests de apelaciones usan el nombre correcto en un commit atómico.
- **SC-002**: Un grep de voseo en `src` no devuelve resultados en strings de UI.
- **SC-003**: No quedan `console.log` en `src/lib`; todos usan el logger.
- **SC-004**: El buscador de `AdminReportesTable` filtra correctamente por número de seguimiento e identificador.
- **SC-005**: `eval-results/` está en `.gitignore` y los archivos nuevos se ignoran.
- **SC-006**: `npm run test` continúa pasando con 0 tests nuevos fallidos.

---

## Assumptions

- El cambio de nombre de `apeaciones` a `apelaciones` no requiere migración de datos (solo rutas y código).
- El logger no requiere integración externa (Sentry, etc.) en esta fase; es una utilidad local.
- La búsqueda en la bandeja admin es local (frontend) o server-side paginada; se prefiere server-side para grandes volúmenes.
- El modelo `Reporte` tiene campos `numeroSeguimiento` e `identificador` (o relación a `Identificador`).
- No se requieren cambios en el modelo de datos de Prisma.

---

## Implementación

*(Se documentará tras completar el trabajo, siguiendo el formato de cierre del Spec-Kit.)*
