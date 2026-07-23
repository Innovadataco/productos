# Feature Specification: Mantenimientos preventivos y correctivos (paridad legacy + modelo de reporte CEO)

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-07-22

**Status**: IMPLEMENTADO (005-A, 2026-07-23) — 005-B (pantalla + PDF programa) pendiente; modo stub, pendiente verificación humana antes de APIs productivas

**Input**: User description: "005-mantenimientos — Paridad con el módulo de mantenimientos del legacy, SOLO preventivos y correctivos (alistamientos=006, autorizaciones=007). Tablas legacy: tbl_mantenimientos, tbl_preventivos, tbl_correctivos, tbl_tipo_mantenimientos, tbl_archivo_programas, tbl_mantenimiento_jobs. Cola MantenimientoQueueService (tmj_estado, máx 3 reintentos, +5 min, lotes de 20, reintento manual resetea reintentos=0). XLSX 100% server-side con ExcelJS (bulk/preventivo/xlsx, bulk/correctivo/xlsx, plantillas descargables, validación por fila 'Fila N: ...', 400 con errores / 202 con {total,exitosos,errores}). Pantalla tabs Preventivos/Correctivos con registro individual + carga masiva + plantilla. Restricciones: migraciones aditivas esquema sicov con @map, modo stub doble gate, reusar cliente doble token + herencia rol 3 + worker único (pasada nueva, no worker nuevo), America/Bogota, tests nuevos y 52 existentes verdes." + gate D-022 completo (dos entregas de ZEUS, 2026-07-22).

> **Fuentes que prevalecen:** `HANDOFF-SICOV.md` **§9, §9.1, §10 y §11** (fe de erratas, BD de
> producción, manual de usuario y modelo de reporte del CEO) sobre §2-§6 y sobre supuestos previos.

---

## Contexto verificado contra el legacy (fuente de verdad)

Verificación línea a línea (2026-07-22) de `legacy-sistema-original/back_gestion_despachos` y
`frontend-gestion-despachos/features/mantenimientos`:

1. **Dos modos de sincronización coexisten.** El **registro individual** reporta a la Super de forma
   **síncrona**; la **carga masiva** es **diferida** por `tbl_mantenimiento_jobs` (`diferido: true`).
   El CEO generalizó este modelo a las 7 operaciones (`HANDOFF §11.1`): web = intento inmediato;
   archivo = colas. **D-021** añade además la caída a cola cuando el intento inmediato falla.
2. **Cabeceras del API externo de mantenimientos** (difieren de despachos — verificado en
   `RepositorioMantenimientoDB.ts`): todas las llamadas llevan `Authorization: Bearer <tokenExterno>` +
   `token: <tokenAutorizado>`; los POST de detalle (`guardar-preventivo`/`guardar-correctivo`) añaden
   la cabecera **`vigiladoId: <nit>`** (NO `documento` como en despachos); el POST base
   (`guardar-mantenimieto` [sic]) lleva el `vigiladoId` **en el payload**; las consultas
   (`listar-placas`, `listar-historial`) lo llevan como **query param**. Base URL:
   **`URL_MATENIMIENTOS`** [sic — typo heredado que se CONSERVA: ya está vivo en
   `.env.example:52` y `src/lib/integracion/cliente-http.ts:76`].
3. **Registro en dos pasos:** primero el **mantenimiento base** (`tbl_mantenimientos`; al crear tipo
   1/2 se **desactivan** — `tmt_estado=false` — los previos del mismo vigilado+placa+tipo), después el
   **detalle** (`tbl_preventivos`/`tbl_correctivos`) referenciando el id del base.
   `tmt_mantenimiento_id` guarda el **id EXTERNO** devuelto por la Super (columna separada del id
   local). ⚠️ **Bug del legacy a NO replicar** (`RepositorioMantenimientoDB.ts:1443`): en el detalle
   sobrescribe `*_mantenimiento_id` (enlace local) con el id externo, **perdiendo el enlace** — el
   003 usa **columnas separadas** (id local + id externo) también en el detalle.
4. **Cola:** lotes de **20** en orden por id, `pendiente → procesando → procesado | fallido`, máx
   reintentos con reprogramación **+5 min** (parametrizables por env — D-019b, default 3 y 5).
   **Dependencia base→detalle:** si el detalle corre antes de que el base tenga id externo →
   `MantenimientoPendienteError` → +5 min **sin consumir reintento**.
5. **Reintento manual** (`POST jobs-fallidos/:jobId/reintentar`): acciones `reprogramar` (default;
   **409** si `reintentos >= máx`), `actualizar` (**corrige el payload** y resetea `reintentos=0`) y
   `marcarProcesado`. Si el job es detalle y su base está `fallido`, opera **sobre el base**. El
   frontend legacy reintenta siempre con `accion: 'actualizar'` + payload. **Manual (§10.6, pág. 25):
   el reintento manual NO es solo reenviar — abre el registro para CORREGIR los campos con error y
   reenviar**, disparando un ciclo completo nuevo de intentos.
