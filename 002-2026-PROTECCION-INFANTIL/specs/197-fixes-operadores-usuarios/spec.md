# SPEC-197 — Fixes operadores + usuarios (002-PI-094)

> Status: `IMPLEMENTADO`
> PI: 002-PI-094
> Responsable: ODIN
> Rama: `work/002-pi-094`
> Base: `feature/001-scaffolding`

## Contexto

Tres fixes operativos detectados por el CEO en el módulo de operadores y la vista unificada de usuarios:

- **I-91**: el botón "Reasignar caso" en `/dashboard/admin/operadores/asignar` genera confusión porque la reasignación real debe hacerse desde la ficha del operador (`/dashboard/admin/operadores/[id]`). En el listado de asignación solo debe quedar "Ver detalle".
- **I-92**: el modal de reasignación (`ReasignarModal.tsx`) permite elegir como destino operadores que ya están al 100% de su cupo, provocando fallos silenciosos o re-asignaciones inválidas. Debe filtrar a operadores con cupo disponible (`casosAbiertos < cupoMaximo`).
- **I-97**: los sub-tabs de `/dashboard/admin/usuarios` (Rectores, Operadores, Comité, Admins) están en el `UsuariosSubNav` pero no tienen página ni listado. Solo el sub-tab "Padres" funciona.

## User Stories

| ID | User Story | Priority |
|---|---|---|
| US-001 | Como admin, quiero que el listado de asignación de operadores solo tenga "Ver detalle", para evitar reasignar desde el lugar incorrecto. | Must |
| US-002 | Como admin, al reasignar un caso quiero que el dropdown destino solo muestre operadores con cupo disponible. | Must |
| US-003 | Como admin, quiero navegar por sub-tabs de usuarios (Rectores, Operadores, Comité, Admins) y ver listados paginados. | Must |

## Acceptance Scenarios

### AS-001 · Quitar botón Reasignar caso del listado
**Given** el admin está en `/dashboard/admin/operadores/asignar`  
**When** la tabla carga operadores activos  
**Then** cada fila muestra solo el enlace "Ver detalle"; no hay botón "Reasignar caso".

### AS-002 · Operadores destino con cupo disponible
**Given** el admin abre el modal de reasignación desde la ficha de un operador  
**When** se cargan los operadores destino  
**Then** no aparecen operadores donde `casosAbiertos >= cupoMaximo`; tampoco el operador actual.

### AS-003 · Sub-tabs de usuarios funcionales
**Given** el admin está en `/dashboard/admin/usuarios`  
**When** hace clic en "Rectores", "Operadores", "Comité" o "Admins"  
**Then** se carga el listado paginado del rol correspondiente con las mismas columnas base del sub-tab Padres.

## Functional Requirements

- **FR-001**: En `src/app/dashboard/admin/operadores/asignar/page.tsx` eliminar el botón "Reasignar caso" y la lógica asociada (`iniciarReasignacion`, `ReasignarModal`, estado `reasignandoId`).
- **FR-002**: `ReasignarModal.tsx` debe consumir `/api/admin/operadores` y filtrar opciones destino a operadores activos con `casosAbiertos < cupoMaximo`, excluyendo el operador actual.
- **FR-003**: Crear páginas `src/app/dashboard/admin/usuarios/{rectores,operadores,comite,admins}/page.tsx` que rendericen `UsuariosAdminClient` con el rol correspondiente.
- **FR-004**: `UsuariosAdminClient` debe aceptar el rol vía prop en lugar de depender exclusivamente de `?rol` en query string.
- **FR-005**: El schema `usuariosQuerySchema` ya soporta `SCHOOL_ADMIN`, `OPERADOR`, `COMITE_VALIDACION` y `ADMIN`; no requiere cambios.
- **FR-006**: El sub-tab "Comité" debe listar roles `COMITE_VALIDACION` y `COMITE_CONVIVENCIA`.

## Non-Functional Requirements

- **NFR-001**: No tocar `src/lib/ai/**`, rate-limit ni motor.
- **NFR-002**: Cero migraciones de BD; los cambios son lectura + UI.
- **NFR-003**: Los tests existentes deben seguir pasando; añadir cobertura para los nuevos filtros y páginas.

## Success Criteria

- [x] AS-001, AS-002 y AS-003 pasan en local y CI.
- [x] Gate local completo: typecheck, lint, test, arch:check, build.
- [ ] CI 6/6 verde en el PR.

## Assumptions

- El endpoint `/api/admin/operadores` ya devuelve `casosAbiertos` y `perfil.cupoMaximo` para cada operador.
- El endpoint `/api/admin/usuarios` ya acepta `rol` y pagina resultados.
- `UsuariosSubNav` ya tiene los hrefs correctos; solo faltan las páginas destino.

## Implementation Notes

- Para I-91 se limpia la página de asignación; el modal `ReasignarModal` sigue usándose en `/dashboard/admin/operadores/[id]`.
- Para I-92 se extiende el tipo `OperadorOpcion` en `ReasignarModal.tsx` con `casosAbiertos` y `cupoMaximo` y se aplica filtro adicional.
- Para I-97 se crean páginas server mínimas que pasan `rol` al client; el client conserva compatibilidad con query string como fallback.

## Impacto en arquitectura:

Cambios localizados en UI del módulo admin (`src/app/dashboard/admin/**`, `src/components/modules/operadores/**`, `src/components/modules/admin/**`). No se modifica el motor, el rate-limit, ni el esquema de BD. Se reutilizan endpoints existentes.

## Deuda Técnica

- Ninguna identificada.
