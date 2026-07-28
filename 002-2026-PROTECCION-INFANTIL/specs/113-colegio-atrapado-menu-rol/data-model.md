# Data Model — SPEC-113

**Date**: 2026-07-28 · Sin cambios de schema.

## Rutas de sesión por rol (fuente única: el proxy)

| Ruta | SCHOOL_ADMIN | PARENT | Roles internos |
|------|--------------|--------|----------------|
| `/api/me` | permitida | permitida | permitida |
| `/cambiar-password` (página) | permitida | permitida | permitida |
| `/api/auth/cambiar-password` | **ENTRA con esta spec** | permitida (default) | permitida (default) |
| `/api/auth/logout` | **ENTRA con esta spec** | permitida (default) | permitida (default) |
| `/dashboard/colegio/**` | permitida | — | — |
| `/dashboard`, `/mis-reportes`, `/dashboard/circulo-confianza` | — (menú las oculta, I-36) | permitidas | — |

## Menú del header (I-36)

El menú muestra una entrada solo si `helperDelProxy(rol, rutaDestino)` la permite:
- SCHOOL_ADMIN → solo su área de colegio (+ sesión).
- PARENT → "Mi panel", "Círculo de Confianza", "Mis reportes".
- Roles internos → su área admin/comité (ya existente).
- Anónimo → sin cambios ("Iniciar sesión").
