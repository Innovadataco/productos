# Checklist de validación — 013 Consola de APIs (Fase 1)

**Estado**: ✅ COMPLETO · **Fecha**: 2026-07-23 · **Radicado cierre**: 003-SICOV-007

## Estructura y Fase 2
- [X] Catálogo declarativo (constante de código) con 8 operaciones Fase 1 + 006/007/008 pendientes (no ejecutables).
- [X] Cada entrada declara el ejecutor = método real de `ClienteSupertransporte` (mapeo por tabla).
- [X] Único camino: `ejecutarOperacion()` → `getClienteSupertransporte()` (stub por gate). Paso a Fase 2 = encender gate + retirar `FASE_CONSOLA`.

## Doble candado (cero red)
- [X] Gate env (`INTEGRACIONES_MODO=stub` + `SUPERTRANSPORTE_HABILITADO=false`) apagado.
- [X] `FASE_CONSOLA = 1` en código; endpoint real responde 403 fijo; botón UI deshabilitado.
- [X] Test `anti-red`: ninguna ejecución alcanza `*.supertransporte.gov.co`.

## Bitácora (jsonb + redacción recursiva)
- [X] `tbl_api_llamadas` (aditiva, prefijo `apl_`); `request`/`respuesta` en **jsonb** (ZEUS).
- [X] Redacción **RECURSIVA** de sensibles (objetos/arrays anidados → `"***"`) + truncado 8 KB ANTES de persistir; solo nombres de cabecera, nunca valores.
- [X] Registra SIEMPRE (éxito y error); `modo` desde `modoIntegracion()`; paginado 25/100 con filtros.

## Seguridad
- [X] Rol 1 + guard `configuracion/apis`; roles 2/3 → 403.
- [X] Ningún token/clave en BD ni logs.

## Regla de Oro y calidad
- [X] Reinicio limpio compartido (`npm run reiniciar`).
- [X] Set Spec-Kit completo (spec, plan, research, data-model, quickstart, checklists, tasks).
- [X] Tests de la consola verdes dentro de la suite 175/175; `tsc`/`lint`/`build` limpios.
