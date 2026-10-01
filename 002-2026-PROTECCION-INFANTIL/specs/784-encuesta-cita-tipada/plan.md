# Plan · SPEC-784 · Rescatar las pantallas de la encuesta sobre el modelo tipado

> **PARÁ en §4.** Este plan documenta el diseño para la compuerta del CEO. Nada se implementa hasta
> aprobación (D-1..D-6); el gate (FR-4) además espera SPEC-751 en `main`.

## A · Lo que YA está en `main` (de 753 / #755) — se LEE, no se toca

| Pieza | Ruta | Rol en 784 |
|---|---|---|
| Modelo `EncuestaCita` + enums + 2 CHECK + `@@unique` | `prisma/schema.prisma` + migraciones `2026092922/23` | **leer**: el endpoint persiste contra estos enums |
| Preguntas cerradas + `key`s atadas a enums | `src/lib/profesional/cita/encuestas-preguntas.ts` | **consumir**: `PREGUNTAS_SERVICIO`, `RAZONES_NO_REALIZO`, `opcionesValidas` (`hueco-funcional` → se cierra al importarlo) |
| Service del cruce | `src/lib/profesional/cita/encuestas-cita-cruce.service.ts` | **llamar**: `cruzarEncuestasCita(solicitudId, db)` (`hueco-funcional` → se cierra al importarlo) |
| Estado efectivo de la cita | `src/lib/profesional/cita/estado-efectivo.ts` | **consumir**: `estadoEfectivoDeCita` — base de la derivación (FR-2) |

## B · Mapa del trasplante de #341 (head `54cee8f42`) — intacto / reescribir / no-rescata

