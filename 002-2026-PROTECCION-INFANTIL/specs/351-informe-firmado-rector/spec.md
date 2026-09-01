# Feature Specification: SPEC-351 · El informe firmado del rector (A-69 · C5)

**Feature Branch**: `work/pi-SPEC-351-informe-firmado-rector`

**Created**: 2026-09-01

**Status**: DESARROLLO

**Impacto en arquitectura:** aditivo · nuevo modelo `InformeCaso` (correlativo INF-AAAA-NNNN, historial inmutable) + nueva columna `Colegio.escudoAssetKey String?` para el escudo institucional cargado en Configuración + endpoint `POST /api/colegio/casos/[id]/informes` (genera y persiste el PDF) + endpoint `GET /api/colegio/casos/[id]/informes` (historial) + reuso de la ruta pública `/verificar/[codigo]` (SPEC-346) para el código impreso al pie del PDF. Sin cambios en `SeguimientoCaso`, `NotaSeguimiento`, `SolicitudComite`, `InformePadre` ni `InformeConsolidado`. Depende de SPEC-350 (C3) — el informe se genera desde el caso.

**Input**: Brief A-69 §C5 + D1 · "Escudo del colegio configurable" + reuso del sello SPEC-234/341.

**Voz**: el colegio habla de **usted**; el rector firma el documento con nombre y documento. Voz USTED en todos los textos NUEVOS.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El rector genera un informe firmado del caso (Priority: P1)

Desde el detalle del caso (SPEC-350), el rector aprieta **Generar informe**.
El sistema muestra un panel de **selección de secciones**:
- Hechos del caso · marcado por defecto ✓
- Actuación del colegio (bitácora `NotaSeguimiento`) · ✓
- Análisis del comité (si existió, viene de C4) · ✓
- Contexto del curso · ○ (desmarcado)

El rector confirma. Se genera un **PDF membreteado con el escudo del
colegio** (cargado en Configuración), el nombre del colegio, el NIT, la
fecha del informe, el correlativo `INF-AAAA-NNNN`, las secciones
elegidas, la firma del rector (nombre + documento) y al pie el
**código de verificación pública** (16 hex) con la URL
`/verificar/<codigo>`. El PDF se descarga y se registra en el
historial.

**Why this priority**: es el entregable físico del brief. Sin él, el
comité y el rector no tienen forma de compartir el caso con una
autoridad o con la familia sin exportar a mano.

**Independent Test**: escalar un caso, agregar 2 notas de bitácora,
abrir el detalle, pulsar Generar informe con las 3 secciones marcadas,
descargar el PDF, abrirlo y verificar (a) escudo + nombre + NIT +
correlativo en el header, (b) secciones presentes, (c) firma del
rector, (d) código impreso al pie, (e) fila en el historial.

**Acceptance Scenarios**:

1. **Given** un caso con al menos 1 reporte y el escudo del colegio
   cargado, **When** el rector pulsa Generar informe con las secciones
   por defecto, **Then** el PDF descargado incluye escudo + nombre +
   NIT + correlativo (formato `INF-<año>-<NNNN>` cero-padeado) +
   fecha de generación en TZ Bogota + firma con nombre y documento del
   rector + código de verificación al pie.
2. **Given** un caso con `SolicitudComite` que tiene análisis del
   comité, **When** el rector marca "Análisis del comité" y genera,
   **Then** el PDF incluye la sección con el texto persistente del
   comité y quién lo firmó.
3. **Given** un caso sin escudo cargado, **When** el rector genera,
   **Then** el PDF sale con un membrete neutro y un aviso en la
   descarga: *"Cargue el escudo del colegio en Configuración para
   membretar sus informes."*

---

### User Story 2 — Historial inmutable de informes generados (Priority: P1)

En el detalle del caso hay una sección **"Informes generados"** que
lista todos los informes del caso en orden cronológico, con: número
correlativo, fecha de generación (TZ Bogota), quién lo firmó y un botón
para descargar el PDF por hash (mismo caché servidor-side · sin
regenerar). Ningún informe se puede editar ni borrar (regla A-68 · D6);
si el rector se equivoca, genera uno nuevo — nada se borra.

**Why this priority**: la evidencia forense exige historial permanente.
Sin él, el colegio pierde la trazabilidad de qué compartió con quién.

**Independent Test**: generar 3 informes de un caso, verificar que la
sección lista los 3 con correlativos consecutivos y que el intento de
`PATCH`/`DELETE` sobre cualquier ruta devuelve 404 (no existe la vía).

**Acceptance Scenarios**:

1. **Given** un caso con 2 informes generados, **When** el rector
   entra al detalle, **Then** ve la lista con 2 filas en orden
   descendente y los correlativos `INF-2026-0001` y `INF-2026-0002`.
2. **Given** un informe generado, **When** el rector pulsa Descargar,
   **Then** el sistema devuelve el PDF con el mismo hash y sin gastar
   tiempo de generación (caché).
