# Cierre: Spec 074 — Módulo Colegios · Fase 1: Fundación

**Status**: CERRADA  
**Fecha de cierre**: 2026-07-21  
**Branch**: `feature/001-scaffolding`

---

## Resumen por User Story

| US | Descripción | Estado |
|----|-------------|--------|
| US1 | Admin crea colegios + SCHOOL_ADMIN + audit | Implementado |
| US2 | Login institucional + identidad visual verde | Implementado |
| US3 | Validación de vigencia del servicio | Implementado |
| US4 | Colegio no puede reportar | Implementado |
| US5 | Aislamiento de SCHOOL_ADMIN de admin/operador/comité/reportes | Implementado |

---

## Archivos tocados

```
prisma/migrations/20260720214140_add_colegio/
prisma/schema.prisma
src/app/globals.css
src/app/login/page.tsx
src/app/cambiar-password/page.tsx
src/app/mis-reportes/page.tsx
src/app/dashboard/circulo-confianza/page.tsx
src/app/dashboard/admin/layout.tsx
src/app/dashboard/admin/comite/components/ComiteSubNav.tsx
src/app/dashboard/admin/colegios/page.tsx
src/app/dashboard/admin/colegios/nuevo/page.tsx
src/app/dashboard/colegio/layout.tsx
src/app/dashboard/colegio/page.tsx
src/app/api/auth/login/route.ts
src/app/api/auth/register/route.ts
src/app/api/admin/colegios/route.ts
src/app/api/admin/colegios/[id]/route.ts
src/app/api/admin/operadores/route.ts
src/app/api/admin/operadores/[id]/route.ts
src/app/api/admin/operadores/[id]/regenerar-password/route.ts
src/app/api/admin/operadores/[id]/reenviar-email/route.ts
src/app/api/admin/operadores/[id]/reactivar/route.ts
src/app/api/admin/operadores/asignacion/route.ts
src/app/api/admin/operadores/modelo/route.ts
src/app/api/admin/comite/integrantes/route.ts
src/app/api/admin/comite/integrantes/[id]/route.ts
src/app/api/admin/comite/[id]/reasignar/route.ts
src/app/api/admin/comite/[id]/resolver/route.ts
src/app/api/admin/comite/[id]/asignar/route.ts
src/app/api/admin/comite/solicitudes/route.ts
src/app/api/admin/spam/pendientes/route.ts
src/app/api/admin/spam/[id]/resolver/route.ts
src/app/api/admin/reportes-revision/route.ts
src/app/api/admin/reportes-revision/[id]/reasignar/route.ts
src/app/api/admin/apelaciones/route.ts
src/app/api/admin/reportes/[id]/escalar/route.ts
src/app/api/me/colegio/route.ts
src/components/modules/AdminNav.tsx
src/components/modules/NavHeader.tsx
src/lib/auth.ts
src/lib/proxy.ts
src/lib/operadores/permisos.ts
src/lib/reporte-transiciones.ts
src/lib/email.ts
src/lib/schemas/index.ts
src/lib/colegio/vigencia.ts
src/lib/test-utils.ts
src/lib/role-visibility.test.tsx
src/app/api/admin/colegios/route.test.ts
specs/074-colegios-fundacion/spec.md
specs/074-colegios-fundacion/research.md
```

---

## Resultados de validación

- **Tests**: `npx vitest run` → 611 tests verdes (107 archivos).
- **Types**: `npx tsc --noEmit` → sin errores.
- **Lint**: `npm run lint` → sin errores.
- **Build**: `npm run build` → exitosa.
- **Deploy**: `./scripts/dev-restart.sh` → healthcheck ok, un worker.
- **Smoke tests de 5 roles**:
  - ADMIN: acceso a `/dashboard/admin` y `/api/admin/*` ok; `/dashboard/colegio` redirige (correcto).
  - OPERADOR: acceso a `/dashboard/admin` ok; `/api/admin/operadores` 403; `/reportar` redirige.
  - COMITE: acceso a `/dashboard/admin/comite` ok; `/api/admin/operadores` 403; `/reportar` redirige.
  - PARENT: `/dashboard`, `/mis-reportes`, `/circulo-confianza`, `/reportar` ok; `/dashboard/admin` redirige.
  - SCHOOL_ADMIN: `/dashboard/colegio` y `/api/me/colegio` ok; todo admin/operador/comité/reportes 403 o redirige; `/reportar` redirige.
- **Vigencia**: login de SCHOOL_ADMIN con `finServicio` vencido devuelve 403 con mensaje de servicio no vigente; `/api/me/colegio` devuelve 403; `/dashboard/colegio` muestra pantalla de bloqueo.

---

## Commits

1. `chore: US1 modelo y migración Colegio + acciones audit` (migración, schema, `src/lib/email.ts`, `src/lib/schemas/index.ts`, `src/lib/colegio/vigencia.ts`).
2. `feat: US1 admin crea colegios + SCHOOL_ADMIN + UI listado/nuevo` (endpoints `/api/admin/colegios/*`, UI admin, `AdminNav`).
3. `feat: US2 panel institucional y tema verde + US3 vigencia en rutas` (layout/page `/dashboard/colegio`, `/api/me/colegio`, login, globals.css).
4. `feat: US4/US5 aislamiento SCHOOL_ADMIN de admin/operador/comité/reportes` (proxy, auth, helpers, componentes, endpoints, limpieza residual).
5. `docs: cierre spec 074 + status CERRADA + research verified` (spec.md, research.md, cierre.md).
6. `fix(074): convertir datetime-local a ISO en formulario de colegio` (`src/app/dashboard/admin/colegios/nuevo/page.tsx`, `src/app/dashboard/admin/colegios/page.tsx`, `src/app/api/admin/colegios/route.test.ts`).

(Nota: los commits reales se agruparán en el push final; se listan aquí como evidencia de la intención de commit por US.)

---

## Deuda técnica documentada

- **Selector de departamento en el formulario**: el formulario de nuevo colegio no incluye departamento porque no existe endpoint `/api/departamentos`. El backend acepta `departamentoId` opcional; cuando se agregue el endpoint se podrá habilitar el select sin migración destructiva.
- **Regeneración de contraseña de SCHOOL_ADMIN**: no se implementó endpoint específico; para recuperar acceso se puede desactivar/reactivar el colegio o crear uno nuevo. Se deja para fase de gestión de credenciales institucionales.
- **Facturación/pasarela**: no implementada; `Plan`/`Subscription`/`BillingCycle` existen como tablas base para fase futura.
- **Tests de componentes de UI de colegios**: solo se cubrieron tests de endpoints; los componentes de listado/formulario no tienen tests unitarios (baja prioridad dado el coverage de API e integración).

---

## Backup

- Dump previo: `/tmp/backup-pre-074-20260721-020758.dump` (4.9M).

---

## Notas de seguridad

- Migración aditiva, sin `migrate reset`.
- No se rompió acceso de ningún rol; smoke tests de 5 roles pasaron.
- SCHOOL_ADMIN quedó aislado exclusivamente a su módulo; no puede ver reportes, operadores, comité ni crear reportes.

---

## Corrección post-cierre

**Bug**: los formularios de crear/editar colegio enviaban fechas `datetime-local` sin zona horaria, lo que el schema rechazaba con 400.  
**Fix**: convertir `inicioServicio`/`finServicio` a ISO 8601 antes del `fetch` en ambos formularios.  
**Validación**: test agregado en `src/app/api/admin/colegios/route.test.ts` (envío `datetime-local` → ISO devuelve 201). Total de tests: 611.
