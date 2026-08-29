# Implementation Plan: Gantt interactivo (arrastre)

**Branch**: `feature/001-scaffolding` (dir: `016-gantt-interactivo`) | **Date**: 2026-07-24 | **Spec**: [spec.md](./spec.md)

## Summary

Hacer el Gantt de SPEC-015 interactivo: arrastrar mueve fechas, arrastrar un borde redimensiona,
snap a la escala, persistencia optimista-con-rollback y señalado de conflictos de dependencia.
**La matemática pura de 015 no se toca**; se añade la inversa (fracción→fecha). Cero dependencias.

## Decisión: la inversa en su propio módulo puro (RZ-2 / FR-006)

`gantt.ts` (la ida, spec 015) queda **intacto**. La vuelta —`fechaEnFraccion`, `snap`,
`moverBarra`, `redimensionar`, `detectarConflictos`— vive en `ganttInteractivo.ts`, también
puro y testeado. El componente solo aporta estado de interacción del ratón. Así SC-003 (la
math de 015 no se rompe) es literal: es otro archivo.

## Decisión: dependencias como referencia polimórfica

El Gantt ya identifica items con ids prefijados (`entregable:x`, `hito:y`). `dependeDe` guarda
ese id. Ventajas: una dependencia puede cruzar tipos (un hito depende de un entregable) sin una
FK polimórfica imposible; una referencia colgada (predecesor borrado) simplemente no genera
conflicto. Migración aditiva de dos columnas nullable.

**Alternativa descartada**: FK self-referencial por tabla. No permitiría dependencias entre
tipos y complicaría el borrado.

## Decisión: persistir por las rutas existentes

Los PATCH de entregables e hitos ya aceptan sus fechas y **ya auditan**. El arrastre reutiliza
ese contrato (patrón del Kanban de SPEC-007): optimista, y si el PATCH falla, la barra vuelve.
No se inventa una ruta de "mover".

## Constitution Check — **PASS**

| Principio | Evaluación |
|---|---|
| §0.2 Pruebas | ✅ `ganttInteractivo.ts` con 16 tests (snap, mover, redimensionar, conflictos). |
| §2.5 Auditoría | ✅ El cambio de fechas audita (rutas existentes). |
| §6.2 React | ✅ "Hoy" en init perezoso; el arrastre usa pointer capture, sin listeners globales en efecto. |
| §6.3 Estilos | ✅ Solo Tailwind; puntero nativo, cero libs. |

## Cambios exactos

| Archivo | Qué |
|---|---|
| `prisma/schema.prisma` + migración | `dependeDe` en entregables e hitos (nullable, aditiva) |
| `src/lib/entregable.ts`, `src/lib/proyectoPm2.ts` | Persistir `dependeDe` |
| `src/lib/gantt.ts` | `ItemGantt` gana `dependeDe?` (compatible) |
| `src/lib/ganttInteractivo.ts` (+test) | Inversa, snap, mover, redimensionar, conflictos |
| `src/lib/ganttAdaptador.ts` | Propagar `dependeDe` |
| `src/components/proyectos/GanttProyecto.tsx` | Arrastre con pointer capture, optimista, conflictos, selector de dependencia |

## Verificación por requisito

| FR | Cómo |
|---|---|
| FR-001 | `moverBarra`/`redimensionar` con test; arrastre en el contenedor |
| FR-002 | Rollback en el componente; auditoría por la ruta; test de rollback (SC-002) |
| FR-003 | `detectarConflictos` con test; marca roja en el Gantt |
| FR-004 | `snap` con test por escala |
| FR-006 / SC-003 | `gantt.ts` intacto; la inversa en otro archivo |
| SC-001 | PATCH persiste, verificado con dato **desechable** en la viva (D-039), post-redeploy |

## Riesgos

- **R-01 · Probar el arrastre contra datos del CEO.** Mitigación (D-039): dato desechable
  sembrado y borrado; nunca sobre entregables/hitos reales.
- **R-02 · La math de 015 se rompe.** Mitigación: la inversa es otro archivo; los 18 tests de
  `gantt.test.ts` siguen verdes (SC-003).
- **R-03 · Dependencia circular cuelga la detección.** Mitigación: `detectarConflictos` no
  recorre cadenas, solo mira el predecesor directo; con test de ciclo.
