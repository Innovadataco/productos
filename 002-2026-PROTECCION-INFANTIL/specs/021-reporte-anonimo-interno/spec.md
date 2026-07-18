# Spec 021 — Reporte anónimo con sesión interna abierta

> Estado: **EN DISEÑO**.
> Plan: [`plan.md`](plan.md).

## Problema

Un usuario interno (ADMIN/OPERADOR/SCHOOL_ADMIN) logueado no puede enviar un reporte desde `/reportar`. El backend devuelve 403 con el mensaje "Esta función no está disponible para usuarios internos".

## Causa raíz

- `POST /api/reportes` obtiene la cookie de sesión y rechaza cualquier usuario cuyo rol no sea `PARENT`.
- `ReporteWizard` envía siempre `credentials: "include"`, por lo que la cookie interna llega al backend.
- El reporte anónimo puro (sin sesión) funciona correctamente.

## Opciones de solución

### Opción A — Tratar `/reportar` como anónimo para roles no-PARENT

Ignorar la cookie interna en `POST /api/reportes` cuando el endpoint se usa desde el wizard público. El reporte se crea con `esAnonimo=true` y `usuarioId=null`, igual que si no hubiera sesión.

- ✅ Mantiene el flujo de prueba sin fricción para el dueño/equipo.
- ✅ No rompe el anónimo puro.
- ⚠️ Riesgo menor de conflicto de intereses si un operador gestiona después un caso que reportó; mitigable con auditoría.

### Opción B — Bloquear en el frontend con mensaje claro

Mantener el 403 en el backend pero detectar la sesión interna en `ReporteWizard` y mostrar un mensaje explicativo con opción de cerrar sesión.

- ✅ Más explícito para producción.
- ⚠️ Fricción para pruebas: obliga a cerrar sesión.
- ⚠️ El 403 sigue siendo posible por API directa.

## Recomendación

**Opción A**, porque `/reportar` es por diseño un flujo anónimo público; la cookie interna no debería cambiar la naturaleza del reporte. Se puede registrar en `AuditLog` o en logs que la petición vino de una sesión interna pero se trató como anónima, preservando trazabilidad sin bloquear.

## Restricciones

- No tocar el pipeline de clasificación.
- No tocar rate-limiting.
- El anónimo puro (sin sesión) debe seguir funcionando intacto.

## R7

No aplica: no toca el pipeline de clasificación.
