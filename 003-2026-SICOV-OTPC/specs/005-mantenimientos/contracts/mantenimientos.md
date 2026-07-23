# Contrato — Módulo Mantenimientos (preventivos/correctivos)

> Paridad con `ruta_mantenimiento.ts` (api/v1, middleware JWT) del legacy, en rutas Next.js del 003.
> Autenticación: `verifyAuth` (cookie JWT) en **todos** los endpoints (incluido exportar — el legacy
> lo tenía público, bug a no replicar) **+ guard de módulo `Mantenimientos` (D-017) en todos**.
> Roles según §10.2 del manual: **el rol 2 (cliente) NO registra** — sus endpoints son los del
> programa PDF (`archivos-programas.md`, 005-B). **Alcance de datos (D-015): server-side** — roles
> 2/3 atados a su NIT efectivo (rol 3 = NIT del administrador), `nit` del cliente se ignora salvo
> rol 1 (que ve todas las empresas: desviación deliberada aprobada por el CEO); consultas SIEMPRE
> parametrizadas. **Guardarraíl:** cliente stub por defecto; cero llamadas reales sin doble gate +
> verificación humana.

## Cabeceras hacia el API externo de mantenimientos (verificadas en legacy)

| Llamada | Cabeceras | vigiladoId viaja en |
|---|---|---|
| POST base `guardar-mantenimieto` [sic] | `Authorization: Bearer <tokenExterno>` + `token` | payload (`vigiladoId` numérico) |
| POST detalle `guardar-preventivo` / `guardar-correctivo` | `Authorization` + `token` + **`vigiladoId: <nit>`** | cabecera |
| GET `listar-placas` / `listar-historial` | `Authorization` + `token` | query param |

Base URL externa: **`URL_MATENIMIENTOS`** [sic — typo heredado que SE CONSERVA (gate B2): vive en
`.env.example:52` y `cliente-http.ts:76`]. Herencia rol 3 vía `resolverContextoEfectivo`
(token+NIT del admin).

## Registro individual (intento inmediato + caída a cola — D-021)

