# Feature Specification: Peso colombiano como fuente única de precio (Fase 1) — desbloquea cobro real (cierra I-126)

**Feature Branch**: `work/002-PI-189` (SPEC-289)
**SPEC**: 289
**Created**: 2026-08-27
**Status**: PLANEADO
**Input**: INSTRUCTIVO-002-PI-189-COP-COMO-FUENTE-UNICA · BRIEF-A-27-COP-COMO-FUENTE-UNICA-DE-PRECIO · D-88 · D-85 · I-126 (efecto colateral) · absorbe A-29 · inicia el frente Fase 2 (ARQ_16 futura, NO se toca aquí)

Impacto en arquitectura: **cero migraciones**. Se introduce bifurcación por `Suscripcion.monedaLocal` en el motor de cobros para que un plan solo-COP se cobre por su `precioBaseCOP` directo, sin pasar por USD ni tasa de cambio. El camino histórico USD→tasa→COP queda intacto para suscripciones `monedaLocal="USD"`. Se desbloquea el cobro real del producto y se cierra I-126 por efecto colateral (el CRUD deja de exigir USD).

**Estado del código verificado en fuente 2026-08-27 (más avanzado que el brief sugiere):**
- ✅ `src/lib/schemas/pagos.ts` — `precioBaseUSD` ya es `.optional()` (no `.positive()`). Solo falta agregar `.default(0)` para asegurar 0 al persistir.
- ✅ `src/app/api/admin/pagos/planes/route.ts:79` — POST ya persiste `body.precioBaseUSD ?? 0` (default 0). El route.ts está OK.
- ✅ `src/lib/pagos/calculo-totales.service.ts:88` — `subtotal = plan.precioBaseCOP` (base ya es COP).
- ⚠️ `src/lib/pagos/calculo-totales.service.ts:86-101` — el descuento de bono todavía se calcula en USD (`bono.descuentoUSD * tasa`). Falta bifurcación.
- ⚠️ `src/lib/pagos/renovacion.service.ts:158-187` — cálculo completo en USD, convierte con `calcularMontoLocal` al final. Falta bifurcación.
- ⚠️ `src/components/modules/PlanesAdminCRUD.tsx:141` — hardcode `precioBaseUSD: 0` a quitar.
- ⚠️ 4 hits `precioBaseUSD` en `src/app/dashboard/{colegio,padre}/suscripcion/page.tsx` (líneas 29, 40, 32, 43) — solo interface + prop drilling, la UI no lo muestra.
- ⚠️ `src/components/modules/cliente/suscripcion/SuscripcionVista.tsx:74` — pasa `montoBaseUSD={vista.plan.precioBaseUSD}` a `AplicarBonoCard`. Cambio de contrato.

---

## Puntos de compuerta (para audit Fábrica antes de aprobar)

1. **Bonos en modo COP — cómo modelo `descuentoCOP` sin migrar Prisma.** El brief §2.1-1 dice "los bonos deben guardar `descuentoCOP` al emitirse (independiente de tasas)", pero §4 impone "cero migración destructiva". Contradicción: sin migración no puedo agregar columna `descuentoCOP` a `BonoAplicado`.

   **Propuesta adoptada (cero migraciones):** función pura `calcularDescuentoBonoCOP(precioBaseCOP, bono, tasaFallback)` en `pagos-calculos.service.ts`, análoga a la USD:
   - `DESCUENTO_PCT`: pct × precioBaseCOP (cero tasa)
   - `MESES_GRATIS`: valor × precioBaseCOP mensual (cero tasa)
   - `DESCUENTO_FIJO_USD`: valor × tasaFallback → COP (mantiene dependencia de tasa SOLO para este tipo histórico; si no hay tasa vigente, `tasaFallback=1`)
   `BonoAplicado.descuentoUSD` sigue guardándose para no romper la historia; la conversión a COP se hace al calcular totales. Si Fase 2 agrega columna `descuentoCOP`, migra los históricos entonces. Requiere confirmación Fábrica.

2. **Planes viejos con `precioBaseUSD > 0` y `precioBaseCOP` presente.** Verificado en BD prod 2026-08-27 (brief §4): 10 planes actuales tienen `precioBaseUSD = 0` — no hay planes vivos con USD real. La bifurcación se guía por `Suscripcion.monedaLocal`, no por `precioBase`. Un plan mixto con `monedaLocal="USD"` sigue por camino histórico; con `monedaLocal="COP"` va por el nuevo.

