> DEPENDE DE: SPEC-201 (motor de notificaciones núcleo).

# Plan de implementación: SPEC-202 — Panel Admin del Motor de Notificaciones (002-PI-099)

## Resumen

Construir el panel de administración del motor de notificaciones como sección de `/dashboard/admin/configuracion` (plantillas, reglas, parámetros, bandeja) y tab de salud en `/dashboard/admin/estadisticas` o `/dashboard/admin/monitoreo`. Exponer endpoints admin y webhook Resend idempotente.

## Cambios de código

### 1. Rutas admin

#### 1.1 `src/app/api/admin/notificaciones/route.ts`

`GET` listado paginado de `Notificacion` con filtros. Respuesta `{ items, pagination }`.

#### 1.2 `src/app/api/admin/notificaciones/plantillas/route.ts`

`GET` listado, `POST` crear plantilla.

#### 1.3 `src/app/api/admin/notificaciones/plantillas/[id]/route.ts`

`GET`, `PATCH`, `DELETE` por plantilla.

#### 1.4 `src/app/api/admin/notificaciones/plantillas/[id]/preview/route.ts`

`POST` con variables de ejemplo; devuelve `{ asuntoRenderizado, cuerpoRenderizado }`.

#### 1.5 `src/app/api/admin/notificaciones/reglas/route.ts`

`GET` listado, `POST` crear regla.

#### 1.6 `src/app/api/admin/notificaciones/reglas/[id]/route.ts`

`GET`, `PATCH`, `DELETE`.

#### 1.7 `src/app/api/admin/notificaciones/reglas/[id]/recalcular/route.ts`

`POST`: confirma recálculo y llama a `motor.recalcular({ evento, motivo })`.

#### 1.8 `src/app/api/admin/notificaciones/parametros/route.ts`

`GET` lista parámetros con prefijo `notificaciones.*`. `PATCH` actualiza valor(s) con validación.

#### 1.9 `src/app/api/admin/notificaciones/salud/route.ts`

`GET`: métricas por estado, volumen 24h, bounces, estado worker (heartbeat).

#### 1.10 `src/app/api/webhooks/resend/route.ts`

`POST`: parsear payload Resend, mapear eventos, actualizar `Notificacion` y `NotificacionContactoBloqueado`. Idempotente por `proveedorId`.

### 2. Repositorios/servicios

#### 2.1 `src/lib/dal/repositories/notificacion.ts`

Queries paginadas, filtros tipados (`Prisma.NotificacionWhereInput`), conteos por estado.

#### 2.2 `src/lib/dal/repositories/notificacion-plantilla.ts`

CRUD de plantillas con manejo de versiones.

#### 2.3 `src/lib/dal/repositories/notificacion-regla.ts`

CRUD de reglas.

#### 2.4 `src/lib/admin/notificaciones/metricas.ts`

Agregaciones de salud del motor.

### 3. Componentes UI

#### 3.1 `src/components/modules/admin/notificaciones/NotificacionesAdminSection.tsx`

Punto de entrada de la sección con tabs internos: Bandeja, Plantillas, Reglas, Parámetros.

#### 3.2 `src/components/modules/admin/notificaciones/BandejaNotificaciones.tsx`

Tabla con filtros y paginación.

#### 3.3 `src/components/modules/admin/notificaciones/EditorPlantilla.tsx`

Formulario + preview en vivo.

#### 3.4 `src/components/modules/admin/notificaciones/EditorRegla.tsx`

Formulario con confirmación de recálculo al guardar cambios de offset/canal/activa.

#### 3.5 `src/components/modules/admin/notificaciones/ParametrosMotor.tsx`

Edición de parámetros `notificaciones.*`.

#### 3.6 `src/components/modules/admin/notificaciones/SaludMotorTab.tsx`

Métricas y lista de contactos bloqueados.

### 4. Navegación

#### 4.1 `src/lib/nav-items.ts` / `AdminNav.tsx`

Agregar enlace "Notificaciones" bajo Configuración y tab "Salud motor" bajo Estadísticas/Monitoreo. Verificar que `proxy()` permita las rutas para `ADMIN`.

### 5. Tests

- `src/app/api/admin/notificaciones/**/route.test.ts`
- `src/app/api/webhooks/resend/route.test.ts`
- Tests de componentes críticos (editor de plantilla, recálculo).

### 6. Documentación

- `specs/202-panel-admin-motor-notificaciones/quickstart.md`
- `specs/202-panel-admin-motor-notificaciones/data-model.md` (nota: no hay cambios de schema, solo uso de modelos de SPEC-201).

## Gate de calidad

- `npx tsc --noEmit`
- `npm run lint -- --no-cache`
- `npm run arch:check`
- `npm run test:unit`
- `npm run test:integration`
- `npm run build`
- CI verde 6/6.
