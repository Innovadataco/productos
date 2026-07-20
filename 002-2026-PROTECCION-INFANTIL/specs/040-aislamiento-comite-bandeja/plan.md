# Plan — Spec 040: Aislamiento del comité a su Bandeja

## Fase 1: Análisis y preparación

- P1.1 Verificar que `ComiteSubNav` hardcodea las 3 pestañas y no recibe rol.
- P1.2 Verificar que `/dashboard/admin/comite/gestion` y `/dashboard/admin/comite/auditoria` no tienen guard server-side.
- P1.3 Confirmar que el proxy (`src/lib/proxy.ts`) cubre `/dashboard/admin/*` y puede redirigir a `COMITE_VALIDACION`.
- P1.4 Decidir mecanismo para pasar el rol a `ComiteSubNav`: prop desde server component (página) o `/api/me`.

## Fase 2: Implementación por User Story

- P2.1 **US1**: Modificar `ComiteSubNav` para recibir el rol del usuario y filtrar las pestañas.
  - `COMITE_VALIDACION`: solo "Bandeja".
  - `ADMIN`/`SCHOOL_ADMIN`: "Bandeja", "Gestión", "Auditoría".
- P2.2 **US1**: Actualizar las páginas del módulo Comité para que el rol llegue al `ComiteSubNav` (por prop desde server component o vía `/api/me`).
- P2.3 **US1**: Agregar en `src/lib/proxy.ts` una lista de rutas admin-only dentro de `/dashboard/admin/comite` (`/gestion` y `/auditoria`) y redirigir a `COMITE_VALIDACION` a `/dashboard/admin/comite`.
- P2.4 **US1**: Mantener `verifyAuth` en endpoints y layouts como defensa en profundidad.
- P2.5 **US2**: Probar el flujo del comité (escalar → tomar → finalizar como `CORREGIDO`) sin rediseñar la bandeja. Si hay bug, documentar como deuda.

## Fase 3: Tests y validación

- P3.1 Probar manualmente con curl que `COMITE_VALIDACION` es redirigido desde `/dashboard/admin/comite/gestion` y `/auditoria`.
- P3.2 Probar manualmente que el comité solo ve "Bandeja" en el SubNav.
- P3.3 Probar manualmente que `ADMIN`/`SCHOOL_ADMIN` ven las 3 pestañas y acceden a Gestión y Auditoría.
- P3.4 Ejecutar `npx tsc --noEmit`, `npm run lint`, `npm run test`.
- P3.5 Ejecutar `rm -rf .next && npm run build`.
- P3.6 Ejecutar `./scripts/dev-restart.sh` y probar con `quickstart.md`.

## Fase 4: Cierre

- P4.1 Actualizar `spec.md` con sección Implementación.
- P4.2 Crear `docs/cierre-040.md`.
- P4.3 Validar checklist de requisitos.
- P4.4 Commits: uno por User Story + uno de docs; push a `feature/001-scaffolding`.
- P4.5 Deploy limpio y pruebas con `quickstart.md`.
