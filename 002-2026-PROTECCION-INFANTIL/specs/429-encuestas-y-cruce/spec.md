# SPEC-429 · Las dos encuestas y el cruce — brief A-75 v2.2 §7 L6-bis + §9-bis

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-04 · **Dev**: PI-1 (`idc-32`) · **Origen**: orden CEO 23:5x tras la orden de Jelkin «de una vez esta noche». En paralelo con SPEC-427 (Dev 02: códigos, cierre, autocierre, worker); ambos comparten el contrato de unión `src/lib/profesional/cita/al-cumplir.ts`.

## Para qué

Cerrar el ciclo humano del brief §9-bis: cuando la cita se marca `CUMPLIDA` (por SPEC-427), padre y profesional reciben cada uno **cinco preguntas de opción**. Las respuestas 1 y 2 de cada lado se cruzan automáticamente: si se contradicen, salta un **incidente al Verificador** sin que nadie reclame. El valor no está en la calificación — está en detectar la contradicción.

Mientras el usuario no responde, queda bloqueado por una **guardia nueva `encuestaPendiente`** del mismo estilo que `debeCambiarPassword`. Se le deja siempre abierto el par «cambiar contraseña» + logout + `/api/me`, como manda la lección I-25 / C-9.

## Diseño (CEO 23:5x)

### Modelo (rehecho)

`EncuestaPrimeraCita` de SPEC-388a (una encuesta, estrellas, texto libre — huérfano, 0 filas, 0 llamadores) **se retira**. En su lugar:

- **`EncuestaCita`** — una fila por (`solicitudId`, `origen ∈ {PADRE, PROFESIONAL}`) con `r1..r5` como strings de opción y `respondidaEn`. `@@unique([solicitudId, origen])` corta el doble intento del mismo lado (409 en el service).
- **`IncidenteContradiccionEncuesta`** — fila abierta al cerrar la 2ª encuesta cuando r1 o r2 se contradicen. `@@unique([solicitudId, pregunta])` la hace idempotente frente a re-cruces. El Verificador la resuelve.
- **`Usuario.encuestaPendiente`** — flag boolean, estilo `debeCambiarPassword`.
- **Enum `AccionAudit`**: dos valores nuevos, `ENCUESTA_CITA_RESPONDIDA` y `ENCUESTA_CITA_CONTRADICCION`. `ALTER TYPE ADD VALUE IF NOT EXISTS` (lección I-277 · sumar valores no rompe callers ya desplegados; corre fuera de la transacción por regla de Postgres).

### Contrato de unión con SPEC-427

`src/lib/profesional/cita/al-cumplir.ts` exporta `export async function alCumplirCita(solicitudId: string): Promise<void>`. Dev 02 la llama en `cierre.service.ts` (`cerrarConCodigoDeCita`), **fuera de la transacción, con try/catch + logger.error** (que una encuesta no se active no deshace una sesión que ocurrió, y tampoco muere muda). Dev 01 llena el cuerpo: sube `encuestaPendiente = true` para padre y profesional. **Idempotente** (repetir la llamada no cambia el estado).

### Servicio

- `registrarRespuestaEncuesta({ solicitudId, usuarioId, origen, respuestas })`
  - Valida rol vs origen (padre solo responde su encuesta, profesional la suya).
  - Valida que la cita esté `CUMPLIDA` (antes no se responde).
  - Crea `EncuestaCita`; segundo intento = 409.
  - Deja audit `ENCUESTA_CITA_RESPONDIDA`.
  - **Cruza**: si el otro lado ya respondió, `cruzarEncuestasSiCompletas` normaliza r1/r2 y crea `IncidenteContradiccionEncuesta` cuando el par contradice.
  - **Baja la guardia** del usuario si no le queda ninguna otra pendiente.

- `cruzarEncuestasSiCompletas(solicitudId)` — idempotente por `@@unique`, log `ENCUESTA_CITA_CONTRADICCION` con `usuarioId = padre` cuando hay ≥1 contradicción (el actor es el sistema, la historia real vive en `IncidenteContradiccionEncuesta`).

- `proximaEncuestaPendiente(usuarioId)` — la más antigua sin responder (padre O profesional), usada por `/encuesta` y por el panel.

### Guardia `encuestaPendiente`

- `GUARDIAS_ACCESO.encuesta = { destino: "/encuesta", exentas: ["/encuesta", "/api/encuesta", "/cambiar-password", "/api/auth/cambiar-password", "/api/auth/logout", "/api/me"] }`. Invariante `destino ∈ exentas` verificada al import.
- `esExentaEncuesta(pathname)` helper puro.
- Middleware: bloque nuevo DESPUÉS de `debeCambiarPassword` (el cambio de contraseña manda sobre la encuesta). Si `estado.encuestaPendiente && !esExentaEncuesta(pathname)`, responde 403 en `/api/**` con `code: "ENCUESTA_REQUERIDA"` o redirige la página al `destino`.
- **RIESGO I-236 (CEO 23:5x)**: el bloque vive dentro del `if (estado)`; sin cookie `sesion_estado` cae abierto. Uso el **mismo estilo** que `debeCambiarPassword`, así SPEC-400b cierra las dos guardias juntas.

### Cookie firmada

`SesionEstadoPayload.encuestaPendiente?: boolean` (opcional para leer cookies viejas del despliegue previo). `buildSesionEstadoValue` la lee de `UsuarioRepository.findEncuestaPendiente` en paralelo con las demás señales.

### Endpoints

