# Quickstart — 013 Consola de APIs (Fase 1: stub + logging)

**Objetivo**: humo de la consola de APIs (rol 1): ejecutar una operación contra el **stub**, ver la
bitácora y confirmar el **doble candado** (botón real deshabilitado + endpoint real 403). Cero red.

## 0. Reinicio limpio

```bash
npm run reiniciar    # mata server 003 por cwd, rm -rf .next, prisma generate, migrate deploy, healthcheck /login 200
```

## 1. Humo en navegador (ventana privada)

1. Login `admin` / `Admin123!` → **Configuración → APIs**.
2. Elegir una operación (p. ej. *Reportar despacho*) → el formulario trae un ejemplo editable.
3. **Ejecutar (stub)** → aparece respuesta + duración + `modo=stub`; la fila cae en la **Bitácora**.
4. El botón **Ejecutar en real** está **deshabilitado** con la nota "Fase 2 — requiere habilitación del CEO".

## 2. Humo por API

```bash
# catálogo (rol 1 + guard configuracion/apis)
curl -s -b cookie.txt http://localhost:5010/api/configuracion/apis/catalogo | head

# ejecutar contra el stub → registra en bitácora, modo=stub
curl -s -b cookie.txt -X POST http://localhost:5010/api/configuracion/apis/ejecutar \
  -H 'Content-Type: application/json' -d '{"operacion":"despachos","payload":{"obj_despacho":{}}}'

# el "ejecutar en real" responde 403 fijo (Fase 1)
curl -s -o /dev/null -w '%{http_code}\n' -b cookie.txt -X POST http://localhost:5010/api/configuracion/apis/ejecutar \
  -H 'Content-Type: application/json' -d '{"operacion":"despachos","payload":{},"real":true}'   # → 403

# bitácora paginada con filtros
curl -s -b cookie.txt "http://localhost:5010/api/configuracion/apis/llamadas?modo=stub&pageSize=25" | head
```

## 3. Garantías verificadas

- **Cero red**: todo por `getClienteSupertransporte()` (stub por el gate apagado). Test `anti-red`.
- **Doble candado**: gate env (`INTEGRACIONES_MODO=stub` + `SUPERTRANSPORTE_HABILITADO=false`) + `FASE_CONSOLA=1` en código; el endpoint real responde 403.
- **Redacción RECURSIVA** de sensibles (objetos/arrays anidados → `"***"`) + truncado 8 KB antes de persistir en `tbl_api_llamadas` (columnas **jsonb**).

## 4. Pruebas

```bash
npm test -- src/lib/consola-apis/   # catálogo, ejecutar (stub, registro éxito/error), redacción recursiva, anti-red
```

## 5. Paso a Fase 2

Encender el gate (decisión EXPLÍCITA del CEO) **y** retirar `FASE_CONSOLA` — sin reestructurar
consola ni bitácora (las filas reales caen en la MISMA tabla con el mismo esquema, `modo=real`).
