# Feature Specification: Tests de rol + documentación de arquitectura

**Feature Branch**: `[047-tests-rol-arquitectura]`

**Created**: 2026-07-20

**Status**: CERRADA

**Input**: PROGRAMA DE SANEAMIENTO — Fase 2: cerrar la deuda de visibilidad por rol detectada en specs previos (especialmente 033, 034, 038, 040, 043) y documentar la arquitectura del sistema para operadores futuros. No se añaden funcionalidades nuevas ni se modifica comportamiento de negocio.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tests de visibilidad por rol (Priority: P1)

El sistema tiene múltiples roles con permisos diferenciados. Se han detectado regresiones previas en la navegación del comité (pestañas ocultas a COMITE_VALIDACION, aislamiento de la bandeja) y en la separación entre usuarios internos y el panel de usuario final. Se necesita un conjunto de tests automatizados que certifiquen qué ve cada rol y qué no ve.

**Why this priority**: Un error de visibilidad expone funciones de administración a roles incorrectos o bloquea a un operador/comité su flujo de trabajo. Los bugs de tabs del comité y del aislamiento de la bandeja son evidencia concreta de que el riesgo es real.

**Independent Test**: Ejecutar `npm run test` y ver que los tests de visibilidad por rol pasan para ADMIN, SCHOOL_ADMIN, OPERADOR, COMITE_VALIDACION y PARENT. Cada test declara explícitamente qué elementos debe ver el rol y cuáles no.

**Acceptance Scenarios**:

1. **Given** un usuario con rol `COMITE_VALIDACION`, **When** se renderiza `ComiteSubNav`, **Then** solo ve la pestaña "Bandeja" y no ve "Gestión" ni "Auditoría".
2. **Given** un usuario con rol `ADMIN` o `SCHOOL_ADMIN`, **When** se renderiza `ComiteSubNav`, **Then** ve las tres pestañas: "Bandeja", "Gestión" y "Auditoría".
3. **Given** un usuario con rol `ADMIN` o `SCHOOL_ADMIN`, **When** se renderiza `AdminNav`, **Then** ve todas las secciones de administración (Bandeja, Spam, Comité, Dashboard, Centro IA, Operadores, Anti-abuso, Apelaciones, Dataset, Configuración).
4. **Given** un usuario con rol `OPERADOR`, **When** se renderiza `AdminNav`, **Then** ve "Bandeja de reportes" y "Revisión de spam", y no ve el resto de secciones administrativas.
5. **Given** un usuario con rol `COMITE_VALIDACION`, **When** se renderiza `AdminNav`, **Then** solo ve "Comité" y no ve ninguna otra sección de administración.
6. **Given** un usuario con rol `PARENT`, **When** el proxy evalúa `/dashboard/admin`, **Then** es redirigido a `/`.
7. **Given** un usuario con rol `COMITE_VALIDACION`, **When** el proxy evalúa `/dashboard/admin/comite/gestion` o `/dashboard/admin/comite/auditoria`, **Then** es redirigido a `/dashboard/admin/comite`.
8. **Given** un usuario con rol `OPERADOR` y un reporte asignado a otro operador, **When** se evalúa `puedeGestionarReporte`, **Then** devuelve `false`.
9. **Given** un usuario con rol `SCHOOL_ADMIN` y un reporte de otro tenant, **When** se evalúa `puedeGestionarReporte`, **Then** devuelve `false`.

---

### User Story 2 - Documento de arquitectura (Priority: P1)

El sistema ha crecido y existe `AGENTS.md` para reglas operativas, pero falta una descripción técnica de las capas de la aplicación, el flujo de datos y las convenciones que complementen las reglas operativas. Se crea `docs/ARCHITECTURE.md` como referencia para desarrolladores y operadores.

**Why this priority**: Un nuevo desarrollador necesita entender rápidamente la división de responsabilidades entre App Router, capa de servicios, modelo de datos y workers sin adivinarla del código. La arquitectura actual está estable, por lo que es el momento de documentarla.

**Independent Test**: Leer `docs/ARCHITECTURE.md` y verificar que describe: capas de la app, flujo de datos de un reporte desde su recepción hasta la clasificación, convenciones de código, seguridad y despliegue. No debe contradecir `AGENTS.md` ni la constitución.

**Acceptance Scenarios**:

