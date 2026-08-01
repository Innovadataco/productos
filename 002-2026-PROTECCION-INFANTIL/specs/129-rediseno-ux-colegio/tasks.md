# Tasks: SPEC-129 — Rediseño de UX del panel del colegio

**Input**: Design documents from `specs/129-rediseno-ux-colegio/` (aprobados por ZEUS en
compuerta §4 con decisiones D-a/D-b y condiciones O-1..O-4)

## Phase 1: Fundación y navegación

- [x] T001 [C1] Test de regresión del logo por TODOS los roles (O-1): SCHOOL_ADMIN→panel;
  demás roles → comportamiento SPEC-106 intacto. **Archivo**: `src/components/modules/nav-logo.test.ts`
- [x] T002 [C1] Logo del SCHOOL_ADMIN a `/dashboard/colegio` también en zona pública (D-a):
  decisión extraída a `destinoLogo()`. **Archivo**: `src/components/modules/NavHeader.tsx`
- [x] T003 [C3] `ColegioSideNav` patrón AdminNav (filtro D-41) montado en el layout;
  retirada `ColegioNav`. **Archivos**: `src/components/modules/colegio/ColegioSideNav.tsx`,
  `src/app/dashboard/colegio/layout.tsx`

## Phase 2: Home del colegio (D-b, O-2)

- [x] T004 [C2] `ConsultaPublica` extraído y compartido con la home pública (O-2: cero fork).
  **Archivos**: `src/components/modules/ConsultaPublica.tsx`, `src/components/modules/HomePageClient.tsx`
- [x] T005 [C2/C3] `PublicDashboard` con variant resumen/completo; resumen en la home del
  colegio, vista ampliada en la subsección Estadísticas (D-b). **Archivos**:
  `src/components/modules/PublicDashboard.tsx`, `src/app/dashboard/colegio/page.tsx`,
  `src/app/dashboard/colegio/estadisticas/ColegioEstadisticasPageClient.tsx`

## Phase 3: Gestión en línea, alertas y auditoría

- [x] T006 [C4] Edición de curso en línea desde la lista (modal SPEC-124) + "Carga masiva"
  visible en el encabezado (parser xlsx intacto, O-3). **Archivo**:
  `src/app/dashboard/colegio/cursos/CursosPageClient.tsx`
- [x] T007 [C5] Alertas: encabezado explicativo + empty state con CTA a Alumnos (SPEC-077
  intacto). **Archivo**: `src/app/dashboard/colegio/alertas/AlertasColegioPageClient.tsx`
- [x] T008 [C6] Auditoría legible: frases naturales + detalle en pares etiqueta-valor
  (O-4), modo `legible` en el visor compartido. **Archivos**:
  `src/components/modules/audit-log/legible.ts`, `AuditTable.tsx`, `AuditLogViewer.tsx`,
  `src/app/dashboard/colegio/auditoria/ColegioAuditoriaPageClient.tsx`

## Phase 4: Gates y cierre

- [x] T009 Gates por commit y al cierre: suite completa, `tsc --noEmit`, `lint` (0 errores),
  build, `arch:check` verdes.
- [x] T010 Status IMPLEMENTADO en `spec.md` + sección Implementación con la aprobación
  registrada + índice `specs/README.md` actualizado.
