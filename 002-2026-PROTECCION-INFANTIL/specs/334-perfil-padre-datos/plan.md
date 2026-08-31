# Implementation Plan: El padre registra los datos de su perfil

**Branch**: `work/pi-SPEC-334-perfil-padre-datos` | **Date**: 2026-08-31 | **Spec**: [spec.md](./spec.md)

**Input**: Prioridad CEO directa. Base `origin/main` (478cc4769).

## Summary
El padre no puede registrar sus datos. Migración aditiva a `Usuario` (apellidos, fechaNacimiento, telefono, paisId, ciudadId), endpoint `GET/PATCH /api/padre/perfil`, y pantalla real editable `/dashboard/padre/perfil` con país/ciudad del catálogo (sin "Otra ciudad") y selector de fecha.

## Technical Context
- **Stack**: Next.js 15 / React 19 / Prisma 5.22 (PostgreSQL) / Tailwind (tokens) / Vitest.
- **Storage**: migración aditiva a `Usuario`: `apellidos String?`, `fechaNacimiento DateTime?`, `telefono String?`, `paisId String?`(FK Pais), `ciudadId String?`(FK Ciudad). Nullable, sin backfill. schema-to-schema (node_modules propio — `npm ci` en el worktree).
- **DAL frontier (Q-3)**: acceso a `Usuario`/catálogo por repositorio; sin Prisma directo en la ruta.
- **Reuso**: `CiudadSearchSelect` (`permitirOtra=false`), catálogo `Pais`/`Ciudad`, `verifyAuth("PARENT")`.
- **Validación**: teléfono no vacío/formato (Zod en el endpoint); fecha nac como `<input type="date">` claro.

## Constitution Check
- Spec Kit ✅ · DAL frontier ✅ · migración aditiva/reversible ✅ · reuso no paralelo ✅ · arch:check (ruta `/dashboard/padre/perfil` deja de ser placeholder → nuevo endpoint `/api/padre/perfil` → regenerar `02-roles-capacidades.md`; esquema tocado → regenerar `01-modelo-datos.md`) ✅ esperado. Sin violaciones.

## Estructura
```text
prisma/schema.prisma + migrations/          # migración aditiva Usuario
src/lib/dal/repositories/usuario.ts          # métodos perfil (leer/actualizar 6 campos)  [o repo existente]
src/app/api/padre/perfil/route.ts            # GET + PATCH (Zod: telefono validado)
src/app/dashboard/padre/perfil/page.tsx      # pantalla real (reemplaza placeholder)
src/components/modules/padre/PerfilPadreForm.tsx  # formulario editable + CiudadSearchSelect
```

## Fases
1. Migración (`Usuario` +5 campos) + `prisma generate`.
2. Endpoint `GET/PATCH /api/padre/perfil` (DAL) + Zod.
3. Pantalla `/dashboard/padre/perfil` + form (país→ciudad, fecha, teléfono).
4. arch regen + tsc + lint + specs-discipline + evidencia navegador (6 campos → guardar → recargar → persisten) en el PR.

Un solo PR. Antes de REALIZADO: `specs-discipline.test.ts` local + hora `TZ`.
