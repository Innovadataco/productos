# Feature Specification: Módulo Colegios — Fase 0: Ubicación (País → Departamento → Ciudad) (Spec 073)

**Feature Branch**: `[feature/001-scaffolding]`

**Created**: 2026-07-21

**Status**: PLANEADO

**Input**: Fase 0 del módulo Colegios (SaaS institucional). Hoy el modelo solo tiene `Pais` y `Ciudad`, donde `Ciudad` cuelga directamente de `Pais`. Esta fase agrega el nivel `Departamento` y carga la data real de Colombia como base reutilizable para colegios, reportes y mapas. No se implementa código hasta aprobación humana del plan.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Modelo Departamento aditivo (Priority: P1)

El sistema necesita representar la división político-administrativa de Colombia (país → departamento → ciudad/municipio) para que un colegio pueda asociarse a una ubicación jerárquica real y los reportes/mapas puedan usar esa jerarquía en el futuro.

**Why this priority**: Es la base geográfica del módulo Colegios y de cualquier análisis posterior por región. Sin Departamento, no hay forma de agrupar ciudades por región administrativa.

**Independent Test**: Tras la migración y el seed, la tabla `Departamento` existe, tiene relación opcional con `Ciudad`, y las ciudades existentes siguen funcionando sin cambios visibles.

**Acceptance Scenarios**:

1. **Given** una base de datos existente con países y ciudades, **When** se aplica la migración aditiva, **Then** se crea la tabla `Departamento` y la columna `departamentoId` (nullable) en `Ciudad`, sin borrar ni modificar datos existentes.
2. **Given** una ciudad existente vinculada solo a `Pais`, **When** se ejecuta el seed, **Then** la ciudad puede quedar vinculada a su departamento correspondiente, pero sigue conservando `paisId` y funcionando igual para los reportes.
3. **Given** un reporte existente con `pais`/`ciudad` como string y `paisId`/`ciudadId` opcionales, **When** se agrega el departamento, **Then** el reporte no se modifica y no hay regresión en su procesamiento ni consulta.

**Edge Cases**:
- ¿Qué pasa si una ciudad no puede mapearse a un departamento? Queda con `departamentoId = null`; el sistema sigue funcionando.
- ¿Qué pasa si se corre el seed dos veces? La carga es idempotente (upsert); no se duplican departamentos ni ciudades.
- ¿Qué pasa con ciudades de otros países? Sus departamentos quedan `null` hasta que se cargue su división territorial; no se inventan datos.

---

### User Story 2 — Carga real de Colombia (Priority: P1)

El sistema debe contar con los 32 departamentos de Colombia + Bogotá D.C. y sus principales ciudades/municipios, vinculados correctamente a `Pais` (Colombia).

**Why this priority**: Colombia es el país inicial de operación del producto. Tener la división territorial real permite ubicar colegios y reportes con precisión desde el inicio.

**Independent Test**: El seed crea Colombia, los 32 departamentos + Bogotá D.C., y las ciudades principales; las 10 ciudades ya existentes (Bogotá, Medellín, Cali, Barranquilla, Cartagena, Bucaramanga, Pereira, Manizales, Cúcuta, Ibagué) quedan vinculadas a su departamento real.

**Acceptance Scenarios**:

1. **Given** el seed de ubicación, **When** se ejecuta, **Then** Colombia existe con 33 divisiones territoriales (32 departamentos + Bogotá D.C.) y cada una tiene al menos su capital asignada.
2. **Given** las 10 ciudades ya existentes en la BD, **When** se ejecuta el seed, **Then** se actualizan con su `departamentoId` correcto sin cambiar su `paisId` ni su nombre.
3. **Given** una segunda ejecución del seed, **When** termina, **Then** no hay duplicados y los datos son idénticos a la primera ejecución.
4. **Given** el endpoint `/api/ciudades?paisId=CO`, **When** se consulta, **Then** sigue devolviendo todas las ciudades de Colombia (ahora vinculadas a departamentos, pero sin cambiar el contrato de respuesta).

**Edge Cases**:
- ¿Qué pasa si Colombia no existe en la BD? Se crea como parte del seed.
- ¿Qué pasa si ya hay ciudades con nombres que coinciden pero en otro país? Se resuelven por `(nombre, paisId)`; el `departamentoId` solo se asigna al país Colombia.
- ¿Qué pasa si se agrega un departamento nuevo por reorganización administrativa? El seed se actualiza y el upsert lo refleja.

---

### User Story 3 — No regresión en componentes existentes (Priority: P1)

Los componentes y endpoints que hoy usan país/ciudad deben seguir funcionando igual después de agregar Departamento. Los 600+ tests actuales deben seguir verdes.

**Why this priority**: El cambio es estructural pero no funcional en esta fase. No se puede permitir que el flujo de reportes, la consulta pública o el dashboard se rompan por agregar una tabla intermedia.

**Independent Test**: Ejecutar el test suite completo tras la migración y el seed; todos los tests pasan.

**Acceptance Scenarios**:

