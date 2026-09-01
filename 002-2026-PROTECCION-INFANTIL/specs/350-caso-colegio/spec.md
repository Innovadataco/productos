# Feature Specification: SPEC-350 · El caso del colegio estilo expediente + análisis IA compartido (A-69 · C3)

**Feature Branch**: `work/pi-SPEC-350-caso-colegio`

**Created**: 2026-09-01

**Status**: DESARROLLO

**Impacto en arquitectura:** aditivo · el detalle del `SeguimientoCaso` estrena una vista tipo expediente que **reusa el componente de mapa/cronología del padre (SPEC-340)** y engancha el orquestador de análisis IA de SPEC-341 con `alcance=COLEGIO_BLINDADO`. Se agrega `seguimientoCasoId String?` a `AnalisisExpediente` (con `expedienteId` pasando a nullable en migración aditiva) y una nueva ruta `GET/POST /api/colegio/casos/[id]/analisis`. Sin cambios en `AlertaColegio`, `SeguimientoCaso`, `NotaSeguimiento` ni en el motor de eventos.

**Input**: Brief A-69 §C3 + D6 · "El caso hereda el diseño del expediente del padre".

**Voz**: el colegio habla de **usted** (formal Colombia). Cero voseo. Cero tuteo.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El rector abre un caso y ve el mapa + cronología + análisis (Priority: P1)

Un rector entra al detalle de un caso escalado (`SeguimientoCaso`) y ve:
- **Mapa** con los hechos ubicados en el tiempo (mismo componente que el
  padre ve en su expediente).
- **Cronología reproducible** con "Reproducir la historia" (mismo control).
- **Capa 1 · Lo que muestra este caso** con cifras calculadas en vivo
  (dominantes por franja horaria/ciudad/categoría, cantidad de reportes,
  fecha del más reciente), SIEMPRE visible aunque la capa 2 aún no exista.
- **Capa 2 · Análisis detallado (IA)** con sello del corte, guía "Qué
  puede hacer ahora" y botón **Actualizar análisis** con cool-down —
  todo idéntico al del padre pero con **voz USTED**.

**Why this priority**: es la pantalla central del brief. Sin ella el
comité y el rector siguen mirando la bandeja plana de alertas.

**Independent Test**: escalar un reporte a caso, abrir el detalle desde
la bandeja del colegio, verificar que aparecen las 4 secciones (header +
mapa + capa 1 + análisis con banner "estamos generando"), esperar la
publicación del análisis y confirmar el sello.

**Acceptance Scenarios**:

1. **Given** un caso con al menos 1 reporte enlazado, **When** el rector
   abre el detalle, **Then** el mapa muestra los hechos con marcador
   temporal y la capa 1 lista dominante de ciudad/franja/categoría.
2. **Given** un caso sin análisis previo y con hechos, **When** el rector
   abre el detalle, **Then** el sistema encola UN job de análisis con
   `alcance=COLEGIO_BLINDADO` y muestra el banner honesto de espera con
   la cola real.
3. **Given** un análisis publicado del caso, **When** el rector reabre
   sin cambios en la cadena, **Then** aparece al instante sin gastar
   modelo (misma economía que el padre).

---

### User Story 2 — El análisis del colegio ve SOLO datos anonimizados (Priority: P1)

