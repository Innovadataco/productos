# SPEC-591 · Plan — Reportar atado a hijo/familiar

Ver `spec.md` (decisión CEO, FR-001–FR-005) y `tasks.md` (fases y tareas).

## Contexto y decisión

Decisión EXACTA del CEO (Jelkin, 06-09-2026): **«el padre que está autenticado SOLO puede reportar situaciones de sus hijos; si quiere anónimo, cierra sesión y reporta»**. Hoy cualquier padre autenticado reporta cualquier situación sin relación con sus fichas «A quién protego» (SPEC-325). El modelo `Hijo` ES la ficha de hijos/familiares — no hay otro modelo.

## Enfoque técnico

- **Migración 100 % aditiva** (`spec591_reporte_atado_a_hijo`): `Reporte.hijoId String?` + relación a `Hijo` + `@@index([hijoId])`. **FK `onDelete: SetNull` deliberado**: el reporte es evidencia; borrar o inactivar la ficha del padre NO puede destruir evidencia existente — el reporte sobrevive desvinculado.
- **Regla SIEMPRE en el servidor** (`resolverHijoDelReporte` en `src/app/api/reportes/route.ts`, único lugar):
  - Sesión PARENT → `hijoId` OBLIGATORIO: 400 «Elige a quién va dirigido el reporte.» si falta; 403 único (no distingue existencia, para no enumerar fichas ajenas) si no es suya; 409 si es suya pero inactiva.
  - Anónimo → `hijoId` PROHIBIDO: 400 «Los reportes anónimos no pueden vincularse a una ficha.»
  - La resolución corre ANTES de los rate limits: un 400/403 claro no gasta cuota.
  - Titularidad acotada en el DAL (`obtenerHijoDePadre`, regla del módulo padre: todo query de Hijo filtra por `usuarioId` del dueño).
- **Pipeline**: `ReporteCreationService.crear` y `crearReporteConTexto` reciben el vínculo; worker, clasificación y dedup no cambian.
- **Wizard**: paso inicial «¿A quién va dirigido?» SOLO en modo autenticado (lista de fichas ACTIVAS vía GET `/api/padre/hijos` existente; sin selección el Siguiente sigue deshabilitado). En anónimo el flujo queda idéntico (misma numeración de pasos de antes). Sin fichas activas: empty state que enlaza a registrar y recuerda la opción anónima. La selección viaja en el borrador de sessionStorage.
- **Visualización**: «dirigido a …» en cada evento de las tarjetas de «Mis reportes» y «Dirigido a …» en el detalle privado (`hijoNombre` en los DTOs de cadenas, listado y detalle).

## Riesgos y mitigaciones

- **Tests y specs que postean como padre quedan rotos**: es la consecuencia esperada del candado — cada setup crea una ficha activa y envía `hijoId` (nunca se relajan aserciones). El barrido completo de setups es parte de las tareas.
- **Enumeración de fichas ajenas**: 403 único para «no existe / no es tuya»; el 409 de inactiva solo se devuelve tras confirmar titularidad.
- **Borrado de ficha vs evidencia**: SetNull documentado en schema; nada en el producto inactiva fichas por su cuenta.
- **Flujos internos** (simulador de abuso, seeds): no pasan por la ruta pública y quedan desvinculados — decisión deliberada, documentada en spec.md.