6. **Carga server-side:** campo `archivo`, ≤ 5 MB; valida columnas requeridas del encabezado (400 si
   faltan), campos vacíos y tipos por fila con mensajes **"Fila N: ..."**; normaliza fechas (serial
   Excel / `dd/MM/yyyy` / ISO → fecha) y horas (fracción / `h:mm a` → `HH:mm`). **Regla del manual
   (§10.10): TODO-O-NADA — un solo registro inválido hace fallar el lote completo (`Exitosos: 0`).**
7. **El módulo "mantenimientos" son DOS cosas por rol (§10.2):** el **CLIENTE (rol 2)** carga el
   **PDF del PROGRAMA** (máx 4 MB, solo PDF; **el último cargado queda ACTIVO** y desactiva los
   anteriores) y **NO registra mantenimientos individuales**; el **OPERADOR (rol 3)** registra los
   mantenimientos específicos (formulario) y la **carga masiva**, y ve el historial.
8. **A NO replicar (bugs/deuda del legacy):** `GET exportar-historial` sin autenticación; bearer de
   paramétricas hardcodeado (`ControladorMantenimiento.ts:1180`); `console.log` de datos sensibles;
   alcance de datos tomado del query string **sin validar rol** e interpolado en SQL
   (`ControladorDashboard.ts:24-26`, `ObtenerResumenDashboard.ts:33` — fuga de datos entre empresas,
   I-08); permisos por módulo solo como decorado de menú (`VerificarModulo` registrado en
   `start/kernel.ts:48` pero aplicado a CERO rutas, I-09).

---

## Decisiones del gate D-022 (ZEUS, 2026-07-22 — dos entregas)

### Primera entrega (4 puntos de aprobación)

1. **`exceljs` APROBADA.** Además, **CSV (D-019e) se suma como formato nuevo** de carga masiva — no
   reemplaza al XLSX; misma validación por fila.
2. **PDF en filesystem APROBADO CON CONDICIONES:** ruta por variable de entorno, **FUERA del
   directorio de la app**, detrás de una **interfaz de almacenamiento**
   (`guardarArchivo`/`leerArchivo`); respaldo de esa carpeta = requisito del switch-over.
3. **`hora` varchar(8) APROBADO como DESVIACIÓN documentada** (legacy: `table.time()`,
   `1741738351341_tbl_preventivos.ts:11`). **Condición:** validación `^([01]\d|2[0-3]):[0-5]\d$` en
   el borde.
4. **Variante JSON de `bulk/*` SE CORTA** (sin consumidores confirmados).
5. **Catálogo de tipos de identificación RESUELTO** (manual): 1 CC · 2 CE · 3 Pasaporte · 4 CC
   digital · 5 TI · 6 Registro civil · 7 PEP · 8 DIE · 9 NIT · 10 NN · 11 Carnet Diplomático ·
   12 PPT.

### Segunda entrega (resto del gate)

6. **BLOQUEANTE id externo:** a la Super viaja el **id EXTERNO**, pero id local e id externo van en
   **columnas separadas** (base Y detalle) — corrige el bug legacy de sobrescritura.
7. **BLOQUEANTE env:** se **conserva `URL_MATENIMIENTOS`** [sic] — introducir el nombre corregido
   rompería `requireEnv` en código vivo del 003.
8. **BLOQUEANTE alcance por rol (D-015):** "rol 1 ve todas las empresas" es **DESVIACIÓN DELIBERADA
   aprobada por el CEO** (no paridad). El alcance se impone **server-side**: roles 2 y 3 atados a su
   **NIT efectivo**, ignorando cualquier `nit` del cliente; rol 3 filtra por el NIT **heredado del
   administrador** (no por su documento); consultas SIEMPRE parametrizadas (nunca interpolación SQL).
9. **BLOQUEANTE roles del módulo (§10.2):** cliente = PDF del programa (no registra); operador =
   registros + carga masiva.
10. **D-021 (CEO, cerrada) dentro de 005-A:** envío inmediato con caída a cola para **las tres
    colas** (despachos, llegadas, mantenimientos) + reintentos/backoff **parametrizables por env**
    (D-019b) + reenvío manual como ciclo completo nuevo.
11. **D-017/D-018 dentro de 005-A:** guard **compartido server-side** de permisos por módulo,
    aplicado a cada endpoint de operación; **7 módulos asignables**: Usuarios, Novedades,
    Mantenimientos, Autorizaciones, Alistamientos + **Salidas** y **Llegadas**.
12. **Partición D-016:** ver sección siguiente.

---

## Partición D-016

| Sub-feature | Alcance | Ventana |
|---|---|---|
| **005-A** | Datos (6 tablas) + integración (cabeceras/cliente) + **envío inmediato en las 3 colas (D-021)** + cola de mantenimientos + jobs/reintentos + **guard de módulos (D-017)** + carga masiva **XLSX/CSV** + plantilla + placas/historial/exportar | jul 23-29 |
| **005-B** | Pantalla (tabs Preventivos/Correctivos, modales de registro/historial/corrección, estados de placa) + **PDF del programa** (`tbl_archivo_programas` + interfaz de almacenamiento) | siguiente |

> Recorte autorizado si la ventana no alcanza: mover **XLSX/CSV** a 005-B. El **envío inmediato** y
> el **guard** son estructurales y NO se mueven.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registro individual por el operador, con reporte inmediato (Priority: P1 — 005-A)

