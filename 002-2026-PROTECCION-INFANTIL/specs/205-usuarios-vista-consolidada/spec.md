# SPEC-205 — Usuarios · Vista consolidada por rol (002-PI-102)

> Status: `PLANEADO`
> PI: 002-PI-102
> Responsable: ODIN
> Rama: `work/002-pi-102`
> Base: `feature/001-scaffolding`

## Contexto

La pantalla `/dashboard/admin/usuarios` es hoy una plantilla genérica sin propósito operativo (I-102). Los sub-tabs agregados en SPEC-197/I-97 cargan listados, pero las columnas son iguales para todos los roles y no responden a la pregunta real del admin: *¿qué está haciendo cada usuario y qué debo hacer con él?*. Además, el mismo operador aparece con conteos distintos entre `/usuarios/operadores` y `/operadores/asignar` porque usan consultas diferentes.

Este SPEC rediseña `/dashboard/admin/usuarios` como tablero operativo consolidado: KPI arriba, tablas útiles por rol y detalle cruzado que mezcla `Usuario + PerfilOperador + Reporte + IntegranteComite + Colegio`. Cierra I-102 y refina I-97.

## User Stories

| ID | User Story | Priority |
|---|---|---|
| US-001 | Como admin, quiero ver una fila de 5 KPI (Padres, Rectores, Operadores, Comité, Admins) con totales y segregación por estado, para saber de un vistazo cuántos usuarios tengo y cómo están. | Must |
| US-002 | Como admin, quiero que el KPI y el total de cada sub-tab salgan del mismo query, para no ver números contradictorios. | Must |
| US-003 | Como admin, quiero que la tabla de cada sub-tab muestre columnas relevantes al rol (no genéricas), para entender la carga real de cada usuario. | Must |
| US-004 | Como admin, quiero abrir el detalle de un usuario y ver información cruzada por rol, para decidir si reasignar, bloquear, editar cupo o ver su colegio. | Must |
| US-005 | Como admin, quiero que los conteos de operadores en `/usuarios/operadores` sean idénticos a los de `/operadores/asignar`, para confiar en la cifra. | Must |
| US-006 | Como admin, quiero distinguir "Comité de convivencia" (por colegio) de "Comité de validación" (plataforma) en sub-tabs separados, para no mezclar funciones. | Must |

## Acceptance Scenarios

### AS-001 · Dashboard KPI consolidado
**Given** el admin está en `/dashboard/admin/usuarios`  
**When** carga la página  
**Then** ve 5 tarjetas (Padres, Rectores, Operadores, Comité, Admins), cada una con total, activos, inactivos, bloqueados y una alerta visual cuando aplica.

### AS-002 · Fuente única del contador
**Given** el admin cambia de sub-tab  
**When** compara el número total del KPI con el total de la tabla  
**Then** ambos coinciden porque provienen del mismo agregado.

### AS-003 · Tablas por rol
**Given** el admin hace clic en "Operadores"  
**When** carga la tabla  
**Then** las columnas son: Nombre, Cupo, Casos abiertos, En proceso, Cerrados 30d, Tiempo medio, Estado — y los valores coinciden con `/operadores/asignar`.

### AS-004 · Detalle de operador consolidado
**Given** el admin abre el detalle de un operador  
**When** carga la ficha  
**Then** ve 3 tarjetas grandes (Abiertos · En proceso · Cerrados), tiempo medio, tasa de escalamiento, cupo actual/máximo, histórico de reasignaciones y un link a la bandeja filtrada por ese operador.

### AS-005 · Detalle de rector consolidado
**Given** el admin abre el detalle de un rector  
**When** carga la ficha  
**Then** ve el/los colegio(s) que dirige, integrantes por rol, reportes del colegio y accesos recientes, con link a `/estadisticas/operacion/colegios/[id]`.

### AS-006 · Cero divergencia operadores
**Given** hay operadores activos con casos asignados  
**When** se comparan `/api/admin/usuarios?rol=OPERADOR` y `/api/admin/operadores/asignacion`  
**Then** la suma de casos abiertos y el total de operadores coinciden.

### AS-007 · Campos vacíos nunca crudos
**Given** un usuario sin colegio asignado  
**When** se renderiza su fila o ficha  
**Then** aparece "—" o "Sin colegio asignado", nunca `null` o un campo en blanco.

## Functional Requirements

