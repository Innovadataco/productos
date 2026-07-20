# Implementation Plan: Claridad y estados

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/051-claridad-estados/spec.md`

---

## Summary

Implementar mejoras de claridad y experiencia de usuario sin modificar flujos ni datos: un componente estándar de estados vacíos/error, microcopy empático en flujos de denuncia y consulta, y mejoras de jerarquía visual en pantallas densas de operador/comité/administrador. Todo sobre el stack existente Next.js 16 + React 19 + Tailwind CSS 3.4.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Next.js 16.2.10 App Router, React 19.2.4, Tailwind CSS 3.4 |
| **Testing** | Vitest + jsdom + `@testing-library/react` |
| **Storage** | Sin cambios de esquema |
| **Target Platform** | Web (App Router) |
| **Constraints** | Sin nuevos endpoints, sin migraciones, sin cambios de lógica de negocio |

---

## Constitution Check

*GATE: Must pass before implementation.*

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto — sin multimedia | ✅ Pass | No se introduce multimedia |
| §1.3 Presunción de inocencia | ✅ Pass | FR-051-005 y FR-051-007 refuerzan lenguaje neutral |
| §1.4 Umbral parametrizable en BD | ✅ Pass | No se modifica la consulta pública ni el umbral |
| §2.1 Stack heredado | ✅ Pass | Se reutiliza React + Tailwind; no se agregan librerías |
| §3.1 TypeScript strict (no `any`) | ✅ Pass | Los componentes se tipan con `React.ReactNode` y handlers tipados |
| §3.3 Convenciones de nombres | ✅ Pass | Componentes en `src/components/ui/` PascalCase |
| §7.3 Estilos con Tailwind | ✅ Pass | Solo clases utilitarias; no CSS modules |
| §7.3 Canales oficiales visibles | ✅ Pass | No se alteran los canales oficiales en reporte |

**Re-check post-design**: All gates still pass. No violations.

---

## Project Structure

### Documentation (this feature)

```text
specs/051-claridad-estados/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (sin cambios)
├── quickstart.md        # Phase 1 output
└── checklists/
    └── requirements.md  # Specification quality checklist
```

### Source Code (repository root)

```text
src/components/ui/
├── EmptyState.tsx       # Estado vacío reutilizable
└── ErrorState.tsx       # Estado de error accionable

src/app/mis-reportes/page.tsx
src/components/modules/
├── DashboardUsuarioClient.tsx
├── ComiteSolicitudDetalle.tsx
├── AdminReporteDetalle.tsx
├── IaEvalManager.tsx
├── AdminReportesTable.tsx
├── ComiteBandeja.tsx
├── SpamRevisionPanel.tsx
├── AdminAntiAbusoSimulacion.tsx
├── AuditLogViewer.tsx
├── IaDocsPanel.tsx
├── ReporteWizard.tsx / ReporteStep*.tsx / ConfirmacionReporte.tsx
├── ConsultaForm.tsx / ConsultaPublicaClient.tsx
└── SeguimientoClient.tsx / SeguimientoForm.tsx

src/app/dashboard/admin/operadores/asignar/page.tsx
src/app/dashboard/admin/operadores/gestion/page.tsx
src/app/dashboard/admin/comite/gestion/GestionPageClient.tsx
src/components/modules/AdminDashboard.tsx
```

---

## Complexity Tracking

No constitution violations. No complexity justification needed.

