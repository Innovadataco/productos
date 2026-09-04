# Tareas · SPEC-427 — Los dos códigos y el cierre de la cita

- [x] T001 Modelo `CodigoCita` + `TipoCodigoCita` + `SolicitudCita.autocerradaEn` + 5 acciones de auditoría (los 2 del expediente viajan a 427b con su emisor), en **una** migración aditiva (lección I-277: enum y código que lo emite viajan juntos).
- [x] T002 `codigos.ts`: emitir (bcrypt), verificar en el orden vencimiento → intentos → comparación, consumo de un solo uso con `WHERE usadoEn IS NULL`, y la traza que leen los tres.
- [x] T003 `cierre.service.ts`: cerrar con código → `CUMPLIDA`; «no se presentó» → `NO_ASISTIO_PADRE`; barredor de recordatorio; barredor de autocierre. (El código de EXPEDIENTE va a 427b.)
- [x] T004 El código y su aviso **en la misma transacción**, fallando en cerrado si no hay regla activa (I-295).
- [x] T005 **I-300**: `autocerradaEn` como marca dedicada y la cola 2 filtrando por ella. Con contraprueba.
- [x] T006 **I-301**: `scripts/worker-citas.mjs` con los CUATRO barredores, lock `123456800` registrado en `ADVISORY-LOCKS.md`, servicio `pi-citas` en el compose de producción y señal en el monitor.
- [x] T007 Traza instrumentada en la cola 2 del Verificador; adiós «pendiente de instrumentar». De paso, la fila mostraba `creadoEn` bajo el rótulo «Cita del …»: ahora muestra la fecha de la cita.
- [x] T008 Panel del profesional: input de 6 dígitos para cerrar y control «No se presentó». El candado de SPEC-425 cayó y se **actualizó**, no se borró.
- [x] T009 `al-cumplir.ts`: punto de unión con SPEC-429, llamado en los dos cierres, fuera de transacción y con el error registrado.
- [x] T010 Seed de las tres plantillas/reglas + declaración en `verify-reglas-notificacion.ts` (dos **bloquean** el despliegue).
- [x] T011 candados estáticos (de CONDUCTA, no de palabras) + 17 tests de integración contra base propia, con reproducciones negativas.
- [x] T012 Gate, fila en `specs/README.md` y PR.

## Anotado

- La **plata** (liberar, girar, devolver) es de L7.
- Las **encuestas** y el cruce son de SPEC-429 (Dev 01, en paralelo).
- El aviso al administrador es la **cola 2**, no un correo más.

## Revisión adversarial (segunda vuelta)

- [x] R1 B1 · `ensureQueue` en `worker-citas.mjs` antes de `schedule/work`.
- [x] R2 (a) · cerrar = consumir + `CUMPLIDA` en una transacción; candado estático con contraprueba.
- [x] R3 (b) · `marcarAutocerrada` con guardia de estado; probado muriendo.
- [x] R4 (c) · autocierre e inasistencia atómicos (estado + aviso en la tx); `programadas===0` → `logger.error`.
- [x] R5 (e) · `try/catch` por cita en los barridos.
- [x] R6 (g) · textos sin la encuesta de 429 ni la reprogramación no cableada.
- [x] R7 (h) · `pi-citas` en la whitelist de `docker-adapter.ts`.
- [x] R8 (i) · candado del worker: descubre por disco, ignora comentarios; contraprueba.
- [x] R9 · código de EXPEDIENTE → SPEC-427b; `EXPEDIENTE_ABIERTO` y `CODIGO_DIGITADO` se mudan a su migración (I-277).
- [x] R10 · los 5 valores de enum de 427 documentados para Kimi (BI · `bi_replica`).

## Radicado v3 (7 bloqueantes + menores)

- [x] B1 La vigencia del código se ancla al fin de la franja (`max(vigenteDesde+30, fin+60)`); antes moría a mitad de sesión.
- [x] B2 Fuera `pedirOtroCodigoDeCita` + su ruta + `puedeReemitir`/`MAX_REEMISIONES` (no hay pantalla del padre); cuatro textos honestos.
- [x] B3 La autocerrada sale del «esperando respuesta» y del marcador; tiene su propio bloque.
- [x] B4 `try/catch` por cita en los dos barredores de `worker.ts` + `errores` en sus resúmenes.
- [x] B5 Autocierre e inasistencia fallan en cerrado si el aviso no se programó; `cita.no_asistio.padre` pasa a bloqueante.
- [x] B6 `EXPEDIENTE` sale del enum de 427 (va a 427b con su emisor); la cola 2 deja de afirmar «Nunca se pidió»; candado de emisor por tipo.
- [x] B7 El test del tablero afirma contra `[...SENALES_MONITOREO]`, no un literal.
- [x] Menores: candados vueltos a conducta (ensureQueue, `tx` en los repos, slice acotado, `.test.mjs` excluido, auditoría leída en BD, ownership 403, un-solo-uso real, traza con envío); whitelist docker == compose; `marcarReprogramadaOriginal` con guardia; `DIAS_AUTOCIERRE` importado; docblocks al día.
