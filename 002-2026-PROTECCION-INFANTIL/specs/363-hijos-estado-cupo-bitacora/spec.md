# SPEC-363 · El PATCH de estado del menor pasa por cambiarEstadoHijo (BUG1 + BUG2)

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-01 · **Dev**: PI-2 · **Origen**: auditoría (CEO idc-71) — 2 bugs confirmados en `hijos.ts` + `[id]/route.ts`

## El punto único

Los dos bugs nacen del mismo lugar: el `PATCH /api/padre/hijos/[id]` de estado pasaba por
`actualizarHijo` en vez de `cambiarEstadoHijo`.

- **BUG 1 (alta) — cupo burlable al reactivar:** `actualizarHijo` no cuenta activos. Un padre con 5
  activos podía: inactivar 1 (200) → registrar el 6º (201) → reactivar el inactivo (200 sin chequeo)
  = **6 activos con tope 5**.
- **BUG 2 (bloqueante) — la bitácora no anota pausar/reactivar:** `actualizarHijo` audita
  `{ campos: ["estado"] }` SIN el valor. La bitácora del menor (consumidor de PI-1) lee
  `valorNuevo.estado` → null → no hay hito. La única función que audita `{ estado }` con el valor es
  `cambiarEstadoHijo`, pero ningún route la llamaba.

## Requisitos

- **FR-001**: El PATCH de estado DEBE pasar por `cambiarEstadoHijo` (audita `{estado}` con valor).
- **FR-002**: Un PATCH puede traer estado Y correcciones de datos: se separan (estado →
  `cambiarEstadoHijo`, datos → `actualizarHijo`).
- **FR-003**: `cambiarEstadoHijo`, al REACTIVAR (inactivo→activo), cuenta contra el tope de activos y
  rebota 409 con el MISMO texto aprobado. Reafirmar "activo" sobre uno ya activo no consume cupo.
- **FR-004**: El tope y su mensaje viven en UN solo lugar, compartidos por el alta (POST) y la
  reactivación (PATCH).
- **FR-005**: Los tests pasan por el route/handler real, no por `cambiarEstadoHijo` directo.

## Impacto en arquitectura:

Un helper nuevo (`src/lib/padre/tope-hijos.ts`) que centraliza el tope y su texto — fuera de
`hijos.ts` a propósito (cadena de workers, SPEC-197). El cupo se inyecta a `cambiarEstadoHijo` desde
la ruta (el servicio no lee parámetros). Sin migraciones, sin cambios de esquema.
