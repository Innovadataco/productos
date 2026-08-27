# Implementation Plan: COP como fuente única de precio (Fase 1) — cierra I-126, inicia D-88

**Branch**: `work/002-PI-189` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: INSTRUCTIVO-002-PI-189 · BRIEF-A-27 · D-88 · D-85 · I-126

---

## Summary

Desbloquear el cobro real del producto introduciendo bifurcación por `Suscripcion.monedaLocal` en el motor de cobros. Para suscripciones `monedaLocal="COP"`, el cálculo se hace en COP nativo (base = `plan.precioBaseCOP`, descuentos en COP con `calcularDescuentoBonoCOP` nueva, `Pago.montoBaseCOP` directo, cero llamadas a `TasaCambio`). Para cualquier otra moneda, camino histórico USD→tasa→local intacto. Se agrega ratchet estático `no-usd-en-vistas-suscripcion.ts` para bloquear regresión visual, se refactoriza `AplicarBonoCard` con shim retrocompatible, y se conservan intactos el módulo Análisis (ARQ_12), `worker-tasas.mjs`, `TasaCambio`, `/api/admin/pagos/tasas` (candados Fase 2). Cero migraciones Prisma. Cierra I-126 por efecto colateral (CRUD deja de exigir USD).

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Stack** | Next.js 15 · TypeScript 5 · Prisma 5.22 · Zod · Vitest |
| **Testing** | Vitest unit (pagos-calculos + schemas) + integration (calculo-totales, renovacion, planes CRUD, aplicar-bono) |
| **Rendimiento** | Sin impacto (una rama if adicional por request; cero I/O nuevo) |
| **Constraints** | Cero migraciones · cero cambios al motor IA · cero cambios en módulo Análisis · candados Fase 2 respetados |
| **Autonomía** | Régimen D-51: build → PR → gate CI → auditoría Fábrica → deploy Jelkin → verificación en vivo (SC-009 obligatoria) |

---

## Constitution Check

- ✅ **Solo texto** — irrelevante.
- ✅ **IA local** — irrelevante; no toca motor.
- ✅ **Migraciones aditivas y no destructivas** — **CERO migraciones** (candado brief §4).
- ✅ **Frontera DAL (Q-3)** — `calculo-totales.service.ts` sigue en `src/lib/pagos/`; el cambio interno no altera la frontera. `PagosRepository` no cambia.
- ✅ **Sin `any` ni stack traces al cliente** — funciones nuevas tipadas.
- ✅ **Un solo commit por User Story + uno de docs** — plan §Commit map documenta el mapa (6 commits).

Sin violaciones. `Complexity Tracking` no aplica.

---

## Project Structure

### Documentation (this feature)

```text
specs/289-cop-fuente-unica-fase-1/
├── plan.md              # Este archivo
├── spec.md              # ya creado
└── tasks.md             # Fase 2 (a producir con /speckit.tasks)
```

### Código a tocar

```text
002-2026-PROTECCION-INFANTIL/
├── src/lib/
│   ├── schemas/pagos.ts                                    # FR-001, FR-002, FR-011: default(0), shim aplicar-bono
│   └── pagos/
│       ├── pagos-calculos.service.ts                       # FR-004: nueva calcularDescuentoBonoCOP
│       ├── pagos-calculos.service.test.ts                  # tests nuevos SC-002/SC-003
│       ├── calculo-totales.service.ts                      # FR-005: bifurcación por monedaLocal
│       ├── calculo-totales.service.test.ts                 # tests nuevos SC-002/SC-003
│       └── renovacion.service.ts                           # FR-006, FR-007: bifurcación completa
├── src/app/
│   ├── api/admin/pagos/planes/route.ts                     # ya OK — verifica solamente
│   └── dashboard/{colegio,padre}/suscripcion/page.tsx      # FR-008: quitar precioBaseUSD del interface + prop drilling
├── src/components/modules/
│   ├── PlanesAdminCRUD.tsx                                 # FR-003: quitar hardcode línea 141
│   └── cliente/suscripcion/
│       ├── SuscripcionVista.tsx                            # FR-009: pasar montoBase={precioBaseCOP}
│       └── AplicarBonoCard.tsx                             # FR-010: prop montoBase renombrada, POST body actualizado
├── scripts/lint/
│   ├── no-usd-en-vistas-suscripcion.ts                     # FR-016 R4: nuevo ratchet
│   └── ratchets.test.ts                                    # +tests del nuevo ratchet
├── .github/workflows/ci.yml                                # agregar el nuevo ratchet al job verificaciones
├── package.json                                            # nuevo script ratchets:no-usd-vistas
└── specs/289-cop-fuente-unica-fase-1/
```

