# Implementation Plan: Spec 100 — Correcciones módulo Colegios (+ Comité)

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-27 | **Spec**: [spec.md](./spec.md)

> Backfill documental (cierre cola 002-PI-014): plan reconstruido a partir del spec.md,
> el cierre.md y el commit `623f6b31`. Documenta lo hecho.

## Summary

Once correcciones de UX/funcionalidad del módulo de colegios y del comité: cascada de
ubicación, período de servicio calculado en servidor (con `LIBRE` para fechas manuales),
validación fin>inicio en cliente y servidor, selects cerrados (grado 1–11, plataforma de
catálogo), tipo de identificador inferido en servidor, fix de la sesión de colegio en el
header (I-25, causa raíz en el proxy), enforcement central de cambio de contraseña por
`debeCambiarPassword`, logo con enlace al home del rol y rótulos del comité (cuenta de
acceso vs roster sin login).

## Diseño (por punto)

1. **C-1 (cascada ubicación)**: nuevo `GET /api/departamentos` (espejo de `/api/paises`);
   `/api/ciudades?departamentoId=`; `/api/departamentos` en `PUBLIC_ROUTES` del proxy;
   formulario `NuevoColegioPageClient.tsx` con selects dependientes (reseteo en handlers).
   El backend ya validaba `departamentoId`.
2. **C-2 (período)**: valor `LIBRE` agregado al enum `TipoPeriodoServicio` (migración
   aditiva `ALTER TYPE ADD VALUE`); `src/lib/colegio/periodo.ts` (`calcularFinServicio`:
   +1/+6/+12 meses; LIBRE→null). El SERVIDOR recalcula fin para períodos no libres
   (no confía en el cliente). UI: fin oculta con preview calculado; LIBRE muestra fechas.
3. **C-3 (fin>inicio)**: `esRangoServicioValido` en `periodo.ts`; validación en POST y
   PATCH (cruzada con valores actuales); `min={inicio}` en los date pickers de fin.
4. **C-6 (grado)**: `GRADO_OPTIONS` en `src/lib/colegio/grados.ts`; selects en crear y
   editar curso.
5. **C-4 (tipo identificador)**: campo eliminado del modal; `tipo` opcional en
   `identificadorAlumnoBodySchema`; el servidor infiere (email/teléfono/nick) con
   `inferirTipoIdentificador` (`src/lib/colegio/normalizacion.ts`).
6. **C-5 (plataforma)**: ya era select del catálogo `Plataforma` (verificado, sin cambios).
7. **I-25 (🔴 header público con sesión)**: causa raíz — el proxy devolvía 403 a
   `GET /api/me` para SCHOOL_ADMIN y el `AuthContext` quedaba vacío. Fix: helper
   `esRutaPermitidaSchoolAdmin` (rutas colegio + `/api/me` + `/cambiar-password`) en
   `src/lib/proxy.ts`; `ColegioNav` monta `ColegioLogoutButton`.
8. **C-9 (cambio de contraseña central)**: enforcement en layouts
   `/dashboard/colegio` y `/dashboard/admin` con verdad de BD
   (`debeCambiarPassword=true` → redirect a `/cambiar-password`, cualquier rol). El bucle
   del proxy (bloqueaba `/cambiar-password` al colegio) se resolvió con el mismo helper.
9. **C-7 (botón inhabilitado)**: no existe el botón reportado en el código; el único
   inhabilitado permanente posible era "Descargar PDF" tras error de carga → `ErrorState`
   con reintento. Documentado en el cierre.
10. **C-8 (logo)**: `NavHeader.tsx` enlaza al home del rol autenticado.
11. **COM-1/2**: rótulos "Cuenta de acceso del comité" (credencial temporal del sistema)
    vs "Integrantes (roster, sin acceso; email de contacto)". Solo textos.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Migración Prisma colando `DROP INDEX` HNSW | SQL editado a mano; índices verificados con `scripts/verify-hnsw-indexes.ts` |
| Bucle de redirect colegio ↔ cambiar-password | El proxy admite `/cambiar-password` para SCHOOL_ADMIN (mismo fix de I-25) |
| Romper el flujo del comité | Enforcement por `debeCambiarPassword` genérico; el redirect de login del comité intacto |
| Inferencia de tipo incorrecta | Tests de `inferirTipoIdentificador` (email/teléfono/nick) |

## Pruebas

21 tests nuevos: `periodo.test.ts` (9), `normalizacion.test.ts` (7), `proxy.test.ts` (5),
colegios POST (rechazo LIBRE fin≤inicio; cálculo servidor MENSUAL), identificadores (tipo
inferido). Gate: lint + test + tsc + build (906/906).
