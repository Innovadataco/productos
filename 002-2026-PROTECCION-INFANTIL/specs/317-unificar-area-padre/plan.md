# Plan · SPEC-317 · Unificar el área del padre

**Stack**: Next.js 14 (App Router) · TypeScript · Vitest
**Rama**: `work/pi-SPEC-317-unificar-area-padre`

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/lib/proxy.ts` | `homeForRole("PARENT")` → `/dashboard/padre`; `redirectToHome` en rutas admin para roles no internos |
| `src/app/dashboard/padre/circulo-confianza/page.tsx` | Re-export de zona vieja |
| `src/app/dashboard/padre/notificaciones/page.tsx` | Re-export de zona vieja |
| `src/components/modules/ReporteWizard.tsx` | `REDIRECT_PADRE_POST_ENVIO` → `/mis-reportes` |
| `src/lib/nav-items.ts` | Perfil retirado del menú PADRE_NAV_ITEMS |
| `src/components/modules/NavHeader.tsx` | `dashboardHref` y dropdown corregidos para PARENT |

## Restricciones

- Solo-lectura: `src/lib/ai/**`, `prisma/**`, `deploy-prod.sh`, `verificar-base-pr.yml`
- Sin nueva librería
- Sin migración de BD
