# Tasks — 012-hotfix-validacion-funcional

Un commit por punto (orden de ejecución). Estado: **todas completadas y verificadas**.

- [x] **T-1 (I-14)** Navegación de retorno compartida en el layout del dashboard — commit `ba651dd0`
  - [x] `src/lib/navegacion.ts` (`derivarMigas`, `rutaPadre` — puras) + 6 tests (`navegacion.test.ts`)
  - [x] `src/app/dashboard/breadcrumb.tsx` (client, `usePathname`) + `src/app/dashboard/layout.tsx`
  - [x] Verificado en navegador (ventana privada): raíz sin "Volver"; Salidas → Nueva → Volver
        regresa a Salidas; miga Inicio regresa al dashboard
- [x] **T-2 (I-13)** Rol 1 solo `inicio` en la semilla — commit `ff118d71`
  - [x] `prisma/seed.ts`: asignaciones declarativas por rol + retiro de obsoletas
  - [x] `pg_dump` de respaldo previo + seed re-ejecutado
  - [x] Verificado: API login admin → `["inicio"]`; menú sin Salidas
- [x] **T-3** Botón de login desacoplado de la hidratación — commit `c4ae2963`
  - [x] `disabled={cargando}` + comentario honesto (no es login-sin-JS)
  - [x] Verificado: botón clicable vacío; submit bloqueado por `required`; login completo OK
- [x] **T-4** Gates: 64/64 tests · `tsc --noEmit` · `lint` · `build` limpios (evidencia en commits)
