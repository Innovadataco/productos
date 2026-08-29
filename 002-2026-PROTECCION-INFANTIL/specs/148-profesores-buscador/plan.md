# Implementation Plan: SPEC-148 — Profesores + buscador global ⌘K

**Branch**: `work/002-pi-058` | **Date**: 2026-08-08 | **Spec**: [spec.md](./spec.md)

## Summary

Pantalla `/dashboard/colegio/profesores/` sobre el CRUD existente (SPEC-145) +
primitivo `CommandPalette` (⌘K, portal, a11y completa) + endpoint
`GET /api/colegio/buscar` tenant-first con resultados agrupados (< 200 ms con 500
registros, debounce 250-300 ms).

## Technical Context

**Stack**: Next.js 16.2.10 · Prisma 5.22.0 · Tailwind tokens · Vitest. **Storage**:
sin cambio de schema. **Constraints**: tenant-first · solo activos · < 200 ms ·
terminología §3 · tokens only · I-29.

## Project Structure

```text
src/
├── app/
│   ├── api/colegio/buscar/route.ts           # GET agrupado + route.test.ts
│   └── dashboard/colegio/profesores/
│       ├── page.tsx                          # server guarda
│       └── ProfesoresPageClient.tsx          # tabla + form + baja/reactivar
├── components/
│   ├── ui/CommandPalette.tsx                 # NUEVO + test a11y
│   └── modules/colegio/BuscadorGlobal.tsx    # monta palette en layout colegio
├── lib/
│   ├── dal/repositories/
│   │   ├── busqueda-colegio.ts               # NUEVO (ilike por grupo) + test A/B/timing
│   │   └── profesor.ts                       # (existente, sin tocar salvo necesidad)
│   ├── nav-items.ts                          # + "Profesores"
│   └── colegio/                              # hooks auxiliares si hacen falta
└── app/dashboard/colegio/layout.tsx          # monta BuscadorGlobal (único toque)
```

## Fases

1. **Datos**: repo de búsqueda + endpoint + tests (A/B, timing 500).
2. **UI**: CommandPalette + página profesores + nav + placeholder home.
3. **Cierre**: checks de día + tokens:check + arch:check (oráculo 54→55).

## Complexity Tracking

Sin violaciones.
