# Tareas · SPEC-427 — Los dos códigos y el cierre de la cita

- [x] T001 Modelo `CodigoCita` + `TipoCodigoCita` + `SolicitudCita.autocerradaEn` + 7 acciones de auditoría, en **una** migración aditiva (lección I-277: enum y código que lo emite viajan juntos).
- [x] T002 `codigos.ts`: emitir (bcrypt), verificar en el orden vencimiento → intentos → comparación, consumo de un solo uso con `WHERE usadoEn IS NULL`, y la traza que leen los tres.
- [x] T003 `cierre.service.ts`: cerrar con código → `CUMPLIDA`; abrir expediente con código; «no se presentó» → `NO_ASISTIO_PADRE`; pedir otro código; barredor de recordatorio; barredor de autocierre.
- [x] T004 El código y su aviso **en la misma transacción**, fallando en cerrado si no hay regla activa (I-295).
- [x] T005 **I-300**: `autocerradaEn` como marca dedicada y la cola 2 filtrando por ella. Con contraprueba.
- [x] T006 **I-301**: `scripts/worker-citas.mjs` con los CUATRO barredores, lock `123456800` registrado en `ADVISORY-LOCKS.md`, servicio `pi-citas` en el compose de producción y señal en el monitor.
- [x] T007 Traza instrumentada en la cola 2 del Verificador; adiós «pendiente de instrumentar». De paso, la fila mostraba `creadoEn` bajo el rótulo «Cita del …»: ahora muestra la fecha de la cita.
- [x] T008 Panel del profesional: input de 6 dígitos para cerrar y control «No se presentó». El candado de SPEC-425 cayó y se **actualizó**, no se borró.
- [x] T009 `al-cumplir.ts`: punto de unión con SPEC-429, llamado en los dos cierres, fuera de transacción y con el error registrado.
- [x] T010 Seed de las tres plantillas/reglas + declaración en `verify-reglas-notificacion.ts` (dos **bloquean** el despliegue).
- [x] T011 39 candados estáticos + 9 tests de integración contra base propia, y **dos reproducciones negativas**.
- [x] T012 Gate, fila en `specs/README.md` y PR.

## Anotado

- La **plata** (liberar, girar, devolver) es de L7.
- Las **encuestas** y el cruce son de SPEC-429 (Dev 01, en paralelo).
- El aviso al administrador es la **cola 2**, no un correo más.
