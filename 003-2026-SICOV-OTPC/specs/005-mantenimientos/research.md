# Research — 005-mantenimientos

> Fase 0. Resuelve las incógnitas técnicas del spec con decisiones verificadas contra el legacy
> (`legacy-sistema-original/back_gestion_despachos`) y el código vigente del 003. Formato:
> Decisión / Racional / Alternativas.

## R1. Modo de sincronización: individual inmediato con caída a cola + masivo diferido (D-021)

- **Decisión:** registro individual con **intento de reporte inmediato**; si el envío falla, el
  registro **cae a la cola** (job `pendiente`) y sigue el ciclo de reintentos — no se pierde ni
  devuelve error definitivo. Carga masiva **siempre diferida** (jobs `base` + detalle). Es el modelo
  de reporte del CEO (`HANDOFF §11.1-11.2`) aplicado por **D-021 a LAS TRES COLAS** (despachos,
  llegadas, mantenimientos) **dentro de 005-A** — las specs 001/002 están cerradas y no se reabren.
- **Racional:** el legacy verificado ya tenía la dualidad (individual síncrono / masivo `diferido:
  true`); el CEO la generalizó y añadió la caída a cola. Un helper compartido
  (`intentarEnviarConCaida`) evita tres implementaciones divergentes.
- **Alternativas:** (a) todo diferido — descartado: contradice §11.1 ("web intenta reportar de una
  vez"); (b) todo síncrono sin caída — descartado: perdería registros con la Super caída; (c) dejar
  despachos/llegadas para después — descartado por D-021 (obligaría a reabrir 001/002 por separado).

## R2. Contrato de cabeceras propio de mantenimientos

- **Decisión:** añadir `construirCabecerasMantenimiento(identificacion, idRol, { conVigiladoId })` en
  `src/lib/integracion/cabeceras.ts`: siempre `Authorization: Bearer <tokenExterno>` +
  `token: <tokenAutorizado>` + `Content-Type`; con `conVigiladoId: true` añade `vigiladoId: <nit>`
  (solo POST de detalle). Reutiliza `getTokenProveedor()` y `resolverContextoEfectivo()` (herencia rol 3).
- **Racional:** verificado en `RepositorioMantenimientoDB.ts`: el API de mantenimientos NO usa la
  cabecera `documento`; el base lleva `vigiladoId` en el payload, el detalle en cabecera, las
  consultas como query param. Reusar `construirCabeceras` de despachos enviaría una cabecera espuria
  y omitiría `vigiladoId`.
- **Alternativas:** (a) reusar las 3 cabeceras de despachos — descartado: rompe el contrato real;
  (b) módulo de cabeceras aparte en `lib/mantenimientos` — descartado: la resolución de tokens/herencia
  es la misma; vive junto a la existente.

## R3. Extensión del cliente stub/real (doble gate intacto)

- **Decisión:** extender la interfaz `ClienteSupertransporte` con dos métodos genéricos de
  mantenimientos: `postMantenimiento(path, body, identificacion, idRol, opts?: { conVigiladoId })` y
  `getMantenimiento(path, params, identificacion, idRol)`. `ClienteStub` simula (ids incrementales,
  placas `FALLA*` fuerzan error, listas demo para placas/historial/tipos de identificación);
  `ClienteHttp` queda tras el doble gate existente. Base URL: **`URL_MATENIMIENTOS`** [sic] — el
  typo heredado **SE CONSERVA** (gate B2): ya está vivo en `.env.example:52` y en
  `src/lib/integracion/cliente-http.ts:76` (código del wizard 004 en producción interna); introducir
  el nombre corregido rompería `requireEnv` en arranque.
- **Racional:** conserva el guardarraíl único (factory `getClienteSupertransporte()` + `modoIntegracion()`);
  los tests siguen corriendo 100% contra stub.
- **Alternativas:** cliente HTTP separado para mantenimientos — descartado: duplicaría el gate y el
  riesgo de fuga a red.

## R4. Cola: pasada adicional del worker único

- **Decisión:** `src/lib/mantenimientos/cola.ts` con `procesarLoteMantenimientos({limite:20})`
  (mismo patrón que `llegadas/cola.ts`; máx reintentos y backoff desde env `COLA_MAX_REINTENTOS`/
  `COLA_BACKOFF_MIN`, defaults 3 y 5 — D-019b, compartidos por las 3 colas) y `scripts/worker.mjs`
  gana una **tercera pasada** (despachos → llegadas → mantenimientos) bajo el MISMO advisory lock
  `30032026`. La
  dependencia base→detalle se modela con un error tipado `MantenimientoPendienteError` que reprograma
  +5 min **sin** incrementar `reintentos` (paridad `MantenimientoQueueService`).
- **Racional:** cumple la restricción "un solo worker" (constitución §1.5-R3 y AGENTS §6) y la
  paridad de estados/reintentos/lotes.
- **Alternativas:** proceso worker propio de mantenimientos (como el legacy) — descartado: el 003
  decidió worker único multi-pasada en la feature 002 (D3) y la regla operativa lo exige.

## R5. XLSX + CSV server-side: dependencia nueva `exceljs` (APROBADA D-022 #1)

- **Decisión:** añadir **`exceljs` ^4.4** (dependencia de producción, solo se importa en código
  server: rutas API y lib). Se portan de forma fiel `leerRegistrosDesdeExcel`,
  `normalizarFechaExcel`, `normalizarHoraExcel`, `validarTiposDeDato` y las definiciones de columnas
  de preventivo/correctivo a `src/lib/mantenimientos/excel.ts` y `validacion.ts` (funciones puras con
  test). La plantilla se genera con `workbook.xlsx.writeBuffer()` y se responde con
  `Content-Disposition: attachment`. **CSV (D-019e, D-022 #1) se suma como formato nuevo:** se lee
  con el lector CSV de la misma `exceljs` (`workbook.csv`) hacia un worksheet, de modo que TODO el
  pipeline de validación/normalización/encolamiento es compartido con XLSX; delimitador coma con
  tolerancia a `;` (auto-detección simple sobre la fila de encabezado). Las celdas CSV llegan como
  texto → la normalización por string de fechas/horas ya lo cubre.
- **Racional:** es la misma librería del legacy (mismo comportamiento con seriales de fecha/hora de
  Excel) y lo exige el input de la feature; un solo pipeline para dos formatos evita divergencia de
  validaciones. La constitución §4.4 ya prescribe Excel server-side.
- **Alternativas:** `xlsx`/SheetJS — descartado: cambia la semántica de celdas (fechas) y aleja la
  paridad; parser CSV dedicado (`papaparse`) — descartado: segunda dependencia y segundo pipeline
  para el mismo resultado.

## R6. Modelo de datos: 6 tablas fieles + ids externos en columnas SEPARADAS (gate B1)

- **Decisión:** migración aditiva `add_mantenimientos` (creada con `--create-only` y SQL revisado)
  con las 6 tablas de columnas físicas exactas (ver `data-model.md`), MÁS columnas aditivas del 003:
  **`tpv_mantenimiento_id_externo`** y **`tcv_mantenimiento_id_externo`**. A la Super viaja el **id
  EXTERNO**, pero el enlace local (`*_mantenimiento_id` → `tmt_id`) **nunca se sobrescribe** — el
  legacy lo pierde al guardar el id externo encima (`RepositorioMantenimientoDB.ts:1443`, bug
  confirmado en el gate). En la base ya venían separados (`tmt_id` local / `tmt_mantenimiento_id`
  externo). `tmj_tipo` como `String @db.VarChar(20)` validado en app. `tpv_nit`/`tcv_nit` **BigInt**
  (ALTER verificado) y **`tmt_usuario_id` también BigInt** (guarda un NIT, no un usn_id — menor del
  gate). `tpv_fecha` `@db.Date`; `tpv_hora`/`tcv_hora` `String @db.VarChar(8)` (`HH:mm`).
- **Racional:** Adonis `table.enum` genera columna texto + CHECK, no un tipo enum de PG; varchar +
  validación en app es lo más cercano y no bloquea 006/007. La hora como varchar es **DESVIACIÓN
  aprobada en D-022 #3** — el legacy usa `table.time()` (`1741738351341_tbl_preventivos.ts:11`), no
  varchar; racional aprobado: Prisma no tiene tipo Time limpio, es hora de pared sin zona y viaja
  como texto a la Super. **Condición vinculante:** validar `^([01]\d|2[0-3]):[0-5]\d$` en el borde
  (endpoints de detalle y pipeline XLSX/CSV) antes de persistir o reportar.
- **Alternativas:** enum nativo Prisma — descartado (migración extra al llegar 006/007 si cambiara, y
  no es fiel al legacy); `@db.Time` — descartado por ergonomía y porque el valor de negocio es el
  string `HH:mm`.

## R7. Almacenamiento del PDF del programa (APROBADO CON CONDICIONES — D-022 #2)

- **Decisión:** filesystem local **detrás de una interfaz de almacenamiento**
  (`src/lib/almacenamiento.ts`: `guardarArchivo(carpeta, nombreOriginal, buffer) → {documento, ruta}`
  y `leerArchivo(ruta) → buffer`) para poder migrar a S3/servicio externo **sin tocar lógica de
  negocio**. Directorio raíz por variable de entorno **`ALMACENAMIENTO_DIR` (obligatoria, FUERA del
  directorio de la app** — `.env.example` sugiere `$HOME/003-sicov-datos/uploads`); subcarpeta
  `programas/`; nombre físico aleatorio (`crypto.randomUUID()` + `.pdf`), metadatos en
  `tbl_archivo_programas` (`tap_nombre_original`, `tap_documento` = nombre físico, `tap_ruta` =
  ruta relativa a la raíz). Descarga vía endpoint autenticado con streaming. Límite **4 MB → 413**;
  solo `application/pdf`. **El respaldo de esa carpeta es requisito del switch-over** (se añade al
  runbook/cierre).
- **Racional:** condiciones impuestas en el gate D-022 #2; el legacy delega en un servicio de
  archivos externo (`ServicioArchivos` → `/recursos`) que el 003 no tiene; el contrato de datos
  (tabla) se conserva 1:1 y la interfaz aísla el backend de almacenamiento.
- **Alternativas:** bytes en BD (`bytea`) — descartado: infla la BD y complica el backup; S3/minio
  ahora — descartado: infraestructura nueva sin necesidad inmediata; queda alcanzable vía la interfaz.

## R8. Reintento manual = corregir-y-reenviar + alcance de datos por rol (D-015, gate B3)

- **Decisión (reintento):** portar las tres acciones del legacy (`reprogramar` default con 409 al
  máximo, `actualizar` con payload override + reset a 0, `marcarProcesado`) y la redirección al job
  base fallido, con la semántica del manual (§10.6, pág. 25): el reintento manual **NO es solo
  reenviar** — abre el registro para **corregir los campos con error** (la acción `actualizar`
  actualiza job Y datos locales) y dispara un **ciclo completo nuevo** de intentos. La UI de
  corrección vive en 005-B; los endpoints en 005-A.
- **Decisión (alcance — D-015):** el alcance de TODOS los listados se impone **server-side**:
  - Roles 2 y 3 quedan atados a su **NIT efectivo**, **ignorando** cualquier `nit` que mande el
    cliente (query param solo tiene efecto para rol 1).
  - **Fix del bug de rol 3:** el filtro usa el NIT **heredado del administrador**
    (`resolverContextoEfectivo`), NO el documento del subusuario — con el filtro ingenuo por
    documento el rol 3 no vería ningún job (los jobs llevan el NIT del admin).
  - **Rol 1 ve todas las empresas: DESVIACIÓN DELIBERADA aprobada por el CEO** — NO es paridad (en
    el manual el admin no opera módulos de operación).
  - Consultas SIEMPRE parametrizadas (Prisma where tipado); **prohibido** interpolar el NIT en SQL —
    el legacy lo hace y además toma el NIT del query string sin validar rol
    (`ControladorDashboard.ts:24-26`, `ObtenerResumenDashboard.ts:33` — fuga entre empresas, I-08).
- **Racional:** el frontend legacy reintenta siempre con `accion:'actualizar'`; I-08 es una fuga de
  datos real que la constitución (§6) obliga a no replicar. Los filtros exóticos sin datos (`vin`,
  `proveedor`, `sincronizacionEstado`) se aceptan y se ignoran, documentado.
- **Alternativas:** un "reintentar" simple — descartado (pierde la corrección de campos, que es la
  vía real de recuperación); alcance en el cliente — descartado (es exactamente el bug I-08).

## R9. Resolución de las preguntas abiertas del spec (actualizado con D-022)

| Pregunta | Resolución |
|---|---|
| Contrato real de `URL_MATENIMIENTOS` [sic] | El stub replica formas observadas: base devuelve `{id}`; detalle `{mantenimientoId}`. La extracción tolerante REUSA `src/lib/normalizar.ts` (ya existente y testeado): solo se añade `extraerIdMantenimientoExterno` (candidatos `id \| mantenimientoId \| mantenimiento_id \| data.*`) en ese mismo módulo — no se crea un módulo de extractores paralelo. Contrato real pendiente de credenciales (igual que 001-004). |
| Catálogo `tipos_identificacion` | **RESUELTO (D-022 #5, manual de usuario):** 1 Cédula de ciudadanía · 2 Cédula de extranjería · 3 Pasaporte · 4 Cédula de ciudadanía digital · 5 Tarjeta de identidad · 6 Registro civil · 7 PEP · 8 DIE · 9 NIT · 10 NN · 11 Carnet Diplomático · 12 Permiso por Protección Temporal. Constante en `src/lib/mantenimientos/tipos.ts`, usada por plantilla y validación (`tipoIdentificacion ∈ 1..12`). |
| Variante JSON `bulk/*` sin archivo | **RESUELTO (D-022 #4): SE CORTA** — sin consumidores confirmados. La carga masiva es solo por archivo (XLSX/CSV). |

## R10. Zona horaria

- **Decisión:** reutilizar `src/lib/bogota.ts`; los timestamps de jobs usan `now()` de PG (timestamptz)
  y las fechas de negocio (`fecha` del mantenimiento) se guardan como date puro ya normalizado, sin
  el hack de restar 5 horas del legacy (`getColombiaDate`), que corrompe el instante real.
- **Racional:** el hack legacy genera timestamps falsos (UTC-5 aplicado a mano sobre un Date UTC);
  el 003 ya resolvió esto en 001-004 con timestamptz + helpers Bogotá.
- **Alternativas:** replicar el offset manual — descartado explícitamente (bug conocido, no paridad
  deseable).

## R11. Guard de permisos por módulo (D-017/D-018, dentro de 005-A)

- **Decisión:** lib compartida `src/lib/guard-modulos.ts` (`requiereModulo(usuarioId, modulo)`)
  construida sobre `src/lib/modulos.ts` (`cargarModulos`, hoy solo alimenta el menú vía login/me/
  dashboard), aplicada **explícitamente en cada endpoint de operación** junto a `verifyAuth`:
  mantenimientos (todos), despachos (módulo **Salidas**) y llegadas (módulo **Llegadas**). Usuario
  sin el módulo → **403**. Seed con los **7 módulos asignables** (D-018): Usuarios, Novedades,
  Mantenimientos, Autorizaciones, Alistamientos, Salidas, Llegadas.
- **Racional:** en el legacy `VerificarModulo` está registrado (`start/kernel.ts:48`) pero aplicado a
  CERO rutas (I-09): el permiso es decorado de menú y un operador puede invocar por API módulos no
  habilitados. La cascada de permisos es regla de negocio central (§10.1) y se corrige ahora para no
  retrofitear 005-008. El manual solo tiene 5 módulos asignables; SICOV necesita 7 (§10.9, D-018).
- **Alternativas:** middleware global de Next — descartado: menos explícito, difícil de testear por
  endpoint y de excluir rutas públicas; retrofit después — descartado por mandato del gate.

## R12. `luxon` como dependencia de parsing (menor del gate, resuelto)

- **Decisión:** añadir **`luxon` ^3** (prod, cero dependencias) + `@types/luxon` (dev). Los
  normalizadores de fecha/hora del legacy usan luxon con ~14 formatos (`fromISO`, `fromFormat` ×
  dd/MM/yyyy, MM/dd/yyyy, dd-MM-yyyy, MM-dd-yyyy, HH:mm(:ss), h:mm(:ss) a, `fromRFC2822`,
  `fromJSDate`, serial de Excel); portarlos con la misma librería garantiza la misma semántica.
  Tests cubren todos los formatos.
- **Racional:** reimplementar a mano ~14 parsers es riesgo de divergencia silenciosa en datos
  regulatorios; luxon ya es la referencia del código fuente que se porta.
- **Alternativas:** reimplementación propia — descartada (más código, menos paridad); `date-fns` —
  descartada (API distinta, misma reescritura).

## R13. Vitest: entorno node para el pipeline de archivos (menor del gate, resuelto)

- **Decisión:** `vitest.config.ts` hoy define `environment: "jsdom"` global y **NO** tiene
  `environmentMatchGlobs` (verificado 2026-07-22). Se añade
  `environmentMatchGlobs: [["src/lib/mantenimientos/**", "node"], ["src/app/api/mantenimientos/**",
  "node"], ["src/app/api/archivos-programas/**", "node"]]` para que exceljs (XLSX **y su lector
  CSV**, misma librería) no resuelva el build de navegador bajo jsdom.
- **Racional:** exceljs publica builds browser/node; bajo jsdom el resolver puede elegir el de
  navegador (sin `fs`/streams), rompiendo tests de forma opaca.
- **Alternativas:** `// @vitest-environment node` por archivo — descartado: frágil, fácil de olvidar
  en tests nuevos.