- `GET /api/encuesta` — devuelve `{ solicitudId, origen, preguntas }` de la próxima pendiente, o `null` cuando no queda ninguna.
- `POST /api/encuesta` — body `{ solicitudId, origen, respuestas: { r1..r5 } }`.

### Pantallas

- `/encuesta` (RSC): trae la próxima pendiente + monta `<EncuestaFormulario />`.
- `EncuestaFormulario.tsx` (client): radios, todos obligatorios, POST + `router.refresh()` para pasar a la siguiente pendencia.
- `EncuestaProfesionalPendiente.tsx` (client): sección del panel del profesional (SPEC-425). Fetch autónomo; sólo se pinta si la próxima pendencia es del lado del profesional. **Se monta en una sola línea** en `PanelProfesional.tsx` de Dev 02: `<EncuestaProfesionalPendiente />`.

### Preguntas (§9-bis, aprobadas provisionalmente por Jelkin 03-09)

Padre: r1 «¿Se dio la cita?», r2 «¿Empezó a la hora acordada?», r3 «¿Entendió lo que le pasaba?», r4 «¿Idea clara de qué hacer?», r5 «¿Volverías?».
Profesional: r1 «¿Se dio la cita?», r2 «¿La familia llegó a tiempo?», r3 «¿La info previa te sirvió?», r4 «¿Corresponde a tu especialidad?», r5 «¿Vas a continuar?».
Opciones fijas por pregunta (ver `encuestas-preguntas.ts`). Cambiar una `key` de opción es migración de datos; cambiar el `label` no.

## Candados

- **Cruce solo r1 y r2** — regla dura del brief: r3/r4/r5 miden mecanismo (compartir expediente, baraja, continuidad); NO disparan incidente.
- **Normalización** — «SI» del padre y «SI» del profesional son iguales; cualquier «NO_*» normaliza a «NO_SE_DIO». El test cierra la contraprueba: coherentes → sin incidente.
- **Idempotencia del cruce** — `@@unique(solicitudId, pregunta)` en `IncidenteContradiccionEncuesta`; el re-cruce no duplica.
- **Guardia sin encerrar** — exentas cubren cambio-de-password + logout + /api/me. Sin esto, un usuario con guardia activa y contraseña temporal se queda encerrado (I-25/C-9).
- **NO escribimos estados de cita** — `NO_ASISTIO_PADRE` lo maneja SPEC-427; acá sólo LEEMOS (via cruce de la r1 del profesional).

## Verificación

- `tsc --noEmit`: verde.
- `arch:check`: **VERDE** en los 7 gates (`01-modelo-datos.md`, `02-roles-capacidades.md`, `03-pantallas.md` regenerados).
- `tokens:check`: piso 1079 intacto.
- `npm run lint`: 0 errors.
- **Suite nueva `encuestas.service.test.ts` — 11/11**:
  - Coherentes → sin incidente.
  - Contradicción en r1 → INCIDENTE P1.
  - Contradicción en r2 → INCIDENTE P2.
  - Un solo lado respondió → no cruza aún.
  - Cruce idempotente (dos llamadas, una fila).
  - `alCumplirCita` sube guardia para padre y profesional.
  - Respondiendo la única pendencia BAJA la guardia.
  - `proximaEncuestaPendiente` devuelve la más antigua.
  - Doble respuesta → 409.
  - Lado incorrecto → 403.
  - Cita no CUMPLIDA → 400.
- **`guardias.test.ts`** + suite nueva `esExentaEncuesta` (40/40 en total).

## Impacto en arquitectura:

- Se retira `EncuestaPrimeraCita` (huérfana, sin filas). Se agregan dos tablas y un enum, más un flag en `Usuario` y una guardia en el middleware. La cookie `sesion_estado` gana el campo opcional `encuestaPendiente` (retrocompatible con sesiones activas del deploy previo — flag lee `false` cuando falta).
- El middleware suma una guardia con el mismo estilo que `debeCambiarPassword`; SPEC-400b, cuando cierre I-236, beneficia a las dos sin cambios.
- El endpoint `/api/encuesta` y la página `/encuesta` son parte del contrato con la guardia: siempre exentos. El componente `EncuestaProfesionalPendiente` es un enclave del panel del profesional (SPEC-425) — Dev 02 lo monta en una sola línea.
- `alCumplirCita` establece la interfaz de unión con SPEC-427; su firma es estable y compatible con la ampliación futura (ej. notificar por correo la encuesta pendiente).

## Fuera de alcance

- Notificar por correo/push al padre y al profesional que tienen encuesta pendiente (queda para el motor de notif del brief L7).
- UI de resolución de `IncidenteContradiccionEncuesta` en el panel del Verificador (queda para SPEC posterior — la fila ya se guarda con lo necesario).
- Recuperar respuestas del usuario ya enviadas (idempotencia = 409, no re-render).
- Diseño de tokens visual del formulario (usa tokens ya existentes; cero color crudo).

## Referencias

- **Brief A-75 v2.2** §7 (L6-bis) + §9-bis (las 10 preguntas).
- **SPEC-388a** — modelo original `EncuestaPrimeraCita` que este SPEC retira.
- **SPEC-425** — panel del profesional donde se monta `EncuestaProfesionalPendiente`.
- **SPEC-427** (Dev 02) — códigos, cierre `CUMPLIDA`, autocierre a 5 días, worker. Contrato de unión: `al-cumplir.ts`.
- **SPEC-395** — motor de citas (`SolicitudCita`, estados).
- **SPEC-400b (I-236)** — cerrará el hueco de las guardias que caen abiertas sin cookie `sesion_estado`.
- Worktree `.worktrees/pi-SPEC-429` desde `origin/main 9dd2e87d5`.
