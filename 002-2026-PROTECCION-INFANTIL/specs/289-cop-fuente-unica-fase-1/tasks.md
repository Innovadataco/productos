# Tasks — SPEC-289 · COP como fuente única (Fase 1) — cierra I-126

**Branch**: `work/002-PI-189`
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

---

## Fase 1 — Schemas Zod (FR-001, FR-002, FR-011)

- **T001** [✓] `src/lib/schemas/pagos.ts:73` — `precioBaseUSD: z.coerce.number().min(0).optional().default(0)`.
- **T002** [✓] `src/lib/schemas/pagos.ts:117-121` (`pagosAplicarBonoBodySchema`): shim retrocompatible `montoBase` (nuevo canónico) + `montoBaseUSD` (viejo). Al menos uno positivo.
- **T003** [✓] Tests unit del schema: SC-005 (create sin USD → default 0), SC-006 (no freemium + COP=0 → error).

## Fase 2 — Función pura descuento COP (FR-004)

- **T004** [✓] `src/lib/pagos/pagos-calculos.service.ts`: nueva `calcularDescuentoBonoCOP(precioBaseCOP, bono, tasaFallback=1)`.
- **T005** [✓] `src/lib/pagos/pagos-calculos.service.test.ts`: +6 tests (3 tipos × 2 escenarios: base positiva / fallback).

## Fase 3 — Bifurcación calculo-totales (FR-005)

- **T006** [✓] `src/lib/pagos/calculo-totales.service.ts`: agregar param `monedaLocal` (default "COP"). Bifurcar descuento del bono. Cero cambio semántico USD.
- **T007** [✓] `src/lib/pagos/calculo-totales.service.test.ts`: SC-002 (COP sin llamar a `obtenerTasaCambioMasReciente` — spy), SC-003 (regresión USD).

## Fase 4 — Bifurcación renovacion.service (FR-006, FR-007)

- **T008** [✓] `src/lib/pagos/renovacion.service.ts`: extraer `calcularNetoUSD` + introducir `calcularNetoCOP`. Bifurcar por `suscripcion.monedaLocal`.
- **T009** [✓] Tests integración renovacion COP: `Pago.montoBaseCOP > 0 AND montoBaseUSD = 0` (SC-010).

## Fase 5 — CRUD admin (FR-003)

- **T010** [✓] `src/components/modules/PlanesAdminCRUD.tsx:141`: quitar `precioBaseUSD: 0` hardcode.

## Fase 6 — Vistas + AplicarBonoCard (FR-008, FR-009, FR-010)

- **T011** [✓] `src/app/dashboard/colegio/suscripcion/page.tsx`: retirar `precioBaseUSD` de interface + mapeo.
- **T012** [✓] `src/app/dashboard/padre/suscripcion/page.tsx`: idem.
- **T013** [✓] `src/components/modules/cliente/suscripcion/SuscripcionVista.tsx:74`: pasar `montoBase={vista.plan.precioBaseCOP ?? 0}`.
- **T014** [✓] `src/components/modules/cliente/suscripcion/AplicarBonoCard.tsx`: prop `montoBase`, POST body `montoBase`.
- **T015** [✓] Actualizar tests unit de `AplicarBonoCard` si existen.

## Fase 7 — Ratchet FR-016 R4

- **T016** [✓] `scripts/lint/no-usd-en-vistas-suscripcion.ts`: grep sobre vistas suscripcion, exit≠0 si `precioBaseUSD|montoBaseUSD`.
- **T017** [✓] `scripts/lint/ratchets.test.ts`: +tests con fixtures.
- **T018** [✓] `package.json`: `ratchets:no-usd-vistas` + añadido a `ratchets:check`.

## Fase 8 — Gate LOCAL

- **T019** [✓] `tsc --noEmit`
- **T020** [✓] `lint` 0 err
- **T021** [✓] `tokens:check`
- **T022** [✓] `arch:check` (regenerar docs si drift)
- **T023** [✓] `locks:check`
- **T024** [✓] `ratchets:check` (5/5)
- **T025** [✓] `test:unit`
- **T026** [✓] Registro `specs/README.md` (SPEC-289).

## Fase 9 — Pre-push + push

- **T027** [✓] Gate pre-push (I-101): fetch + rebase + diff — solo archivos SPEC-289.
- **T028** [✓] Push (Fábrica abre PR + mergea).

## Fase 10 — Verificación en vivo (SC-009)

- **T029** [✓] Post-deploy: admin crea plan COP-only, padre lo ve en `/dashboard/padre/suscripcion` — bitácora.

---

## Restricciones activas

- 🔒 CERO migraciones Prisma (`Plan.precioBaseUSD`, `Pago.montoBaseUSD`, `TasaCambio` intactos).
- 🔒 CERO cambios en módulo Análisis (ARQ_12) — MRR=0 para planes COP aceptado por §7-7.
- 🔒 CERO eliminación de `worker-tasas.mjs` · CERO cambios en `/api/admin/pagos/tasas` · CERO cambios en `obtenerTasaCambioMasReciente`.
- 🔒 CERO cambios en tipos `SuscripcionVista`, `PlanesSelector`, `AdminActivacionManual` (candado §4 brief).
- 🔒 CERO cambios en `src/lib/ai/**`.
- 🔒 `AplicarBonoCard`: shim `montoBaseUSD` retrocompatible se retira en Fase 2 — documentado en cierre.md.