1. **Given** el flujo de crear un reporte, **When** el usuario selecciona país y ciudad, **Then** el reporte se guarda con los mismos campos (`pais`, `ciudad`, `paisId`, `ciudadId`) y no requiere departamento.
2. **Given** el endpoint `/api/ciudades`, **When** se consulta por `paisId`, **Then** devuelve el mismo shape y las mismas ciudades que antes.
3. **Given** los dashboards públicos y de admin, **When** se renderizan, **Then** muestran las mismas agrupaciones geográficas que antes.
4. **Given** el test suite completo, **When** se ejecuta, **Then** pasa con 600+ tests sin modificaciones.

**Edge Cases**:
- ¿Qué pasa si un componente futuro necesita departamento? En esta fase no se expone; se deja la base lista.
- ¿Qué pasa si se filtran ciudades por departamento? No se implementa filtro en esta fase; el campo es nullable y opcional.

---

## Edge Cases generales

- ¿Qué ocurre si el seed se ejecuta en una BD que ya tiene reportes vinculados a ciudades? Nada; los reportes no cambian.
- ¿Qué ocurre si se elimina un departamento del seed? No se recomienda; si sucede, las ciudades ya vinculadas quedan con `departamentoId` apuntando a un registro inexistente. El seed debe manejar esto como actualización controlada.
- ¿Qué ocurre con el campo `Tenant.direccion` o similares del módulo Colegios? Esta fase no los crea; quedan para fases posteriores.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE crear el modelo `Departamento` con campos: `id`, `nombre`, `paisId` (FK a `Pais`), `codigo` (opcional, string), `esActivo` (default true), `creadoEn`, `actualizadoEn`.
- **FR-002**: El sistema DEBE agregar la columna `departamentoId` (nullable) al modelo `Ciudad`, manteniendo `paisId` intacto para compatibilidad.
- **FR-003**: El sistema DEBE establecer la relación `País → Departamentos → Ciudades` sin hacer obligatorio `departamentoId` en `Ciudad`.
- **FR-004**: El sistema DEBE cargar los 32 departamentos de Colombia + Bogotá D.C. como divisiones territoriales oficiales.
- **FR-005**: El sistema DEBE cargar las ciudades/municipios principales de cada departamento, incluyendo su capital.
- **FR-006**: El sistema DEBE vincular las 10 ciudades existentes de Colombia (Bogotá, Medellín, Cali, Barranquilla, Cartagena, Bucaramanga, Pereira, Manizales, Cúcuta, Ibagué) a su departamento real.
- **FR-007**: El seed DEBE ser idempotente: upsert por `(nombre, paisId)` para países, por `(nombre, paisId)` para departamentos, y por `(nombre, paisId)` para ciudades.
- **FR-008**: El sistema NO DEBE modificar el modelo `Reporte` ni cambiar la forma en que guarda `pais`/`ciudad` string ni `paisId`/`ciudadId` opcionales.
- **FR-009**: El sistema NO DEBE alterar los endpoints `/api/paises` ni `/api/ciudades` en esta fase; solo se asegura que sigan devolviendo el mismo contrato.
- **FR-010**: El sistema NO DEBE crear UI nueva para seleccionar departamento en esta fase.
- **FR-011**: La migración DEBE ser aditiva (nuevas tablas/columnas nullable) y NUNCA destructiva.
- **FR-012**: Antes de tocar seed/migraciones, el sistema DEBE generar un dump de respaldo de la BD.

### Key Entities

- **Pais**: existente. No cambia.
- **Departamento**: nuevo. Relación con `Pais`. Campos: `id`, `nombre`, `paisId`, `codigo?`, `esActivo`, timestamps.
- **Ciudad**: existente. Se agrega `departamentoId` nullable. `paisId` se mantiene.
- **Reporte**: existente. No cambia; sigue usando `pais`/`ciudad` string y `paisId`/`ciudadId` opcionales.
- **Tenant**: existente; en fases futuras podrá usar `departamentoId`/`ciudadId`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: La tabla `Departamento` existe con 33 registros para Colombia (32 + Bogotá D.C.).
- **SC-002**: La columna `departamentoId` existe en `Ciudad` y es nullable.
- **SC-003**: Las 10 ciudades colombianas existentes tienen `departamentoId` correcto tras el seed.
- **SC-004**: El seed es idempotente: correrlo 2 veces no duplica registros.
- **SC-005**: El endpoint `/api/ciudades?paisId=CO` devuelve el mismo contrato y las mismas ciudades que antes.
- **SC-006**: `npm run test` pasa con ≥ 600 tests sin modificar tests existentes.
- **SC-007**: `npx prisma migrate deploy` aplica la migración sin pérdida de datos.
- **SC-008**: Un dump de respaldo de la BD existe antes de ejecutar migraciones/seed.

---

## Assumptions

- La fuente de datos de Colombia será la División Político-Administrativa oficial (DANE / Ministerio del Interior), simplificada a 32 departamentos + Bogotá D.C. y sus capitales/principales municipios.
- No se modifica la lógica de reportes, consulta pública ni dashboards en esta fase.
- No se requiere soporte multi-país de departamentos en esta fase; solo Colombia se carga con datos reales.
- Los campos `pais` y `ciudad` en `Reporte` siguen siendo la fuente de verdad funcional; `paisId`/`ciudadId` siguen siendo opcionales.
- No se implementa código hasta aprobación humana del plan.

---

## Implementación

*Pendiente. Se completará tras la aprobación del plan y la implementación de las User Stories.*

## Status

PLANEADO
