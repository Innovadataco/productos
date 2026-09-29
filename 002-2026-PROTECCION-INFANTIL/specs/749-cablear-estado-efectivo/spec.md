# SPEC-749 · La cita dice la verdad después de la hora — cablear el estado efectivo

**Status**: DESARROLLO

**Origen:** Jelkin en producción (28/29-09): «el padre entra y no pasa nada». Medido: **105 de 135** citas `CONFIRMADA` ya pasaron su franja y la pantalla dice «Cita confirmada» en verde — el 78% miente. **Carril:** Dev 1 · Datos (revisa) · Calidad. **Radicado:** `RADICADO-SPEC-749` · `BRIEF A-79 §6` fila 1 · `FORMA-FLUJO-REUNION-OPERADOR-ENLACE §14`. **Base:** `main 74fcbbd8c`.

## Lo medido

- La **fuente única** del estado EFECTIVO ya existe en `main`: `estadoEfectivoDeCita` (SPEC-746, #718) — derivación PURA, con su candado (26 casos), `now` INYECTABLE que falla hacia `PASADA`. Sólo overlaya la fase temporal (`PROXIMA`/`EN_CURSO`/`PASADA`) sobre `CONFIRMADA`; todo otro estado es passthrough. Hoy **ningún módulo de producción la importa** (entrada `hueco-funcional` en `modulos-huerfanos-allowlist.json`).
- **Dos piezas cuentan el tiempo con frontera propia, a mano:**
  - `panel.service::panelDelProfesional` (viva): parte `CONFIRMADA` en `porCerrar` vs `agenda` con `yaOcurrio(franja.inicio, ahora)` — frontera en el **INICIO**.
  - `EsperaCitaPanel` (la que miente): decide título/detalle/tono desde `ESTADO_LEGIBLE[cita.estado]` con **cero** franja-vs-ahora → `CONFIRMADA` siempre dice «Cita confirmada», aun con la franja de ayer.
- **Una pieza muerta:** `citas-listado::grupoDeCita` cuenta el tiempo con frontera ≈ **FIN** (`esFutura`) y **no tiene un solo llamador de producción** — sólo su candado (cobertura falsa). `badgeDeCita` (mismo archivo) SÍ se usa (`EsperaCitaPanel`, `RejillaMisCitas`) → el archivo vive.

## El arreglo — tres piezas, la tercera es un borrado

1. **Re-expresar sobre la fuente única, SIN cambiar conducta.** `panelDelProfesional` deriva `porCerrar`/`agenda` de `estadoEfectivoDeCita(estado, franja.inicio, franja.fin, ahora)`: `agenda = PROXIMA`, `porCerrar = EN_CURSO ∪ PASADA`. Con datos válidos (`franja.fin` ya viaja en `solicitud-cita.ts`) es **idéntico** al `yaOcurrio(inicio, ahora)` actual (frontera INICIO). Al importarla, `estado-efectivo.ts` gana importador de producción → se **quita** su entrada `hueco-funcional` del allowlist (salida autoexigida: `entradasObsoletas()` la pondría roja).
2. **La pantalla del padre dice la verdad pasada la hora (DIFERIDA — ver Bloqueos).** `EsperaCitaPanel` deriva de (estado + franja vs `now` inyectado): `CONFIRMADA`→`PROXIMA`/`EN_CURSO` = copy actual; `CONFIRMADA`→`PASADA` = **[NEEDS CLARIFICATION]** (el copy no existe; lo resuelve el CEO con Diseño — no se inventa); `PAGADA_PENDIENTE`/`SIN_CONFIRMAR` con franja pasada = copy de **FORMA §14**. `now` inyectable; ausente/basura → `PASADA`.
3. **Borrar lo muerto.** Se borra `grupoDeCita` + el tipo `GrupoCita` de `citas-listado.ts` (se conserva `badgeDeCita`/`BadgeCita`); se quitan el import y los casos de `grupoDeCita` de `mis-citas.candado.test.ts` (se conservan los de `badgeDeCita`). El barrido cubre las **tres clases de candado** (import · lector de FUENTE por ruta · meta-aserción de cobertura), no sólo el grep de import.

## Requisitos funcionales (FR)

- **FR-1:** `panelDelProfesional` reparte `CONFIRMADA` en `porCerrar`/`agenda` derivando de `estadoEfectivoDeCita`, con conducta **idéntica** a hoy para datos válidos. Si un test existente cambia de resultado → es HALLAZGO: se PARA y reporta (la frontera no era la asumida).
- **FR-2 (diferida):** `EsperaCitaPanel` deriva título/detalle/tono de (estado + franja vs `now`), no del estado crudo; usa el copy de FORMA §14 para `PAGADA_PENDIENTE`/`SIN_CONFIRMAR` con franja pasada; deja `CONFIRMADA` pasada como [NEEDS CLARIFICATION] hasta que el CEO baje el copy.
- **FR-3:** `grupoDeCita` y su candado dejan de existir; `citas-listado.ts` y `badgeDeCita` siguen vivos y probados; el allowlist de huérfanos pierde la entrada de `estado-efectivo.ts`.
- **FR-4:** `now` se inyecta en toda derivación nueva; ausente/basura falla hacia `PASADA`, nunca hacia `PROXIMA` (mentirle al padre hacia el lado optimista es el defecto original).

## Criterios de éxito (SC)

- **SC-1:** cero pantallas del padre que digan «Cita confirmada» a secas con la franja pasada (hoy: 105). *(Se cierra con FR-2; FR-1/FR-3 no lo tocan.)*
- **SC-2:** `arch:check` VERDE (allowlist sin la entrada obsoleta; sin huérfano nuevo).
- **SC-3:** la suite existente de `panel.service` NO cambia de resultado (FR-1 es conducta idéntica).
- **SC-4:** cero cobertura huérfana: no queda candado apuntando a `grupoDeCita`; `badgeDeCita` sigue cubierto.

## Escenarios de aceptación (candado — control positivo por mutación, DOS direcciones)

- **A-1 (futuro → PROXIMA):** `CONFIRMADA` con franja de mañana → `panelDelProfesional` la pone en `agenda`, no en `porCerrar`. Mutación: si la derivación mandara el futuro a `porCerrar` → ROJO.
- **A-2 (ayer → PASADA):** `CONFIRMADA` con franja de ayer → `porCerrar`, no `agenda`; y (FR-2) la pantalla del padre NO dice «Cita confirmada» a secas. Mutación: revertir a una comparación que fallara → ROJO.
- **A-3 (borrado sin cobertura huérfana):** el candado de `grupoDeCita` no sobrevive apuntando a nada; `badgeDeCita` sigue cubierto por su candado.

## Bloqueos y secuencia

- **FR-2 va DESPUÉS:** (a) espera el copy de `CONFIRMADA` con franja pasada ([NEEDS CLARIFICATION] del CEO); (b) rebase sobre `main` antes de tocar `EsperaCitaPanel` (#721 ya corrigió sus comentarios). **Se arranca por FR-1 y FR-3**, que no dependen de una palabra ni de ese archivo.
- **No correr tests contra la BD de test compartida** hasta que el CEO confirme el reset de Datos (migración huérfana de #665 + `ADD COLUMN` sin `IF NOT EXISTS`).

## Impacto en arquitectura

**Impacto en arquitectura:** SPEC-749 cablea la fuente única `estadoEfectivoDeCita` (#718) a `panel.service`, colapsando a **una sola frontera con un solo significado** las dos comparaciones de tiempo que hoy conviven (INICIO en el panel, ≈FIN en el listado muerto). Retira un módulo del allowlist de huérfanos (gana importador de producción) y borra código muerto (`grupoDeCita`). **Sin esquema, sin ruta nueva, sin cambio de datos ni de copy** en FR-1/FR-3; la derivación en la pantalla del padre (FR-2) es UI y va diferida. Es defensa contra la deriva de fronteras: la verdad temporal de una cita queda con un solo dueño.

## Fuera

- El enlace por cita, la cola/asignación del operador con simultaneidad, el DTO del operador (**SPEC-750**). · Consentimiento por versión (**751**). · Canal de continuidad y las dos puertas (**752**). · Dos encuestas + cruce (**753**). · Cerrar el contacto mutuo (**754**). · **No** se toca `estado-efectivo.ts` (fuente, sólo lectura — si falta un caso, se pide, no se agrega acá) ni `#708/#665` (Datos).