3. **Alcance del cambio en `AplicarBonoCard`.** Es cambio de contrato de props (recibe `montoBaseCOP` en lugar de `montoBaseUSD`) y de body POST a la API de aplicar bono (`pagosAplicarBonoBodySchema` valida `montoBaseUSD.positive()`). Dos opciones:
   - **(a) Renombrar prop + agregar campo `montoBaseCOP` opcional al schema** — cambio de contrato de UI + API, mínimo.
   - **(b) Reinterpretar `montoBaseUSD` como "monto base numérico" pero mantener el nombre** — hack, no lo recomiendo.
   
   **Propuesta adoptada:** (a) — renombro `montoBaseUSD` → `montoBase` en la prop de `AplicarBonoCard` y en el body de `/api/pagos/aplicar-bono`, con un shim retrocompatible en el schema Zod que acepta ambos por 1 versión. La API interna interpreta el valor según `monedaLocal` de la suscripción. Es Fase 1 auto-contenida.

4. **Módulo Análisis (ARQ_12) — hallazgo aceptado.** MRR (`mensualizarPrecio`) sigue leyendo `precioBaseUSD`. Con planes solo-COP, MRR mostrará 0 para esos planes. §7 criterio 7 del brief lo declara aceptado — se cierra en Fase 2 (ARQ_16). Este frente NO toca `analisis-panel-repository.ts`, `dal/services/analisis-panel.ts`, `panel-calculos.ts`, `anomalias/fixtures.ts`. Si aparece necesidad de tocarlos → PARA · HALLAZGO.

5. **`worker-tasas.mjs` NO se elimina.** Queda inerte en repo (no está en compose). Si aparece propuesta de eliminarlo → PARA · HALLAZGO. Su ID `123456798` en `scripts/ADVISORY-LOCKS.md` sigue siendo válido.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Jelkin puede crear un plan con solo precio COP y cobrarlo (Priority: P1)

Jelkin entra a `/dashboard/admin/pagos/planes`, crea un plan "Colegio Anual COP" con `precioBaseCOP=50000` (sin ingresar USD). Un rector con ese plan y `monedaLocal="COP"` abre `/dashboard/colegio/suscripcion` y ve `$50.000 COP` como precio. Al renovar, el sistema le cobra exactamente `50.000 COP` (más IVA si aplica) — SIN pasar por `TasaCambio`.

**Why this priority**: Es el único motivo del frente. Sin este cambio, el producto no puede cobrar (auditoría CEO 2026-08-27).

**Independent Test**: (a) test integración `pagosPlanCreateSchema` acepta `{precioBaseCOP: 50000}` sin `precioBaseUSD`. (b) test integración `calcularTotales(plan={precioBaseCOP:50000}, tipoTitular="COLEGIO")` con `monedaLocal="COP"` → total = 50000 + IVA. (c) test integración `registrarRenovacion` con suscripción COP → `Pago.montoBaseCOP = precioBaseCOP` sin llamadas a `obtenerTasaCambioMasReciente`.

**Acceptance Scenarios**:

1. **Given** admin en `/dashboard/admin/pagos/planes`, **When** POST `{nombre:"Colegio Anual COP", precioBaseCOP:50000, tipoTitular:"COLEGIO", duracion:"MES_12", esFreemium:false}`, **Then** 201 · plan persistido con `precioBaseUSD=0`.
2. **Given** suscripción con `monedaLocal="COP"` y plan con `precioBaseCOP=50000`, **When** `calcularTotales`, **Then** `subtotal=50000` sin tasa consultada.
3. **Given** rector renueva con plan COP, **When** `registrarRenovacion`, **Then** `Pago.montoBaseCOP=50000`, cero llamadas a `TasaCambio`.

### User Story 2 — Cobro USD histórico sigue funcionando (regresión) (Priority: P1)

Un plan viejo con `precioBaseUSD=25` y una suscripción con `monedaLocal="USD"` (o cualquier moneda no-COP) sigue cobrando por el camino histórico: base USD → tasa → moneda local. Ningún cliente USD ve cambios.

**Why this priority**: Regresión invisible al ojo humano. Si rompemos el camino USD, cualquier futura expansión internacional se rompe silenciosamente.

**Independent Test**: test integración `calcularTotales(plan={precioBaseUSD:25}, monedaLocal="USD")` sigue devolviendo 25 USD equivalente. `registrarRenovacion` para suscripción USD llama a `calcularMontoLocal` y consume `TasaCambio` como hoy.

