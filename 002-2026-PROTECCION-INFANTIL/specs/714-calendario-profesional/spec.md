# SPEC-714 · El calendario del profesional, nivel dios (mockup aprobado por Jelkin)

**Status**: DESARROLLO

**Origen:** Jelkin en prod (17-09): «no es funcional… un calendario nivel dios, fácil e intuitivo, como Google/Apple; hoy toca ir una a una, hora por día». **Diseño entregó el mockup y Jelkin lo aprobó directo.** **Carril:** Dev 1 · Diseño (certifica) · Calidad. **Fuentes:** `mockups/calendario-profesional-nivel-dios-2026-09-17.html` (el objetivo, no una referencia) + `FORMA-CALENDARIO-PROFESIONAL-2026-09-17.md` (Gestión).

## Alcance v1 — sin modelo nuevo para las repeticiones

Las repeticiones se **materializan** como filas `FranjaDisponible` (no hay tabla de series). El calendario se **pinta**: rejilla semana/día (+ móvil día con tira), arrastrar-para-crear con popover (modalidad + repetir), repetir patrón, copiar día, seleccionar en lote, y —lo pedido por Jelkin— **un solo componente** para «Calendario» (publicar) y «Citaciones» (ver y responder), con los estados de la cita **dentro de la cuadrícula**.

## Lo que entra

- **Rejilla** semana (web, por defecto) / día (móvil, por defecto) + tira de días; conmutador Día/Semana; `‹ Hoy ›`.
- **Crear arrastrando** (snap 30 min, fantasma) → popover: modalidad (fija si atiende una sola), **repetir** (no / cada {día} hasta la vigencia / lun-vie), publicar.
- **Repetir / copiar día / seleccionar-lote / quitar.** Materializan respetando **muro de vigencia** y **no-solape**; las que no caben no se crean y se dice cuántas sí.
- **Estados en la cuadrícula** (empatan con SPEC-712): `libre` (cielo, acciones de publicar), `validando` (`SIN_CONFIRMAR`, neutro+reloj, sin acción), `esperando` (`PAGADA_PENDIENTE`, ámbar+punto → Responder con el relato + Confirmar/No puedo), `confirmada` (`CONFIRMADA`, pino+candado → detalle), `fuera de vigencia` (rayado).
- **Reservada/confirmada a prueba de borrado**: no se quitan con el gesto de publicar (el servidor ya lo garantiza: `borrarSiLibre`).
- **Campanita → buzón** «Esperando su respuesta» (deriva de las `PAGADA_PENDIENTE`; sin backend nuevo).

## Las tres cosas del mockup que NO existen hoy — decididas por el CEO (medí antes de construir)

1. **Código de cierre — NO va.** No hay flujo de cierre ni nada escribe `CUMPLIDA` (L6). El detalle de la confirmada muestra **cita + contacto** (correo del padre, que `toCitaParaProfesional` ya expone solo en `CONFIRMADA` — H-2), **sin** código de cierre y **sin insinuarlo**. La forma se corrige (Diseño).
2. **Dónde/enlace — degradado con la verdad.** Dirección/enlace entran con **SPEC-708** (Dev 2). Hasta entonces el detalle muestra el contacto que sí existe; no se deja un hueco rotulado «dirección».
3. **Bloquear día — con modelo (decisión del CEO).** `DiaBloqueado` (Datos): no se pueden crear franjas en un día bloqueado y bloquear **no borra** citas confirmadas. **No bloquea este PR:** el núcleo sale sin el botón de bloquear si el modelo de Datos no está listo; el botón entra en un PR chico después — **nunca un botón falso**.

## Candados (mutación-verificada)

- **c1 · repetir materializa exacto y nada pasa la vigencia**: un patrón lun-vie crea las franjas que caben, ninguna con `fin > venceEn`; mutar (quitar el filtro de vigencia) → rojo.
- **c2 · bloquear no toca las reservadas** (cuando entre el modelo): las confirmadas del día se conservan; mutar → rojo. *(Difiere con el botón de bloquear.)*
- **c3 · borrar una reservada se rechaza en el servidor**: `DELETE` sobre una `tomada` → 0 filas/400 (`borrarSiLibre`); mutar (quitar `tomada:false` del where) → rojo.
- **c4 · publicar una modalidad que no atiende se rechaza**: `POST` VIRTUAL con `!atiendeVirtual` → 400; mutar (quitar la validación) → rojo.

## Impacto

**Impacto en arquitectura:** un solo componente de calendario (`CalendarioProfesional`) montado por `/dashboard/profesional/calendario` (publicar) y `/dashboard/profesional/citaciones` (responder), alimentado por una lectura de calendario que une `FranjaDisponible` con su `SolicitudCita` (estado + `presentacion` + contacto por H-2) y `venceEn`. La materialización en lote va por un `franjas.service.ts` (transaccional, `withUnitOfWork`) tras un `POST /api/profesional/franjas/lote` (nunca un GET que muta). Sin modelo nuevo en el núcleo (el de bloquear-día lo implementa Datos aparte). Voz **usted** (candado SPEC-550/719). Reserva legal H-2: el correo del padre solo en `CONFIRMADA` (ya lo hace `toCitaParaProfesional`).

## Fuera

- Modelo de **serie** de recurrencia (editar «todos mis martes» como unidad) — si Jelkin lo pide, se radica con Datos. · Cierre con código (L6) y plata (L7). · Dirección/enlace (SPEC-708).
