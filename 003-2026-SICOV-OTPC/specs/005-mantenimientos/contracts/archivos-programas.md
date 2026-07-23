# Contrato — Archivos de programa de mantenimiento (PDF) — **005-B**

> **Partición D-016: este contrato completo pertenece a 005-B** (pantalla + programa PDF).
> Paridad con `ruta_archivo_programa.ts` + `ControladorArchivosProgramas` del legacy (api/v1, JWT)
> y **§10.2 del manual**: este es el lado del **CLIENTE (rol 2)** del módulo mantenimientos — el
> cliente gestiona el PDF del PROGRAMA y **no registra** mantenimientos individuales.
> Todos los endpoints llevan además el guard de módulo `Mantenimientos` (D-017).
> El legacy delega el binario en un servicio de archivos externo; el 003 lo persiste localmente
> **detrás de la interfaz de almacenamiento** `src/lib/almacenamiento.ts`
> (`guardarArchivo`/`leerArchivo`) con raíz en **`ALMACENAMIENTO_DIR` (env obligatoria, FUERA del
> directorio de la app)** — condiciones D-022 #2; ver research R7. El respaldo de esa carpeta es
> requisito del switch-over. Se mantiene el contrato de datos de `tbl_archivo_programas`.

## POST /api/archivos-programas  (multipart)
Roles **1 y 2** (la card del programa es de la empresa; paridad UI legacy).
Campos: `archivo` (PDF), `tipoId` (1=preventivo, 2=correctivo; el 3 llega con la 006).
Validación:
- `tipoId` requerido y ∈ {1,2} → 400 si no.
- Solo `application/pdf` / extensión `.pdf` → 400.
- Tamaño ≤ **4 MB** → **413** si excede (constitución §4.4).
Proceso: `guardarArchivo("programas", nombreOriginal, buffer)` (interfaz de almacenamiento; físico:
`ALMACENAMIENTO_DIR/programas/<uuid>.pdf`) → **desactivar los archivos anteriores del mismo
vigilado+tipo (`tap_estado=false`) — el último cargado queda ACTIVO (§10.2)** → insertar en
`tbl_archivo_programas` (`nombreOriginal`, `documento` = nombre físico, `ruta` relativa a la raíz,
`tipoId`, `usuarioId` = id del usuario efectivo, `estado=true`).
**201** `{ id, nombreOriginal, tipoId, creado }`.

## GET /api/archivos-programas?tipoId=1|2
Roles 1,2,3. 400 sin `tipoId`. Lista los archivos del vigilado efectivo — alcance **D-015
server-side** (roles 2/3 atados a su NIT efectivo; solo rol 1 puede pasar `vigiladoId`):
`[{ id, nombreOriginal, documento, ruta, fecha, estado }]` (el activo primero).
404 con `{ mensaje: "No se encontraron archivos" }` si vacío (paridad legacy).

## GET /api/archivos-programas/[id]/descargar
Roles 1,2,3 (solo archivos del propio vigilado; rol 1 todo). Streaming del PDF con
`Content-Type: application/pdf` y `Content-Disposition: attachment; filename=<nombreOriginal>`.
404 si no existe registro o archivo físico.

## Notas
- `ALMACENAMIENTO_DIR` vive FUERA del repo/app (ejemplo en `.env.example`:
  `$HOME/003-sicov-datos/uploads`); nunca se commitean binarios.
- La descarga usa `leerArchivo(ruta)` — cambiar a S3/servicio externo solo reimplementa la interfaz.
- Ningún endpoint expone rutas absolutas del filesystem.
- **Switch-over:** incluir la carpeta de `ALMACENAMIENTO_DIR` en la rutina de respaldo (junto al
  `pg_dump`) — requisito D-022 #2.
