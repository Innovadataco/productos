# SPEC-428 · El padre agenda una cita con un profesional — brief A-75 v2.1 §9

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: PI-1 (`idc-32`) · **Origen**: brief A-75 v2.1 §9 momentos 1, 4, 5, 6 y 7 · reusa SPEC-395 (motor de citas), SPEC-392 (directorio L3).

## Para qué

Cerrar el hilo humano del padre: del expediente vivo al primer contacto con un profesional verificado. Los 7 momentos del brief §9 orquestados en pantallas que ya existían (L3 baraja) más las que faltaban:

1. **Entrada nace del expediente**: dos botones a la vista en el expediente vivo — «Llamar a la línea» (`tel:141`) y «Recibir apoyo» (arma el flujo con el `expedienteId`).
2. Presentación + urgencia + canales oficiales (SPEC-392, ya existía).
3. Baraja aleatoria (SPEC-392, ya existía).
4. **Perfil del profesional con franjas + PRECIO ESTÁNDAR de primera cita** (parametrizable · `profesional.cita.precio_estandar_primera_cita_cop`). La tarifa del profesional aparece como *«desde la 2ª cita en adelante»*.
5. **«Pagar y pedir la cita»** con decisión explícita de compartir el expediente sugerido por (1).
6. **Pantalla de espera** con reloj de 48 h en `PAGADA_PENDIENTE`.
7. **«Elegí otro» sin volver a pagar** cuando la solicitud queda `VENCIDA_SIN_RESPUESTA` o `NO_ASISTIO_PROFESIONAL` — reusa SPEC-395 `/reasignar` (hereda el pago).

## Diseño / constraints del CEO (verbatim)

- «precio estándar, no la tarifa del profesional. Su tarifa se muestra como *«de la segunda cita en adelante»*, informativa».
- «nunca teléfono ni correo del profesional antes de una cita confirmada. `debeExponerContacto` ya lo cuida en el DTO — no lo rodees».
- «SPEC-403 (comisión 10 %) pasa a Dev 02 — él acaba de centralizar la constante y la convierte en parámetro. No la toques.»
- «reusá, no reescribas» — el motor SPEC-395 (`cita.service.ts` + `/api/padre/citas` + `/reasignar`) ya existía; este SPEC arma pantallas y el precio estándar por encima.

## Qué trae

### Datos + parámetro nuevo

- **Seed** (`prisma/seed.ts` · `seedParametrosPrimeraCita`): `profesional.cita.precio_estandar_primera_cita_cop = "50000"`, `SYSTEM`, no público, no secreto. Idempotente (`update: {}`).
- **Helper** `src/lib/profesional/cita/precio-primera-cita.ts · leerPrecioEstandarPrimeraCita()`: lee el parámetro, valida > 0 entero, throws `AppError` si falta.

### API

- **GET `/api/publico/profesionales/precio-primera-cita`** — sin sesión, devuelve `{ data: { precioCOP: n } }`. Se usa donde haga falta para el badge; hoy la página del padre ya lo trae en SSR.
- **GET `/api/padre/citas/[id]`** (nuevo · rol `PARENT`): detalle vivo de UNA cita del padre. Reusa `SolicitudCitaRepository.findParaPadre` + `toCitaParaPadre` (DTO H-2: contacto sólo si `debeExponerContacto`).
- **`POST /api/padre/citas`** (existente, mínimo cambio): cuando no hay `pagoHeredadoDeId`, la ruta pasa `montoConsultaOverride = leerPrecioEstandarPrimeraCita()` al service, para que el cálculo cobre precio estándar en vez de la tarifa del profesional. `PORCENTAJE_SERVICIO_DEFAULT` no se toca — Dev 02 la mueve en SPEC-403.
- **`POST /api/padre/citas/[id]/reasignar`** (SPEC-395, sin cambio): se consume desde el panel para el momento 7.

### Service

- **`cita.service.ts · CrearCitaInput`**: nuevo campo opcional `montoConsultaOverride?: number`. En el cálculo de montos: `montoConsulta = input.montoConsultaOverride ?? pro.tarifaConsultaCOP`. Sin cambios al flujo de reasignación (hereda pago via mecanismo existente).

### Pantallas

- **`ExpedienteVivo.tsx`** (M1): sección de CTAs al lado del header — «Llamar a la línea 141» + «Recibir apoyo» (→ `/dashboard/padre/profesionales?expedienteId=X`).
- **Cadena de propagación** `?expedienteId=X` y `?heredarDe=Y` de la puerta de entrada hasta el panel de reserva:
  - `/dashboard/padre/profesionales` (`PresentacionUrgenciaForm`)
  - `/dashboard/padre/profesionales/directorio` (`DirectorioProfesionales`)
  - `/dashboard/padre/profesionales/[id]` (`ProfesionalPerfil`)
  - `SolicitarCitaPanel`
