# Implementation Plan: SPEC-168 — Comité de Convivencia por colegio

**Branch**: `work/002-pi-068` | **Date**: 2026-08-12 | **Spec**: [spec.md](./spec.md)

---

## Summary

Introducir el rol `COMITE_CONVIVENCIA` como una cuenta compartida de login por colegio, administrada por el rector (`SCHOOL_ADMIN`), con un padrón documentado de integrantes (sin login individual) y una bandeja colegio-scoped para revisar y cerrar casos escalados desde las alertas del colegio. Reusa `IntegranteComite` y `SolicitudComite` acotándolas por `colegioId`, sin contaminar el Comité de Validación de la plataforma.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Next.js 16.2.10 App Router, Prisma 5.22.0, Tailwind CSS 3.4 |
| **Storage** | PostgreSQL 16+ (Docker Compose) |
| **Testing** | Vitest + jsdom + `@testing-library/react` |
| **Multi-tenant** | `colegioId` obligatorio en todas las lecturas/escrituras (DAL E-1 / SPEC-134) |
| **Transaction boundary** | `withUnitOfWork` para operaciones que tocan múltiples entidades |
| **Auth** | JWT manual con `jose` + `bcryptjs`, cookie `httpOnly` |
| **Privacy invariant** | Nunca se expone el texto del reporte ni el denunciante al colegio (BRIEF §2, SPEC-077/159) |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto | ✅ Pass | Cuenta, integrantes y resoluciones son texto; no se procesa multimedia |
| §1.3 Presunción de inocencia | ✅ Pass | El comité documenta decisiones institucionales, no emite veredictos públicos |
| §2.1 Stack heredado | ✅ Pass | Next.js + Prisma + JWT manual |
| §2.4 Modelo SaaS | ✅ Pass | Todo el módulo es colegio-scoped |
| §3.1 TypeScript strict | ✅ Pass | Sin `any`; tipos de Prisma |
| §3.5 Logs y auditoría | ✅ Pass | FR-018: audit en cuenta, integrantes, escalamiento y resolución |
| §4.1 Singletons | ✅ Pass | Reusa `prisma` singleton |
| §4.2 Rutas API individuales | ✅ Pass | Un `route.ts` por método/endpoint |
| I-49 Migraciones aditivas | ✅ Pass | Solo añade columnas/tablas; `Curso` y `Estudiante.cursoId` no se tocan |
| I-22 No secretos | ✅ Pass | Contraseñas hasheadas; el valor temporal solo se muestra una vez al crear/regenerar |

---

## Project Structure

### Documentation (this feature)

