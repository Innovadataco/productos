# SPEC-317 · Unificar el área del padre (002-PI-217)

**Status**: DESARROLLO
**Radicado:** 002-PI-217 · Fábrica PI-1 (`idc-d9`)
**Brief:** BRIEF-A-54-UNIFICAR-AREA-PADRE.md
**Prioridad:** 🔴 CRÍTICA
**Estimado:** 2-3h

## Impacto en arquitectura:

Unificación de zonas de padre en `/dashboard/padre` como canónica:
- `proxy.ts:199` cambia `homeForRole("PARENT")` de `/dashboard` → `/dashboard/padre`
- `src/app/dashboard/padre/circulo-confianza/page.tsx` re-exporta `src/app/dashboard/circulo-confianza/page.tsx`
- `src/app/dashboard/padre/notificaciones/page.tsx` re-exporta `src/app/dashboard/perfil/notificaciones/page.tsx`
- `NavHeader.tsx`: enlace de círculo de confianza corregido a `/dashboard/padre/circulo-confianza` para PARENT
- `ReporteWizard.tsx`: `REDIRECT_PADRE_POST_ENVIO` corregido de `/dashboard/padre/mis-reportes` → `/mis-reportes`
- `PlaceholderPadre.tsx` eliminado (sin usos tras el porte)
- Zona vieja (`/dashboard/circulo-confianza`, `/dashboard/perfil/notificaciones`) permanece viva

Sin cambios en: `prisma/schema.prisma`, `src/lib/ai/**`, `deploy-prod.sh`, workflows, home proactivo ni sus 5 componentes.

## Alcance

1. Cambiar redirect por rol en `proxy.ts` para PARENT → `/dashboard/padre`
2. Portar círculo de confianza: re-exportar desde zona vieja
3. Portar notificaciones: re-exportar desde zona vieja
4. Corregir NavHeader: enlace círculo para PARENT + dashboardHref para PARENT
5. Corregir enlace roto `REDIRECT_PADRE_POST_ENVIO` en `ReporteWizard.tsx`
6. Borrar `PlaceholderPadre` tras confirmar sin usos
7. Agregar test proxy para `esDestinoPermitidoPorRol("PARENT", "/dashboard/padre")`

## Fuera de alcance

- Perfil del padre (no existe versión real en zona vieja — hallazgo reportado a Fábrica)
- Rediseño de cualquier sección portada
- Limpieza de la zona vieja (brief de limpieza posterior)