### POST /api/mantenimientos  (base)
Roles **1,3** (rol 2 → 403, §10.2). Body: `{ vigiladoId, placa, tipoId }`.
Validación: todos requeridos (400); `tipoId ∈ {1,2}` (los tipos 3/4 responden 400 "no disponible
en esta versión" hasta 006/007); `placa` con `^[A-Z]{3}[0-9]{3}$` (3 letras + 3 dígitos, §10.7).
Proceso: desactivar previos (`tmt_estado=false` para mismo NIT+placa+tipo) → crear base
(`fechaDiligenciamiento` = ahora Bogotá) → **intento de reporte inmediato** vía
`cliente.postMantenimiento` → persistir **`tmt_mantenimiento_id` (id EXTERNO — columna separada del
id local `tmt_id`)** y `tmt_procesado=true`. **Si el envío falla:** el base queda persistido y se
crea job `base` `pendiente` (caída a cola) — respuesta indica `encolado`.
**201** → `{ ...respuesta del API externo | encolado, mantenimientoLocalId, jobId? }`.
Errores: 400 validación · 401 · 403 (rol/módulo) · errores de negocio de la Super tal cual
("No tiene autorización, consulte con el vigilado" · "La placa no pertenece al vigilado" · "La placa
debe tener 6 caracteres" — matriz placa↔vigilado externa, §10.10).

### POST /api/mantenimientos/preventivo · POST /api/mantenimientos/correctivo  (detalle)
Roles **1,3**. Body: `{ mantenimientoId, placa, fecha, hora, nit, razonSocial, tipoIdentificacion,
numeroIdentificacion, nombresResponsable, detalleActividades }`.
Validación: `mantenimientoId` entero requerido (400); `hora` debe cumplir
`^([01]\d|2[0-3]):[0-5]\d$` (400 — D-022 #3); `tipoIdentificacion ∈ 1..12` (catálogo D-022).
Proceso: persistir detalle (`fecha` ISO date, `hora` HH:mm) → intento inmediato con cabecera
`vigiladoId` → marcar `procesado=true` y guardar el id externo en
**`*_mantenimiento_id_externo` (columna separada — el enlace local `*_mantenimiento_id` NUNCA se
sobrescribe; bug legacy `RepositorioMantenimientoDB.ts:1443` corregido)**. Si falla → job
`preventivo|correctivo` `pendiente` (caída a cola).
**201** → respuesta del API externo o `encolado`. Errores: 400 · 401 · 403 · upstream.

## Carga masiva (diferida → cola) — SOLO por archivo (variante JSON del legacy CORTADA, D-022 #4)

### POST /api/mantenimientos/bulk/preventivo/xlsx · /bulk/correctivo/xlsx  (multipart)
### POST /api/mantenimientos/bulk/preventivo/csv · /bulk/correctivo/csv  (multipart — formato nuevo D-019e)
Roles **1,3** (rol 2 → 403). Carga POR OPERACIÓN dentro de su módulo — no hay cargador universal
(§11.5). Campo `archivo`:
- **XLSX:** extensión `.xlsx` + content-type `spreadsheetml`/octet-stream.
- **CSV:** extensión `.csv` + content-type `text/csv`/octet-stream; delimitador coma con tolerancia
  a `;` (auto-detección sobre el encabezado); se lee con el lector CSV de ExcelJS hacia el MISMO
  pipeline.
Ambos ≤ 5 MB.
Pipeline server-side compartido (ExcelJS):
1. Sin archivo → 400 `['Debe adjuntar el archivo en el campo "archivo"']`; formato inválido → 400
   `["El archivo debe estar en formato XLSX"]` (o `CSV` según endpoint).
2. Columnas requeridas (10, case-insensitive): `vigiladoId, placa, fecha, hora, nit, razonSocial,
   tipoIdentificacion, numeroIdentificacion, nombresResponsable, detalleActividades`. Falta alguna →
   400 `["El archivo no contiene las columnas requeridas: <col (desc)>, ..."]`.
3. Filas: vacías se ignoran; campos requeridos vacíos → `"Fila N: <col (desc)>, ..."`; tipos
   (`vigiladoId`/`nit`/`tipoIdentificacion` numéricos — `tipoIdentificacion ∈ 1..12` del catálogo
   D-022; textos; `placa` con `^[A-Z]{3}[0-9]{3}$`) →
   `"Fila N: la columna X debe contener un <tipo> válido."`.
4. Normalización: fecha (Date/serial Excel/dd-MM-yyyy/MM-dd-yyyy/ISO → `AAAA-MM-DD` sin corrimiento);
   hora (Date/fracción/H:mm/h:mm a → `HH:mm`) + **validación de borde `^([01]\d|2[0-3]):[0-5]\d$`**
   (D-022 #3; incumple → `"Fila N: ..."`).
5. **TODO-O-NADA (§10.10):** si CUALQUIER fila es inválida → **400**
   `{ total: totalFilas, exitosos: 0, errores: ["Fila N: ...", ...] }` y **CERO** jobs. Solo con el
   100% de filas válidas → encolado **transaccional** por registro (base diferido + detalle local +
   job `preventivo|correctivo`; si el encolado falla a mitad, se revierte todo) → **202**
   `{ total, exitosos: total, errores: [] }`. La UI (005-B) muestra *"Se procesaron N registros.
   Exitosos: X. Fallidos: Y. Errores a corregir: Z"* + botón **Descargar errores** (`.txt`).

### GET /api/mantenimientos/plantillas/preventivo-correctivo
Roles 1,3. Genera XLSX server-side: hoja `mantenimiento` (10 columnas EXACTAS del manual §10.10 —
`fecha` en `AAAA-MM-DD`, `hora` en `HH:mm` —, fila 2 vacía) + hoja
`tipos_identificacion` (`codigo`, `descripcion` — **catálogo D-022 #5**: 1 Cédula de ciudadanía,
2 Cédula de extranjería, 3 Pasaporte, 4 Cédula de ciudadanía digital, 5 Tarjeta de identidad,
6 Registro civil, 7 PEP, 8 DIE, 9 NIT, 10 NN, 11 Carnet Diplomático, 12 Permiso por Protección
Temporal).
**200** `Content-Type: ...spreadsheetml.sheet`,
`Content-Disposition: attachment; filename=plantilla_mantenimiento_preventivo_correctivo.xlsx`.

## Consultas externas (proxy vía cliente stub/real)

### GET /api/mantenimientos/placas?tipoId=1|2
Roles 1,3. 400 sin `tipoId`. Proxy `listar-placas?vigiladoId=<nitEfectivo>&tipoId=` → lista de
placas del vigilado (la Super devuelve solo vehículos activos con póliza vigente, §10.7; stub:
placas demo). El `vigiladoId` SIEMPRE es el NIT efectivo server-side (D-015).

### GET /api/mantenimientos/historial?tipoId=&placa=
Roles 1,3. Proxy `listar-historial?tipoId=&vigiladoId=<nitEfectivo>&placa=` → historial (stub:
filas demo con `fecha,hora,nit,razon_social,tipo_identificacion,numero_identificacion,
nombres_responsable,detalle_actividades`).

### GET /api/mantenimientos/historial/exportar?tipoId=&placa=
Roles 1,3 (**con auth**, a diferencia del legacy). XLSX del historial con cabeceras dinámicas.
**200** attachment `Historial.xlsx`.

## Cola de sincronización (jobs)

### GET /api/mantenimientos/jobs
Roles 1,2,3. Query: `pagina` (entera ≥1, 400 si no), `limite` (≥1, 400 si no; default 25, máx 100),
`estado`, `tipo`, `placa`, `nit` (solo rol 1), `fecha` (ISO, 400 si inválida), `termino`,
`ordenCampo`/`ordenDireccion` (`asc|desc`, 400 otro valor). Filtros legacy sin datos en el 003
(`vin`, `proveedor`, `sincronizacionEstado`) se aceptan y se ignoran (documentado).
**Alcance (D-015, server-side):** roles 2/3 SIEMPRE filtrados por su **NIT efectivo** (rol 3 = NIT
heredado del administrador — sin este fix el rol 3 no vería ningún job, pues los jobs llevan
`tmj_vigilado_id` = NIT del admin); cualquier `nit` que mande el cliente se **ignora** salvo rol 1.
**Rol 1 ve todas las empresas — desviación deliberada aprobada por el CEO (NO paridad).** Consultas
parametrizadas (Prisma where tipado); prohibida la interpolación SQL (I-08 del legacy).
**200** `{ items: [job + contexto legible], pagination: { page, pageSize, total, totalPages } }`.

### GET /api/mantenimientos/jobs/fallidos
Roles 1,2,3. Query opcional `tipo`, `estado`, `nit` (solo rol 1). Log de errores para revisión
(§11.2): jobs `fallido` del alcance D-015.

### GET /api/mantenimientos/jobs/[id]
Roles 1,2,3. 400 si id no entero; 404 si no existe o fuera del alcance D-015.

### POST /api/mantenimientos/jobs/[id]/reintentar
Roles 1,2,3 (alcance D-015). Body:
`{ accion?: 'reprogramar'|'actualizar'|'marcarProcesado', payload?: object|null }`
(400 si acción inválida o payload no objeto/nulo).
**Semántica del manual (§10.6, pág. 25): el reintento manual NO es solo reenviar — la UI abre el
registro para CORREGIR los campos con error y reenviar** (acción `actualizar` + payload corregido),
disparando un **ciclo completo nuevo** de intentos.
Reglas (paridad legacy):
- Si el job es detalle y su job `base` está `fallido` → opera sobre el base.
- Job no `fallido` → 200 sin acción (paridad: retorno silencioso).
- `actualizar`: actualiza `tmj_payload` **y los datos locales del registro** → `pendiente`,
  **`reintentos=0`**, `ultimoError=null`, intento inmediato.
- `reprogramar` (default): si `reintentos >=` máximo (env) → **409** "alcanzó el número máximo de
  reintentos"; si no, resetea igual que actualizar.
- `marcarProcesado`: job → `procesado` sin reporte.
**200** `{ mensaje, estado, jobId, siguienteIntento? }`.

## Worker (pasada nueva del worker único) + parámetros por env (D-019b)

`procesarLoteMantenimientos({ limite: 20 })` en `scripts/worker.mjs` (tercera pasada, mismo advisory
lock 30032026). Reintentos y backoff se leen de env — compartidos por las 3 colas:
`COLA_MAX_REINTENTOS` (default 3) y `COLA_BACKOFF_MIN` (default 5).
- Toma jobs `pendiente` con `siguienteIntento <= now`, orden por id, lote 20; marca `procesando`.
- `base`: POST externo → persiste `tmt_mantenimiento_id` (**id externo, columna separada de
  `tmt_id`**) + `tmt_procesado`; sin id en la respuesta → error con mensaje del API.
- `preventivo`/`correctivo`: si el base no tiene id externo → `MantenimientoPendienteError` →
  `pendiente` +backoff **sin** consumir reintento; si lo tiene → POST externo con `mantenimientoId`
  = id EXTERNO del base → marca detalle `procesado` y guarda el id externo en
  **`*_mantenimiento_id_externo`** (el enlace local `*_mantenimiento_id` NO se toca — gate B1).
- Error normal: `reintentos+1`, `ultimoError`, +backoff; al máximo → `fallido` (log de errores).
- Solo procesa tipos `base|preventivo|correctivo` (otros → error explícito "no soportado en 005").

## Envío inmediato en despachos y llegadas (D-021 — rutas existentes tocadas)

`POST /api/integracion/despachos` y `POST /api/integracion/llegadas` (hoy solo encolan,
`despachos/route.ts:32-39`): tras persistir la solicitud, **intentan el envío inmediato** con el
mismo helper; éxito → `procesado` + id externo en la misma petición; fallo → queda `pendiente`
(comportamiento actual, nada se pierde). El reintento manual existente conserva `reintentos=0`
(ciclo completo nuevo). Ambas rutas ganan además el guard de módulo (**Salidas** / **Llegadas**,
D-017/D-018).

## Endpoints externos (solo modo real; URLs no secretas)

`POST {URL_MATENIMIENTOS}/mantenimiento/guardar-mantenimieto` [sic ×2 — ambos typos heredados se
conservan] · `POST .../guardar-preventivo` · `POST .../guardar-correctivo` ·
`GET .../listar-placas` · `GET .../listar-historial`.
