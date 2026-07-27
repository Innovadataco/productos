# Tasks — Spec 100: Correcciones módulo Colegios (+ Comité)

> Backfill documental (cierre cola 002-PI-014): tareas ejecutadas, reconstruidas del
> cierre.md y el commit `623f6b31`. Todas completadas.

- [x] T001 C-1: cascada País→Departamento→Ciudad — `src/app/api/departamentos/route.ts` (nuevo), `src/app/api/ciudades/route.ts` (`departamentoId`), `src/lib/proxy.ts` (ruta pública), `src/app/dashboard/admin/colegios/nuevo/NuevoColegioPageClient.tsx`.
- [x] T002 C-2: tipo de período con cálculo servidor — enum `TipoPeriodoServicio.LIBRE` (migración `20260727073254_tipo_periodo_libre`), `src/lib/colegio/periodo.ts`, POST `/api/admin/colegios`, UI nuevo + edición.
- [x] T003 C-3: validación fin>inicio — `esRangoServicioValido`, POST + PATCH (`[id]/route.ts`), `min` en date pickers.
- [x] T004 C-6: grado select 1–11 — `src/lib/colegio/grados.ts`, `cursos/nuevo/NuevoCursoPageClient.tsx`, `cursos/[id]/CursoDetallePageClient.tsx`.
- [x] T005 C-4: quitar campo "Tipo" — `AlumnoDetallePageClient.tsx`, `identificadorAlumnoBodySchema` opcional, `inferirTipoIdentificador` en `src/lib/colegio/normalizacion.ts` + route de identificadores.
- [x] T006 C-5: verificar Plataforma = select del catálogo (ya implementado; sin cambios).
- [x] T007 I-25 (🔴): fix header sesión colegio — `esRutaPermitidaSchoolAdmin` en `src/lib/proxy.ts` (admite `/api/me` y `/cambiar-password`), `ColegioLogoutButton` en `ColegioNav`.
- [x] T008 C-9: enforcement central `debeCambiarPassword` en `dashboard/colegio/layout.tsx` y `dashboard/admin/layout.tsx`.
- [x] T009 C-7: diagnóstico (botón inexistente) + `ErrorState` con reintento en `ColegioEstadisticasPageClient.tsx`.
- [x] T010 C-8: logo enlaza al home del rol en `NavHeader.tsx`.
- [x] T011 COM-1/2: rótulos cuenta de acceso vs roster en `comite/gestion/GestionPageClient.tsx`.
- [x] T012 [P] Tests: `periodo.test.ts`, `normalizacion.test.ts`, `proxy.test.ts`, `admin/colegios/route.test.ts`, `identificadores/route.test.ts` (21 nuevos).
- [x] T013 Gate: `npx tsc --noEmit` + `npm run lint` + `npm run test` (906/906) + `npm run build`.
- [x] T014 `cierre.md` + fila en `specs/README.md` + commit `623f6b31` + push.