**Structure Decision**: monolito Next.js del PI. Bifurcación por `monedaLocal` con función pura nueva `calcularDescuentoBonoCOP` como fuente única de la lógica COP en el motor de cobros. Ratchet estático nuevo sigue el patrón de SPEC-287 (`scripts/lint/*.ts` + CI job `verificaciones`). Cero nuevos endpoints, cero migraciones.

---

## Implementation Steps

### Fase 0 — Estado de fuente ya verificado (documentado en spec)

`schemas/pagos.ts:73` = `precioBaseUSD.optional()` ✅ · `route.ts:79` = `?? 0` ✅ · `calculo-totales.ts:88` = `precioBaseCOP` ✅ · `PlanesAdminCRUD.tsx:141` = hardcode ⚠️ · `renovacion.ts:158-187` = USD ⚠️.

### Fase 1 — Schemas Zod (FR-001, FR-002, FR-011)

1. **`src/lib/schemas/pagos.ts:73`**: `precioBaseUSD: z.coerce.number().min(0).optional().default(0)`.
2. **`src/lib/schemas/pagos.ts:117-121`** (`pagosAplicarBonoBodySchema`): admitir `montoBase` (nuevo canónico) y `montoBaseUSD` (shim retrocompatible). Ambos `.optional()` con validación custom "al menos uno positivo".
3. **Unit test** de `pagosPlanCreateSchema` cubre SC-005/SC-006.

### Fase 2 — Función pura de descuento COP (FR-004)

4. **`src/lib/pagos/pagos-calculos.service.ts`**: nueva `calcularDescuentoBonoCOP(precioBaseCOP, bono, tasaFallback=1)`. Tres ramas por `TipoBono`:
   - `DESCUENTO_PCT`: `Math.min(bono.valor, 100) * precioBaseCOP / 100`, redondeado.
   - `MESES_GRATIS`: `bono.valor * precioBaseCOP`.
   - `DESCUENTO_FIJO_USD`: `Math.min(bono.valor * tasaFallback, precioBaseCOP)`.
5. **Unit tests** de la nueva función: casos feliz, valor inválido, borde `precioBaseCOP<=0`, fallback 1:1.

### Fase 3 — Bifurcación en calculo-totales (FR-005)

6. **`src/lib/pagos/calculo-totales.service.ts`**: agregar parámetro `monedaLocal: string` (default "COP" para llamadas actuales que no lo pasan explícitamente — cero regresión). Refactor:
   - Si `monedaLocal === "COP"`: `descuentoBono = calcularDescuentoBonoCOP(subtotal, bono, tasa)` (con `tasa` como fallback para FIJO_USD).
   - Else: camino histórico `descuentoBono = redondearCents(bono.descuentoUSD * tasa)`.
7. **Tests integración**: SC-002 (COP sin tasa consumida — asegurar con spy en `PagosRepository.obtenerTasaCambioMasReciente`), SC-003 (USD histórico intacto).

### Fase 4 — Bifurcación en renovacion.service (FR-006, FR-007)

8. **`src/lib/pagos/renovacion.service.ts:148-200`** (`registrarRenovacion`): extraer la lógica de "calcular en USD y convertir" a helper `calcularNetoUSD(...)`. Introducir `calcularNetoCOP(plan, bonos, referido, descuentoAnualPct)`:
   - `baseCOP = plan.precioBaseCOP ?? 0`
   - descuentos anual/bono/referido calculados en COP directo (aplicar `calcularDescuentoAnualCOP` = `calcularDescuentoAnualUSD` reusada con base COP — es puro porcentaje).
   - `Pago.montoBaseCOP = baseCOP; Pago.montoBaseUSD = 0` para el registro.
   - `Pago.montoLocal = totalCOP; Pago.monedaLocal = "COP"`.
9. En el punto de decisión: `if (suscripcion.monedaLocal === "COP") { return calcularNetoCOP(...) } else { return calcularNetoUSD(...) }`.
10. Rama USD conserva todo el flujo actual (incluyendo `calcularMontoLocal` y el error 503).
11. **Tests integración**: SC-002 + SC-010 (post-renovación, `Pago.montoBaseCOP > 0 AND montoBaseUSD = 0`).

### Fase 5 — CRUD admin: quitar hardcode (FR-003)