**Acceptance Scenarios**:

1. **Given** plan con `precioBaseUSD=25` y suscripción `monedaLocal="USD"`, **When** `calcularTotales`, **Then** devuelve base 25 USD.
2. **Given** misma suscripción, **When** `registrarRenovacion`, **Then** el flujo USD→tasa→local ejecuta como hoy (mismo path que pre-fix).

### User Story 3 — Bonos aplicados a plan COP descuentan en COP (Priority: P2)

Un rector con plan COP aplica un bono `DESCUENTO_PCT` de 20%. El descuento es 20% × `precioBaseCOP` — cero llamada a tasa. Un bono `MESES_GRATIS` de 2 meses da 2 × `precioBaseCOP` mensual. Un bono `DESCUENTO_FIJO_USD` de $5 se convierte con la última tasa vigente (fallback 1:1 si no hay); el estado se registra en `BonoAplicado.descuentoUSD` para historia.

**Why this priority**: Los bonos son el mecanismo de retención y activación (SPEC-216, SPEC-244). Sin ellos, la Fase 1 se cobra pero no premia. Se conserva la semántica sin migrar.

**Independent Test**: 3 tests unit de `calcularDescuentoBonoCOP` cubriendo los 3 tipos. Test integración: plan COP + bono PCT en checkout → total refleja descuento correcto sin llamada a tasa.

**Acceptance Scenarios**:

1. **Given** plan COP `precioBaseCOP=100000` + bono PCT 20%, **When** checkout, **Then** `descuentoBono=20000`, cero tasa consultada.
2. **Given** plan COP + bono FIJO_USD $5 sin tasa vigente en BD, **When** checkout, **Then** `descuentoBono=5` (fallback 1:1), NO 500.
3. **Given** bono aplicado a suscripción COP, **When** `BonoAplicado` se persiste, **Then** `descuentoUSD` guarda el equivalente reconvertido para historia (no rompe reportes).

### User Story 4 — La UI del padre y del colegio muestra COP como precio único (Priority: P2)

Un rector abre `/dashboard/colegio/suscripcion` — ve `$50.000 COP` como precio del plan, sin ninguna mención a USD. El `AplicarBonoCard` recibe el monto base en COP y muestra el descuento previo en COP.

**Why this priority**: Cero cambio observable en la UX visual (el precio se muestra en COP hoy también); el cambio es interno — `precioBaseUSD` sale de las interfaces TypeScript y del prop drilling. Sin este cambio, el ratchet §3-4 grep no da 0.

**Independent Test**: grep `precioBaseUSD` en `src/app/dashboard/{colegio,padre}/suscripcion/**` = 0 hits. Test unit `AplicarBonoCard` con `montoBase` (nuevo prop) llama a la API con body correcto.

**Acceptance Scenarios**:

1. **Given** vista `/dashboard/colegio/suscripcion` con plan COP, **When** cargo la página, **Then** el precio se muestra en COP; grep `precioBaseUSD` en el árbol de vistas = 0.
2. **Given** `AplicarBonoCard`, **When** se le pasa `montoBase={precioBaseCOP}`, **Then** POST `/api/pagos/aplicar-bono` con body correcto.

---

## Edge Cases

