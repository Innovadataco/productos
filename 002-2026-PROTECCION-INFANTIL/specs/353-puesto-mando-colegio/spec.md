# SPEC-353 · El puesto de mando del rector (A-69 · Fase C6)

**Feature Branch**: `work/pi-SPEC-353-puesto-mando-colegio`

**Created**: 01-09-2026

**Status**: IMPLEMENTADO

**Radicado**: A-69 · Brief del CEO 01-09-2026 v1.0 · mockup aprobado v3 (momento 2) · orden CEO 02:28 ("si terminás C1, seguí con C6")

**Impacto en arquitectura:** menor.
1. El DTO `homeRector` gana 4 campos derivados (casos en comité, última alerta
   sin abrir, identificador cruzado, hora pico) — solo lectura, cero migraciones.
2. UN agregado SQL nuevo (identificador que toca a más de un estudiante).
3. La pantalla de Configuración del colegio se rediseña in-place (misma ruta,
   mismo módulo de permisos, cero cambios de navegación).
Regenerar `docs/architecture/` solo si `arch:check` lo pide (no cambia schema,
proxy ni navegación).

---

## Contexto (mockup A-69 v3 · momento 2 + brief C6, verificado en fuente)

El inicio del rector ya tiene los números (semáforo, embudo, tendencias,
anillos de cobertura, cursos que merecen mirada — SPEC-143/167): lo que falta
es que **abra con una frase que diga qué hacer hoy**, no con una tabla. El
mockup 2.1 lo pinta: caja ámbar "Dos cosas necesitan su atención hoy" +
párrafo concreto ("Una cuenta desconocida escribió a dos estudiantes de 7-B
esta semana. Es el mismo usuario en los dos casos.") + botón "Ver ahora".

Y las preferencias de aviso del rector ya existen por debajo
(`PreferenciaAlertaColegio`, 4 tipos con umbral/ventana, GET/PATCH en
`/api/colegio/preferencias-avisos`) pero la pantalla actual
(`ConfiguracionPageClient`) es técnica: títulos crudos, botones
Activado/Desactivado, campos numéricos sueltos y un "Guardar" por tarjeta.
El brief C6 ordena darle **la experiencia del padre** (diseño A-62,
`PreferenciasNotificaciones.tsx`): frases completas, switches, guardado
inmediato, cabecera con el correo de destino.

Precedente exacto en fuente para la frase accionable: el padre ya tiene
`calcularSugerenciaHome` (`src/lib/padre/home-sugerencia.ts:22-69`) — reglas
puras sin IA que devuelven `{texto, accionHref, accionTexto, prioridad}` — y
la tarjeta `SugerenciaProactivaCard`. C6 construye el ESPEJO para el rector.

Lo que existe y se reusa (verificado): `homeRector` DTO con semáforo/embudo/
tendencias/cursosMirada (`colegio-resumen.ts:92-121`), `reloj24h`
(`alerta-colegio.ts:371-400`), `contarPorTipoSujeto` (`:181-202`),
estadísticas del comité (`comite-convivencia-solicitudes.ts:130-149`),
`Switch` (`src/components/ui/Switch.tsx`), y el patrón completo de la
pantalla del padre con su API PATCH de guardado inmediato.

Lo que falta (verificado, no supuesto):
1. Ningún cálculo de "mismo identificador tocando a VARIOS estudiantes"
   (existe el inverso: N reportes sobre 1 estudiante). Se agrega un groupBy.
2. `casosComiteAbiertos` y `ultimaAlertaSinAbrir` no están en `homeRector`.
3. Ninguna frase accionable en la home del rector.
4. La pantalla de preferencias no tiene la experiencia A-62.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El inicio me dice qué hacer hoy (Priority: P1)

El rector abre su panel y lo primero que ve —arriba del embudo— es una frase
accionable en una tarjeta ámbar: cuántas cosas necesitan su atención y cuál
es la más urgente, dicho en lenguaje humano, con un botón que lo lleva
directo a atenderla. Si no hay nada pendiente, la tarjeta lo dice en positivo
y no grita.

**Why this priority**: es el corazón de C6 ("los números ya están; falta que
hablen"). Mockup 2.1.

**Independent Test**: sembrar estados distintos (alertas nuevas, caso en
comité, identificador cruzado, nada pendiente) y verificar la frase y el
destino del botón en cada uno.

**Acceptance Scenarios**:

1. **Given** un colegio con 2 alertas sin abrir, **When** el rector abre su
   panel, **Then** ve una tarjeta ámbar con una frase que nombra la cantidad
   ("Dos avisos esperan su atención") y un botón que lo lleva a la bandeja
   de alertas.
2. **Given** que además el mismo identificador aparece en alertas de DOS o
   más estudiantes en los últimos 7 días, **When** abre el panel, **Then**
   la frase lo prioriza y lo dice en concreto ("Una misma cuenta aparece en
   los casos de N estudiantes esta semana") — es la señal más grave del
   dominio (posible depredador contactando a varios menores).
3. **Given** un caso escalado al comité sin resolver, **When** abre el
   panel, **Then** la frase lo menciona con su antigüedad ("El comité tiene
   un caso desde hace N días").
4. **Given** cero pendientes, **When** abre el panel, **Then** ve la
   tarjeta en tono calmado ("Todo al día. La última señal llegó el …") sin
   color de alerta.
5. **Given** cualquier estado, **Then** la tarjeta usa ámbar como ÚNICO
   color de alarma (cero rojo), voz de usted, cero jerga técnica.

---

### User Story 2 — Mis avisos se configuran como los del padre (Priority: P1)

El rector entra a Configuración y encuentra sus avisos escritos como frases
("Cuando alguien reporte una cuenta de su comunidad…"), cada una con un
interruptor que guarda al instante. El correo de destino se ve arriba
("Le escribimos a rectoria@… — cambiar"). Los umbrales se leen como frases
("Avisar a partir de 3 reportes en 7 días") y se editan sin botón de guardar.

**Why this priority**: la mitad B de C6. Los eventos existen; falta la
pantalla con el diseño A-62.

**Independent Test**: alternar un switch y verificar el PATCH inmediato +
recarga muestra el estado persistido; editar umbral y verificar persistencia.

**Acceptance Scenarios**:

1. **Given** la pantalla de Configuración, **When** el rector la abre,
   **Then** ve los 4 avisos como frases humanas con interruptores, no
   títulos técnicos con botones Activado/Desactivado.
2. **Given** un interruptor, **When** lo apaga, **Then** el cambio se guarda
   al instante (sin botón "Guardar"), con indicador de progreso en esa fila,
   y sobrevive a la recarga.
3. **Given** un aviso con umbral (curso o estudiante repetido), **When** el
   rector edita el número, **Then** la frase se lee natural ("Avisar a
   partir de N reportes en M días") y el cambio persiste al salir del campo.
4. **Given** la cabecera, **Then** muestra el correo de destino efectivo y
   permite cambiarlo en línea (campo emailDestino existente; vacío = correo
   del rector).
5. **Given** el contrato actual del backend, **Then** GET/PATCH de
   `/api/colegio/preferencias-avisos` NO cambian de forma — solo la pantalla.

---

### Edge Cases

- Colegio recién creado (sin alertas, sin estudiantes): frase calmada de
  bienvenida al trabajo del día; jamás una tarjeta vacía o rota.
- `ultimaSenal` nula (nunca hubo alertas): la frase calmada omite la fecha.
- Empate de prioridades (alertas nuevas + comité + cruzado): gana el
  identificador cruzado > alertas sin abrir > comité — el orden refleja
  gravedad para menores, y solo se muestra UNA frase (con el conteo total
  de pendientes si hay más de uno: "Dos cosas necesitan su atención hoy").
- PATCH de preferencia falla: el switch vuelve a su estado anterior y se
  muestra el error en la fila (patrón del padre).
- El agregado del identificador cruzado NUNCA expone el valor del
  identificador en la frase (solo conteos) — presunción de inocencia y
  cero PII en la home.

## Requirements *(mandatory)*

### Functional Requirements

**Frase accionable ("qué hacer hoy")**

- **FR-001**: El DTO de la home del rector DEBE ganar: `casosComiteAbiertos`
  (con la antigüedad del más viejo), `ultimaAlertaSinAbrirEn`, e
  `identificadorCruzado` (conteo de estudiantes distintos tocados por un
  mismo identificador en alertas visibles de los últimos 7 días, con el
  máximo de estudiantes por identificador). Deriva de datos existentes; cero
  columnas nuevas.
- **FR-002**: Un módulo puro `calcularQueHacerHoy(datos)` DEBE producir
  `{titulo, detalle, accionHref, accionTexto, tono: "ambar"|"calma"}`
  con la prioridad: identificador cruzado > alertas sin abrir > caso en
  comité > calma. Espejo de `calcularSugerenciaHome` del padre; funciones
  puras con test unitario por regla.
- **FR-003**: La tarjeta DEBE renderizarse arriba del embudo en la home del
  rector (mockup 2.1), en ámbar SOLO cuando hay pendientes, con voz de usted
  y cero jerga; si hay más de un pendiente el título dice el conteo ("Dos
  cosas necesitan su atención hoy").
- **FR-004**: El agregado del identificador cruzado DEBE contar por
  identificador de estudiante (`groupBy` con `COUNT(DISTINCT alumnoId) > 1`
  sobre alertas visibles en ventana de 7 días) y NUNCA exponer el valor del
  identificador en la respuesta de la home.

**Preferencias con la experiencia A-62**

- **FR-005**: La pantalla de Configuración del colegio DEBE presentar los 4
  avisos como frases humanas con `Switch` (componente existente) y guardado
  INMEDIATO por fila (PATCH al soltar), con indicador de progreso y
  reversión visual si falla — patrón exacto de
  `PreferenciasNotificaciones.tsx` del padre.
- **FR-006**: Los umbrales DEBEN leerse como frase ("Avisar a partir de
  [N] reportes en [M] días") con los campos embebidos; el cambio persiste
  al salir del campo (blur), sin botón "Guardar".
- **FR-007**: La cabecera DEBE mostrar el correo de destino efectivo
  ("Le escribimos a **{correo}**") con edición en línea del override
  (`emailDestino`; vacío = correo del rector).
- **FR-008**: El contrato del backend (`GET`/`PATCH
  /api/colegio/preferencias-avisos`) NO DEBE cambiar; el rediseño es solo
  de pantalla.
- **FR-009**: Voz de usted formal Colombia en todos los textos; ámbar único
  color de alerta; cero rojo (brief §0).

### Key Entities

- **Frase del día (derivada)**: resultado puro de `calcularQueHacerHoy`; no
  se persiste.
- **Identificador cruzado (agregado)**: conteo derivado de `AlertaColegio` ×
  `IdentificadorAlumno`; no expone valores, solo cantidades.
- **Preferencia de aviso (existente)**: `PreferenciaAlertaColegio` sin
  cambios de modelo.

## Success Criteria *(mandatory)*

- **SC-001**: En cada uno de los 4 estados (cruzado, alertas, comité, calma)
  la home muestra la frase correcta con su acción — verificado por tests del
  módulo puro y recorrido real.
- **SC-002**: Un cambio de switch persiste sin recargar y sobrevive a la
  recarga; un PATCH fallido revierte el switch.
- **SC-003**: Cero rojo y cero jerga técnica en la home y en preferencias.
- **SC-004**: El contrato GET/PATCH de preferencias no cambia (tests de
  integración existentes del endpoint pasan sin modificar).
- **SC-005**: La frase del identificador cruzado no contiene el valor de
  ningún identificador.

## Assumptions

- **A-1**: La tarjeta reemplaza visualmente el espacio del mockup 2.1 sin
  rehacer `HeroEstado` ni el resto de la home (se inserta entre Hero y
  Embudo).
- **A-2**: `reloj24h`/"a quién le pasa" del mockup 2.1 ya viven en la
  pantalla de estadísticas (SPEC-167); C6 NO los duplica en la home — el
  brief dice "reusar, no rehacer".
- **A-3**: La bandeja de alertas (mockup 2.2) "ya funciona" según el propio
  mockup; fuera de alcance.
- **A-4**: La pantalla rediseñada vive en la misma ruta
  `/dashboard/colegio/configuracion` (cero cambios de navegación/permisos).
- **A-5**: Migraciones: ninguna.
