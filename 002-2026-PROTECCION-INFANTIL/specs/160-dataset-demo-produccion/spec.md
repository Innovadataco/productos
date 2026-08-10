# Feature Specification: SPEC-160 — Dataset demo de producción (002-PI-059)

**Feature Branch**: `work/002-pi-059`

**Created**: 2026-08-10

**Status**: PLANEADO

**Input**: Instructivo 002-PI-059. Poblar `pi.innovadataco.com` con una simulación de "6 meses de operación" para que el CEO explore todo el producto. Motor real (Ollama por Tailscale), correos reales solo a subdirecciones de `soporte@innovadataco.com`.

## Alcance

Crear un dataset demo completo y realista en el entorno de producción, manteniendo una puerta de purga quirúrgica e idempotente que permita borrar todo el demo sin dejar rastro ni tocar datos reales.

## User Scenarios & Testing

### User Story 1 — CEO explora el producto con datos reales (P1)

Como CEO, quiero ver 5 colegios operando con cursos, profesores, alumnos, padres, reportes y flujos de revisión, para evaluar el producto con escenarios reales.

**Independent Test**: tras correr el seed demo, el dashboard de admin muestra 5 colegios, ≥10 operadores, 1 comité, ≥50 padres, reportes clasificados y casos asignados.

**Acceptance Scenarios**:

1. **Given** el script de seed demo, **When** termina, **Then** existen 5 colegios activos con su tenant y SCHOOL_ADMIN cada uno.
2. **Given** cada colegio, **When** se revisa, **Then** tiene 10 cursos, 10 profesores titulares y 200 estudiantes (20 × 10 cursos).
3. **Given** cada estudiante, **When** se revisa, **Then** tiene ≥5 identificadores activos.
4. **Given** el dataset, **When** se listan usuarios, **Then** existen ≥10 OPERADOR, 1 COMITE_VALIDACION y ≥50 PARENT.
5. **Given** algunos padres, **When** se revisa su cuenta, **Then** tienen círculo de confianza con identificadores y reportes asociados a esos identificadores.
6. **Given** los reportes sembrados, **When** se procesan con el motor real, **Then** alcanzan estados finales (`CLASIFICADO`, `REVISION_MANUAL`, `POSIBLE_SPAM`, `CORREGIDO`, etc.) y los casos manuales quedan asignados a operadores.
7. **Given** el comando de purga, **When** se ejecuta, **Then** la BD queda idéntica a antes del seed (conteos a cero en todo lo sembrado) y no se borra ningún dato real.

### User Story 2 — Equipo de soporte recibe credenciales (P1)

Como CEO, quiero una hoja de credenciales demo para acceder con cada rol sin usar datos personales reales.

**Acceptance Scenarios**:

1. Todos los usuarios demo usan subdirecciones `soporte+{rol}{NN}@innovadataco.com`.
2. Una contraseña común, entregada en hoja de credenciales junto con el email de cada rol.
3. Los avisos por email del sistema llegan a esas mismas direcciones.

## Edge Cases

- **Corrida interrumpida**: el seed debe ser resumible (`scripts/reanudar-demo.ts`).
- **Re-ejecución**: debe ser idempotente (no duplicar colegios, usuarios ni reportes).
- **Motor caído**: los reportes quedan `PENDIENTE` y se reanudan cuando Ollama vuelva.
- **Purga parcial**: si falla a mitad, debe poder re-ejecutarse sin dejar huérfanos.
- **Datos reales coexisten**: la purga debe distinguir demo de real sin depender únicamente de nombres arbitrarios.

## Requirements

- **FR-001**: Sembrar 5 colegios con tenant, SCHOOL_ADMIN, representante legal y vigencia de servicio.
- **FR-002**: Sembrar 10 cursos por colegio con profesor titular.
- **FR-003**: Sembrar 20 estudiantes por curso (1.000 total), cada uno con ≥5 identificadores.
- **FR-004**: Sembrar acudientes para los estudiantes (mínimo 1 por estudiante).
- **FR-005**: Sembrar ≥10 OPERADOR y 1 COMITE_VALIDACION globales (no por colegio).
- **FR-006**: Sembrar ≥50 padres PARENT, algunos con círculo de confianza y reportes del círculo.
- **FR-007**: Sembrar reportes anónimos y autenticados a lo largo de 6 meses, usando el banco curado (`scripts/simulacion/`) y variándolo.
- **FR-008**: Mezclar categorías/gravedades: críticos, medios, bajos, SPAM/OTRO.
- **FR-009**: Procesar reportes con el motor real de forma resumible.
- **FR-010**: Asignar reportes a operadores según la lógica real del sistema cuando requieren revisión manual.
- **FR-011**: Ejercer escalamiento operador→comité donde aplique.
- **FR-012**: Todos los correos de usuarios demo deben ser subdirecciones de `soporte@innovadataco.com`.
- **FR-013**: Generar hoja de credenciales con email, rol y contraseña común.
- **FR-014**: MARCAR todo dato demo de forma inequívoca para purga quirúrgica.
- **FR-015**: EXTENDER `purgar-simulaciones.sql` (o su equivalente TypeScript) para borrar todo el árbol demo: colegios, cursos, estudiantes, identificadores, acudientes, profesores, usuarios de todos los roles, círculo de confianza, seguimientos, avisos, grants, reportes y agregados derivados.
- **FR-016**: El comando de purga debe ser idempotente y dejar la BD idéntica a antes del seed.
- **FR-017**: Correos de aviso solo a direcciones `soporte+…@innovadataco.com`; nunca a dominios externos.
- **FR-018**: No tocar `src/lib/ai/**`, Gesmovil ni configuración real.
- **FR-019**: Reutilizar `prisma/seed.ts`, `scripts/generar-reportes-demo.ts`, `scripts/reanudar-demo.ts`, `scripts/simulacion/` y `prisma/seed-modulos-grants.ts`.

## Success Criteria

- Dataset completo y realista en producción.
- CEO puede navegar todos los roles y flujos.
- Purga quirúrgica verificada y documentada.
- Cero correos a direcciones externas.
- Motor, Gesmovil y config real intactos.

## Assumptions

- Existe un usuario ADMIN en producción con credenciales disponibles para invocar las APIs de admin (o se provee token).
- Ollama está accesible por Tailscale para clasificación real.
- El banco curado (`scripts/simulacion/simulacion-200-antes-curaduria.json` y archivos relacionados) contiene textos suficientes y aprobados por el equipo.
- PostgreSQL de producción permite ejecutar transacciones largas para seed/purga.

## Impacto en arquitectura

- Posible migración aditiva para agregar campo `esDemo` (o similar) a entidades de negocio que aún no lo tengan, o uso de una tabla de marcado central `DemoMarcado` (tabla, id, entidad, entidadId, creadoEn).
- Nuevos scripts en `scripts/demo-prod/`:
  - `sembrar-demo.ts`: orquesta todo el dataset.
  - `purgar-demo.ts`: borrado quirúrgico idempotente.
  - `hoja-credenciales.ts`: genera la hoja de acceso.
  - `verificar-purga.ts`: conteos antes/después.
- Reutiliza flujos existentes llamando a los endpoints reales o a servicios DAL, sin duplicar lógica de negocio.
- No cambia el motor de IA ni las reglas de negocio de reportes.
