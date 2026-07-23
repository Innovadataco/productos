# Quickstart — 005-mantenimientos (validación en vivo, modo stub)

> Guía de validación E2E. Prerrequisito: BD 003 levantada (`:5434`) y seed aplicado.
> **Todo corre en modo stub** (`INTEGRACIONES_MODO=stub`): cero llamadas a la Super.

## 1. Preparar

```bash
cd 003-2026-SICOV-OTPC
lsof -i :5010; lsof -i :5434            # verificar puertos propios
npm install                              # instala exceljs + luxon (dependencias nuevas de 005)
mkdir -p "$HOME/003-sicov-datos/uploads" # almacenamiento FUERA de la app (D-022 #2, 005-B)
# .env: ALMACENAMIENTO_DIR=$HOME/003-sicov-datos/uploads
# .env (opcional): COLA_MAX_REINTENTOS=3  COLA_BACKOFF_MIN=5   (D-019b)
npx prisma migrate dev --name add_mantenimientos --create-only   # constitución §1.2
#   → revisar el SQL generado (solo CREATE, aditivo) y luego:
npx prisma migrate dev
npm run db:seed                          # tipos 1-4 + 7 módulos (D-018) + demo
rm -rf .next && npm run dev              # app en :5010
npm run worker                           # worker ÚNICO (3 pasadas: despachos+llegadas+mantenimientos)
```

## 2. Registro individual (US1 — operador)

Con sesión iniciada (cookie) como **operador demo (rol 3)** con el módulo Mantenimientos asignado
(un rol 2 recibe 403 en estos endpoints — §10.2; un usuario sin el módulo, 403 por el guard D-017):

```bash
# Base preventivo (tipoId=1) — respuesta 201 con id externo (stub)
curl -b cookies.txt -X POST localhost:5010/api/mantenimientos \
  -H 'Content-Type: application/json' \
  -d '{"vigiladoId":"900123456","placa":"ABC123","tipoId":1}'

# Detalle preventivo — 201, procesado=true
curl -b cookies.txt -X POST localhost:5010/api/mantenimientos/preventivo \
  -H 'Content-Type: application/json' \
  -d '{"mantenimientoId":<idLocal>,"placa":"ABC123","fecha":"2026-07-20","hora":"08:30","nit":900555444,"razonSocial":"TALLER DEMO","tipoIdentificacion":1,"numeroIdentificacion":"1010","nombresResponsable":"MECANICO DEMO","detalleActividades":"Cambio de aceite"}'
```