- **FR-001**: El sistema DEBE mostrar 5 tarjetas KPI en `/dashboard/admin/usuarios` (Padres, Rectores, Operadores, Comité, Admins). Cada tarjeta DEBE incluir total, activos, inactivos y bloqueados.
- **FR-002**: El KPI y el `total` de cada sub-tab DEBEN provenir del mismo query agregado; no se permiten dos `count()` independientes.
- **FR-003**: El sistema DEBE mantener sub-tabs: Padres, Rectores, Operadores, Comité de convivencia, Comité de validación, Admins. El KPI "Comité" DEBE agregar ambos sub-tabs.
- **FR-004**: La tabla "Padres" DEBE mostrar: Nombre, Email, Reportes enviados, Últimos 30d, Colegios asociados, Estado.
- **FR-005**: La tabla "Rectores" DEBE mostrar: Nombre, Colegio(s) que dirige, Alumnos, Profesores, Cursos, Reportes del colegio, Último acceso.
- **FR-006**: La tabla "Operadores" DEBE mostrar: Nombre, Cupo, Casos abiertos, En proceso, Cerrados 30d, Tiempo medio, Estado. Los conteos DEBEN ser idénticos a `/api/admin/operadores/asignacion`.
- **FR-007**: La tabla "Comité de convivencia" DEBE mostrar: Nombre, Colegio asociado, Casos escalados abiertos, Resueltos, Tiempo medio, Estado.
- **FR-008**: La tabla "Comité de validación" DEBE mostrar: Nombre, Casos escalados a plataforma, Últimas decisiones, Estado.
- **FR-009**: La tabla "Admins" DEBE mostrar: Nombre, Email, Módulos gestionados, Último acceso, Estado.
- **FR-010**: El detalle DEBE ser específico por rol (no un template compartido) y DEBE incluir acciones útiles: bloquear, reasignar, ver bandeja filtrada, editar cupo (operador), ver ficha del colegio (rector/comité).
- **FR-011**: El endpoint para operadores DEBE reutilizar `OperadorService.panelAsignacion()` o extraer el mismo query agregado; cero divergencia con `/operadores/asignar`.
- **FR-012**: Los endpoints DEBEN validar `verifyAuth("ADMIN")` y `assertModulo(..., "usuarios_admin")`.
- **FR-013**: Los listados DEBEN ser paginados (default 25, máx 100) y DEBEN respetar rate-limit `admin_read`.
- **FR-014**: La UI DEBE usar terminología en criollo: "Padres", "Rectores", "Operadores", "Comité de convivencia", "Comité de validación", "Admins"; nunca códigos de rol (`PARENT`, `SCHOOL_ADMIN`, etc.).
- **FR-015**: Si un dato falta, la UI DEBE mostrar "—" o un motivo explícito (p. ej. "Sin colegio asignado").
- **FR-016**: No se DEBE modificar `src/lib/ai/**`, rate-limit ni migraciones existentes.

## Non-Functional Requirements

- **NFR-001**: Tiempo de carga del dashboard KPI + sub-tab inicial < 1 s en cache frío local; < 500 ms detalle de operador.
- **NFR-002**: Cero PII de reportes en agregados: nunca se devuelve texto de reporte, identificador de menor ni denunciante.
- **NFR-003**: Los tests nuevos DEBEN cubrir: coincidencia de conteos operadores, render de KPI, detalle por rol, filtro de listados.
- **NFR-004**: Gate local completo: `tsc --noEmit`, `lint --no-cache`, `arch:check`, `test`, `build`.

## Success Criteria

- **SC-001**: `/dashboard/admin/usuarios` carga KPI + sub-tab activo en < 1 s.
- **SC-002**: Totales del KPI coinciden con totales de sub-tab para los 6 tabs.
- **SC-003**: `/usuarios/operadores` y `/operadores/asignar` muestran los mismos casos abiertos por operador.
- **SC-004**: El detalle de cada rol renderiza sin errores y con acciones útiles.
- **SC-005**: Gate local completo verde.
- **SC-006**: CI 6/6 verde en el PR a `feature/001-scaffolding`.

## Assumptions

- El módulo `usuarios_admin` y la ruta `/dashboard/admin/usuarios` existen (SPEC-194/197).
- `OperadorService.panelAsignacion()` es la fuente correcta de conteos operativos (SPEC-053).
- `OperadorMetricasService.obtenerMetricas()` provee métricas detalladas de operador (SPEC-189).
- `UsuarioRepository`, `ReporteRepository` y repositorios de colegio/comité ya existen y soportan lecturas agregadas.
- La tabla `Usuario` tiene `rol`, `estado`, `creadoEn`, `ultimaSesion`, `colegioId`, `tenantId`.
- `PerfilOperador` tiene `cupoMaximo`; `IntegranteComite` tiene `comiteId`, `estado`.

## Decisiones propuestas para compuerta §4

1. **Fuente única de conteos**: crear `UsuarioDashboardService` que, en una sola pasada, agregue `COUNT(*) FILTER (WHERE rol = ...)` por estado. El mismo servicio alimenta KPI y totales de sub-tab. Para operadores, reutilizar `OperadorService.panelAsignacion()` en lugar de contar de nuevo.
2. **Sub-tab Comité dividido**: 6 sub-tabs (Padres, Rectores, Operadores, Comité de convivencia, Comité de validación, Admins). El KPI "Comité" suma convivencia + validación.
3. **Detalle por rol**: 6 renders distintos en el cliente, seleccionados por `usuario.rol`. El backend devuelve un DTO consolidado con las secciones necesarias; el cliente decide qué mostrar.
4. **Reuso operadores**: el endpoint `GET /api/admin/usuarios?rol=OPERADOR` delega en `OperadorService.panelAsignacion()` para los conteos, garantizando cero divergencia.
5. **Navegación**: `UsuariosSubNav` se actualiza a 6 tabs; el tab activo usa `pathname.startsWith(href)` para soportar `/usuarios/[rol]/[id]`.
6. **No migraciones**: todos los datos se derivan de tablas existentes; si un agregado es lento, se añaden índices aditivos en una fase posterior.

## Impacto en arquitectura:

Cambios en UI del admin (`src/app/dashboard/admin/usuarios/**`, `src/components/modules/admin/**`) y nuevos endpoints/servicios de solo lectura (`src/app/api/admin/usuarios/**`, `src/lib/dal/services/usuarios-consolidado.ts`). Se reutilizan servicios existentes (`OperadorService`, `OperadorMetricasService`, `UsuarioRepository`, `ReporteRepository`). No se toca el motor, el rate-limit ni el esquema de BD. Posibles índices aditivos si los agregados lo requieren.

## Deuda Técnica

- Ninguna identificada en la fase de diseño.
