# Tasks · SPEC-749 · cablear el estado efectivo

> §4 aprobado (CEO). Frontera confirmada: `now ≥ FIN`. Orden: FR-1/FR-3 primero; FR-2 diferida.

## Fase A — FR-1 (panel.service) · arranca ya

- [ ] **T1 · Caracterización ANTES del refactor.** Test de FRONTERA en `route.test.ts` (o vecino): `CONFIRMADA` con `now` **justo antes** del `inicio` → `citasConfirmadas` (agenda); **justo después** del `inicio` (aún < `fin`) → `casosPorCerrar`. Correr contra el código VIEJO → **VERDE**. Fija que la frontera del split es el **INICIO**, no el FIN (el existente `route.test.ts:197` usa -3h/+72h — no atrapa un corrimiento de frontera).
- [ ] **T2 · Refactor.** `panelDelProfesional` deriva `porCerrar`/`agenda` de `estadoEfectivoDeCita("CONFIRMADA", franja.inicio, franja.fin, ahora)`: `agenda = fase === "PROXIMA"`, `porCerrar = resto`. Quitar `yaOcurrio`. Correr T1 + `route.test.ts` → **VERDE sin tocarlos** ⇒ «idéntica» PROBADO. Si alguno flipa → HALLAZGO, PARO.
- [ ] **T3 · Salida del allowlist.** Quitar la entrada `estado-efectivo.ts` (`hueco-funcional`) de `modulos-huerfanos-allowlist.json` (obsoleta al ganar importador de prod). `arch:check` VERDE.

## Fase B — FR-3 (borrado)

- [ ] **T4** · Borrar `grupoDeCita` + tipo `GrupoCita` de `citas-listado.ts`. Conservar `badgeDeCita`/`BadgeCita`.
- [ ] **T5** · `mis-citas.candado.test.ts`: quitar `grupoDeCita` del import y sus asserts; conservar los de `badgeDeCita`. Barrer las 3 clases de candado (import · lector de FUENTE por ruta · meta-aserción de cobertura).
- [ ] **T6** · Verificar sin cobertura huérfana ni export muerto (`arch:check` + búsqueda dead-code).

## Fase C — Preflight + PR

- [ ] **T7** · `tsc` + `lint` + `arch:check` + tests de las áreas tocadas. Control positivo por mutación A-1 (futuro→PROXIMA) y A-2 (ayer→PASADA), ambas direcciones.
- [ ] **T8** · Commit(s), push, PR. Reportar al CEO (incluye: `migrate deploy` aplicó `direccion_atencion` sin error).

## Fase D — FR-2 (DIFERIDA)

- [ ] **T9** · Espera copy `CONFIRMADA`-pasada ([NEEDS CLARIFICATION] del CEO) + **rebase tras #721** antes de tocar `EsperaCitaPanel`. Derivar de (estado + franja vs `now`, frontera **FIN**); copy §14 para `PAGADA_PENDIENTE`/`SIN_CONFIRMAR`; `now` inyectado, ausente/basura → PASADA. Cierra SC-1 (las 105 pantallas).