Un **operador (rol 3)** — o el admin (rol 1) — selecciona un vehículo y registra un mantenimiento
**preventivo** o **correctivo**: el sistema crea el mantenimiento **base** (placa + tipo), luego el
**detalle** y lo **reporta de inmediato** a la Superintendencia con las cabeceras verificadas del
legacy. Si la Super falla, el registro **cae a la cola** y se sincroniza por reintentos (D-021). El
**cliente (rol 2) NO registra mantenimientos individuales** (§10.2).

**Why this priority**: Flujo transaccional núcleo del módulo y primer aplicador del modelo de
reporte del CEO (intento inmediato + caída a cola).

**Independent Test**: Con un operador autenticado en modo stub, registrar un preventivo: base +
detalle quedan `procesado=true` con id externo en **columna separada**; con placa `FALLA*` (fallo
stub), el registro queda encolado como job `pendiente` en vez de perderse.

**Acceptance Scenarios**:

1. **Given** un operador autenticado, **When** registra el mantenimiento base (`vigiladoId`, `placa`,
   `tipoId ∈ {1,2}`), **Then** el sistema valida placa **3 letras + 3 dígitos** (§10.7) y tipo
   permitido, **desactiva** los previos del mismo vigilado+placa+tipo, persiste el base, intenta el
   reporte inmediato y guarda `tmt_mantenimiento_id` (**id externo, columna separada del id local**)
   con `tmt_procesado=true`; responde 201.
2. **Given** un base sincronizado, **When** registra el detalle preventivo (fecha, hora, nit, razón
   social, tipo/número identificación, responsable, actividades, `mantenimientoId`), **Then** valida
   `mantenimientoId` entero, `hora` con `^([01]\d|2[0-3]):[0-5]\d$` y `tipoIdentificacion ∈ 1..12`,
   persiste en `tbl_preventivos` **conservando el enlace local** y guardando el id externo en
   **columna separada** (`tpv_mantenimiento_id_externo`), reporta con cabeceras
   `Authorization`+`token`+`vigiladoId` y marca `tpv_procesado=true`; responde 201.
3. **Given** el mismo flujo con `tipoId=2`, **When** registra el correctivo, **Then** idéntico sobre
   `tbl_correctivos` (`tcv_*`).
4. **Given** un usuario rol 3, **When** registra, **Then** token y NIT usados son los **heredados del
   administrador**; **Given** un usuario rol 2, **When** intenta registrar un individual, **Then**
   recibe 403 (§10.2).
5. **Given** que el reporte inmediato falla (Super caída / placa `FALLA*` en stub), **When** se
   registra, **Then** el registro NO se pierde: queda un job `pendiente` en la cola con los
   reintentos automáticos (D-021) y la respuesta indica `encolado`.
6. **Given** `tipoId` fuera de {1,2}, placa que no cumpla `^[A-Z]{3}[0-9]{3}$`, hora inválida o
   `mantenimientoId` no entero, **When** envía, **Then** 400 con mensaje claro, sin persistir.
