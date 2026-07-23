# Cierre — Spec 086: Navegación y páginas gobernadas por permisos

**Fecha**: 2026-07-23
**Rama**: `feature/001-scaffolding`
**Spec**: `specs/086-navegacion-gobernada-permisos/`
**Estado**: FINALIZADO — pendiente validación funcional del CEO y ACTA-VALIDACION de ZEUS

## Resumen por defecto corregido

| Defecto | Corrección | Estado |
|---|---|---|
| D-1 Nav con roles quemados | Layout server resuelve `modulosPermitidos`; AdminNav/ColegioNav/ComiteSubNav filtran por `modulo` (sin `roles:[...]`) | Implementado + validado |
| D-2 403 visto como avería | Guard de página server (`verificarAccesoPagina` + `SinAccesoModulo`) en todas las páginas admin/colegio | Implementado + validado |
| D-3 Spam rota para OPERADOR | Módulo propio `revision_spam`; backfill solo desde `anti_abuso` (corrección 2) | Implementado + validado |
| D-4 Catálogo ≠ visible | Fusión `reportes_revision`→`bandeja_reportes` con semántica AND (corrección 1); test estructural | Implementado + validado |
| Corrección 3 | Tabs del centro IA filtradas por submódulo | Implementado |
| Vacío 4 | Aterrizaje: redirect al primer módulo permitido o "Sin módulos asignados" | Implementado + validado |

## Correcciones de ZEUS aplicadas

1. **AND, no OR**: la fusión usa `activo = bandeja AND revision`. En dev no había divergencia (ADMIN t/t, OPERADOR f/f) → **restringidos: ninguno**. En otros entornos, las divergencias quedan restringidas y deben listarse (rol, módulo).
2. **`revision_spam` sin inferencia**: backfill solo copia de `anti_abuso`. OPERADOR arrancó denegado y se activó por clic (exactamente el flujo de la 019).
3. **Tabs IA**: `IA_TABS` en `nav-items.ts`, filtradas server-side por `ia_playground`/`ia_eval`/`ia_configuracion` (Documentación libre con la raíz).
4. **Aterrizaje definido**: `/dashboard/admin` sin bandeja → redirect al primer ítem permitido; sin ninguno → `SinModulosAsignados`.

## Cambios realizados

- Migración de datos aditiva `20260723120000_align_catalogo_navegacion` (INSERT `revision_spam` + backfill, UPDATE AND, DELETE fila fusionada). Sin schema, sin reset.
- `src/lib/nav-items.ts`: fuente única de ítems nav (admin/comite/colegio) + tabs IA.
- `AdminNav`, `ColegioNav` (movida al layout del colegio), `ComiteSubNav`: filtran por `modulo`; `roles` eliminado.
- Layouts admin y colegio: resuelven claves permitidas server-side (sin endpoint nuevo).
- `verificarAccesoPagina` + `SinAccesoModulo`/`SinModulosAsignados`; guards en 24 páginas (7 patrón A inline + 11 patrón B wrapper server→client + 6 ya cubiertas).
- Re-claveo API: `spam/**` → `revision_spam`; `reportes-revision/**` + `correcciones` → `bandeja_reportes` (8 archivos).
- Seed y catálogo compartido actualizados.

## Validación

- Test estructural menú↔catálogo (4/4) + navs reescritas por módulo (role-visibility 79/79 con componentes).
- Gate: lint 0 errores (1 warning heredado) · tsc OK · **768/768 tests** · build limpio · dev-restart healthcheck OK.
- **Prueba del CEO en vivo** (con operador real, contraseña regenerada):
  1. Bandeja desactivada → ítem fuera del menú ✓
  2. Sin módulos → pantalla "Sin módulos asignados" ✓ (cero "No pudimos cargar…")
  3. Spam activada → ítem visible, `/dashboard/admin` redirige a spam, página funciona ✓
  4. Spam desactivada → URL directa = "Sin acceso a este módulo" ✓
  5. Bandeja reactivada → ítem vuelve ✓
- `grep "roles:"` en navegación: solo queda `PermisosRolPanel.tsx` (interfaz de la API de gestión, no filtro de nav).

## Pendiente para cierre

- Validación funcional del CEO (quickstart.md: prueba A-F) + ACTA-VALIDACION de ZEUS.

## Deuda técnica

- Guards de página no cubren subpáginas admin no listadas (`admin/estadisticas/operacion`, `admin/operadores/asignar`) — mismas páginas que la 019; se adoptan en una iteración futura si se requiere.
- `docs/` conserva historial de la 019; el catálogo ya no tiene `reportes_revision` pero el AuditLog histórico lo menciona (como texto, correcto).

## Commit

- `feat(permisos): navegación y páginas gobernadas por permisos (spec 086, corrige 019)`