```text
specs/168-comite-convivencia/
├── spec.md
├── plan.md
├── data-model.md
└── tasks.md
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma                       # + RolUsuario.COMITE_CONVIVENCIA, + Usuario.comiteColegioId, + IntegranteComite.cargo, + SolicitudComite.colegioId/alertaColegioId/creadoPorId
└── migrations/                         # migración aditiva + backfill de grants de módulos
src/
├── lib/
│   ├── dal/
│   │   ├── repositories/
│   │   │   ├── comite-convivencia.ts            # NUEVO: cuenta del comité (crear, obtener, regenerar password)
│   │   │   ├── comite-convivencia.test.ts       # NUEVO
│   │   │   ├── comite-convivencia-integrantes.ts # NUEVO: padrón de integrantes
│   │   │   ├── comite-convivencia-integrantes.test.ts # NUEVO
│   │   │   ├── comite-convivencia-solicitudes.ts # NUEVO: bandeja colegio-scoped
│   │   │   └── comite-convivencia-solicitudes.test.ts # NUEVO
│   │   ├── services/
│   │   │   ├── comite-convivencia.ts            # NUEVO: lógica de cuenta
│   │   │   ├── comite-convivencia-integrantes.ts # NUEVO: lógica de integrantes
│   │   │   └── comite-convivencia-bandeja.ts    # NUEVO: escalamiento, detalle y resolución
│   │   └── types/
│   │       └── comite-convivencia.ts            # NUEVO: DTOs e inputs
│   ├── schemas/index.ts                         # + comiteCuentaSchema, integranteComiteConvivenciaSchema, escalarAlertaSchema, resolverSolicitudSchema
│   ├── permisos-catalogo.ts                     # + colegios_comite, colegios_comite_bandeja
│   ├── nav-items.ts                             # + COLEGIO_COMITE_NAV_ITEMS
│   └── proxy.ts                                 # + soporte COMITE_CONVIVENCIA
├── app/
│   ├── api/colegio/
│   │   ├── comite/
│   │   │   ├── cuenta/
│   │   │   │   ├── route.ts                     # GET/POST
│   │   │   │   └── regenerar-password/
│   │   │   │       └── route.ts                 # POST
│   │   │   ├── integrantes/
│   │   │   │   ├── route.ts                     # GET/POST
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts                 # PATCH
│   │   │   │       └── estado/
│   │   │   │           └── route.ts             # PATCH estado
│   │   │   └── solicitudes/
│   │   │       ├── route.ts                     # GET
│   │   │       └── [id]/
│   │   │           ├── route.ts                 # GET detalle
│   │   │           ├── resolver/
│   │   │           │   └── route.ts             # POST
│   │   │           └── notas/
│   │   │               └── route.ts             # POST
│   │   └── alertas/
│   │       └── [id]/
│   │           └── escalar/
│   │               └── route.ts                 # POST
│   └── dashboard/colegio/
│       ├── layout.tsx                           # MODIFICADO: acepta COMITE_CONVIVENCIA
│       ├── comite/
│       │   ├── page.tsx                         # NUEVO: gestión de cuenta e integrantes
│       │   └── casos/
│       │       ├── page.tsx                     # NUEVO: bandeja del comité
│       │       └── [id]/
│       │           └── page.tsx                 # NUEVO: detalle del caso
│       └── components/
│           └── ColegioSideNav.tsx               # MODIFICADO: menú por rol
└── components/modules/colegio/comite/          # NUEVO: componentes de UI (formularios, tarjetas, bandeja)
    ├── ComiteCuentaCard.tsx
    ├── IntegranteForm.tsx
    ├── IntegrantesList.tsx
    ├── SolicitudesBandeja.tsx
    └── CasoDetalle.tsx
```

---

## Fases

1. **Schema + migración + grants**
   - Añadir `COMITE_CONVIVENCIA` a `RolUsuario`.
   - Añadir `Usuario.comiteColegioId` (FK única a `Colegio.id`) y relación inversa `Colegio.comiteConvivencia`.
   - Añadir `cargo` a `IntegranteComite`.
   - Añadir `colegioId`, `alertaColegioId` y `creadoPorId` a `SolicitudComite`.
   - Añadir acciones de audit `COLEGIO_COMITE_*` y `COLEGIO_CASO_*` a `AccionAudit`.
   - Añadir módulos `colegios_comite` y `colegios_comite_bandeja` a `CATALOGO_MODULOS` y grants por defecto.
   - Migración aditiva; no tocar `Curso` ni `Estudiante`.

2. **Backend: cuenta e integrantes**
   - `ComiteConvivenciaRepository` + `ComiteConvivenciaService`.
   - `GET /api/colegio/comite/cuenta`, `POST /api/colegio/comite/cuenta`, `POST /api/colegio/comite/cuenta/regenerar-password`.
   - `ComiteConvivenciaIntegrantesRepository` + `Service` (cifrado/descifrado del documento).
   - `GET/POST /api/colegio/comite/integrantes`, `PATCH .../[id]`, `PATCH .../[id]/estado`.
   - Tests de A/B y cifrado.

3. **Backend: escalamiento y resolución**
   - `ComiteConvivenciaSolicitudesRepository` + `ComiteConvivenciaBandejaService`.
   - `POST /api/colegio/alertas/[id]/escalar`.
   - `GET /api/colegio/comite/solicitudes`, `GET .../[id]`, `POST .../[id]/resolver`, `POST .../[id]/notas`.
   - Reuso de `obtenerDetalleCaso` para el detalle, adaptado al rol comité.
   - Tests de A/B, escalamiento duplicado y resolución.

4. **Frontend: gestión del comité (rector)**
   - Página `/dashboard/colegio/comite` para crear cuenta, regenerar contraseña y administrar integrantes.
   - Formularios con validación Zod y feedback de acción.

5. **Frontend: bandeja del comité**
   - Página `/dashboard/colegio/comite/casos` con bandeja paginada.
   - Página `/dashboard/colegio/comite/casos/[id]` con resumen, timeline, bitácora y botón de cerrar con decisión.

