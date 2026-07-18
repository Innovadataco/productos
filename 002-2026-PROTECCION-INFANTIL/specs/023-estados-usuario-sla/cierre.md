# Cierre — Spec 023: Estados de cara al usuario + SLA visible

## Resumen de implementación

Se implementó la simplificación de estados de reporte para el usuario final:
- Dos estados visibles: **En proceso** y **Procesado**.
- Estados internos (`PENDIENTE`, `PROCESANDO`, `REVISION_MANUAL`, `POSIBLE_SPAM`, `REQUIERE_ANONIMIZACION`, `CLASIFICADO`, `CORREGIDO`, `DUPLICADO`) se mantienen sin cambios en el backend y en las bandejas de operador/admin/comité.
- Se filtran los reportes con `eliminado = true` en las vistas de usuario final (`/seguimiento`, `/mis-reportes`).
- Se expone un SLA configurable (`ui.sla_horas_procesamiento`) en los mensajes de estado "En proceso".

## Archivos tocados

- `src/lib/reporte-estados-usuario.ts` (nuevo) — helper puro `mapEstadoUsuario`, `getMensajeUsuario`, `parseSlaHoras`.
- `src/lib/reporte-estados-usuario.test.ts` (nuevo) — tests unitarios del helper.
- `prisma/seed.ts` — upsert del parámetro `ui.sla_horas_procesamiento` (INTEGER, SYSTEM, default 24).
- `src/lib/reporte-test-utils.ts` — incluye el parámetro en `crearParametrosReportes`.
- `src/app/api/reportes/seguimiento/[numero]/route.ts` — filtra `eliminado=false`, retorna `estadoVisual`, `estadoInterno`, `badge`, `enProceso`, `mensaje`, `slaHoras`.
- `src/app/api/reportes/mis-reportes/route.ts` — filtra `eliminado=false`, retorna `estadoVisual`, `badge`, `mensaje`, `slaHoras`.
- `src/app/api/reportes/seguimiento/[numero]/route.test.ts` — tests de mapeo, eliminado, SLA.
- `src/app/api/reportes/mis-reportes/route.test.ts` (nuevo) — tests de filtrado, mapeo y SLA.
- `src/components/modules/SeguimientoClient.tsx` — usa `estadoVisual` y `badge` del backend.
- `src/components/modules/SeguimientoClient.test.tsx` — mocks actualizados al nuevo contrato.
- `src/components/modules/MisReportesList.tsx` — muestra `estadoVisual`, `badge` y `mensaje` con SLA.
- `src/app/mis-reportes/page.tsx` — tipado actualizado.
- `src/components/modules/ConfigPanel.tsx` — nueva sección "Interfaz de usuario" para parámetros `ui.`.

## Decisiones

- `DUPLICADO` se muestra como "Procesado" con badge `muted` para no confundirlo con un procesamiento exitoso.
- El mensaje para estados en proceso es: `"Tu reporte está en proceso — puede tardar hasta N horas"`.
- El mensaje para `CLASIFICADO`, `CORREGIDO` y `DUPLICADO` es específico y no incluye SLA.
- Los estados internos se siguen viendo en el panel de operación/admin/comité; no se aplica el mapeo visual allí.
- No se requirió migración de schema; el parámetro se crea por seed/upsert.

## Resultados de verificación

- `npx tsc --noEmit`: ✅ sin errores.
- `npm run lint`: ✅ sin errores (1 warning preexistente en `src/lib/sms.ts` no relacionado con esta spec).
- `npm run build`: ✅ compilación exitosa.
- `npm run test`: ✅ 329 tests pasaron, 64 archivos de test.
- `npm run smoke-e2e`: no existe en `package.json`.

## Hash de referencia del commit de implementación

`a441c42`

## Decisiones pendientes / notas

- Ninguna decisión pendiente. La spec queda implementada según los contratos.
- Se recomienda ejecutar `npm run db:seed` en ambientes que ya tengan la base creada para que el parámetro aparezca.