El análisis del caso NUNCA recibe texto crudo del reporte, ni nombre,
identificador, edad o sexo por hecho individual. Solo agregados
(categoría dominante, franja horaria, curso, plataforma). Es el candado
de PII del brief (§4 · "Del reporte ajeno: solo fecha, país, ciudad y
clasificación") aplicado al motor de IA.

**Why this priority**: sin este candado, el colegio ve datos del
comunitario que la Ley 1581 no le autoriza y rompe el corazón del
producto ("no medimos riesgo de personas").

**Independent Test**: correr el orquestador sobre un caso demo con 5
identificadores + textos + nombres, verificar por grep exacto que
ninguno aparece en el payload al modelo (mismo test que el padre pero
con datos del colegio).

**Acceptance Scenarios**:

1. **Given** un caso demo con reportes que traen texto/identificadores,
   **When** el orquestador arma el payload con `COLEGIO_BLINDADO`,
   **Then** el JSON serializado al modelo NO contiene ningún valor de
   identificador, texto de reporte, nombre, email, edad ni sexo (grep
   exacto = 0 hits · SC-002/006 del análisis).

---

### User Story 3 — Actualizar análisis del caso (misma economía del padre) (Priority: P2)

El rector puede pedir a mano "Actualizar análisis" con cool-down
parametrizado. Si la cadena no cambió → responde honestamente "ya está
al día"; si cambió → encola nuevo. Tras N FALLIDOs consecutivos del mismo
hash → tarjeta ámbar "no pudimos generarlo, vuelva más tarde" (misma
regla que SPEC-348).

**Why this priority**: sin escape manual, si el motor falla el rector
queda mirando el "estamos generando" en bucle.

**Independent Test**: forzar 3 FALLIDOs con misma cadena, ver la
tarjeta ámbar; pulsar Actualizar y ver que se encola un nuevo intento
(el POST del caso es también su vía de escape).

**Acceptance Scenarios**:

1. **Given** cool-down cumplido y hash igual, **When** el rector pulsa
   Actualizar, **Then** el sistema responde "el análisis ya está al día"
   sin gastar modelo.
2. **Given** cool-down cumplido y hash distinto, **When** el rector
   pulsa Actualizar, **Then** el sistema encola un job nuevo con
   `alcance=COLEGIO_BLINDADO`.

---

### Edge Cases

- **Caso sin reportes/hechos analizables** (poco común, pero posible al
  crear el caso a mano): la capa 1 y el análisis muestran "este caso
  aún no tiene eventos analizables"; el análisis NO se encola.
- **Caso cerrado** (`SeguimientoCaso.estado="cerrado"`): la pantalla se
  ve igual pero el botón Actualizar queda deshabilitado (ya no hay
  actividad que justifique gastar modelo); el análisis vigente se sigue
  mostrando para consulta.
- **La cola del análisis ya llena** (`padre.analisis.tope_fila`): el
  colegio ve el mensaje "la cola está llena — vuelva a intentar en unos
  minutos" en voz USTED. Comparte cola con el padre (candado brief).
- **Cambio de nombre del identificador** (raro): el `hashCadena` NO
  depende del identificador — mismo comportamiento que el padre.

---

## Requirements *(mandatory)*

### Funcionales

**Vista del caso**

- **FR-001**: El detalle del caso DEBE reusar el componente de mapa y
  cronología del padre (`ExpedienteVivo`/`MapaUbicaciones`), sin
  duplicar código de layout — el brief lo pide como "orden expresa de
  Jelkin".
- **FR-002**: La capa 1 DEBE calcular en vivo dominantes de ciudad,
  franja horaria y categoría a partir de los hechos del caso, con la
  misma etiqueta "En vivo" que el padre.
- **FR-003**: La capa 2 (análisis IA) DEBE colgar bajo el mapa, con la
  MISMA estructura visual que el padre pero con voz USTED en textos.

**Análisis IA reutilizado**

- **FR-004**: El caso DEBE encolar en la MISMA cola pg-boss
  `padre.analisis.expediente` (candado brief · cola compartida).
- **FR-005**: El orquestador DEBE recibir `alcance=COLEGIO_BLINDADO`;
  el armador no puede incluir texto de reporte, identificador, nombre,
  email, edad ni sexo por hecho individual (candado PII).
- **FR-006**: El worker (SPEC-341) DEBE aceptar jobs de caso sin ramas
  nuevas — solo el `alcance` diferencia la persistencia.
- **FR-007**: La prioridad del análisis DEBE seguir siendo estrictamente
  menor que la de clasificación de reportes (SC-008 de SPEC-341).

**Persistencia y estado**

- **FR-008**: Cada análisis del caso DEBE persistirse con `alcance` y
  con un identificador del dueño del análisis (`seguimientoCasoId`).
  Migración aditiva; `expedienteId` pasa a nullable con constraint
  aplicación XOR (uno de los dos IDs debe estar).
- **FR-009**: El análisis vigente del caso DEBE ser inmutable (misma
  regla FR-016 del padre); nueva versión = nueva fila.
- **FR-010**: El estado terminal `FALLIDO` DEBE respetar el corte por
  agotamiento (SPEC-348) — tras N FALLIDOs consecutivos del mismo hash,
  la UI muestra la tarjeta ámbar y NO re-encola en aperturas automáticas.

**API**

- **FR-011**: Nueva ruta `GET/POST /api/colegio/casos/[id]/analisis`
  con la misma forma de respuesta que la del padre (vigente + hashActual
  + coincide + hechosNuevosDesde + estado + cola + colaLlena + cooldown +
  agotadoPorFallos + ultimoMotivoFallo).
- **FR-012**: Boundary de rol: sesión `SCHOOL_ADMIN` o `COMITE_CONVIVENCIA`
  del MISMO colegio del caso — 403 para otros roles, 404 para caso ajeno.
- **FR-013**: El GET DEBE encolar solo cuando el rector o el comité
  abren el detalle — mismo criterio "cero trabajo invisible" del padre.
- **FR-014**: El POST DEBE ser la vía de escape (SPEC-348): si el
  vigente es FALLIDO o no existe, el botón Actualizar ignora el
  agotamiento (solo cooldown lo modera).

**Voz**

- **FR-015**: Todos los textos NUEVOS del colegio DEBEN usar USTED
  formal ("usted puede…", "revise…"). El sello dice "Análisis al corte
  del <fecha> · incluye N hechos" (idéntico al padre, no cambia).
- **FR-016**: La etiqueta "análisis asistido" DEBE mostrarse igual que
  en el padre.
- **FR-017**: Los prompts sistema para colegio ya viven en
  `colegio.analisis.prompt_sistema` (sembrado por SPEC-341). Este SPEC
  NO cambia el contenido — el admin lo edita luego si quiere.

### Key Entities

- **SeguimientoCaso** (existe · reusado): dueño del caso. Se accede por
  su `id`; el rector del `colegioId` lo puede ver.
- **AlertaColegio** (existe · reusado): fuente del caso — trae el
  `tipoSujeto`, `identificador*Id`, `reporteId`.
- **AnalisisExpediente** (extendido · migración aditiva):
  - `expedienteId String?` (era NOT NULL) — nullable si el análisis es
    de un caso del colegio.
  - `seguimientoCasoId String?` (NUEVO) — nullable si el análisis es
    del padre.
  - Constraint XOR de aplicación: uno de los dos debe estar (no ambos
    ni ninguno).
- **Cola pg-boss** `padre.analisis.expediente` (existente · reusada
  con el mismo prioridad menor que la clasificación).

---

## Success Criteria *(mandatory)*

- **SC-001**: El 90% de las aperturas de un caso con análisis vigente y
  hash coincidente muestran el texto en menos de 1 segundo, sin gastar
  modelo.
- **SC-002**: 0% de los payloads al modelo (caso, `alcance=COLEGIO_BLINDADO`)
  contienen texto crudo o valores de identificador — verificable con
  grep exacto sobre el payload registrado.
- **SC-003**: El rector puede completar el recorrido *"abro caso → veo
  mapa + capa 1 → espero análisis → leo → aprieto Actualizar"* sin
  documentación externa (usabilidad esperada porque reusa el diseño ya
  aprobado del padre).
- **SC-004**: Cuando la cola tiene análisis del padre delante, el
  colegio ve el mensaje correcto de espera con el estimado real y NO
  re-encola en cada apertura.
- **SC-005**: El módulo del padre (SPEC-341) NO se rompe con este SPEC —
  la constraint XOR + tests de regresión garantizan que un análisis con
  `expedienteId` sigue funcionando exactamente igual.

---

## Assumptions

- SPEC-341 (motor IA) + SPEC-348 (escape) + SPEC-349 (fecha Bogota) ya
  están en producción cuando se implementa este SPEC.
- La bandeja de alertas del colegio (`AlertasColegioPageClient`) ya
  permite navegar a un `SeguimientoCaso`; este SPEC solo agrega la
  pantalla de detalle del caso, no reescribe la bandeja.
- El diseño de la limpieza `red-* → ambar/rubi` del §8 del brief es
  frente aparte — este SPEC solo se preocupa por NO introducir tokens
  crudos nuevos.

---

## Fuera de alcance (explícito)

- **Comité asesor y análisis del comité** (C4 del brief) — tienen SPEC
  propia; este SPEC no crea el campo de análisis del comité.
- **PDF del informe firmado** (C5) — tiene SPEC propia (351).
- **Migración de `emerald-*` / `red-*` a tokens** en pantallas
  existentes del colegio — §8 limpieza del brief; frente aparte.
- **Cambio del contenido de los prompts del análisis** — solo si el
  admin lo hace desde el panel de parámetros existente.
- **Notificación proactiva "análisis listo"** al rector — el rector lo
  ve al reabrir el caso; misma economía que el padre.
