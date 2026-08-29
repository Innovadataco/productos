# Implementation Plan: SPEC-176 — Cursos: ver y reactivar desactivados

**Branch**: `work/002-pi-073` | **Date**: 2026-08-18 | **Spec**: [spec.md](./spec.md)

---

## Summary

Toggle "Mostrar desactivados" en la página de cursos + reactivación con el endpoint de estado existente. Tres capas mínimas: repositorio (opción incluir inactivos), endpoint (query param validado), UI (toggle + badge + botón Activar).

---

## Estado actual (verificado en fuente)

- `src/lib/dal/repositories/curso.ts:55`: `listarActivos(colegioId)` — `where: { colegioId, estado: "activo" }`, orden por nombre.
- `src/app/api/colegio/cursos/route.ts`: GET sin query params; usa el repo (frontera DAL respetada).
- `src/app/api/colegio/cursos/[id]/estado/route.ts`: PATCH con `estadoActivoSchema` (`activo`|`inactivo`), ya audita y responde sin cambio si el estado es el mismo.
- `src/app/dashboard/colegio/cursos/CursosPageClient.tsx`: client component con fetch a `/api/colegio/cursos`; ya tiene la acción "Desactivar" (línea ~60) que llama ese PATCH — el patrón a reusar para "Activar".

---

## Cambios

### 1. Repositorio (`src/lib/dal/repositories/curso.ts`)

```ts
/** Cursos del colegio; por defecto solo activos. Con incluirInactivos trae todos. */
listarPorColegio(colegioId: string, opts?: { incluirInactivos?: boolean }) {
    return this.db.curso.findMany({
        where: { colegioId, ...(opts?.incluirInactivos ? {} : { estado: "activo" }) },
        select: LISTADO_SELECT, // el mismo select de listarActivos
        orderBy: { nombre: "asc" },
    });
}
```
`listarActivos` queda como wrapper (`listarPorColegio(id)`) para no romper llamantes.

### 2. Endpoint (`src/app/api/colegio/cursos/route.ts`)

- Query: `?incluirInactivos=true` con Zod (`z.enum(["true","false"]).optional()` o coerce boolean), default false.
- Con el flag llama `listarPorColegio(colegioId, { incluirInactivos: true })`.

### 3. UI (`CursosPageClient.tsx`)

- Estado `mostrarInactivos` (default false); al cambiarlo, refetch con el query param.
- Toggle visible arriba de la lista ("Mostrar desactivados").
- Filas inactivas: badge "Desactivado" (tono tinta/ambar, tokens del proyecto) + botón "Activar" (PATCH estado activo, mismo flujo de confirmación que Desactivar si lo hay — si Desactivar no pide confirmación, Activar tampoco).
- En la tarjeta/tabla de un activo NO se muestra "Activar".

### 4. Tests

- `src/app/api/colegio/cursos/route.test.ts` (integration): sin flag → solo activos; con flag → incluye inactivos; inactivos de otro colegio nunca aparecen; reactivación vía PATCH deja el curso en activo y auditado (o test ya existente del PATCH + caso de ida y vuelta).
- `CursosPageClient.test.tsx` (unit): toggle cambia el fetch (URL con query), inactivos muestran badge + botón Activar, activos no lo muestran. Añadir a `vitest.unit.includes.ts` si es archivo nuevo.

### 5. Arquitectura

- Regenerar `docs/architecture/` si el endpoint cambia de firma visible (query param documentado en 03-pantallas si el generador lo captura). `arch:check` verde.

---

## Verificación

Gate local completo (tsc · lint --no-cache · arch:check · tokens · unit · integration · journeys · build · arranque) + CI del PR verde.