3. **Given** un intento de `PATCH /api/colegio/casos/[id]/informes/<n>`,
   **Then** el sistema responde 404 (no existe el endpoint) y el test
   de inmutabilidad lo blinda (mismo estilo que
   `informes-padre.test.ts` de A-68).

---

### User Story 3 — Verificación pública del informe firmado (Priority: P2)

Una autoridad recibe el PDF impreso. Copia el código del pie y va a
`https://pi.innovadataco.com/verificar/<codigo>` (ruta SPEC-346, ya
pública). La página confirma que ese informe existe, quién lo firmó y
cuándo se generó — sin exponer contenido.

**Why this priority**: cierra el ciclo del sello. Sin verificación
pública, el PDF es un papel más — el brief lo pide explícitamente
reusando el mecanismo de SPEC-234/341.

**Independent Test**: generar un informe, copiar el código, abrir la
URL en incógnito, ver "Informe verificado" con la fecha y la firma
del rector.

**Acceptance Scenarios**:

1. **Given** un `InformeCaso` con `codigoVerificacion` conocido,
   **When** se llama `GET /api/publico/verificar-pdf/<hash>` con el
   hash del PDF, **Then** responde 200 con `casoId`, `numeroCorrelativo`,
   `pdfGeneradoEn` y `firmadoPorNombre` (sin PII del sujeto).
2. **Given** una URL con `<codigo>` válido, **When** se abre en
   incógnito, **Then** la página `/verificar/<codigo>` muestra
   "Informe verificado" con fecha y firma; con código falso →
   "Código no encontrado".

---

### Edge Cases

- **Rector genera informes en ráfaga (mismo caso, mismo minuto)**: el
  correlativo se calcula con `pg_advisory_xact_lock(hashtext("informe-caso:"+casoId))`
  (mismo patrón I-208 de `informes-padre`) para evitar la carrera del
  `MAX+1`. Test dedicado con 8 concurrentes → `INF-...-0001..INF-...-0008`.
- **Año cambia entre dos informes del mismo caso**: el correlativo
  reinicia el `NNNN` en cada año (`INF-2026-0042`, `INF-2027-0001`).
  Sembrar con SEED que fija el año actual con TZ Bogota.
- **Escudo pesa demasiado / formato malo**: en Configuración se valida
  ≤ 500 KB y formatos SOLO PNG/JPG (SVG prohibido: puede cargar scripts
  y se incrusta en el PDF y en Configuración — el colegio convierte su
  logo y ya, decisión CEO 01-09); si falla, el rector ve el error y
  no rompe la generación de informes.
- **Análisis del comité NO existe** (C4 aún no cerrado o el rector no
  lo pidió): la sección aparece deshabilitada en el panel de selección.

---

## Requirements *(mandatory)*

### Funcionales

**Generación del PDF**

- **FR-001**: El rector DEBE poder generar un informe del caso desde
  el detalle (SPEC-350) con selección de secciones (hechos, actuación,
  análisis del comité, contexto del curso).
- **FR-002**: El PDF DEBE ser membreteado con el escudo del colegio
  (cargado en Configuración), nombre y NIT. Sin escudo cargado, sale
  con membrete neutro + aviso al rector.
- **FR-003**: El PDF DEBE incluir el correlativo `INF-AAAA-NNNN`
  (año en TZ Bogota, NNNN por caso, cero-padeado a 4).
- **FR-004**: El PDF DEBE cerrar con firma del rector (nombre completo
  + documento) y con el **código de verificación pública** (16 hex,
  reutilizando el mecanismo de SPEC-234/341: el código se decide ANTES
  del render, viaja impreso al pie, el hash del BUFFER FINAL se
  registra — jamás entra al PDF).
- **FR-004-bis · BLINDAJE DEL CONTENIDO (candado CEO 01-09)**: el PDF
  del rector JAMÁS incluye texto crudo de reportes comunitarios ni la
  identidad del denunciante (nombre, email, usuario). La sección
  "Hechos" lleva SOLO fecha/lugar/clasificación por hecho; "Actuación"
  lleva la bitácora del colegio (`NotaSeguimiento`, que es texto propio
  del colegio); "Análisis del comité" lleva el texto del comité (autor
  interno). Test con grep exacto sobre el texto extraíble del PDF: cero
  ocurrencias del texto del reporte y del email/nombre del denunciante
  sembrados en el caso demo.

**Historial inmutable**

- **FR-005**: Cada generación DEBE persistir `InformeCaso` con:
  `id`, `casoId`, `numeroCorrelativo`, `anio`, `pdfHash` (@unique),
  `codigoVerificacion` (@unique), `firmadoPorNombre`, `firmadoPorDocumento`,
  `firmadoPorId`, `escudoAssetKey`, `seccionesJson`, `generadoEn`.
- **FR-006**: NO existe endpoint de update ni delete de `InformeCaso`.
  Un test blindar la ausencia (mismo estilo que `informes-padre.test.ts`).