- **`ProfesionalPerfil.tsx`**: costo por delante = precio estándar de la primera cita; tarifa del profesional en línea aparte («desde la 2ª cita»). Botón provisional reemplazado por `<SolicitarCitaPanel />`.
- **`SolicitarCitaPanel.tsx`** (nuevo): franjas, presentación, urgencia, modal de confirmación con checkbox «compartir expediente» (sólo si `expedienteIdSugerido`). POST a `/api/padre/citas` en flujo normal · POST a `/api/padre/citas/[id]/reasignar` cuando viene con `heredarDeSolicitudId` (M7: no exige presentación nueva, no cobra, mensaje explícito de «pago heredado»).
- **`/dashboard/padre/citas/[id]/page.tsx`** (nuevo · M6-M7): RSC que verifica rol + carga la cita; renderiza `<EsperaCitaPanel />`.
- **`EsperaCitaPanel.tsx`** (nuevo): estado legible + reloj de 48 h cuando `PAGADA_PENDIENTE`; refresco automático al foco de la pestaña; botón «Elegir otro profesional» cuando `VENCIDA_SIN_RESPUESTA` o `NO_ASISTIO_PROFESIONAL` (arma `?heredarDe=<id>`).

## Candados

- **Contacto NUNCA antes de la cita confirmada**: la pantalla de espera imprime `cita.contactoProfesional` sólo si el DTO lo trae; el DTO lo trae sólo si `debeExponerContacto === true` (SPEC-388a). No se rodea.
- **Precio estándar vs. tarifa del profesional**: si no hay parámetro sembrado, `leerPrecioEstandarPrimeraCita()` explota con `AppError` (falla ruidoso) — el SSR de la página del profesional queda en 500 con mensaje claro en lugar de cobrar la tarifa del profesional por accidente.
- **Reasignación no cobra**: `SolicitarCitaPanel` cambia el endpoint (POST /reasignar) y el UI cuando `heredarDeSolicitudId`; el service `reasignarPorPadre` es el candado real (SPEC-395 impone estado válido + herencia de pago).
- **`expedienteCompartidoId` sólo si el padre lo autoriza**: el checkbox arranca en `true` porque el padre entró desde el expediente, pero se puede desmarcar; y en reasignación no se envía nunca (el service usa la decisión de la solicitud original).
- **No toca SPEC-403**: el porcentaje de servicio queda hardcodeado en `route.ts` con comentario que aclara que Dev 02 lo migra.

## Verificación

- `tsc --noEmit`: verde.
- `arch:check`: **VERDE** en los 7 gates.
- `tokens:check`: piso 1079 intacto.
- `npm run lint`: 0 errors (73 warnings preexistentes).
- **Pruebas (13 casos, veredicto CEO 23:1x)**:
  - `precio-primera-cita.test.ts` (4): entero cuando sembrado; EXPLOTA sin parámetro; EXPLOTA con valor inválido (0/negativo/no numérico/vacío); redondeo de decimal positivo.
  - `cita.service.test.ts` (4): override cobra precio ESTÁNDAR; sin override cae a tarifa; reasignación HEREDA montos + `pagoHeredadoDeId` + arranca `pagoAprobadoEn`; rechaza reasignar al MISMO profesional (400).
  - `api/padre/citas/[id]/route.test.ts` (3): sin sesión → 401; otro padre → 404; el padre dueño → 200 y DTO CitaParaPadre con `contactoProfesional === undefined` (candado H-2).
  - `api/publico/profesionales/precio-primera-cita/route.test.ts` (2): sin sesión → 200 con el número; sin parámetro → 500 con AppError.
- **Endpoint público en el barrido arch:check**: `GUARDIAS_ACCESO.publicas` (`src/lib/routing/guardias.ts:54`) incluye `"/api/publico"` — matcheaRuta por segmento cubre `/api/publico/profesionales/precio-primera-cita`. La regeneración de `02-roles-capacidades.md` marca la fila ANONIMO → **permitir** (misma familia que I-289/I-297).

## Impacto en arquitectura:

- Nuevo parámetro sistema `profesional.cita.precio_estandar_primera_cita_cop` (INTEGER, categoría SYSTEM). Se agrega al mapa de parámetros conocidos indirectamente por seed.
- Nuevo endpoint público-vs-privado: `GET /api/publico/profesionales/precio-primera-cita` (sin sesión, lectura del parámetro; usable para embeds futuros).
- Nuevo endpoint privado: `GET /api/padre/citas/[id]` (rol PARENT). Cierra el DTO H-2 al frontend con la garantía existente.
- El `SolicitarCitaPanel` es la superficie única de reserva del padre — cambia el flujo cuando viene el query `heredarDe`, sin duplicar componentes.
- Cadena de propagación de query params (`expedienteId`, `heredarDe`) documentada en cada page.tsx / componente que participa.

## Fuera de alcance

- Tests unitarios del panel/hook de countdown y de integración del nuevo GET — en tasks.md.
- Job de vencimiento a las 48 h (hoy existe en SPEC-395/301 — la pantalla anticipa el estado leyendo `venceEn` del DTO).
- Botón de reprogramar por el padre sin cambiar profesional (SPEC-395 tiene `/reprogramar`, superficie UI queda para otro spec).
- Detección real de pago aprobado (SPEC-395 sigue con el flujo de admin manual).
- Cambio de la comisión 10% → parametrizable (SPEC-403, Dev 02).
- Sacar el motor del monolito PI (fuera de alcance total).

## Referencias

- **Brief A-75 v2.1 §9** — 7 momentos del padre.
- **SPEC-395** — motor de citas (services, endpoints, reasignar, reprogramar).
- **SPEC-392** — directorio L3 (baraja aleatoria, filtros, PerfilPublicoDTO H-2).
- **SPEC-388a** — DTO `debeExponerContacto` (candado H-2).
- **SPEC-296/201** — motor de notificaciones asíncrono (contexto para futuros mensajes de estado).
- Worktree `.worktrees/pi-SPEC-428` desde `origin/main f57eb7033`.
