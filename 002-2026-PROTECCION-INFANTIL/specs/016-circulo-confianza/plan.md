# Plan de implementación — Spec 016 Círculo de Confianza

> **Fase actual:** EN DISEÑO — esperando revisión de [`diseno.md`](diseno.md) antes de tareas/código.

## Condiciones de aprobación (R1-R7)

1. No se modifica el pipeline de clasificación (R1, R7).
2. No se expone más información que `/api/consulta` para usuario autenticado (R2).
3. El email de notificación es ciego y apagable (R2).
4. Migraciones con `prisma migrate dev` (R4).
5. No se toca `EmbeddingReporte` ni `EmbeddingDataset` (R5).
6. Todo cambio de contacto se audita (R2/R6).
7. Lint, tsc, build, tests y smoke-e2e verdes al cerrar (R6).

## Fases

### 0. Aprobación del diseño
- Revisar y aprobar [`diseno.md`](diseno.md).
- Resolver riesgos de inferencia por resta y confirmar umbrales de agregación.

### 1. Schema y migración
- Crear modelo `ContactoConfianza`.
- Agregar `Usuario.notificacionesCirculo Boolean @default(true)`.
- Agregar valores a `AccionAudit`: `CIRCULO_CONTACT_CREATE`, `CIRCULO_CONTACT_UPDATE`, `CIRCULO_CONTACT_DISABLE`.
- Agregar parámetros a `prisma/seed.ts`:
  - `circulo.max_contactos` (INTEGER, 20)
  - `circulo.notificaciones.enabled` (BOOLEAN, true)
  - `ratelimit.circulo_contacto.window_seconds` (INTEGER, 3600)
  - `ratelimit.circulo_contacto.max_requests` (INTEGER, 20)
- Actualizar `src/lib/reporte-test-utils.ts` si crea parámetros de reporte (no aplica directamente, pero verificar consistencia).

### 2. Backend
- Crear `src/lib/circulo-confianza.ts`:
  - `listarContactos(usuarioId)` con estado resumido.
  - `agregarContacto(usuarioId, identificador, plataformaId, etiqueta)` con validación de tope.
  - `actualizarContacto(id, usuarioId, data)`.
  - `obtenerDetalleContacto(id, usuarioId)` que reutilice la misma lógica de `/api/consulta`.
  - `obtenerVistaAgregada(usuarioId)` para mapas/conteos/timeline.
  - Helpers de estado (sin reportes / en revisión / clasificado).
- Crear endpoints:
  - `GET /api/circulo-confianza`
  - `POST /api/circulo-confianza`
  - `PATCH /api/circulo-confianza/[id]`
  - `GET /api/circulo-confianza/[id]`
  - `GET /api/circulo-confianza/agregado`
  - `PATCH /api/circulo-confianza/preferencias`
- Extender `src/lib/rate-limit.ts` con scope `circulo_contacto`.
- Extender `src/lib/audit.ts` con helpers específicos si hace falta.

### 3. Notificaciones
- Crear `enviarAlertaCirculoConfianza(email: string)` en `src/lib/email.ts`.
- Determinar cambio de estado del círculo: al procesar un reporte, si el identificador+plataforma coincide con algún contacto activo, comparar estado previo vs nuevo y notificar respetando cooldown.
- Cooldown por usuario (no por contacto): `ultimaNotificacionCirculoEn` o consulta a `AuditLog`/`NotificacionEnviada`.

### 4. Frontend
- Crear `src/app/dashboard/circulo-confianza/page.tsx`.
- Reutilizar componentes:
  - `MetricCard`, `MiniList`, `RiskBadge`, `ChartCard`, `BarChart`, `DonutChart`.
- Secciones:
  - Resumen superior (contactos por estado).
  - Lista de contactos con semáforo.
  - Vista agregada con gráficos (restringida a contactos del usuario).
  - Modal/drawer de detalle de contacto.
  - Formulario agregar/editar contacto.
  - Toggle de notificaciones email.
- Enlace al dashboard público general etiquetado como "Panorama nacional".

### 5. Integración con worker
- En el flujo de procesamiento de reportes (`worker-reportes.mjs` o post-clasificación), detectar si el identificador+plataforma pertenece a contactos activos.
- Si cambia el estado agregado del círculo del usuario, encolar/enviar notificación respetando cooldown.

### 6. Tests
- Tests unitarios de `src/lib/circulo-confianza.ts`:
  - Tope de contactos.
  - Estado por contacto (sin reportes, en revisión, clasificado).
  - Vista agregada solo incluye contactos del usuario.
- Tests de endpoints:
  - Rechazo sin autenticación.
  - No acceder a contactos de otro usuario.
  - Rate limit en alta.
- Tests de notificación:
  - Email ciego no contiene identificador ni categoría.
  - Cooldown funciona.
- Smoke E2E: agregar contacto y ver estado.

### 7. Validación y no-regresión
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm test`
- `scripts/smoke-e2e.ts`

### 8. Cierre
- Actualizar `IMPLEMENTATION-REPORT.md`.
- Crear `specs/016-circulo-confianza/reporte-cierre.md`.
- Actualizar `specs/README.md` con estado CERRADA y enlace al reporte.
- Commit + push según regla del runbook.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Auto-vigilancia o scraping de identificadores | Tope de contactos, rate limit, auditoría de altas. |
| Filtración por email | Email ciego sin datos sensibles. |
| Inferencia por resta (círculo pequeño) | Umbrales mínimos de agregación en vista agregada; si no se alcanza, mostrar mensaje de insuficiencia. |
| Fuga de reportes dados de baja | Excluir `eliminado: true` en todas las consultas del círculo. |
| Regresión en consulta pública | No modificar `/api/consulta`; crear endpoints separados. |
| Saturación de notificaciones | Cooldown por usuario y preferencia apagable. |

## Definición de terminado

- Diseño aprobado por el owner.
- Todos los endpoints y UI funcionan.
- Notificación email ciego y apagable.
- Vista agregada respeta umbrales de agregación.
- Tests pasan.
- Lint, tsc, build y smoke verdes.
- Documentación Spec-Kit completa.
