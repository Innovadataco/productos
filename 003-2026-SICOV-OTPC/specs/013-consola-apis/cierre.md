# Cierre — 013 Consola de APIs (Fase 1)

**Estado**: ✅ IMPLEMENTADO · **Fecha**: 2026-07-23 · **Radicado**: 003-SICOV-007

## Alcance entregado

- **Catálogo declarativo** (`src/lib/consola-apis/catalogo.ts`): 8 operaciones Fase 1 + 006/007/008
  pendientes; `FASE_CONSOLA=1`; mapeo ejecutor→método real de `ClienteSupertransporte`.
- **Ejecución SOLO stub** (`ejecutar.ts`): único camino `getClienteSupertransporte()` (stub por gate);
  cronometra, redacta y REGISTRA siempre (éxito/error). Doble candado: `body.real=true` → 403.
- **Bitácora** `tbl_api_llamadas` (aditiva, **jsonb**): redacción **RECURSIVA** de sensibles +
  truncado 8 KB antes de persistir; listado paginado 25/100 con filtros.
- **UI** `/dashboard/configuracion/apis`: lista + formulario + resultado + bitácora; botón "Ejecutar
  en real" deshabilitado ("Fase 2").

## Evidencia

- **Tests**: consola verde dentro de 175/175 — catálogo, ejecutar (stub, registro éxito/error, cero
  red), redacción recursiva (anidados), anti-red. `tsc`/`lint`/`build` limpios.
- **Verificación**: `GET /api/configuracion/apis/catalogo` 200 (rol 1); `POST …/ejecutar` con
  `real:true` → **403**; ejecución stub registra en bitácora con `modo=stub`.
- Commit: `a103ed0a` + cierre 007.

## Deuda técnica

- Purga/retención y exportación de la bitácora (Fase 1 sin purga; volumen bajo, solo rol 1).
- `route.test.ts` de la bitácora no creado (convención del repo: tests de servicio); lógica cubierta
  por `bitacora.ts` + `ejecutar.test.ts` + paginación.

## Paso a Fase 2

Encender el gate (decisión EXPLÍCITA del CEO) **y** retirar `FASE_CONSOLA`; sin reestructurar consola
ni bitácora — las filas reales caen en la MISMA tabla (`modo=real`).
