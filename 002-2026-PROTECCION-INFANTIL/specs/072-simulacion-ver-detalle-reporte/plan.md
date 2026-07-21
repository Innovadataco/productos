# Implementation Plan: Simulación — Ver detalle del reporte (Spec 072)

**Branch**: `[feature/001-scaffolding]` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/072-simulacion-ver-detalle-reporte/spec.md`

---

## Summary

Agregar un botón "Ver detalle" en cada fila de `TablaResultadosSimulacion` que abra el modal `AdminReporteDetalle` reutilizando el `Modal` del Spec 054. El cambio es puramente de UI: no se crean endpoints nuevos ni se modifica el modelo de datos. Se verifica que el endpoint de resultados ya expone `reporteId`.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Next.js 16.2.10 App Router, React 19.2.4, Tailwind CSS 3.4 |
| **Components** | `src/components/modules/ia/simulacion/TablaResultadosSimulacion.tsx`, `src/components/modules/AdminReporteDetalle.tsx`, `src/components/ui/Modal.tsx` |
| **Endpoint** | `GET /api/admin/ia/simulaciones/[id]/resultados` (existente, solo lectura) |
| **Target Platform** | Web (Mac Studio / VPS) |
| **Constraints** | Sin migración, sin tocar `Reporte`/`SimulacionRun`/`SimulacionReporte`, sin duplicar UI |
| **Scale/Scope** | 1 User Story, ~2 archivos de componente, ~1 test de componente |

---

## Constitution Check

*GATE: Must pass before research. Re-check after design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto — sin multimedia | ✅ Pass | El detalle muestra texto existente; no se añade multimedia |
| §1.3 Presunción de inocencia | ✅ Pass | `AdminReporteDetalle` ya respeta el lenguaje descriptivo |
| §2.1 Stack heredado | ✅ Pass | Next.js App Router + React + Tailwind; sin nuevas dependencias |
| §3.1 TypeScript strict | ✅ Pass | Se mantienen tipos existentes (`ResultadoCaso`, `AdminReporteDetalleProps`) |
| §3.3 Convenciones de nombres | ✅ Pass | Componentes PascalCase, props tipadas |
| §4.3 Paginación estándar | ✅ Pass | No se modifica la paginación del endpoint existente |
| §5.1 Testing | ✅ Pass | Se agrega test de componente para el botón/modal |
| §6.1 Autenticación | ✅ Pass | El detalle sigue requiriendo `verifyAuth(ADMIN)` en su propia ruta |

**Re-check post-design**: All gates still pass. No violations.

---

## Project Structure

### Documentation (this feature)

```text
specs/072-simulacion-ver-detalle-reporte/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── resultados.md    # Contract del endpoint existente (sin cambios)
├── checklists/
│   └── requirements.md  # Specification quality checklist
└── tasks.md             # Phase 2 output
```

### Source Code (affected)

```text
002-2026-PROTECCION-INFANTIL/
└── src/
    └── components/
        ├── modules/
        │   ├── ia/simulacion/
        │   │   └── TablaResultadosSimulacion.tsx   # agregar botón
        │   └── AdminReporteDetalle.tsx             # ya existente, reutilizar
        └── ui/
            └── Modal.tsx                            # ya existente, reutilizar
```

**Structure Decision**: No se crean nuevos archivos de componente; solo se modifica `TablaResultadosSimulacion.tsx`. El modal y el detalle se importan desde los módulos existentes.

---

## Complexity Tracking

No constitution violations. No complexity justification needed. El cambio es un hook de estado local (`useState`) para el `reporteId` seleccionado y una renderización condicional de `AdminReporteDetalle` dentro de `Modal`.

---

## UI/UX Notes

- El botón debe ser discreto para no saturar la tabla; se propone un ícono de ojo con `aria-label="Ver detalle del reporte"` o un link de texto "Ver detalle" según el ancho de columna.
- El modal debe usar el mismo tamaño que en la bandeja admin (`size="lg"` o el default de `AdminReporteDetalle`).
- Se mantiene el `onRefresh` para que, si el admin modifica el reporte desde el modal, la tabla de resultados se recargue y refleje el nuevo estado.
