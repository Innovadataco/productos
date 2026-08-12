# Implementation Plan: SPEC-169 — Onboarding + cobertura + notificaciones in-app

**Branch**: `work/002-pi-061-g` (propuesta; ajustar al radicar) | **Date**: 2026-08-12 | **Spec**: [spec.md](./spec.md)

---

## Summary

Cerrar el hueco crítico de adopción del módulo Colegio con tres piezas cohesionadas:

1. **Onboarding "Activa tu protección"** que guía al rector (`SCHOOL_ADMIN`) a completar los pasos previos para que el sistema genere alertas.
2. **Anillo de cobertura** en el Inicio que muestra el % de estudiantes, profesores y acudientes con identificadores activos y empuja a completar.
3. **Centro de notificaciones in-app** que complementa los emails de SPEC-149 con una bandeja visible dentro de la plataforma.

Todo es colegio-scoped, se construye con migraciones aditivas y no modifica `Curso` ni `Estudiante.cursoId`.

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

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto | ✅ Pass | Onboarding, cobertura y notificaciones manejan solo metadatos de texto |
| §1.3 Presunción de inocencia | ✅ Pass | Las notificaciones describen eventos, nunca veredictos sobre personas |
| §2.1 Stack heredado | ✅ Pass | Next.js + Prisma + JWT manual |
| §2.4 Modelo SaaS | ✅ Pass | `OnboardingColegio` y `NotificacionInApp` son colegio-scoped |
| §3.1 TypeScript strict | ✅ Pass | Sin `any`; tipos de Prisma |
| §3.5 Logs y auditoría | ✅ Pass | FR-011: audit en onboarding y notificaciones |
| §4.1 Singletons | ✅ Pass | Reusa `prisma` singleton |
| §4.2 Rutas API individuales | ✅ Pass | Un `route.ts` por método/endpoint |
| I-49 Migraciones aditivas | ✅ Pass | Solo crea tablas; `Curso` y `Estudiante` no se tocan |

---

## Project Structure

### Documentation (this feature)

```text
specs/169-onboarding-cobertura/
├── spec.md
├── plan.md
├── data-model.md
└── tasks.md
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma                       # + model OnboardingColegio, + model NotificacionInApp, + enum AccionAudit values
└── migrations/                         # migración aditiva + backfill de onboarding para colegios existentes
src/
├── lib/
│   ├── dal/
│   │   └── repositories/
│   │       ├── onboarding-colegio.ts   # NUEVO: CRUD tenant-first + test
│   │       ├── onboarding-colegio.test.ts
│   │       ├── cobertura.ts            # NUEVO: cálculo de cobertura + test
│   │       ├── cobertura.test.ts
│   │       ├── notificacion-in-app.ts  # NUEVO: listar, marcar leída, archivar + test
│   │       └── notificacion-in-app.test.ts
│   ├── schemas/index.ts                # + onboardingPatchSchema, notificacionFiltroSchema
│   └── colegio/
│       ├── onboarding.ts               # NUEVO: lógica de pasos calculados
│       ├── cobertura.ts                # NUEVO: agregaciones de cobertura
│       └── notificaciones.ts           # NUEVO: disparadores de notificaciones in-app
├── app/
│   ├── api/colegio/
│   │   ├── onboarding/
│   │   │   └── route.ts                # GET / PATCH
│   │   ├── cobertura/
│   │   │   └── route.ts                # GET
│   │   └── notificaciones/
│   │       ├── route.ts                # GET
│   │       ├── resumen/
│   │       │   └── route.ts            # GET count no leídas
│   │       ├── marcar-leidas/
│   │       │   └── route.ts            # PATCH
│   │       └── [id]/
│   │           ├── route.ts            # PATCH (leída)
│   │           └── route.ts            # DELETE (archivar)
│   └── dashboard/colegio/
│       ├── page.tsx                    # + AnillosCobertura
│       └── onboarding/
│           └── page.tsx                # NUEVA: wizard reactivable
└── components/modules/colegio/
    ├── OnboardingModal.tsx             # NUEVO
    ├── AnillosCobertura.tsx            # NUEVO
    └── CentroNotificaciones.tsx        # NUEVO (campana + dropdown/panel)
```

---

## Fases

