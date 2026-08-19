# Cierre: SPEC-180 — Fixes visuales del admin

**Fecha**: 2026-08-19 · **Rama**: `work/002-pi-077` · **Modo**: autónomo (aprobado por CEO tras revisión de prod).

## Qué se implementó

1. **Tabs duplicados en operación (I-59 residual)**: eliminado el `<nav>` interno de `OperacionTableroClient` (quedaba debajo del sub-nav de SPEC-179). El componente solo LEE `?tab=`; la navegación vive en `EstadisticasSubNav` con `<Link>` reales. Test actualizado (verifica que NO hay nav interno).
2. **Texto blanco invisible en tabs activos** (hallazgo del CEO en prod, bug global): `bg-accent` a secas no genera CSS (`accent` es objeto de sombras en tailwind.config.ts) → fondo transparente + texto blanco. Reemplazado por `bg-pino` en `ComiteSubNav.tsx` y `OperadoresSubNav.tsx` (la 3ª ocurrencia desapareció con el nav interno). Verificado: **0 ocurrencias** de `bg-accent` a secas en `src/`.
3. **Monitoreo worker fuera del menú**: redundante con el tablero operativo (SPEC-171 cubre worker + BD + 4 señales más). Item retirado de `ADMIN_NAV_ITEMS`; la ruta redirige a `/dashboard/admin/estadisticas/operacion` (bookmarks vivos). `/api/health/worker` intacto (lo consume el tablero). `monitoreo_worker` a `SIN_PANTALLA_PROPIA` con justificación.
4. **Dataset explica su propósito**: bloque "¿Qué es esto y para qué sirve?" en criollo (memoria de aprendizaje del clasificador; nace de correcciones humanas anonimizadas; se usa en Simulación; es solo consulta).

## Evidencia

- Grep: `bg-accent` a secas = 0 ocurrencias en `src/`.
- Unit: `OperacionTableroClient.test.tsx` 4/4 (incl. "no renderiza nav interno") · `nav-items.test.ts` 4/4 · suite unit 846/846.
- `arch:check` ✅ (aserción B sin el href retirado; redirect registrado) · tokens bajo el piso.
- Gate: tsc · eslint --no-cache · unit · integration · journeys · build · arranque — anexo en PR.

## Nota

- El redirect de monitoreo/worker es permanente (301 de Next); la página ya no requiere el módulo `monitoreo_worker` (el grant queda en BD sin efecto — sin migración, sin revocación).
