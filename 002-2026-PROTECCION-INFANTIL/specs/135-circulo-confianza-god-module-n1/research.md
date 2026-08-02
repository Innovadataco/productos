# Research: SPEC-135 — reverificación en fuente (2026-08-01)

## Tamaño y estructura

`src/lib/dal/services/circulo-confianza.ts`: **864 líneas exactas** (el conteo de julio
no cambió tras 051-056). 17 símbolos exportados en 5 responsabilidades:

- Estado: `calcularEstado`, `determinarEstadoContacto`, `whereReportesCirculo`,
  `contarContactosActivos`, `obtenerTopeContactos`, `obtenerUmbralAgregacion`.
- Contactos: `listarContactos`, `agregarContacto`, `actualizarContacto` (313-445: la
  función más larga), `obtenerDetalleContacto`.
- Agregado: `obtenerVistaAgregada` (585-708), `construirAgregado`.
- Preferencias: `toggleNotificacionesCirculo`, `obtenerPreferenciasCirculo`.
- Notificaciones: `notificarCambioCirculoSiCorresponde` (734-864).

## N+1 verificado (línea:columna)

`listarContactos` (159-164): `Promise.all(contactos.map(c => determinarEstadoContacto(c.id)))`
→ por contacto, `determinarEstadoContacto` (103-130) hace `identificadorContacto.findMany`
+ `reporte.findMany` = **2N queries** tras la inicial. La query inicial (147-157) YA
incluye los identificadores por contacto: la segunda query por contacto es redundante y
la de reportes se puede unificar en una (`identificador: { in: todosLosValores }`).

`obtenerVistaAgregada` (588-607): junta valores en una pasada — sin N+1 evidente en la
recolección; verificar el resto del cuerpo en implementación.

`notificarCambioCirculoSiCorresponde` (734+): revisar si el loop es de queries (N+1) o
de envíos de email (legítimo, se documenta).

## Consumidores (no se tocan)

`api/circulo-confianza/route.ts`, `[id]/route.ts`, `agregado/route.ts`,
`preferencias/route.ts`, `dashboard/circulo-confianza/page.tsx`, `dashboard/layout.tsx`,
`email.ts`, `docs/indice.ts`, `e2e/mock-headers.ts`, `NavHeader.tsx`.

## Red de tests

`circulo-confianza.test.ts` (423 L) + `api/circulo-confianza/route.test.ts` + journey
padre (círculo: alta + lista). El tope de contactos (`obtenerTopeContactos`) acota el N
real, pero el patrón N+1 es lo que E-2 erradica.