6. **Proxy, layout y permisos**
   - Actualizar `src/lib/proxy.ts` para reconocer `COMITE_CONVIVENCIA`, redirigir su home y permitir sus rutas.
   - Actualizar `src/app/dashboard/colegio/layout.tsx` para aceptar ambos roles y aplicar vigencia del colegio.
   - Actualizar `ColegioSideNav` y `nav-items.ts` para mostrar menú según rol (`SCHOOL_ADMIN` vs `COMITE_CONVIVENCIA`).
   - Seed/upsert de grants por defecto.

7. **Auditoría y arquitectura**
   - Asegurar que todas las mutaciones emitan `AuditLog` con metadatos seguros (sin texto de reporte).
   - Regenerar artefactos de arquitectura (`npm run arch:check` en verde).

8. **Integración**
   - Gate completo: `tsc --noEmit`, `lint`, `tokens:check`, `arch:check`, `test:coverage`, `build`.
   - Commit, push a `work/002-pi-068`, PR a `feature/001-scaffolding`.
   - CI-PUSH verde.

---

## Decisions & Risks

| Decision | Rationale | Risk / Mitigation |
|----------|-----------|-------------------|
| Nuevo rol `COMITE_CONVIVENCIA` | El brief pide "rol nuevo tipo comité, colegioId"; `COMITE_VALIDACION` es el comité de validación de la plataforma y no debe mezclarse. | Riesgo bajo; requiere actualizar proxy, layout y grants. |
| `Usuario.comiteColegioId` separado de `colegioId` | `Usuario.colegioId` tiene `@unique` para el `SCHOOL_ADMIN`; añadir una FK exclusiva para el comité evita modificar esa constraint y mantiene la migración aditiva. | Riesgo de confusión; se documenta claramente en data-model.md. |
| Reusar `IntegranteComite` y `SolicitudComite` | El brief lo exige explícitamente; acota por `colegioId` sin crear tablas duplicadas. | Riesgo de filtrado cruzado; todos los repos filtran por `colegioId` y el comité asociado. |
| Añadir `cargo` a `IntegranteComite` | El brief exige documentar el cargo del integrante; el modelo base no lo tenía. | Riesgo bajo; nullable con default para integrantes históricos del comité de validación. |
| Cifrado de `numeroIdentificacion` | Consistencia con SPEC-024 (Comité de Validación). | Riesgo bajo; se reusa `param-encryption`. |
| El comité no corrige categoría | El comité de convivencia documenta una decisión institucional; la corrección de categoría sigue siendo del comité de validación de la plataforma. | Aclarar en la UI para evitar expectativas equivocadas. |
| No notificaciones por email en esta fase | El brief prioriza login + bandeja; las notificaciones in-app van en Fase G. | Riesgo aceptado; se documenta como fuera de alcance. |
| Actualizar `AlertaColegio.estado` a `gestionada` al resolver | Cierra el ciclo del caso y refleja que el colegio actuó. | Posible colisión con flujo del rector; se documenta en la bitácora. |

---

## Acceptance Mapping

| FR | Tests principales |
|----|-------------------|
| FR-001 / FR-002 / FR-003 / FR-004 / FR-005 | `src/lib/dal/repositories/comite-convivencia.test.ts`, `src/app/api/colegio/comite/cuenta/route.test.ts` |
| FR-006 / FR-007 / FR-008 / FR-009 | `src/lib/dal/repositories/comite-convivencia-integrantes.test.ts`, `src/app/api/colegio/comite/integrantes/route.test.ts` |
| FR-010 / FR-011 | `src/lib/dal/repositories/comite-convivencia-solicitudes.test.ts`, `src/app/api/colegio/alertas/[id]/escalar/route.test.ts` |
| FR-012 / FR-013 / FR-014 / FR-015 | `src/app/api/colegio/comite/solicitudes/route.test.ts`, `src/app/api/colegio/comite/solicitudes/[id]/route.test.ts`, `src/app/api/colegio/comite/solicitudes/[id]/notas/route.test.ts` |
| FR-016 / FR-017 | `src/app/api/colegio/comite/solicitudes/[id]/resolver/route.test.ts` |
| FR-018 | Tests de auditoría en repositorios y APIs |
| FR-019 | `src/lib/permisos-catalogo.ts`, tests de `modulosPermitidosParaRol` |
| FR-020 | Tests de regresión de `Curso` y `Estudiante.cursoId`, verificación de migración aditiva |
