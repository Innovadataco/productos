# SPEC-427b · El código de expediente, de punta a punta — A-75 · L6

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-04 · **Dev**: Dev 02 (`idc-80`) · **Origen**: brief A-75 §9 momento 6 (la mitad que SPEC-427 dejó afuera)

**Impacto en arquitectura:** migración aditiva de **2 valores** de `AccionAudit` (`CODIGO_DIGITADO`, `EXPEDIENTE_ABIERTO`); el modelo `CodigoCita` y su tipo `EXPEDIENTE` ya existen desde 427. Un quinto barredor en el worker `pi-citas`, un evento nuevo del motor y dos endpoints. Sin cambios de contrato con otros productos más allá del enum (ya aplicado por BI).

> **Se construye sobre SPEC-427** (#339): usa `CodigoCita`, `validarCodigo`, `emitirCodigo` y el tipo `EXPEDIENTE`, que viven ahí. Se mergea **después** de 427.

---

## Por qué existe

427 implementó el **código de cita** —el que certifica que la sesión ocurrió— y dejó el **código de expediente** a medias: se validaba y se auditaba, pero **nadie lo emitía y no abría nada**. Media funcionalidad no entra a medias, así que salió a esta spec. Acá se completa de punta a punta.

El brief §9 momento 6: si el padre eligió compartir su expediente, le llega un **segundo código**, distinto del de cita. Se lo dicta al profesional **en la sesión**; el profesional lo digita y con eso —y solo con eso— puede **abrir el expediente en solo lectura**, con vigencia de 30 minutos y un solo uso.

Con las palabras del brief: la autorización a leer el expediente deja de ser una casilla marcada días antes y pasa a ser **un acto del padre, en el momento**. Si se arrepiente, no entrega el código y no hay nada que revocar.

SPEC-425 dejó el bloque «Expedientes compartidos» del panel como una **lista muerta** («solo se listan»). 427b lo vuelve accionable.

---

## Cómo quedó

**Emisión (barredor nuevo).** `barrerRecordatoriosDeExpediente` corre en el worker `pi-citas`, junto a los otros cuatro. Emite el código de EXPEDIENTE **solo si `expedienteCompartidoId` está** —solo si el padre compartió—, 10 minutos antes de la cita, con su propio correo. Idempotente por consulta (`codigos: { none: { tipo: "EXPEDIENTE" } }`) y con `try/catch` por cita (lección fix e de 427). Código y aviso nacen en la misma transacción (I-295).

**Digitar (`abrirExpedienteConCodigo`).** Valida el código; si sirve, lo **consume y deja el rastro `CODIGO_DIGITADO` en la misma transacción** (lección fix a de 427: si el audit fallara después de consumir, el código quedaría quemado sin constancia). Un solo uso.

**Leer (`lecturaExpedienteParaProfesional`).** Devuelve **exactamente las mismas cifras que ve el padre** (capa 1, SPEC-340): no hay una segunda vista ni un camino de escritura. El acceso se comprueba contra la fila usada del código —no un booleano aparte que pueda contradecir la traza—. La lectura se calcula sobre el **padre dueño** del expediente, no sobre el profesional, y Prisma no sale del DAL (Q-3): se agregó `lecturaDelExpedientePorId` en `expediente-vivo.ts`.

**H-2 · cada lectura se audita.** No alcanza con auditar que digitó el código: **cada vez que abre el expediente** deja su fila `EXPEDIENTE_ABIERTO`. Saber quién leyó el expediente de un menor, y cuándo, es reserva legal (Ley 1918/2018 · 2375/2024), no un lujo.

---

## Verificación

**6 tests de integración** contra base propia (creada y destruida):

- El barrido emite el código **solo** si el padre compartió el expediente.
- Idempotente: una segunda corrida no reemite.
- **Sin digitar → 403**: la lectura se niega.
- Con el código correcto abre en solo lectura, y **el mismo código no abre dos veces**; la lectura trae los hechos reales del padre.
- **H-2**: dos lecturas → **dos filas de auditoría**.
- **Otro profesional no puede** abrir la cita ajena (403, cero auditoría).

**6 candados estáticos** con contraprueba: que la lectura audite `EXPEDIENTE_ABIERTO` **antes** de devolver (una lectura sin rastro se detecta), que exija acceso (403 sin código), que abrir consuma y audite en una transacción, que el acceso viva en la fila del código, y que el valor del código nunca se audite ni se loguee.

`tsc` limpio · `lint` 0 errores · `arch:check` verde · `locks:check` sin colisión · **2.387 unitarios verdes**.

> **Verde en CI ≠ funciona.** Cierra cuando en producción un padre comparta su expediente, reciba su código, y un profesional lo lea con él dejando su fila de auditoría.

---

## Contrato cross-producto (BI · ya resuelto)

Los dos valores de enum de esta spec (`CODIGO_DIGITADO`, `EXPEDIENTE_ABIERTO`) se escriben en `AuditLog`, que está en la publicación `bi_replica`. **Kimi ya los aplicó** junto con los 5 de 427 (7 en total, `ADD VALUE IF NOT EXISTS`, y en su script de reconciliación para rebuilds; suscripción sana 45/45 tablas). No hace falta coordinar nada más por el enum.

## Lo que NO trae

- **La plata** (el cobro por compartir, si lo hubiera) — no aplica: compartir el expediente no cuesta.
- **Escritura sobre el expediente** — el profesional solo lee. Nunca hay un camino de mutación.
