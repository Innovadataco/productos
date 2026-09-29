# Plan · SPEC-749 · cablear el estado efectivo

> **Compuerta §4:** este plan PARA. El CEO aprueba antes de `/speckit.tasks` → `implement`.

## Base y aislamiento

- Rama `work/pi-SPEC-749-cablear-estado-efectivo` sobre `main 74fcbbd8c`.
- **Toca:** `src/lib/profesional/panel/panel.service.ts` · `src/lib/padre/citas-listado.ts` · `src/lib/padre/mis-citas.candado.test.ts` · `scripts/arch/modulos-huerfanos-allowlist.json` · (diferido) `src/components/modules/padre/citas/EsperaCitaPanel.tsx` + su candado.
- **Sólo lectura:** `src/lib/profesional/cita/estado-efectivo.ts` (la fuente). **No toca** `#708/#665` (Datos).

## Orden de ejecución

1. **FR-1 + salida del allowlist** — no depende del copy ni de #721.
2. **FR-3** — borrado; independiente.
3. **Preflight** — `tsc` + `lint` + `arch:check` + los tests de las áreas tocadas — **CUANDO el CEO habilite la BD** (reset de Datos en curso).
4. **FR-2 (diferida)** — rebase sobre `main` → cablear la derivación + copy §14 → dejar `CONFIRMADA`-pasada como [NEEDS CLARIFICATION] hasta que baje el copy del CEO.

## FR-1 — `panel.service`

- `import { estadoEfectivoDeCita } from "@/lib/profesional/cita/estado-efectivo"`.
- Sustituir el split: hoy `porCerrar = confirmadas.filter(s => yaOcurrio(s.franja.inicio, ahora))`, `agenda = !`. Nuevo: `const fase = s => estadoEfectivoDeCita("CONFIRMADA", s.franja.inicio, s.franja.fin, ahora)`; `agenda = confirmadas.filter(s => fase(s) === "PROXIMA")`; `porCerrar = confirmadas.filter(s => fase(s) !== "PROXIMA")`. Eliminar el helper `yaOcurrio`.
- `franja.fin` ya viaja (`solicitud-cita.ts`, ambos `select`). Conducta idéntica para datos válidos (frontera INICIO ≡ límite `PROXIMA`/`EN_CURSO`).
- **Candado A-1/A-2** por conducta con `now` inyectado (una cita mañana → `citasConfirmadas`/agenda; una de ayer → `casosPorCerrar`).
- Quitar la entrada `estado-efectivo.ts` (`hueco-funcional`) de `modulos-huerfanos-allowlist.json` (mismo commit).

## FR-3 — borrado de `grupoDeCita`

- `citas-listado.ts`: borrar la función `grupoDeCita` + el tipo `GrupoCita`. **Conservar** `badgeDeCita`/`BadgeCita` (los usan `EsperaCitaPanel:201`, `RejillaMisCitas:113`).
- `mis-citas.candado.test.ts`: quitar `grupoDeCita` del `import` y sus asserts (≈ líneas 63-68); **conservar** el bloque de `badgeDeCita`.
- **Barrer las 3 clases de candado** (lección SPEC-744): (a) import — grep `grupoDeCita`; (b) lector de FUENTE por ruta — ¿algún test lee `citas-listado.ts` por ruta y cuenta `grupoDeCita`?; (c) meta-aserción de cobertura — ¿algún test exige que `grupoDeCita` esté cubierto? Verificar con `arch:check` + búsqueda de dead-code que no quede export muerto ni cobertura huérfana.

## FR-2 (diferida) — `EsperaCitaPanel`

- **Rebase sobre `main` primero** (#721 tocó comentarios del archivo — evita conflicto comentario-vs-lógica).
- Derivar título/detalle/tono de (estado + franja vs `now`): `CONFIRMADA` → `estadoEfectivoDeCita`; `PAGADA_PENDIENTE`/`SIN_CONFIRMAR` + franja pasada → copy §14 (para `PAGADA_PENDIENTE`, variante `<48 h`/`≥48 h` del reloj de pago que la pantalla ya calcula); `CONFIRMADA` → `PASADA` = **[NEEDS CLARIFICATION]** (no inventar).
- `now`: inyectar (derivado en server o prop), ausente/basura → `PASADA`.

## Preguntas para el gate §4

1. **FR-2 · umbral de «franja pasada»** para `PAGADA_PENDIENTE`/`SIN_CONFIRMAR`: ¿se mide `now ≥ fin` o `now ≥ inicio`? **Propongo `now ≥ fin`** (coherente con `estadoEfectivoDeCita.PASADA`). Confirmar contra §14.
2. **FR-1 · flip:** ¿hay algún test de `panel.service`/route que ejercite `inicio > fin` o entradas inválidas (donde `estadoEfectivoDeCita` difiere de `yaOcurrio`)? Se corre al habilitar la BD; si flipa → HALLAZGO, se PARA.
3. **CONFIRMADA-pasada copy:** [NEEDS CLARIFICATION] del CEO — arranco FR-1/FR-3 sin él.

## Definición de terminado (esta SPEC)

FR-1 + FR-3 mergeables con `arch:check` verde, candado A-1/A-2/A-3 con control positivo por mutación en las dos direcciones, y la suite de `panel.service` sin cambios. FR-2 entra cuando lleguen el copy y el rebase; SC-1 (las 105 pantallas) se cierra con FR-2.