- **Plan freemium (`esFreemium=true`)**: `precioBaseCOP=0` es válido (schema §5 refine). El motor no cobra nada; sigue igual pre-fix.
- **Suscripción con `monedaLocal` distinta de "COP" y "USD"** (moneda no soportada hoy): cae por el camino USD (histórico) que llama a `calcularMontoLocal(monedaLocal)`. Si no hay tasa vigente para esa moneda, el error 503 histórico se conserva.
- **Plan con `precioBaseCOP=null` y `monedaLocal="COP"`**: `calcularTotales` devuelve subtotal 0 (comportamiento actual `?? 0`). Documentado; no es responsabilidad del servicio validar la data del plan.
- **Bono `DESCUENTO_FIJO_USD` sin tasa vigente**: fallback 1:1 documentado en `calcularDescuentoBonoCOP`. No lanza 503.
- **Aplicar bono a suscripción con `Pago` histórico USD**: la historia (`BonoAplicado.descuentoUSD`) se conserva; nada retroactivo se cambia.
- **`AplicarBonoCard` en un consumidor externo que aún envía `montoBaseUSD`**: schema Zod acepta ambos (`montoBase` prioridad, `montoBaseUSD` shim retrocompatible por Fase 1). Post-Fase 2 se retira el shim.
- **Módulo Análisis MRR con planes COP**: `mensualizarPrecio(plan.precioBaseUSD)` = 0. **Hallazgo aceptado** (brief §7 criterio 7).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `src/lib/schemas/pagos.ts` — `pagosPlanCreateSchema.precioBaseUSD` DEBE ser `z.coerce.number().min(0).optional().default(0)`. El default cierra el hueco de no enviar el campo.
- **FR-002**: `src/lib/schemas/pagos.ts` — `pagosPlanUpdateSchema.precioBaseUSD` DEBE ser `z.coerce.number().min(0).optional()`. El default sólo aplica en create.
- **FR-003**: `src/components/modules/PlanesAdminCRUD.tsx:141` DEBE quitar el hardcode `precioBaseUSD: 0` del body del POST. El schema y la API se encargan del default 0.
- **FR-004**: `src/lib/pagos/pagos-calculos.service.ts` DEBE exportar `calcularDescuentoBonoCOP(precioBaseCOP, bono, tasaFallback)`, función pura equivalente a `calcularDescuentoBono` pero en COP. Tres ramas por `TipoBono`: `DESCUENTO_PCT`, `MESES_GRATIS` (cero tasa), `DESCUENTO_FIJO_USD` (usa `tasaFallback`).
- **FR-005**: `src/lib/pagos/calculo-totales.service.ts` DEBE bifurcar por `monedaLocal` (nuevo parámetro): si `monedaLocal==="COP"`, el descuento del bono se calcula con `calcularDescuentoBonoCOP`; en cualquier otro caso, camino histórico (`descuentoUSD * tasa`).
- **FR-006**: `src/lib/pagos/renovacion.service.ts` DEBE bifurcar por `suscripcion.monedaLocal`: si `"COP"`, todo el cálculo se hace en COP nativo (`baseCOP = plan.precioBaseCOP`, descuentos en COP, `Pago.montoBaseCOP` directo, `Pago.montoBaseUSD=0`, sin llamar a `calcularMontoLocal`). En cualquier otro caso, camino histórico intacto.
- **FR-007**: `src/lib/pagos/renovacion.service.ts` — cuando `monedaLocal="COP"`, el error 503 "no hay tasa vigente" NO se lanza. Suscripciones COP nunca dependen de tasa.
- **FR-008**: `src/app/dashboard/colegio/suscripcion/page.tsx` y `src/app/dashboard/padre/suscripcion/page.tsx` DEBEN eliminar `precioBaseUSD` de las interfaces TypeScript locales y del prop drilling. La UI ya muestra COP hoy; solo se limpia el tipo.
- **FR-009**: `src/components/modules/cliente/suscripcion/SuscripcionVista.tsx` DEBE pasar `montoBase={vista.plan.precioBaseCOP ?? 0}` a `AplicarBonoCard` (renombrada desde `montoBaseUSD`).
- **FR-010**: `src/components/modules/cliente/suscripcion/AplicarBonoCard.tsx` DEBE aceptar prop `montoBase: number` (renombrada). El POST a `/api/pagos/aplicar-bono` DEBE enviar `montoBase` (nuevo nombre).
- **FR-011**: `src/lib/schemas/pagos.ts:pagosAplicarBonoBodySchema` DEBE aceptar `montoBase` como campo canónico y `montoBaseUSD` como shim retrocompatible (ambos opcionales; al menos uno positivo). El endpoint interno usa el que venga.
- **FR-012**: NO se toca `prisma/schema.prisma` (candado brief §4).
- **FR-013**: NO se toca módulo Análisis (ARQ_12): `analisis-panel-repository.ts`, `dal/services/analisis-panel.ts`, `panel-calculos.ts` (MRR), `anomalias/fixtures.ts` (candado brief §4).
- **FR-014**: NO se elimina `scripts/worker-tasas.mjs` (candado brief §4). Su ID `123456798` sigue registrado en `scripts/ADVISORY-LOCKS.md`.
- **FR-015**: NO se toca `/api/admin/pagos/tasas`, ni `TasaCambio`, ni `obtenerTasaCambioMasReciente` (candado brief §4).
- **FR-016**: Los 5 ratchets del brief §3 DEBEN correr verdes en CI:
  - R1: test integración POST plan sin `precioBaseUSD` → 201.
  - R2: test integración `calcularTotales` COP → total = COP sin tasa.
  - R3: test regresión `calcularTotales` USD → total USD histórico intacto.
  - R4: `grep precioBaseUSD src/app/dashboard/{colegio,padre}/suscripcion` = 0. Nuevo script en `scripts/lint/no-usd-en-vistas-suscripcion.ts` corre en `verificaciones`.
  - R5: test invariante schema — envío con `esFreemium=false` y `precioBaseCOP=0` falla; envío con `precioBaseCOP=100000` sin `precioBaseUSD` pasa.