- **FR-007**: El correlativo por caso se serializa con
  `pg_advisory_xact_lock(hashtext("informe-caso:"+casoId))` para que
  dos generaciones simultáneas nunca choquen (regla I-208).

**Escudo configurable**

- **FR-008**: Nueva columna `Colegio.escudoAssetKey String?` — clave
  del asset en el almacenamiento (mismo patrón que otros uploads del
  producto). El upload se hace desde Configuración con validación
  ≤ 500 KB y formato SOLO PNG/JPG (SVG prohibido — scripts embebidos).

**Verificación pública**

- **FR-009**: `GET /api/publico/verificar-pdf/<hash>` DEBE resolver
  también `InformeCaso.pdfHash` (además de `InformePadre` y
  `InformeConsolidado` que ya resuelve). Sin cambio de contrato — solo
  agrega el nuevo dueño.
- **FR-010**: La página pública `/verificar/[codigo]` DEBE distinguir
  el tipo (Informe del padre vs Informe del colegio) y mostrar solo
  metadata segura: fecha, correlativo (colegio), nombre del firmante,
  sin PII del sujeto.

**Endpoints**

- **FR-011**: `POST /api/colegio/casos/[id]/informes` con body
  `{ secciones: string[] }` genera el PDF, lo registra en historial
  y devuelve `{ id, numeroCorrelativo, pdfHash, downloadUrl }`.
  Boundary: `SCHOOL_ADMIN` del `colegioId` del caso — 403 para otros.
- **FR-012**: `GET /api/colegio/casos/[id]/informes` devuelve el
  historial paginado en orden descendente. Boundary igual.
- **FR-013**: `GET /api/colegio/casos/[id]/informes/[hash]/pdf`
  devuelve el PDF por hash (caché, no regenera).

### Key Entities

- **InformeCaso** (NUEVO):
  - `id String @id @default(cuid())`
  - `casoId String` (FK a `SeguimientoCaso.id`, `onDelete: Cascade`)
  - `numeroCorrelativo Int` (secuencial por `casoId` y por `anio`)
  - `anio Int` (año Bogota al momento de generar)
  - `pdfHash String @unique` (SHA-256 del buffer final)
  - `codigoVerificacion String @unique` (16 hex, decidido antes del render)
  - `firmadoPorNombre String`
  - `firmadoPorDocumento String`
  - `firmadoPorId String` (FK a Usuario)
  - `escudoAssetKey String?` (snapshot del escudo usado)
  - `seccionesJson Json` (qué secciones fueron incluidas)
  - `generadoEn DateTime @default(now()) @db.Timestamptz(6)`
  - `@@unique([casoId, anio, numeroCorrelativo])`
  - `@@index([casoId, generadoEn(sort: Desc)])`
- **Colegio.escudoAssetKey** (NUEVA columna nullable).

---

## Success Criteria *(mandatory)*

- **SC-001**: El rector puede generar un informe firmado del caso en
  menos de 3 segundos con secciones por defecto (medido en local con
  10 hechos + 5 notas de bitácora).
- **SC-002**: 8 generaciones concurrentes del mismo caso producen
  correlativos `INF-<año>-0001..INF-<año>-0008` sin duplicados
  (test de la carrera I-208).
- **SC-003**: Ningún endpoint permite modificar ni borrar un
  `InformeCaso`: `PATCH/DELETE` devuelven 404 en toda ruta (test de
  inmutabilidad).
- **SC-004**: La página pública `/verificar/<codigo>` responde correctamente
  para códigos de `InformeCaso` sin exponer PII del sujeto (solo
  metadata: fecha, correlativo, nombre del firmante).
- **SC-005**: El escudo cargado por el rector se refleja en el PDF
  siguiente sin redeploy (validación end-to-end desde Configuración).

---

## Assumptions

- SPEC-350 (C3) está en producción — el detalle del caso ya existe y
  puede montar el botón "Generar informe".
- SPEC-346 (verificador público) está en producción — la ruta
  `/verificar/[codigo]` y `/api/publico/verificar-pdf/<hash>` están
  vivas.
- El escudo se sube desde una pantalla de Configuración que YA existe
  (o se agrega en un ticket separado del path); este SPEC solo agrega
  la columna y su lectura.
- La firma del rector = `nombre + documento` que ya viven en `Usuario`
  (SPEC-334); si faltaran, el sistema muestra un aviso y no genera.

---

## Fuera de alcance (explícito)

- **Análisis del comité (creación del campo)**: es tarea de C4 · este
  SPEC solo lo INCLUYE en el PDF si existe.
- **Dossier multi-caso / multi-período** para Secretaría: futuro; el
  brief lo saca explícitamente.
- **Migración de `red-*` a tokens** en pantallas existentes: §8 del
  brief · frente aparte.
- **Firma digital certificada** (certificado electrónico): el brief
  usa "firma" en el sentido de nombre + documento + código verificable,
  no certificado digital.
