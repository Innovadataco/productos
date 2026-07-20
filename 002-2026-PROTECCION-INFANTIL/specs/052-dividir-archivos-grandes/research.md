# Research: Dividir archivos grandes

**Date**: 2026-07-20
**Feature**: specs/052-dividir-archivos-grandes/spec.md

---

## Inventario de archivos grandes

Se identificaron los siguientes archivos fuente con más de 400 líneas (excluyendo tests, a menos que se indique):

| Archivo | Líneas | Tipo | Prioridad | Complejidad |
|---------|--------|------|-----------|-------------|
| `src/components/modules/ia/IaEvalManager.tsx` | 1095 | Componente React | P1 | Media — tabs bien delimitados |
| `src/lib/circulo-confianza.ts` | 862 | Utilidad TypeScript | P2 | Alta — lógica de confianza |
| `src/components/modules/AdminReporteDetalle.tsx` | 814 | Componente React | P1 | Alta — muchas acciones y estado |
| `src/app/dashboard/admin/comite/gestion/GestionPageClient.tsx` | 708 | Componente React | P2 | Media — tablas y formularios |
| `src/app/dashboard/circulo-confianza/page.tsx` | 649 | Página Next.js | P2 | Media — UI + carga de datos |
| `src/app/api/reportes/procesar/route.ts` | 627 | Route Handler | P1 | Alta — orquestador crítico |
| `src/app/dashboard/admin/operadores/gestion/page.tsx` | 564 | Página Next.js | P2 | Media — tablas de operadores |
| `src/components/modules/ConfigPanel.tsx` | 494 | Componente React | P2 | Baja — lista de parámetros |
| `src/lib/ai/eval-runner.ts` | 464 | Utilidad TypeScript | P2 | Media — runner de evaluación |
| `src/components/modules/AuditLogViewer.tsx` | 452 | Componente React | P2 | Baja — tabla de auditoría |
| `src/lib/ai/classifier.ts` | 444 | Utilidad TypeScript | P2 | Alta — clasificación con votos |

## Decisiones

### D1: Orden de ataque

**Decision**: Procesar primero los tres archivos P1 (`IaEvalManager.tsx`, `AdminReporteDetalle.tsx`, `procesar/route.ts`) de mayor impacto y luego los P2.

**Rationale**: Los P1 son los más grandes y críticos para el producto. Los P2 se atacan si queda tiempo dentro del sprint, siguiendo el mismo criterio: uno por uno, tests verdes.

### D2: Estrategia de extracción

**Decision**: Extraer por cohesión funcional, no por tamaño arbitrario. Cada archivo extraído debe tener un único propósito.

**Rationale**: Fragmentar por líneas produce archivos sin sentido y dificulta la navegación. Agrupar por cohesión mantiene la legibilidad.

### D3: Preservación de exports

**Decision**: Los componentes padre mantienen su nombre de export original. Los archivos extraídos usan nombres internos descriptivos.

**Rationale**: Evita romper todos los imports existentes en páginas y layouts. No se requieren alias de export.

### D4: No modificar lógica

**Decision**: No se cambian condiciones, flujos, cálculos, ni textos durante el refactor. Solo se mueve código.

**Rationale**: La regla de oro del refactor es comportamiento idéntico. Cualquier cambio funcional se trata como regresión.

### D5: Validación por archivo

**Decision**: Tras cada extracción se ejecuta `tsc --noEmit`, `npm run lint` y `npm run test` (o la suite relevante) antes de continuar.

**Rationale**: Atrapar errores temprano y cumplir con la regla de tests verdes entre cada paso.

---

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Dividir todos los archivos en paralelo | Riesgo de conflictos y regresiones difíciles de aislar |
| Reescribir componentes con hooks más grandes | Cambiaría la estructura lógica y podría alterar renderizados |
| Mover todo a un monolito de hooks | Perdería cohesión visual y dificultaría lectura |
| Cambiar a barrel files | Añadiría indirección innecesaria y podría romper imports estáticos |

---

## Open Questions (0 remaining)

No quedan dudas. El alcance, el orden y los criterios de éxito están definidos en `spec.md` y `tasks.md`.