12. **`src/components/modules/PlanesAdminCRUD.tsx:141`**: eliminar la línea `precioBaseUSD: 0` del body del POST. El schema (fase 1 · default 0) se encarga.
13. Verificar que ningún test del CRUD depende del hardcode.

### Fase 6 — UI: retirar `precioBaseUSD` de vistas (FR-008, FR-009, FR-010)

14. **`src/app/dashboard/colegio/suscripcion/page.tsx`**: quitar `precioBaseUSD: number` de la interface local (línea 29) y del mapeo (línea 40). Idem `padre/suscripcion/page.tsx` (líneas 32, 43).
15. **`src/components/modules/cliente/suscripcion/SuscripcionVista.tsx:74`**: cambiar `montoBaseUSD={vista.plan.precioBaseUSD}` → `montoBase={vista.plan.precioBaseCOP ?? 0}`.
16. **`src/components/modules/cliente/suscripcion/AplicarBonoCard.tsx`**: renombrar prop `montoBaseUSD` → `montoBase`; POST body `{suscripcionId, bonoId, montoBase}` (o `montoBase` como canónico + `montoBaseUSD` para compat interna si necesario).
17. **Buscar consumidores** de `AplicarBonoCard` — grep automático. Los tests unit/UI existentes se ajustan.
18. **`SuscripcionVista.tsx` tipos** (`SuscripcionVistaProps`): actualizar el tipo si trae `precioBaseUSD`. `suscripcion-vista.types.ts` NO se toca (candado Fase 2: brief §4).
    - **Nota candado**: brief §4 lista `SuscripcionVista, PlanesSelector, AdminActivacionManual` como "NO cambiar tipos" en Fase 1. Aquí sólo cambio prop de `AplicarBonoCard` (NO listado en el candado). Si aparece necesidad de modificar los tipos listados → PARA · HALLAZGO.

### Fase 7 — Ratchet estático FR-016 R4

19. **`scripts/lint/no-usd-en-vistas-suscripcion.ts`**: grep sobre `src/app/dashboard/colegio/suscripcion/**` + `src/app/dashboard/padre/suscripcion/**`, exit ≠ 0 si aparece `precioBaseUSD` o `montoBaseUSD`. Mismo patrón de `no-x-invoke-path.ts`.
20. **`scripts/lint/ratchets.test.ts`**: +tests con fixtures.
21. **`package.json`**: `ratchets:no-usd-vistas` + añadido a `ratchets:check`.
22. **`.github/workflows/ci.yml`**: el paso `npm run ratchets:check` ya está — cubre el nuevo automáticamente.

### Fase 8 — Gate LOCAL completo

23. `npx tsc --noEmit`
24. `npm run lint`
25. `npm run tokens:check`
26. `npm run arch:check` (regenerar docs si drift)
27. `npm run locks:check`
28. `npm run ratchets:check` (5 ratchets — 4 anteriores + `no-usd-vistas`)
29. `npm run test:unit` (incluye los nuevos + los existentes intactos)
30. Verificar integración: `npm run test:integration -- calculo-totales renovacion aplicar-bono planes` sobre BD test.

### Fase 9 — Gate pre-push (I-101/I-104)

31. `git fetch origin && git rebase origin/feature/001-scaffolding`
32. `git diff --name-status origin/feature/001-scaffolding..HEAD` — verificar solo archivos declarados. Si aparece uno ajeno → HALLAZGO · PARA.

### Fase 10 — Push + PR + CI + merge

33. `git push origin work/002-PI-189`. Fábrica abre PR + mergea cuando CI cierre verde.

### Fase 11 — Verificación en vivo obligatoria (SC-009)

34. Admin login → `/dashboard/admin/pagos/planes` → crear plan `Test COP 50000` con solo `precioBaseCOP=50000`. Verificar POST 201.
35. Consultar BD: `SELECT precioBaseCOP, precioBaseUSD FROM "Plan" WHERE nombre='Test COP 50000'` → `(50000, 0)`.
36. Padre con ese plan (o rector, según `tipoTitular`): abrir `/dashboard/{padre|colegio}/suscripcion` → ver `$50.000 COP` como precio.
37. Reportar bitácora con los tres puntos.

### Commit map (español, imperativo)