- **FR-017**: NO se toca `src/lib/ai/**` (candado global).

### Key Entities

- **`calcularDescuentoBonoCOP`** (nueva función pura en `src/lib/pagos/pagos-calculos.service.ts`): fuente única de descuento de bono en COP. Sin efectos.
- **`Suscripcion.monedaLocal`** (existente, no se toca schema): campo que activa la bifurcación. Valores hoy: "COP", "USD" (potencialmente otros).
- **Shim retrocompatible `pagosAplicarBonoBodySchema`**: acepta `montoBase` (nuevo) o `montoBaseUSD` (viejo). Post-Fase 2 se retira.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `POST /api/admin/pagos/planes` con `{nombre, precioBaseCOP:50000, tipoTitular:"COLEGIO", duracion:"MES_12"}` (sin `precioBaseUSD`) → 201. `SELECT precioBaseUSD FROM "Plan" WHERE id=<nuevo>` = 0.
- **SC-002**: Unit test `calcularTotales(plan={precioBaseCOP:100000}, tipoTitular:"COLEGIO", monedaLocal:"COP")` → `subtotal=100000, total=100000+IVA`, `obtenerTasaCambioMasReciente` NO se llama (verificable con spy).
- **SC-003**: Unit test `calcularTotales(plan={precioBaseUSD:25}, tipoTitular:"COLEGIO", monedaLocal:"USD")` → mismo comportamiento pre-fix (regresión).
- **SC-004**: `grep -r "precioBaseUSD" src/app/dashboard/{colegio,padre}/suscripcion/` = **0 hits**.
- **SC-005**: Unit test `pagosPlanCreateSchema.parse({nombre:"x", precioBaseCOP:100000, tipoTitular:"COLEGIO", duracion:"MES_12"})` → OK, `precioBaseUSD` = 0 via default.
- **SC-006**: Unit test `pagosPlanCreateSchema.parse({nombre:"x", precioBaseCOP:0, esFreemium:false, ...})` → error.
- **SC-007**: Ratchet `no-usd-en-vistas-suscripcion.ts` corre en `verificaciones` y sale con código 0.
- **SC-008**: Gate LOCAL completo verde: `tsc --noEmit`, `lint 0 err`, `tokens:check`, `arch:check`, `locks:check`, `ratchets:check` (incluye el nuevo), `test:unit`.
- **SC-009**: **Verificación en vivo**: en prod post-deploy, Desarrollo (yo) crea un plan `Test COP 50000` con solo `precioBaseCOP=50000`, se autentica como padre con ese plan, abre `/dashboard/padre/suscripcion`, ve `$50.000 COP` como precio del plan y del total. Reporta la salida.
- **SC-010**: `SELECT COUNT(*) FROM "Pago" WHERE "monedaLocal"='COP' AND "montoBaseCOP" > 0 AND "montoBaseUSD" = 0` post-deploy después de un cobro real de plan COP: al menos 1 fila.

---

## Assumptions

- El worktree parte de `origin/feature/001-scaffolding` HEAD (`61492c3d`, post-merge SPEC-287).
- Los 10 planes de producción tienen `precioBaseUSD=0`; no hay planes vivos con USD real que preservar (verificado en brief §4).
- El schema Zod ya está más avanzado que lo que el brief sugiere: `precioBaseUSD` es `.optional()` hoy. Solo falta `.default(0)`.
- El route API POST ya persiste `?? 0`. Solo falta quitar el hardcode del CRUD.
- El módulo Análisis mostrará 0 MRR para planes solo-COP durante Fase 1. Hallazgo aceptado (§7 criterio 7 brief).
- `TasaCambio` sigue viva para bonos DESCUENTO_FIJO_USD; `calcularDescuentoBonoCOP` la lee vía `tasaFallback` opcional (fallback 1:1 si vacía).
- Cero cambios en `src/lib/ai/**`. Cero migraciones. Cero cambios en módulo Análisis. Cero eliminación de `worker-tasas.mjs`.
