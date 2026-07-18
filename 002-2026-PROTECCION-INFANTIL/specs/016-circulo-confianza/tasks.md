# Tareas — Spec 016 Círculo de Confianza

> Diseño aprobado el 2026-07-18.

## T1 — Schema, migración y seed

- [ ] Agregar modelo `ContactoConfianza` en `prisma/schema.prisma`.
- [ ] Agregar `Usuario.notificacionesCirculo Boolean @default(true)`.
- [ ] Agregar acciones de audit `CIRCULO_CONTACT_CREATE`, `CIRCULO_CONTACT_UPDATE`, `CIRCULO_CONTACT_DISABLE`.
- [ ] Crear migración con `prisma migrate dev`.
- [ ] Agregar parámetros a `prisma/seed.ts`:
  - `circulo.max_contactos` = 20
  - `circulo.umbral_agregacion` = JSON `{ "contactosConReportes": 2, "totalReportes": 3 }`
  - `circulo.notificaciones.enabled` = true
  - `circulo.notificaciones.cooldown_horas` = 24
  - `ratelimit.circulo_contacto.window_seconds` = 3600
  - `ratelimit.circulo_contacto.max_requests` = 20
- [ ] Actualizar `src/lib/reporte-test-utils.ts` si es necesario.

## T2 — Backend core

- [ ] Crear `src/lib/circulo-confianza.ts` con funciones:
  - `listarContactos(usuarioId)` — contactos con estado resumido.
  - `agregarContacto(...)` — valida tope de activos, valida plataforma, audita.
  - `actualizarContacto(id, usuarioId, data)` — etiqueta/activo.
  - `obtenerDetalleContacto(id, usuarioId)` — reutiliza lógica de consulta pública.
  - `obtenerVistaAgregada(usuarioId)` — agregados con umbral configurable.
  - Helpers de estado (`sinReportes`, `enRevision`, `clasificado`).
- [ ] Extender `src/lib/rate-limit.ts` con scope `circulo_contacto`.
- [ ] Extender `src/lib/audit.ts` con helpers de circulo si hace falta.

## T3 — API routes

- [ ] `GET /api/circulo-confianza` — lista contactos + resumen.
- [ ] `POST /api/circulo-confianza` — agregar contacto (rate limit).
- [ ] `PATCH /api/circulo-confianza/[id]` — editar/inhabilitar.
- [ ] `GET /api/circulo-confianza/[id]` — detalle del contacto.
- [ ] `GET /api/circulo-confianza/agregado` — vista agregada.
- [ ] `PATCH /api/circulo-confianza/preferencias` — toggle notificaciones.

## T4 — Notificaciones

- [ ] Crear `enviarAlertaCirculoConfianza(email)` en `src/lib/email.ts`.
- [ ] Detectar cambio de estado del círculo al procesar reportes.
- [ ] Respetar cooldown configurable y preferencia del usuario.
- [ ] Verificar que el email sea ciego (sin identificador, categoría, fecha, ciudad).

## T5 — Frontend

- [ ] Crear `src/app/dashboard/circulo-confianza/page.tsx`.
- [ ] Reutilizar `MetricCard`, `MiniList`, `RiskBadge`, `ChartCard`, `BarChart`, `DonutChart`.
- [ ] Secciones: resumen, lista de contactos, detalle, vista agregada, formulario, preferencias.
- [ ] Enlace al dashboard público general etiquetado como "Panorama nacional".

## T6 — Tests

- [ ] Tests unitarios de `src/lib/circulo-confianza.ts`.
- [ ] Tests de endpoints (auth, propiedad, rate limit, tope).
- [ ] Tests de notificación ciega y cooldown.
- [ ] Smoke E2E: agregar contacto y ver estado.

## T7 — Verificación final

- [ ] `npm run lint` ✅
- [ ] `npx tsc --noEmit` ✅
- [ ] `npm run build` ✅
- [ ] `npm test` ✅
- [ ] `scripts/smoke-e2e.ts` ✅
- [ ] Verificar que R7 no aplica (no se tocó pipeline de clasificación).

## T8 — Cierre

- [ ] Crear `specs/016-circulo-confianza/reporte-cierre.md`.
- [ ] Actualizar `specs/README.md` con Spec 016 en estado CERRADA.
- [ ] Actualizar `IMPLEMENTATION-REPORT.md` si aplica.
- [ ] Commit + push con mensajes descriptivos.