7. **Given** la Super rechaza por negocio ("No tiene autorización, consulte con el vigilado", "La
   placa no pertenece al vigilado", "La placa debe tener 6 caracteres"), **When** se reporta,
   **Then** el mensaje del API se muestra tal cual (matriz placa↔vigilado externa, §10.10).
8. **Given** modo stub, **When** se reporta, **Then** cero peticiones reales.

---

### User Story 2 - Carga masiva XLSX/CSV todo-o-nada con cola (Priority: P1 — 005-A)

El operador carga un archivo **XLSX o CSV** con mantenimientos preventivos o correctivos **desde su
módulo** (no hay cargador universal — §11.5). El sistema valida **100% server-side** y **TODO-O-NADA**
(§10.10): un solo registro inválido hace fallar el lote completo con `Exitosos: 0`; si todo es
válido, encola cada fila como jobs **base + detalle**. La **plantilla** oficial (con hoja auxiliar de
tipos de identificación) se descarga desde la app.

**Why this priority**: Vía masiva real del módulo y razón de ser de la cola.

**Independent Test**: XLSX válido de 3 filas → 202 `{total: 3, exitosos: 3, errores: []}` y 6 jobs;
archivo con UNA fila mala → 400 `{total: N, exitosos: 0, errores: ["Fila N: ..."]}` y CERO jobs.

**Acceptance Scenarios**:

1. **Given** un operador autenticado, **When** descarga la plantilla, **Then** recibe un XLSX
   server-side con hoja `mantenimiento` — columnas EXACTAS (§10.10): `vigiladoId, placa,
   fecha (AAAA-MM-DD), hora (HH:mm), nit, razonSocial, tipoIdentificacion, numeroIdentificacion,
   nombresResponsable, detalleActividades` — + hoja `tipos_identificacion` (12 códigos).
2. **Given** un archivo válido subido en el campo `archivo`, **When** se procesa, **Then** por cada
   fila crea base diferido (job `base`) + detalle (job `preventivo|correctivo`) y responde **202**
   `{total, exitosos, errores: []}`.
3. **Given** un archivo al que le falta una columna requerida, **When** se sube, **Then** **400**
   `errores: ["El archivo no contiene las columnas requeridas: ..."]` sin encolar nada.
4. **Given** un archivo con AL MENOS una fila inválida (campo vacío, tipo erróneo, hora que no cumpla
   la regex, `tipoIdentificacion` fuera de 1..12, placa que no sea 3 letras + 3 dígitos), **When** se
   sube, **Then** **TODO-O-NADA**: 400 `{total, exitosos: 0, errores: ["Fila N: ...", ...]}` y CERO
   jobs (§10.10).
5. **Given** un archivo que no es `.xlsx`/`.csv` según el endpoint o pesa más de 5 MB, **When** se
   sube, **Then** 400 con el mensaje de formato/tamaño.
6. **Given** fechas serial Excel o `dd/MM/yyyy` y horas fracción o `h:mm a`, **When** se procesan,
   **Then** normalizan a `AAAA-MM-DD` y `HH:mm` sin corrimiento de zona.
7. **Given** un CSV con las mismas 10 columnas (delimitador `,` con tolerancia a `;`), **When** se
   sube al endpoint CSV, **Then** pasa por el MISMO pipeline (validación, todo-o-nada, encolado).

---

### User Story 3 - Cola de mantenimientos en el worker único + log de errores (Priority: P1 — 005-A)

Los trabajos encolados (por carga masiva o por caída del envío inmediato) se sincronizan en segundo
plano: el worker único gana una **tercera pasada** (no un worker nuevo). Los fallidos quedan en un
**log de errores para revisión** (§11.2) desde donde el usuario **corrige los campos y reenvía**
(§10.6, pág. 25), disparando un ciclo completo nuevo de intentos.

**Why this priority**: Sin la cola no hay sincronización diferida ni recuperación de fallos.

**Independent Test**: Con jobs encolados en stub, correr una pasada: base obtiene id externo
(columna separada); detalle con base sin sincronizar se reprograma +5 min sin consumir reintento;
fallo simulado 3 veces → `fallido`; reintento con `actualizar` + payload corregido → `reintentos=0`
y ciclo nuevo.

**Acceptance Scenarios**:

1. **Given** jobs `pendiente` con `siguiente_intento <= now`, **When** corre la pasada, **Then**
   procesa hasta 20 por lote en orden por id (`procesando` → `procesado`), persistiendo el id externo
   en **columna separada** (base: `tmt_mantenimiento_id`; detalle: `*_mantenimiento_id_externo`) sin
   tocar el enlace local.
2. **Given** un job detalle cuyo base aún no tiene id externo, **When** se procesa, **Then** se
   reprograma +BACKOFF manteniendo `pendiente` **sin incrementar** `reintentos`, registrando el
   motivo.
3. **Given** un error del reporte, **When** se procesa, **Then** incrementa `tmj_reintentos`, guarda
   `tmj_ultimo_error` y reprograma; al llegar al máximo (env, default 3) queda `fallido`.
4. **Given** un job `fallido`, **When** el usuario corrige y reenvía (`actualizar` + payload),
   **Then** el job (y los datos locales) se actualizan, vuelve a `pendiente` con **`reintentos=0`** e
   intento inmediato — un ciclo completo nuevo; `reprogramar` con reintentos al máximo → 409;
   `marcarProcesado` → `procesado`. Si el job es detalle con base `fallido`, opera sobre el base.
5. **Given** los listados de jobs (programados paginado con filtros, fallidos, detalle por id),
   **When** se consultan, **Then** el alcance se impone **server-side** (D-015): roles 2 y 3 ven SOLO
   su NIT efectivo (el del administrador para rol 3 — sin esto el rol 3 no vería ningún job),
   cualquier `nit` que mande el cliente se IGNORA salvo rol 1; **rol 1 ve todas las empresas
   (desviación deliberada aprobada por el CEO)**; consultas parametrizadas, sin interpolación SQL.
6. **Given** el worker corriendo, **When** procesa mantenimientos, **Then** es una pasada del worker
   único (mismo proceso/advisory lock); máx reintentos y backoff se leen de **env** (D-019b).

---

### User Story 4 - Envío inmediato con caída a cola en despachos y llegadas (Priority: P1 — 005-A, D-021)

Las rutas de registro de **despachos** y **llegadas** (hoy solo encolan) ganan el **intento síncrono
con caída a cola**: al registrar desde la web, el sistema intenta reportar de una vez; si la Super
falla, la solicitud queda encolada exactamente como hoy. Los parámetros de reintento/backoff de las
**tres colas** pasan a variables de entorno.

**Why this priority**: D-021 (cerrada por el CEO) se implementa aquí para las tres colas de una vez;
las specs 001/002 están cerradas y no se reabren.

**Independent Test**: Registrar un despacho en stub → responde `procesado` con id externo sin esperar
al worker; con placa `FALLA*` → responde `encolado` y el worker lo reintenta después. Ídem llegadas.

**Acceptance Scenarios**:

1. **Given** un despacho registrado vía web, **When** el stub responde bien, **Then** la solicitud
   queda `procesado` con id externo en la MISMA transacción de registro (sin esperar al worker).
2. **Given** que el reporte inmediato falla, **When** se registra, **Then** la solicitud queda
   `pendiente` (comportamiento actual) y el worker la procesa con reintentos — nada se pierde.
3. **Given** una llegada registrada vía web, **When** se repite el patrón, **Then** mismo
   comportamiento (intento inmediato, caída a cola).
4. **Given** `COLA_MAX_REINTENTOS=5` y `COLA_BACKOFF_MIN=2` en env, **When** corre cualquiera de las
   3 colas, **Then** usa esos valores (defaults 3 y 5 si no están).
5. **Given** el reenvío manual de cualquier cola, **When** se dispara, **Then** resetea
   `reintentos=0` (ciclo completo nuevo — comportamiento ya existente que se conserva).

---

### User Story 5 - Guard de permisos por módulo en cada endpoint (Priority: P1 — 005-A, D-017)

La asignación de módulos deja de ser decorado de menú: un **guard compartido server-side** (sobre
`src/lib/modulos.ts`) valida en **cada endpoint de operación** que el usuario tenga el módulo
habilitado. SICOV maneja **7 módulos asignables** (D-018): Usuarios, Novedades, Mantenimientos,
Autorizaciones, Alistamientos, **Salidas** y **Llegadas**.

**Why this priority**: En el legacy `VerificarModulo` existe pero no protege ninguna ruta (I-09): un
operador puede llamar por API módulos que no le habilitaron. Se corrige ahora para no retrofitear
las specs 005-008.

**Independent Test**: Un operador SIN el módulo Mantenimientos recibe 403 en todos los endpoints de
mantenimientos aunque esté autenticado; con el módulo asignado, opera normal. Ídem Salidas/Llegadas.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado sin el módulo Mantenimientos, **When** llama cualquier endpoint
   del módulo, **Then** 403 (y el módulo no aparece en su menú).
2. **Given** los endpoints existentes de despachos (Salidas) y llegadas, **When** se aplica el guard,
   **Then** exigen sus módulos respectivos; los 52 tests existentes se ajustan/mantienen verdes.
3. **Given** el seed, **When** se ejecuta, **Then** existen los 7 módulos asignables (D-018) y las
   asignaciones demo coherentes (admin no opera; cliente asigna a operador).
4. **Given** rol 1 (administrador), **When** llama endpoints de operación, **Then** la política es la
   del manual §10.1 (el admin no opera los módulos de operación; ve Inicio y Usuarios) — el guard lo
   respeta salvo la desviación de lectura D-015 (rol 1 consulta datos de todas las empresas).

---

### User Story 6 - Pantalla Mantenimientos: tabs, PDF del programa y modales (Priority: P2 — 005-B)

El usuario entra al módulo Mantenimientos (dos tabs: Preventivos / Correctivos). El **cliente
(rol 2)** gestiona el **PDF del PROGRAMA** (subir ≤ 4 MB, solo PDF; **el último cargado queda
ACTIVO** y desactiva los anteriores; listar y descargar). El **operador (rol 3)** ve los vehículos
con su **estado de reporte**, registra individuales (modal), consulta historial (modal), usa la
carga masiva con plantilla y descarga los errores como TXT, y corrige/reenvía los fallidos.

**Why this priority**: Superficie visible; depende de 005-A para operar.

**Independent Test**: Como rol 2 subir/listar/descargar el PDF (el nuevo queda activo y el anterior
inactivo); como rol 3 ver placas con estado, registrar, ver historial, cargar un archivo con errores
y descargar `errores_cargue_preventivo.txt`.

**Acceptance Scenarios**:

1. **Given** un rol 2 en el tab Preventivos, **When** sube un PDF del programa (≤ 4 MB, solo PDF),
   **Then** queda en `tbl_archivo_programas` **como ACTIVO, desactivando los anteriores** del mismo
   vigilado+tipo (§10.2); > 4 MB → 413; no-PDF → 400. El rol 2 NO ve el formulario de registro
   individual.
2. **Given** un rol 3 (o rol 1), **When** abre el tab, **Then** ve la tabla de vehículos (placas del
   vigilado vía stub) con su **estado**: preventivo con 5 estados (`sin reporte · inicio · reportado
   vigente · próximo a vencer · vencido` — derivados de la cadencia mínima de **2 meses**, §10.3);
   correctivo solo los 3 primeros. Acciones: "Registrar mantenimiento" e "Historial".
3. **Given** el formulario de registro, **When** se muestra, **Then** el responsable se rotula según
   la operación (preventivo → **ingeniero mecánico**; correctivo → **técnico mecánico**, §10.11) y
   solo se aceptan vehículos **activos con póliza vigente** (§10.7 — la lista de placas del vigilado
   ya viene filtrada por la Super).
4. **Given** una carga masiva con errores, **When** termina, **Then** el modal muestra **"Se
   procesaron N registros. Exitosos: X. Fallidos: Y. Errores a corregir: Z"** y el botón **"Descargar
   errores"** genera el `.txt` (ej. `errores_cargue_preventivo`) — §10.10.
5. **Given** un job fallido en la vista de sincronización, **When** el usuario pulsa reintentar,
   **Then** se abre el registro **para corregir los campos con error** y reenviar (§10.6) — no es un
   simple reenviar.
6. **Given** un usuario sin el módulo, **When** intenta acceder, **Then** no aparece en el menú y la
   API responde 403 (guard de US5).

---

### Edge Cases

- Fila del XLSX/CSV completamente vacía → se ignora (no cuenta en `total`), igual que el legacy.
- Hora `24:00`, `8:75` o `830` tras normalizar → rechazada por `^([01]\d|2[0-3]):[0-5]\d$`
  (400 / "Fila N: ...").
- Encabezados con mayúsculas/minúsculas distintas → se aceptan (matching case-insensitive).
- **Todo-o-nada:** si la validación pasa pero el encolado de una fila falla a mitad de lote, el lote
  se revierte (transacción) — nunca un lote parcialmente encolado con `Exitosos > 0` y errores.
- Job detalle huérfano (base borrado o inexistente) → job falla con error claro, no rompe el lote.
- Reintento de un job que no está `fallido` → respuesta sin acción (paridad legacy).
- Rol 3 sin administrador o admin sin token autorizado → 400 de configuración, no se reporta.
- Rol 3 lista jobs → ve los del NIT del administrador (sin el fix vería cero — bug corregido).
- Cliente (rol 2) llama endpoints de registro individual/carga masiva → 403 (§10.2).
- Dos pasadas de worker simultáneas → imposible por advisory lock único del 003.
- PDF exactamente 4 MB → se acepta; por encima → 413. Subir un segundo PDF → el primero queda
  Inactivo (último ACTIVO).
- Envío inmediato con la Super caída a mitad de transacción → la solicitud queda `pendiente` en cola;
  jamás se pierde ni se duplica el reporte.
- `exportar-historial`: en el 003 **requiere autenticación** (bug legacy no replicado).

## Requirements *(mandatory)*

### Functional Requirements

**005-A — datos, integración, colas, guard**

- **FR-001**: El sistema DEBE añadir de forma **ADITIVA** al esquema `sicov` las 6 tablas del legacy
  con `@map` a columnas físicas exactas (`tbl_tipo_mantenimientos`, `tbl_archivo_programas`,
  `tbl_mantenimientos`, `tbl_preventivos`, `tbl_correctivos`, `tbl_mantenimiento_jobs` con índice
  `(tmj_estado, tmj_siguiente_intento)` y el set completo de tipos para 006/007), MÁS las columnas
  aditivas del 003: **`tpv_mantenimiento_id_externo`** y **`tcv_mantenimiento_id_externo`** (id
  externo en columna separada — corrige el bug legacy de sobrescritura del enlace local). Nunca
  `migrate reset`; migración creada con `--create-only` y SQL revisado antes de aplicar.
- **FR-002**: El seed DEBE poblar los 4 tipos de mantenimiento y los **7 módulos asignables**
  (D-018); esta feature solo opera los tipos 1 y 2.
- **FR-003**: El registro individual (roles **1 y 3** — el rol 2 recibe 403, §10.2) DEBE operar en
  dos pasos con **intento de reporte inmediato y caída a cola** (D-021): (a) base — valida
  `vigiladoId`, `placa` con `^[A-Z]{3}[0-9]{3}$` (§10.7), `tipoId ∈ {1,2}`, desactiva previos del
  mismo vigilado+placa+tipo, persiste, intenta reportar y guarda el id externo en columna separada;
  (b) detalle — valida `mantenimientoId` entero, `hora` con `^([01]\d|2[0-3]):[0-5]\d$`,
  `tipoIdentificacion ∈ 1..12`, persiste conservando el enlace local y guarda el id externo en
  `*_mantenimiento_id_externo`. Si el intento inmediato falla, el registro queda como job `pendiente`
  (no se pierde). Errores de negocio de la Super se muestran tal cual (§10.10).
- **FR-004**: Todo reporte de mantenimientos DEBE usar el contrato de cabeceras verificado
  (`Authorization` + `token` siempre; `vigiladoId` solo en POST de detalle) sobre el cliente
  stub/real existente (doble gate) con base URL **`URL_MATENIMIENTOS`** [sic — se conserva el typo
  vivo]; herencia rol 3 igual que despachos/llegadas.
- **FR-005**: La carga masiva (roles 1 y 3) DEBE ser **solo por archivo** — XLSX (paridad) y CSV
  (D-019e) — por operación dentro de su módulo (sin cargador universal, §11.5), campo `archivo`,
  ≤ 5 MB, validación 100% server-side compartida y **TODO-O-NADA** (§10.10): columnas requeridas
  (400), y si CUALQUIER fila es inválida → 400 `{total, exitosos: 0, errores: ["Fila N: ..."]}` sin
  encolar nada; solo con el 100% de filas válidas encola (base + detalle por fila, transaccional) y
  responde 202 `{total, exitosos, errores: []}`.
- **FR-006**: La normalización DEBE ser la del legacy (fechas Date/serial/`dd/MM/yyyy`/ISO →
  `AAAA-MM-DD`; horas Date/fracción/`h:mm a` → `HH:mm`) con validación de borde de hora
  (D-022 #3) y números como dígitos puros.
- **FR-007**: La plantilla DEBE generarse server-side con las 10 columnas EXACTAS del manual
  (§10.10) y la hoja auxiliar `tipos_identificacion` con los 12 códigos.
- **FR-008**: La cola DEBE procesarse como pasada adicional del **worker único** (mismo
  proceso/advisory lock): lotes de 20, estados `pendiente → procesando → procesado | fallido`,
  reintentos y backoff **parametrizables por env** (`COLA_MAX_REINTENTOS` default 3,
  `COLA_BACKOFF_MIN` default 5 — D-019b, compartidos por las 3 colas), dependencia base→detalle sin
  consumir reintento, id externo SIEMPRE en columna separada.
- **FR-009**: El reintento manual DEBE implementar el modelo del manual (§10.6): **corregir y
  reenviar** — acción `actualizar` (payload corregido; actualiza también los datos locales; resetea
  `reintentos=0`; ciclo completo nuevo), `reprogramar` (default; 409 al máximo) y `marcarProcesado`;
  detalle con base `fallido` opera sobre el base.
- **FR-010 (D-015)**: Los listados (jobs, fallidos, detalle) DEBEN imponer el alcance **server-side**:
  roles 2/3 atados a su NIT efectivo (rol 3 = NIT del administrador), **ignorando** cualquier `nit`
  del cliente; **rol 1 ve todas las empresas — desviación deliberada aprobada por el CEO**; consultas
  parametrizadas (nunca interpolación SQL — I-08 del legacy no se replica).
- **FR-011**: Placas e historial DEBEN proxearse vía cliente stub/real; exportar historial a XLSX
  **con autenticación**.
- **FR-016 (D-021)**: Las rutas de registro de **despachos** y **llegadas** DEBEN ganar el intento
  síncrono con caída a cola (hoy solo encolan — `despachos/route.ts:32-39`), sin cambiar contratos
  de respuesta más allá del estado resultante (`procesado` inmediato o `pendiente` encolado); el
  reenvío manual sigue reseteando `reintentos=0`.
- **FR-017 (D-017/D-018)**: Un guard **compartido server-side** sobre `src/lib/modulos.ts` DEBE
  aplicarse a **cada endpoint de operación** (mantenimientos, despachos/Salidas, llegadas): usuario
  sin el módulo → **403**. Seed con los 7 módulos asignables.

**005-B — pantalla y programa PDF**

- **FR-012**: El PDF del programa (roles 1 y 2; el operador no) por tipo (1|2): solo PDF, ≤ 4 MB →
  413; **el último cargado queda ACTIVO y desactiva los anteriores** del mismo vigilado+tipo
  (§10.2); listar y descargar; binario tras la **interfaz de almacenamiento** con
  `ALMACENAMIENTO_DIR` fuera de la app (D-022 #2); respaldo = requisito de switch-over.
- **FR-013**: La UI DEBE separar el módulo por rol (§10.2): card del programa PDF solo roles 1-2;
  card de vehículos/registro/carga solo roles 1-3; estados de placa (preventivo 5, correctivo 3,
  §10.3 — cadencia preventiva mínima 2 meses como origen de `próximo a vencer`/`vencido`);
  responsable rotulado por operación (§10.11); modal de resumen **"Se procesaron N registros.
  Exitosos: X. Fallidos: Y. Errores a corregir: Z"** + botón **Descargar errores** (`.txt`); el
  reintento de fallidos abre el registro para **corregir campos** antes de reenviar.

**Transversales**

- **FR-014 (guardarraíl)**: `INTEGRACIONES_MODO=stub` default, cero llamadas productivas, doble gate;
  fechas en `America/Bogota`; ningún log imprime tokens.
- **FR-015**: Todo endpoint/función nueva con su `.test.ts`; los **52 tests existentes** siguen
  verdes (ajustados donde el guard D-017 lo exija).

### Key Entities

- **TipoMantenimiento** (`tbl_tipo_mantenimientos`): catálogo 1-4; en 005 operan 1 y 2.
- **Mantenimiento** (`tbl_mantenimientos`): cabecera base placa+tipo+vigilado; `tmt_usuario_id`
  guarda el **NIT** del vigilado (BigInt); `tmt_mantenimiento_id` = id EXTERNO (columna separada del
  id local `tmt_id`); `tmt_estado` marca vigencia.
- **Preventivo** / **Correctivo** (`tbl_preventivos`/`tbl_correctivos`): detalle del mantenimiento;
  `*_mantenimiento_id` = enlace LOCAL al base (nunca se sobrescribe);
  `*_mantenimiento_id_externo` (columna 003) = id devuelto por la Super.
- **ArchivoPrograma** (`tbl_archivo_programas`): PDF del programa por tipo y vigilado; el último
  cargado queda activo.
- **MantenimientoJob** (`tbl_mantenimiento_jobs`): cola de sincronización (tipo, refs local/detalle,
  vigilado, usuario, rol, estado, reintentos, último error, siguiente intento, payload).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los reportes de mantenimiento salen con el contrato de cabeceras verificado;
  ninguno con cabeceras de despachos.
- **SC-002**: Un archivo válido de N filas termina con N bases + N detalles sincronizados; un archivo
  con UNA fila inválida termina con **Exitosos: 0**, todos los errores "Fila N: ..." reportados y
  CERO jobs encolados (todo-o-nada).
- **SC-003**: Ningún registro se pierde: con la Super caída, el 100% de los registros web quedan
  encolados y reintentables; el reintento manual (corregir + reenviar) funciona el 100% de las veces
  con contador en 0.
- **SC-004**: Un detalle nunca se reporta antes que su base, y el enlace local base↔detalle se
  conserva SIEMPRE (el id externo vive en columna separada).
- **SC-005**: Con modo stub, cero peticiones a `*.supertransporte.gov.co` (verificable en tests).
- **SC-006**: La suite completa (52 existentes + nuevos) pasa verde; `tsc`, `lint` y `build` sin
  errores.
- **SC-007**: Un usuario sin un módulo asignado recibe 403 en el 100% de los endpoints de ese módulo
  (mantenimientos, salidas, llegadas); roles 2/3 jamás ven datos de otro NIT (alcance server-side).
- **SC-008**: Un despacho/llegada/mantenimiento registrado vía web con la Super disponible queda
  `procesado` en la misma petición (sin esperar al worker).

## Assumptions

- Reutiliza íntegro el andamiaje 001-004 (cliente doble token stub/real, contexto efectivo rol 3,
  worker único, paginación, `bogota.ts`).
- La dualidad individual-inmediato / masivo-cola es el modelo del CEO (`HANDOFF §11`) aplicado a las
  3 colas (D-021); las specs 001/002 NO se reabren — el cambio vive en 005-A.
- "Vehículos activos con póliza vigente" (§10.7) se garantiza por la lista de placas que devuelve la
  Super para el vigilado (el 003 no re-valida pólizas localmente); los errores de la matriz
  placa↔vigilado los devuelve la Super y se muestran tal cual.
- Los estados de placa (5/3) se derivan del historial que devuelve la Super + cadencia de 2 meses;
  el cálculo exacto del umbral "próximo a vencer" se define en 005-B con el CEO si el historial no
  trae el estado ya calculado (el stub lo simula).
- La hoja `tipos_identificacion` usa el catálogo D-022 #5 (12 valores) como constante local.
- `tbl_mantenimiento_jobs` se crea con el set completo de tipos para 006/007.
- Carga masiva TXT (R-03 de §11.3) y carga masiva para las otras 4 operaciones (R-04) quedan FUERA
  de 005 (prioridad CEO §11.5: "primero las operaciones reportando bien").

## Preguntas abiertas (no bloquean el stub)

- **[NEEDS CLARIFICATION]** Contrato exacto (payload/respuesta) del API externo real de
  mantenimientos (`URL_MATENIMIENTOS`); el stub respeta cabeceras y formas de id observadas.

---

## Implementación (005-A — 2026-07-23)

**Flujo:** `/speckit.tasks` (35 tareas) → `/speckit.analyze` (0 críticos, coverage 100%) →
implementación. Un commit por US en el orden de ZEUS:

| Commit | Contenido |
|---|---|
| `cf6bc6c5` | Correcciones Spec Kit (checklist honesto, Status DESARROLLO) |
| `bbaf0d20` | Datos + integración (T001-T012): deps, modelos, migración `--create-only` revisada, seed D-018, cabeceras/cliente/stub/normalizar |
| `0c183040` | **US5** guard de módulos D-017 (aplicado a despachos/llegadas; rutas nuevas nacen con guard) |
| `22284e90` | **US4** envío inmediato con caída a cola en despachos/llegadas + env D-019b |
| `69b57bb4` | **US1** registro individual (base+detalle, ids separados B1, placas/historial) |
| `971bd08c` | **US2** carga masiva XLSX/CSV todo-o-nada + plantilla + exportar |
| `df6c308e` | **US3** cola en worker único + jobs D-015 + corregir-y-reenviar §10.6 |
| `1a942187` | Artefactos faltantes spec 002 (I-11) |
| `7ea85eee` | Hallazgos del smoke: disparador `FAL*` (FALLA* no pasa la regex de placa) y luxon enrollando horas fuera de rango (24:00→00:00) — rechazo en el borde restituido |

**Resultados:** 117/117 tests · `tsc --noEmit`/`lint`/`build` limpios · smoke E2E en vivo
(registro inmediato, caída a cola FAL999, CSV todo-o-nada con "Fila N", worker 3 pasadas con
cabeceras correctas, corregir-y-reenviar con reset a 0, alcance D-015 con `nit` ajeno ignorado,
403 rol 2) · navegador en ventana privada 8/8 (admin solo Inicio; vigilado con módulos D-018;
I-14 intacto; operador registra E2E).

**Deuda / pendientes:** 005-B (pantalla, PDF programa, modales); contrato real del API (stub);
filtros legacy sin datos (`vin`, `proveedor`) ignorados; filtro placa/término de jobs en memoria
sobre tope 2000 (documentado en cola.ts); TXT y carga masiva de otras operaciones (R-03/R-04 §11.3)
fuera por prioridad CEO.