- `docs(spec-kit): SPEC-289 · spec + plan · COP como fuente única Fase 1 (I-126) [002-PI-189]`
- `feat(pagos): calcularDescuentoBonoCOP como fuente única para bonos COP [SPEC-289]`
- `feat(pagos): bifurcación por monedaLocal en calculo-totales + renovacion [SPEC-289]`
- `refactor(admin): quitar hardcode precioBaseUSD del PlanesAdminCRUD [SPEC-289]`
- `refactor(ui): retirar precioBaseUSD de vistas suscripción + AplicarBonoCard con montoBase [SPEC-289]`
- `feat(ci): ratchet no-usd-en-vistas-suscripcion [SPEC-289]`

---

## Test Strategy

- **Unit**: `calcularDescuentoBonoCOP` (3 tipos + bordes) + schemas Zod (SC-005/SC-006).
- **Integración (Vitest con BD real)**:
  - `calculo-totales.service.test.ts`: SC-002 (COP sin tasa consumida, con spy), SC-003 (USD histórico), edge cases (bono FIJO_USD sin tasa vigente → fallback 1:1).
  - `renovacion.service.test.ts`: SC-010 post-renovación COP `montoBaseCOP>0 AND montoBaseUSD=0`.
  - `POST /api/admin/pagos/planes` route.test.ts: SC-001.
  - `POST /api/pagos/aplicar-bono` route.test.ts: shim retrocompatible `montoBase` y `montoBaseUSD`.
- **Ratchet**: fixture con `precioBaseUSD` sintético en vista → ratchet falla; sin él → verde.
- **Verificación en vivo**: SC-009 obligatoria, reporte con 3 números concretos.

---

## Risks & Mitigations

| Riesgo | Mitigación |
|---|---|
| Introducir el default `.default(0)` rompe algún test existente del schema. | Los tests actuales pasan `precioBaseUSD` explícitamente cuando lo requieren; el default solo aplica cuando el campo está ausente. Se corren todos los tests del schema post-fix. |
| El shim `montoBaseUSD` retrocompatible en `pagosAplicarBonoBodySchema` deja código muerto. | Documentado explícito como "shim Fase 1"; se retira en Fase 2 (ARQ_16). |
| `calcularDescuentoBonoCOP` para `DESCUENTO_FIJO_USD` sin tasa vigente cobra menos (fallback 1:1). | Documentado en Edge Cases del spec; alternativa (lanzar 503) es peor UX que un cobro subestimado. Se registra en el log de auditoría del checkout. |
| El módulo Análisis muestra MRR=0 para planes solo-COP. | Hallazgo aceptado brief §7-7. Se documenta en cierre; Fase 2 lo cerrará. |
| El refactor de `AplicarBonoCard` rompe consumidores no anticipados. | Grep automático para localizar todos los consumidores. El shim en el schema evita ruptura HTTP; los cambios de UI son solo tipado + prop renombrada. Tests unit ya cubren la card. |
| El rebase sobre `origin/feature/001-scaffolding` post-merge SPEC-287 crea conflicto en algún archivo tocado. | Los archivos SPEC-287 (`middleware.ts`, layouts, routing) no colisionan con los míos (pagos, schemas, admin). Si aparece conflicto en `scripts/lint/` (donde SPEC-287 agregó ratchets), conservar ambos bloques (§9.6 CLAUDE.md). |
| La bifurcación por `monedaLocal` deja usuarios con `monedaLocal=null` en limbo. | Verificar en BD: TODAS las Suscripcion tienen `monedaLocal` no-null (defecto en schema). Si algún registro es null, el `else` histórico se ejecuta con `calcularMontoLocal(null)` que hoy lanza 503. Comportamiento pre-fix conservado. |

---

## Out of Scope

- **Fase 2** completa: retiro columnas USD en Prisma, refactor MRR, ARQ_16, retiro `TasaCambio`/`worker-tasas.mjs`/`/api/admin/pagos/tasas`.
- **Módulo Análisis dinero-vs-valor (ARQ_12)** — MRR mostrará 0 para planes solo-COP (hallazgo aceptado).
- **Cambios al motor IA** `src/lib/ai/**`.
- **Cambios al schema Prisma** (`Plan.precioBaseUSD`, `Pago.montoBaseUSD`, `TasaCambio`).
- **Endpoint `/api/admin/pagos/tasas`** (intacto).
- **Tipos `SuscripcionVista`, `PlanesSelector`, `AdminActivacionManual`** (brief §4 candado explícito).
- **Módulo Colegio, Padre, Admin** más allá de las vistas de suscripción, del CRUD de planes y de `AplicarBonoCard`.
- **Rediseño de flujo de renovación/cancelación/consentimiento**.