1. **Given** un desarrollador nuevo, **When** lee `docs/ARCHITECTURE.md`, **Then** entiende la separación entre UI (Next.js App Router), API routes, servicios (`src/lib`), capa de datos (Prisma/PostgreSQL) y workers (`scripts/worker.mjs`).
2. **Given** un desarrollador nuevo, **When** lee la sección de flujo de datos, **Then** comprende cómo un reporte pasa por recepción, encolamiento, clasificación IA, revisión humana y consulta pública.
3. **Given** un desarrollador nuevo, **When** lee la sección de convenciones, **Then** conoce las reglas de nombres, errores, paginación y autenticación usadas en el proyecto.
4. **Given** `AGENTS.md`, **When** se compara con `docs/ARCHITECTURE.md`, **Then** no hay contradicciones; `ARCHITECTURE.md` complementa la información operativa con detalle técnico.

---

### User Story 3 - JSDoc en módulos clave (Priority: P2)

Los módulos centrales del procesamiento de reportes, el círculo de confianza, el proxy de rutas, el clasificador IA y el cifrado de parámetros carecen de documentación inline. Añadir JSDoc mejora la mantenibilidad y reduce el tiempo de onboarding.

**Why this priority**: Aunque el código es legible, los módulos clave tienen reglas de negocio complejas (aislamiento de datos, encriptación, flujo de estados). El JSDoc documenta contratos, parámetros y efectos secundarios sin alterar el comportamiento.

**Independent Test**: Ejecutar `npx tsc --noEmit` y `npm run lint` para verificar que el JSDoc no introduce errores de tipado ni de sintaxis. Revisar que los módulos mencionados tienen documentación en sus exportaciones principales.

**Acceptance Scenarios**:

1. **Given** el módulo `src/lib/reporte-lifecycle.ts`, **When** un desarrollador lo abre, **Then** ve JSDoc en las funciones `darDeBajaReporte` y `reactivarReporte` que describen parámetros, retornos y efectos secundarios.
2. **Given** el módulo `src/lib/circulo-confianza.ts`, **When** un desarrollador lo abre, **Then** ve JSDoc en las funciones principales (`agregarContacto`, `listarContactos`, `obtenerVistaAgregada`, etc.).
3. **Given** el módulo `src/lib/proxy.ts`, **When** un desarrollador lo abre, **Then** ve JSDoc que documenta la lógica de redirección por rol.
4. **Given** el módulo `src/lib/ai/classifier.ts`, **When** un desarrollador lo abre, **Then** ve JSDoc en las funciones `clasificarReporte` y `clasificarConVotos`.
5. **Given** el módulo `src/lib/param-encryption.ts`, **When** un desarrollador lo abre, **Then** ve JSDoc en las funciones de cifrado/descifrado y verificación de clave.
6. **Given** un componente pequeño, **Then** no se añade JSDoc (acuerdo: solo módulos clave de negocio/infraestructura).

---

## Edge Cases

- **US1**: ¿Qué pasa si un rol futuro se añade a `ADMIN_ROLES`? Los tests fallarán y forzarán una actualización explícita, lo cual es deseado.
- **US1**: ¿Qué pasa si una ruta admin-only cambia de prefijo? Los tests de proxy deben actualizarse junto con la ruta.
- **US2**: Si `AGENTS.md` se actualiza, `ARCHITECTURE.md` debe revalidarse para mantener coherencia.
- **US3**: Si el JSDoc usa tipos que cambian en Prisma, `tsc` detectará la inconsistencia.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE tener tests de Vitest que verifiquen la visibilidad de navegación por rol para `ComiteSubNav` y `AdminNav`.
- **FR-002**: El sistema DEBE tener tests de Vitest que verifiquen las redirecciones del proxy por rol para rutas protegidas del comité y del área admin.
- **FR-003**: El sistema DEBE tener tests de Vitest que verifiquen las funciones de permisos de `src/lib/operadores/permisos.ts` para cada rol y escenario de aislamiento.
- **FR-004**: Los tests DEBEN declarar explícitamente qué elementos ve cada rol y qué elementos no ve.
- **FR-005**: El documento `docs/ARCHITECTURE.md` DEBE existir y cubrir capas de la aplicación, flujo de datos y convenciones.
- **FR-006**: El documento `docs/ARCHITECTURE.md` DEBE complementar `AGENTS.md` sin contradecirlo.
- **FR-007**: Los módulos `src/lib/reporte-lifecycle.ts`, `src/lib/circulo-confianza.ts`, `src/lib/proxy.ts`, `src/lib/ai/classifier.ts` y `src/lib/param-encryption.ts` DEBEN tener JSDoc en sus exportaciones principales.
- **FR-008**: El JSDoc DEBE ser preciso y no alterar el comportamiento funcional del código.
- **FR-009**: No se DEBE añadir JSDoc a componentes de UI pequeños.
- **FR-010**: Todos los tests y documentación DEBEN pasar `npx tsc --noEmit`, `npm run lint` y `npm run test`.

