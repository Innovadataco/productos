# Implementation Plan: Dividir archivos grandes

**Branch**: `[feature/001-scaffolding]` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/052-dividir-archivos-grandes/spec.md`

---

## Summary

Reducir la complejidad de los archivos fuente más grandes del proyecto mediante refactor puro: extraer sub-componentes React y helpers TypeScript en archivos independientes, manteniendo el comportamiento exacto. Se trabaja un archivo a la vez, con tests verdes entre cada extracción.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Next.js 16.2.10 App Router, React 19, Tailwind CSS 3.4, Prisma 5.22.0 |
| **Testing** | Vitest + jsdom + `@testing-library/react` |
| **Target Platform** | Next.js App Router + Docker Compose |
| **Project Type** | Web application (full-stack Next.js) |
| **Performance Goals** | Sin cambios de rendimiento; el refactor es estructural |
| **Constraints** | Refactor puro; comportamiento idéntico; tests verdes entre pasos |
| **Scale/Scope** | 8+ archivos > 400 líneas; priorizar los 3 más grandes |

---

## Constitution Check

*GATE: Must pass before research. Re-check after design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto | ✅ Pass | No se agrega multimedia |
| §1.3 Presunción de inocencia | ✅ Pass | No se alteran etiquetas de culpabilidad |
| §1.4 Umbral parametrizable | ✅ Pass | No se modifica lógica de visibilidad |
| §2.1 Stack heredado | ✅ Pass | No se cambian frameworks |
| §2.2 Roles | ✅ Pass | No se modifica autorización |
| §3.1 TypeScript strict | ✅ Pass | Se mantiene `strict` y se evita `any` |
| §3.4 Códigos HTTP | ✅ Pass | No se cambian contratos de API |
| §3.5 Logs y auditoría | ✅ Pass | No se alteran logs ni auditoría |
| §3.6 Límites de tamaño | ✅ Pass | El objetivo es reducir líneas por archivo |
| §4.1 Singletons | ✅ Pass | No se tocan singletons |
| §4.2 Rutas API individuales | ✅ Pass | `route.ts` sigue siendo el handler principal |
| §4.3 Paginación estándar | ✅ Pass | No se modifica paginación |
| §6.1 JWT en cookie | ✅ Pass | No se modifica auth |
| §6.2 Validación manual | ✅ Pass | No se alteran validaciones |
| §6.3 Datos sensibles encriptados | ✅ Pass | No se altera cifrado |

**Re-check post-design**: All gates still pass. No violations.

---

## Project Structure

### Documentation (this feature)

```text
specs/052-dividir-archivos-grandes/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (no changes)
├── quickstart.md        # Phase 1 output
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
src/
├── components/
│   └── modules/
│       ├── ia/
│       │   ├── IaEvalManager.tsx          # < 400 líneas
│       │   └── eval/
│       │       ├── LaboratorioTab.tsx
│       │       ├── CasosTab.tsx
│       │       ├── HistorialTab.tsx
│       │       ├── ExperimentCard.tsx
│       │       ├── NuevoExperimentoForm.tsx
│       │       ├── ExperimentoDashboard.tsx
│       │       ├── MetricCard.tsx
│       │       └── ComparadorExperimentos.tsx
│       ├── reporte-detalle/
│       │   ├── AdminReporteDetalle.tsx    # < 400 líneas
│       │   ├── ReporteDetalleHeader.tsx
│       │   ├── ReporteInfoGrid.tsx
│       │   ├── ClasificacionPanel.tsx
│       │   ├── ReporteAccionesPanel.tsx
│       │   └── useReporteDetalle.ts
│       └── ...
├── app/
│   └── api/
│       └── reportes/
│           └── procesar/
│               ├── route.ts                # < 400 líneas
│               └── helpers/
│                   ├── validar-request.ts
│                   ├── embedding.ts
│                   ├── deduplicacion.ts
│                   ├── parametros-clasificacion.ts
│                   ├── clasificar-reporte.ts
│                   ├── guardas-seguridad.ts
│                   └── alertas.ts
```

**Structure Decision**: Los archivos extraídos se agrupan por dominio en subcarpetas. Los componentes padre exportan el mismo nombre público y reexportan desde la ubicación original cuando sea necesario.

---

## Complexity Tracking

No constitution violations. No complexity justification needed.

---

## Rollback Strategy

- Antes de cada extracción se hace `git stash` o se mantiene un commit previo verde.
- Si un test falla tras un refactor, se revierte el cambio de ese archivo con `git checkout -- <archivo>` o `git reset`.
- No se fuerzan cambios que fallen en TypeScript, lint o tests.
- Cada archivo refactorizado se valida individualmente antes de continuar con el siguiente.

---

## Notes

- El refactor es puramente estructural: no se cambian nombres de funciones exportadas, interfaces, contratos ni lógica.
- Se prioriza legibilidad sobre granularidad extrema: un archivo padre de 350-400 líneas es aceptable.
- Todos los helpers extraídos de `route.ts` deben ser funciones puras o transacciones autocontenidas para facilitar tests futuros.