1. **Schema + migración aditiva**
   - Añadir `model OnboardingColegio` y `model NotificacionInApp`.
   - Ampliar `AccionAudit` con `COLEGIO_ONBOARDING_OMITIDO`, `COLEGIO_ONBOARDING_REACTIVADO`, `COLEGIO_ONBOARDING_COMPLETADO`, `COLEGIO_NOTIFICACION_CREADA`, `COLEGIO_NOTIFICACION_LEIDA`, `COLEGIO_NOTIFICACION_ARCHIVADA`.
   - Backfill: crear fila `OnboardingColegio` para cada `Colegio` existente (`completado` si ya tiene cobertura > 0, `activo` en otro caso).

2. **Backend: onboarding y cobertura**
   - `OnboardingColegioRepository` con A/B y transiciones de estado.
   - Servicio que calcula el progreso de pasos a partir de `Curso`, `Estudiante`, `Profesor`, `AcudienteEstudiante` e identificadores.
   - `CoberturaRepository` con agregaciones eficientes (counts + exists).
   - Endpoints `GET /api/colegio/onboarding` y `PATCH /api/colegio/onboarding`.
   - Endpoint `GET /api/colegio/cobertura`.
   - Tests de API y repositorio.

3. **Backend: notificaciones in-app**
   - `NotificacionInAppRepository`: listado paginado, marcar leída, marcar todas, archivar, contar no leídas.
   - Servicio de disparadores: integrar en la creación/actualización de `AlertaColegio` y en eventos de sistema.
   - Endpoints bajo `/api/colegio/notificaciones`.
   - Tests de API, A/B y privacidad (sin texto de reporte).

4. **Frontend**
   - `OnboardingModal`: modal/wizard con pasos calculados y CTAs.
   - `AnillosCobertura`: tres anillos en `/dashboard/colegio` con colores según %.
   - `CentroNotificaciones`: campana con badge, dropdown de últimas y enlace a panel.
   - Página `/dashboard/colegio/onboarding` para reactivar el wizard.

5. **Auditoría y arquitectura**
   - Auditar mutaciones de onboarding y notificaciones.
   - Regenerar artefactos de arquitectura (`npm run arch:check` en verde).

6. **Integración**
   - Gate completo: `tsc --noEmit`, `lint`, `tokens:check`, `arch:check`, `test:coverage`, `build`.
   - Commit, push a rama de trabajo, PR a `feature/001-scaffolding`.
   - CI-PUSH verde.

---

## Decisions & Risks

| Decision | Rationale | Risk / Mitigation |
|----------|-----------|-------------------|
| `OnboardingColegio` con progreso calculado, no guardado por paso | Evita desincronización con los datos reales del colegio. | El cálculo requiere joins; se mitiga con índices y un límite de escala manejable para colegios. |
| `NotificacionInApp` con estados implícitos (`leidaEn` / `archivadaEn`) | Patrón simple y suficiente; evita enum de estados. | Queries deben filtrar por NULL; se documenta en el repositorio. |
| Notificaciones dirigidas al `SCHOOL_ADMIN` del colegio | Hoy hay un único usuario rector por colegio (`Usuario.colegioId` unique). | Fase F puede extender el destinatario sin cambiar el schema. |
| Soft delete por `archivadaEn` | Permite conservar histórico de notificaciones sin mostrar basura. | Ninguno; el patrón ya está establecido. |
| Cobertura calculada on-demand | Los colegios no superan decenas de miles de registros; evita tabla de cache. | Si en el futuro crece, se puede cachear en `OnboardingColegio` sin cambiar contratos. |
| No tocar `src/lib/ai/**` | Fase G es pura UX y notificación; la IA no interviene. | Cero riesgo de afectar el clasificador. |

---

## Acceptance Mapping

| FR | Tests principales |
|----|-------------------|
| FR-001 / FR-002 / FR-003 | `src/lib/dal/repositories/onboarding-colegio.test.ts`, `src/app/api/colegio/onboarding/route.test.ts` |
| FR-004 / FR-005 | `src/lib/dal/repositories/cobertura.test.ts`, `src/app/api/colegio/cobertura/route.test.ts`, componente `AnillosCobertura` |
| FR-006 / FR-007 / FR-008 / FR-009 | `src/lib/dal/repositories/notificacion-in-app.test.ts`, `src/app/api/colegio/notificaciones/route.test.ts`, tests de privacidad |
| FR-010 | Tests de regresión de `Curso` y `Estudiante` (no deben cambiar) |
| FR-011 | Tests de auditoría en repositorios y APIs |
| FR-012 | Test de que la creación de notificación no depende del envío de email |
