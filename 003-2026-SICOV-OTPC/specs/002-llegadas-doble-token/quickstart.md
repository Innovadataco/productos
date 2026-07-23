# Quickstart — 002-llegadas-doble-token (validación en vivo, modo stub)

> Artefacto completado retroactivamente (I-11, 2026-07-23). Refleja el comportamiento VIGENTE
> (incluye el delta D-021 de 005-A: envío inmediato + guard de módulo `llegadas`).

## 1. Preparar

```bash
cd 003-2026-SICOV-OTPC
npm run db:seed && rm -rf .next && npm run dev   # :5010
npm run worker                                    # worker único (3 pasadas)
```

## 2. Registrar una llegada (envío inmediato)

Con sesión de `vigilado` (rol 2, módulo Llegadas asignado):

```bash
# Tipo 2 (sin salida previa): idDespacho debe ser null
curl -b cookies.txt -X POST localhost:5010/api/integracion/llegadas \
  -H 'Content-Type: application/json' \
  -d '{"placa":"ABC123","idTipollegada":"2","nitEmpresaTransporte":"900853057","terminalLlegada":"Terminal Medellín","fechaLlegada":"2026-07-23","horaLlegada":"12:00","numeroPasajero":"0","sede":"0"}'
# → 202 {"solicitudId":N,"estado":"procesado","idLlegadaExterno":<id stub>}  (inmediato, sin worker)

# Tipo 1 exige idDespacho; tipo 2 con idDespacho → 400.
# Placa FALLA1 → 202 {"estado":"pendiente"} (caída a cola; el worker la reintenta).
```

## 3. Listado, reintento y alcance

```bash
curl -b cookies.txt 'localhost:5010/api/integracion/llegadas?page=1&pageSize=10'
# rol 2/3: solo su NIT efectivo; rol 1: todo.
curl -b cookies.txt -X POST localhost:5010/api/llegadas/<id>/reintentar
# → resetea reintentos=0 (ciclo completo nuevo)
```

## 4. Guard de módulo (D-017)

Un usuario sin el módulo Llegadas recibe **403** en POST/GET/reintentar aunque esté autenticado.

## 5. Gates

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

## 6. Guardarraíl

Modo stub por defecto: cero peticiones a `*.supertransporte.gov.co`; logs solo con nombres de
cabecera.