| #341 (SPEC-429) | Clasificación | Qué hago |
|---|---|---|
| `src/app/encuesta/page.tsx` | **INTACTO (estructura)** | shell: `verifyAuth` + derivar pendientes + montar form + redirect si ninguna. Cambia la FUENTE de «pendiente» → `citasConEncuestaPendiente` |
| `src/components/modules/profesional/panel/EncuestaProfesionalPendiente.tsx` | **INTACTO (estructura)** | panel del profesional: fetch pendiente + monta form lado `PROFESIONAL` |
| `src/components/modules/encuesta/EncuestaFormulario.tsx` | **REESCRIBIR** | de `r1..r5` texto a opciones cerradas de `PREGUNTAS_SERVICIO`; flujo condicional P1 (FR-3); copy/voz Diseño (`d682cdb`) |
| `src/app/api/encuesta/route.ts` | **REESCRIBIR** | valida `key`s (`opcionesValidas`), deriva `origen`, persiste `EncuestaCita`, llama `cruzarEncuestasCita`, 409 en `@@unique` |
| `src/lib/dal/repositories/encuesta-cita.ts` | **NO RESCATA** (superseded) | 753 usa `db.encuestaCita` directo; no se trae el repo `r1..r5`/`resolverPartes`/`marcarEncuestaPendiente` |
| `src/lib/profesional/cita/encuestas-preguntas.ts` (de #341) | **NO RESCATA** (superseded) | la versión canónica es la de 753 (ya en `main`) |
| `src/lib/profesional/cita/encuestas.service.ts` (+test) | **NO RESCATA** (superseded) | el service canónico es `encuestas-cita-cruce.service.ts` (753) |
| `al-cumplir.ts` (disparador 427↔429) | **NO RESCATA** (subsumido) | la derivación reemplaza el flag; sin caller en `main` (verificado) |
| `middleware.ts +16` (guarda `/encuesta`) | **NO RESCATA** (suposición vencida) | Edge no lee BD (D-1); el gate va a la página (FR-4) |

## C · Piezas NUEVAS de 784

### C-1 · Derivación única (FR-2) — `src/lib/profesional/cita/encuesta-pendiente.ts`
- **Núcleo PURO** (unit, sin BD), la regla que el candado C-1 prueba:
  ```
  export function esEncuestaPendientePara(
      estadoEfectivo: EstadoEfectivoCita,
      yaRespondidaEsteLado: boolean,
  ): boolean
  // true sii estadoEfectivo ∈ ESTADOS_QUE_PIDEN_ENCUESTA ({PASADA, CUMPLIDA}) && !yaRespondidaEsteLado
  ```
- **Envoltura de lectura** `citasConEncuestaPendiente(usuarioId, rol, now, db)`: trae las
  `SolicitudCita` del usuario (por su rol → `origen`), aplica `estadoEfectivoDeCita` + la ausencia de
  `EncuestaCita` de ese `origen`, devuelve las citas pendientes. **Consumida por el gate, el panel y el
  shell** — una sola noción de «pendiente» (la costura que el CEO advirtió).
- Falla conservador (heredado de `estadoEfectivoDeCita`: tiempo inválido → `PASADA`).

### C-2 · ~~Gate de página~~ **ELIMINADO (D-7, Diseño `439d1c3`)** — el punto de entrada es una TARJETA/BLOQUE
> No se construye `encuestaGateDetiene` ni la exención de `SUPERFICIES_PROTECCION`. En su lugar: la tarjeta
> del padre (`TarjetaEncuestaPendiente` en `DashboardUsuarioClient` + `EsperaCitaPanel`) y el `Bloque`
> «Sesiones por registrar» del profesional (`PanelProfesional`, conteo por el DAL). La invariante «nunca
> sobre el reporte» la sostiene el **candado de ORDEN** del árbol de render (C-4), no una compuerta. **784
> deja de depender de SPEC-751.** El texto de abajo queda como registro del diseño descartado.

#### (registro) diseño de gate descartado — `src/lib/routing/encuesta-gate.ts`
- Molde exacto de `audiencia-gate.ts` (SPEC-751): PURA, import-light, **sin BD**.
  ```
  import { esSuperficieDeProteccion } from "@/lib/routing/guardias"; // ← de SPEC-751
  export function encuestaGateDetiene(ruta: string, hayPendiente: boolean): boolean
  // false si esSuperficieDeProteccion(ruta) (protección SIEMPRE abierta); si no, hayPendiente
  ```
- **Consumo server-side** (no Edge): en la página/layout del padre y el panel del profesional, si
  `encuestaGateDetiene(pathname, hayPendiente)` → `redirect("/encuesta")`. **Nunca** en un shell que
  envuelva `/dashboard/padre/reportar`.
- Se **suma al candado** `proteccion-siempre-abierta.candado.test.ts` (de 751) con control positivo.
- **No se escribe hasta que 751 esté en `main`** (importa `esSuperficieDeProteccion`); mientras tanto
  vive como diseño en este plan.

### C-3 · Capa de copy del formulario (FR-7, D-3) — `src/components/modules/encuesta/copy-encuesta.ts`
- La copy visible de Diseño (`d682cdb`): enunciados, labels, **role-relative** de
  `OTRA_PARTE_NO_CONECTO` (padre «El profesional no se conectó» / profesional «La familia no se
  conectó»), intro por voz, desenlace del «no se realizó» (padre acuse+salida; profesional log).
- Las `key`s vienen de `PREGUNTAS_SERVICIO`/`RAZONES_NO_REALIZO` (753); esta capa **solo pinta**. Así el
  módulo de 753 conserva su texto de provenance legal y el label doble no se fuerza en un string único.
  *(Sujeto a D-3: alternativa = reescribir los labels del módulo de 753.)*

## D · El endpoint `POST /api/encuesta` (FR-1/5/6)
1. `verifyAuth` → usuario + rol.
2. Resuelve la `SolicitudCita` y el `origen` del usuario (PADRE si es el padre de la cita; PROFESIONAL
   si es el profesional). Si no participa → 403.
3. Verifica que la cita está en estado que pide encuesta (reusar `esEncuestaPendientePara`) → si no, 409/422.
4. Valida el cuerpo contra las `key`s cerradas (`opcionesValidas`); rechaza texto libre y `key` inválida → 400.
5. Aplica la coherencia P1 también en el server (defensa en profundidad; la UI ya la impone): `seRealizo`
   → exige `duracion` y prohíbe `razonNoRealizo`, y viceversa.
6. Persiste `EncuestaCita` (map `key`→enum; `SI`/`NO`→bool para `seRealizo`).
7. `cruzarEncuestasCita(solicitudId, db)` (no-op si falta el otro lado; registra incidentes si están los dos).
8. Colisión `@@unique([solicitudId, origen])` → **409** (traducir el `P2002` de Prisma, no 500).

## E · Cierre del `hueco-funcional` (mismo commit del cableado)
- Quitar de `scripts/arch/modulos-huerfanos-allowlist.json`:
  - `src/lib/profesional/cita/encuestas-preguntas.ts` (lo importa el form + endpoint).
  - `src/lib/profesional/cita/encuestas-cita-cruce.service.ts` (lo importa el endpoint).
- **Queda** `src/lib/profesional/cita/estado-efectivo-incidente.ts` (D-4).
- Salida autoexigida: si el módulo queda importado pero sigue en la allowlist, `arch:check` cae ROJO
  (huérfano-ya-cubierto).

## F · Candados y pruebas (todas control-positivo por MUTACIÓN, nunca `git checkout`)
- **C-1** `encuesta-pendiente.candado.test.ts` (unit): la regla pura por estado × yaRespondida. Registrar
  en `vitest.unit.includes.ts`.
- **C-2** en `api/encuesta/route.test.ts` (integración): 1er POST 201 · 2º del mismo `origen` 409.
- **C-3** candado del formulario (unit, jsdom / árbol de render): con `seRealizo=Sí` no monta la razón;
  con `No` no monta la duración; no hay `textarea`/input de texto. Control positivo por mutación del
  render.
- **C-4** sumar `encuestaGateDetiene` a `proteccion-siempre-abierta.candado.test.ts` (cuando 751 entre).
- **C-5** cubierto por C-3 (cero texto libre) + una aserción de que ninguna pregunta pide contenido.
- Gate de calidad antes de REALIZADO: `tsc` + `lint` + `test:unit` + candados + recorrido caminado en la
  app desplegada (padre y profesional), no solo verde.

## G · Orden de implementación (tras aprobación §4)
1. Derivación pura + envoltura (C-1) — no depende de nada externo.
2. Endpoint + su test 409 (D) — cierra los dos huecos de la allowlist en este commit.
3. Formulario + capa de copy + candado estructural (C-3) — copy de `d682cdb`.
4. Shell `/encuesta` + panel del profesional (re-derivan pendiente).
5. **Cuando entre 751:** gate de página (C-2) + sumar al candado de protección (C-4) + cablear el
   redirect server-side.
6. `#341` se cierra con el motivo en el PR de 784 (no antes).