Esperado: en BD el base previo de la misma placa+tipo queda `tmt_estado=false`; el nuevo tiene
`tmt_mantenimiento_id` (id externo stub, **columna separada** del `tmt_id` local) y
`tmt_procesado=true`; el detalle conserva `tpv_mantenimiento_id` (enlace local) y guarda el id
stub en **`tpv_mantenimiento_id_externo`** (gate B1). Repetir con `tipoId=2` y `/correctivo`.
Con `tipoId=3` → 400 (alcance 006). Placa `AB123` o `1ABC23` → 400 (regex 3 letras + 3 dígitos).
`hora: "8:75"` o `"24:00"` → 400 (regex de borde D-022 #3).
**Envío inmediato (D-021):** con placa `FAL999` el stub falla → la respuesta indica `encolado`, el
registro NO se pierde y aparece como job `pendiente`.

## 3. Plantilla y carga masiva XLSX/CSV (US2)

```bash
curl -b cookies.txt -o plantilla.xlsx \
  localhost:5010/api/mantenimientos/plantillas/preventivo-correctivo
# Abrir: hoja "mantenimiento" (10 columnas) + hoja "tipos_identificacion" (12 valores D-022)

# Llenar 3 filas válidas y subir:
curl -b cookies.txt -X POST localhost:5010/api/mantenimientos/bulk/preventivo/xlsx \
  -F archivo=@plantilla.xlsx
# → 202 {"total":3,"exitosos":3,"errores":[]}  y 6 jobs (3 base + 3 preventivo) en tbl_mantenimiento_jobs

# Archivo con UNA fila mala (sin nit, o placa que no sea 3 letras+3 dígitos) → TODO-O-NADA (§10.10):
# → 400 {"total":N,"exitosos":0,"errores":["Fila 2: ...","Fila 3: ..."]} y CERO jobs nuevos
#   (nunca un lote parcial: o entran todas las filas o ninguna)

# CSV (formato nuevo D-019e) — mismas columnas de encabezado, mismo pipeline:
printf 'vigiladoId,placa,fecha,hora,nit,razonSocial,tipoIdentificacion,numeroIdentificacion,nombresResponsable,detalleActividades\n900123456,DEF456,2026-07-20,09:15,900555444,TALLER DEMO,1,1010,MECANICO DEMO,Cambio de frenos\n' > carga.csv
curl -b cookies.txt -X POST localhost:5010/api/mantenimientos/bulk/correctivo/csv \
  -F archivo=@carga.csv
# → 202 {"total":1,"exitosos":1,"errores":[]}
```

> La variante JSON (`registros[]`) del legacy NO existe en el 003 (cortada en D-022 #4).

Verificar normalización: una celda fecha en formato Excel (serial) y hora `8:30 AM` deben quedar
`YYYY-MM-DD` y `08:30` en el detalle persistido.

## 4. Cola y worker (US3)

Con el worker corriendo, en segundos los jobs pasan a `procesado` (ver logs `[worker]`), el base
persiste `tmt_mantenimiento_id` y el detalle `procesado=true`.

Dependencia y reintentos:

```bash
# Placa FALLA* fuerza error del stub → el job base reintenta (+5 min) hasta 3 → fallido
# (para no esperar 5 min: UPDATE tmj_siguiente_intento = now() entre pasadas, o usar el test)
curl -b cookies.txt 'localhost:5010/api/mantenimientos/jobs?estado=fallido'
curl -b cookies.txt 'localhost:5010/api/mantenimientos/jobs/fallidos'

# Reintento manual = CORREGIR y reenviar (§10.6): payload corregido, resetea reintentos=0
curl -b cookies.txt -X POST localhost:5010/api/mantenimientos/jobs/<jobId>/reintentar \
  -H 'Content-Type: application/json' \
  -d '{"accion":"actualizar","payload":{"placa":"ABC123"}}'
# → 200; corrige los datos locales, el job vuelve a pendiente con reintentos=0 (ciclo completo nuevo)
```

Esperado adicional: un job detalle cuyo base aún no sincroniza se reprograma +BACKOFF SIN aumentar
`tmj_reintentos` (ver `tmj_ultimo_error` = "mantenimiento base aún no ha sido sincronizado").
**Alcance D-015:** logueado como rol 3, `GET /jobs` devuelve los del NIT del administrador (no cero);
`GET /jobs?nit=<otro>` como rol 2/3 ignora el `nit` (mismos resultados); como rol 1 sí filtra.

## 4b. Envío inmediato en despachos y llegadas (US4 — D-021)

```bash
# Despacho normal → procesado en la MISMA respuesta (sin esperar al worker)
curl -b cookies.txt -X POST localhost:5010/api/integracion/despachos -d '{...payload demo...}'
# → estado "procesado" + id externo (stub)
# Despacho con placa FAL999 → cae a cola: estado "pendiente", el worker lo reintenta
# Ídem llegadas. Con COLA_MAX_REINTENTOS=1 en .env, un FALLA* queda fallido tras 1 intento.
```

## 4c. Guard de módulos (US5 — D-017)

```bash
# Usuario demo SIN el módulo Mantenimientos → 403 en cualquier endpoint del módulo
# Usuario demo sin Salidas → 403 en POST /api/integracion/despachos (ídem Llegadas)
# Con el módulo asignado → 200/201 normal. El menú solo muestra módulos asignados.
```

## 5. Pantalla y PDF del programa (US6 — **005-B**)

En `localhost:5010` (login demo):
1. Menú → Mantenimientos → tabs **Preventivos / Correctivos**.
2. Como rol 2 (cliente): subir un PDF < 4 MB en "PDF del programa" → aparece **como ACTIVO y el
   anterior pasa a Inactivo** (§10.2) → descargar. > 4 MB → 413. Un `.txt` → 400. El rol 2 NO ve el
   formulario de registro individual.
3. Como rol 3 (operador) o rol 1: tabla de **vehículos** (placas stub) con **estado** (preventivo:
   5 estados; correctivo: 3) → "Registrar mantenimiento" (modal, flujo del paso 2; responsable
   rotulado ingeniero/técnico mecánico) → "Historial" (modal con datos stub, filtros).
4. Cargue masivo desde la card: archivo inválido → modal *"Se procesaron N registros. Exitosos: 0.
   Fallidos: Y. Errores a corregir: Z"* + botón **Descargar errores** (`errores_cargue_preventivo.txt`);
   archivo válido → resumen con exitosos.
5. Job fallido en la tabla de sincronización → "Reintentar" abre el registro para **corregir los
   campos** y reenviar.
6. Exportar historial: descarga `Historial.xlsx` (autenticado).

## 6. Gates de calidad (obligatorios antes de commit)

```bash
npm run typecheck && npm run lint && npm run test && npm run build
# 52 tests previos + nuevos de 005 en verde; build limpio (rm -rf .next antes de confiar)
```

## 7. Verificación del guardarraíl

- `grep -r "supertransporte.gov.co" src/` solo debe aparecer en `cliente-http.ts`/config.
- Logs del worker y rutas: nombres de cabecera solamente, nunca valores de tokens.
- `.env` sin credenciales reales; `ALMACENAMIENTO_DIR` apunta FUERA de la app y su carpeta entra en
  la rutina de respaldo (requisito de switch-over, D-022 #2).