### Key Entities

- **Rol**: `ADMIN`, `SCHOOL_ADMIN`, `OPERADOR`, `COMITE_VALIDACION`, `PARENT`.
- **Navegación**: `AdminNav`, `ComiteSubNav`.
- **Proxy**: middleware de ruta `src/lib/proxy.ts`.
- **Permisos**: funciones de `src/lib/operadores/permisos.ts`.
- **Arquitectura**: documento `docs/ARCHITECTURE.md`.
- **JSDoc**: anotaciones en módulos clave de negocio/infraestructura.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Existe un archivo de tests `src/lib/role-visibility.test.tsx` que cubre al menos los 9 escenarios de aceptación de US1.
- **SC-002**: Los tests de visibilidad por rol pasan en `npm run test`.
- **SC-003**: `docs/ARCHITECTURE.md` existe y tiene al menos 4 secciones: capas, flujo de datos, convenciones y seguridad/despliegue.
- **SC-004**: Los 5 módulos clave tienen JSDoc en sus exportaciones principales.
- **SC-005**: `npx tsc --noEmit`, `npm run lint` y `npm run test` pasan sin errores introducidos por este spec.
- **SC-006**: El spec 047 se cierra con `cierre.md` y sección de Implementación en `spec.md`.

---

## Assumptions

- El código funcional actual es correcto; este spec solo añade tests y documentación.
- El programa de saneamiento continúa con specs posteriores (sin tocar SPEC-050 ni SPEC-060).
- Los tests de UI se ejecutan con `jsdom` y `@testing-library/react` como indica la constitución.
- El proxy se puede testear mockeando `next/server` o invocando `proxyCore` de forma indirecta.
- No se requieren migraciones de base de datos.

---

## Implementación (documentado al cerrar el spec)

### Objetivo alcanzado

Se entregó un paquete de tests de visibilidad por rol, un documento de arquitectura técnica y JSDoc en los módulos clave, sin modificar comportamiento funcional.

### Decisiones de diseño

- **Tests centralizados**: se creó `src/lib/role-visibility.test.ts` para agrupar las pruebas de visibilidad por rol. Se prefirió un único archivo con todos los escenarios para facilitar mantenimiento y auditoría del saneamiento.
- **Módulos de JSDoc**: se eligieron `reporte-lifecycle.ts`, `circulo-confianza.ts`, `proxy.ts`, `ai/classifier.ts` y `param-encryption.ts` porque son los módulos de negocio/infraestructura que más impactan en seguridad y flujo de datos.
- **Arquitectura**: `docs/ARCHITECTURE.md` se redactó como complemento de `AGENTS.md`, con énfasis en capas, flujo de datos y convenciones, no en reglas operativas.

### Archivos afectados

- `src/lib/role-visibility.test.tsx` (nuevo).
- `docs/ARCHITECTURE.md` (nuevo).
- `src/lib/reporte-lifecycle.ts` (JSDoc).
- `src/lib/circulo-confianza.ts` (JSDoc).
- `src/lib/proxy.ts` (JSDoc).
- `src/lib/ai/classifier.ts` (JSDoc).
- `src/lib/param-encryption.ts` (JSDoc).
- `specs/047-tests-rol-arquitectura/*` (artefactos Spec-Kit).

### Tests y validación

- `npm run test`: OK, incluyendo los nuevos tests de visibilidad por rol.
- `npx tsc --noEmit`: OK.
- `npm run lint`: OK (sin nuevos warnings).
- `./scripts/dev-restart.sh`: OK, healthcheck OK, un solo worker.
- `quickstart.md` verificado.

### Migraciones

Ninguna. No se modifica el modelo de datos.

### Deuda técnica

- Los tests de proxy usan mocks de `next/server`. Si Next.js cambia la API de `NextRequest`/`NextResponse`, los tests requerirán ajuste.
- El JSDoc es manual; un futuro spec puede automatizar parte con `typedoc` o similar.
