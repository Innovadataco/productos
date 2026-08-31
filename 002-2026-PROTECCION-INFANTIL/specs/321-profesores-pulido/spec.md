# SPEC-321 · Pulido de la pantalla de profesores (SPEC-B de A-58) · 002-PI-221

**Status**: IMPLEMENTADO
**Radicado**: 002-PI-221 · SPEC-B (diferido de A-58/SPEC-320) · colegio · NO toca `/dashboard/padre`
**Impacto en arquitectura:** ninguno — un `_count` filtrado en el listado de profesores (repo/API) y tres ajustes de UI en `ProfesoresPageClient`. Sin cambio de esquema.

## Problema (verificado en main 478cc4769)

1. **P5 — botón duplicado:** `ProfesoresPageClient.tsx` tiene DOS "Agregar profesor" (header `:273` + CTA del estado vacío `:321`). Cuando la lista está vacía se ven ambos.
2. **P8 — copy confuso:** el toggle de estado `:384` dice "Dar de baja" / "Reactivar". Debe decir **"Inactivar" / "Activar"** (claro y simétrico). Ya alterna el estado; se mantiene esa conducta.
3. **P10 — falta el conteo:** la lista NO muestra los identificadores activos por profesor. Agregar una columna con el **conteo de `IdentificadorProfesor` con `estado='activo'`** por profesor.

## Requisitos funcionales

- **FR-001** La pantalla muestra UN solo botón "Agregar profesor" (se conserva el del header, siempre visible; se quita el duplicado del estado vacío — el texto del empty-state queda).
- **FR-002** El botón de estado dice "Inactivar" cuando el profesor está activo y "Activar" cuando está inactivo, y alterna el estado (conducta actual intacta).
- **FR-003** El listado de profesores incluye, por profesor, el conteo de identificadores activos (`IdentificadorProfesor.estado='activo'`), expuesto por el repo/API.
- **FR-004** La tabla muestra una columna "Identificadores" con ese conteo.

## Escenarios (User Story)

- **US1 (P1) — El rector ve la pantalla pulida.** Como `SCHOOL_ADMIN`, en `/dashboard/colegio/profesores` veo un solo botón de agregar, el toggle dice Inactivar/Activar y alterna, y cada fila muestra cuántos identificadores activos tiene el profesor.

## Success Criteria

- **SC-001** Verificación en navegador como rector (candado 25): un solo botón, toggle Inactivar/Activar que alterna, y la columna con el conteo. Evidencia en el PR.
- **SC-002** Tests (payload real): el listado devuelve el conteo; `ProfesoresPageClient` renderiza 1 botón, el label del toggle correcto y la columna.
- **SC-003** Job `verificaciones` + `specs-discipline` verdes.

## Fuera de alcance

- Guardas de profesor inactivo / cascada de identificadores (otra pieza de SPEC-B si se pide).
- `/dashboard/padre/**` (frente del padre, otro dev).
