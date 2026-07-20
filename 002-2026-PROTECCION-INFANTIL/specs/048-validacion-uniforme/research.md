# Research: Validación uniforme (zod)

**Date**: 2026-07-20
**Feature**: specs/048-validacion-uniforme/spec.md

---

## Decisions

### D1: Usar zod v4 ya instalado

**Decision**: Reutilizar zod 4.4.3, que ya es dependencia del proyecto, en lugar de introducir otra librería de validación.

**Rationale**: La constitución (§6.2) establece como meta migrar a zod. El proyecto ya depende de zod v4 y varias rutas lo usan inline. Centralizar los esquemas reduce duplicación y alinea con la meta constitucional.

**Components**:
- `zod` v4.4.3
- Esquemas en `src/lib/schemas`
- Helper `withValidation` en `src/lib/validation.ts`

### D2: Helper genérico `withValidation` con `body` y `params`

**Decision**: El helper expone dos métodos: `withValidation.body(schema)` para parsear body y `withValidation.params(schema)` para parsear parámetros de ruta. Ambos lanzan `ValidationError` con formato canónico.

**Rationale**: Next.js App Router separa `request` (body) de `context.params` (parámetros de ruta). Un helper único que combine ambos sería inflexible para handlers con solo body o solo params. La versión de dos métodos es explícita y mantiene el handler limpio.

### D3: Esquemas reutilizables por dominio

**Decision**: Colocar esquemas comunes en `src/lib/schemas/index.ts` y exportar esquemas específicos para IA, operadores, parámetros y apelaciones.

**Rationale**: Agrupa reglas de validación cercanas al negocio y facilita su reutilización en futuros endpoints. Los esquemas son el lugar único de verdad para reglas como `max 4000 caracteres`, `cuid`, `tipo de parámetro permitido`, etc.

### D4: No modificar handlers existentes con zod inline

**Decision**: Las rutas que ya usan zod inline (`admin/operadores/route.ts`, `admin/operadores/[id]/route.ts`, `admin/ia/experimentos/route.ts`, etc.) no se refactorizan para usar el helper central.

**Rationale**: El alcance del spec es cerrar la deuda de rutas sin esquema. Refactorizar handlers sanos aumenta el riesgo de regresión sin aportar valor directo. El helper queda disponible para nuevas rutas y futuros specs de saneamiento.

### D5: Tests unitarios para esquemas y helper

**Decision**: Añadir `src/lib/validation.test.ts` y `src/lib/schemas/index.test.ts` con tests unitarios puros (sin base de datos).

**Rationale**: Los tests unitarios son rápidos y verifican que los esquemas y el helper producen los resultados esperados. Los tests de integración de las rutas afectadas se dejan para los tests existentes o futuros specs; aquí no se modifica la lógica que requeriría setup de BD.

---

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Introducir `valibot` o `arktype` | Prohibido por constitución §2.1 (stack heredado) y duplicaría dependencia de validación |
| Wrapper de handler `withValidation(schema, handler)` | Cambiaría la firma de los handlers y requeriría reescribir try/catch; se prefiere invocación interna |
| Validación manual centralizada sin zod | Contradice la meta constitucional de migrar a zod |
| Refactorizar todas las rutas con zod inline al helper | Fuera de alcance; aumenta riesgo sin valor inmediato |
| Middleware global de validación | Next.js App Router no facilita middleware por ruta con body; además, no aplica a worker secret de apelaciones/vencer |

---

## Open Questions (0 remaining)

All resolved. zod es la librería canónica, el helper será genérico y las rutas afectadas están identificadas en el spec.
