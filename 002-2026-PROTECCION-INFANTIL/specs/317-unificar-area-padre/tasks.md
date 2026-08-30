# Tasks · SPEC-317 · Unificar el área del padre

Todas completadas en la implementación inicial.

- [X] T001 Cambiar `homeForRole("PARENT")` a `/dashboard/padre` en `src/lib/proxy.ts`
- [X] T002 Redirigir roles no internos a `redirectToHome` (en vez de `/`) en rutas admin de `src/lib/proxy.ts`
- [X] T003 Re-exportar circulo-confianza en `src/app/dashboard/padre/circulo-confianza/page.tsx`
- [X] T004 Re-exportar notificaciones en `src/app/dashboard/padre/notificaciones/page.tsx`
- [X] T005 Corregir `REDIRECT_PADRE_POST_ENVIO` → `/mis-reportes` en `src/components/modules/ReporteWizard.tsx`
- [X] T006 Retirar ítem perfil de `PADRE_NAV_ITEMS` en `src/lib/nav-items.ts`
- [X] T007 Actualizar `dashboardHref` y dropdown en `src/components/modules/NavHeader.tsx` para PARENT
- [X] T008 Actualizar tests proxy en `src/lib/proxy.test.ts` (SPEC-317 describe block)
- [X] T009 Actualizar tests NavHeader en `src/components/modules/NavHeader.test.tsx`
