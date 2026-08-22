# Implementation Plan: SPEC-239 — Escalación ROJO + SLA 12h + Contacto emergencia

**Branch**: `work/002-pi-padre-lote-core` | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)

---

## Summary

Añadir modelo `ContactoEmergencia` (administrado por padres), extender el DAL de expedientes con `marcarEscaladoRojo()`, implementar el handler de `expediente.gravedad.subio_a_rojo` que fija SLA 12h y alerta admin/CEO, exponer `POST /api/admin/comite/expediente/[id]/activar-emergencia` para que el comité notifique al contacto prioritario, extender el worker `pi-expediente-motor` para detectar SLA vencidos, y añadir el botón de emergencia en la vista de consolidación del comité (SPEC-237).

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Next.js 16.2.10 App Router, Prisma 5.22.0, pg-boss, Resend |
| **Storage** | PostgreSQL 16 — migración ADITIVA (`ContactoEmergencia` + enum audit + parámetros) |
| **Testing** | Vitest integration para endpoints/servicios/repositorios; unit para helpers |
| **Procesos** | Worker `pi-expediente-motor` de SPEC-236/D-72, extendido en esta spec |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto | ✅ Pass | Contactos almacenan texto plano; notificaciones usan plantillas de texto |
| §1.3 Presunción de inocencia | ✅ Pass | Las notificaciones describen el expediente, no emiten veredictos |
| §1.6 Disputas | ✅ Pass | No se modifica texto original del reporte; contactos son del padre |
| §2.1 Stack heredado | ✅ Pass | Next.js + Prisma + JWT manual; no cambios de stack |
| §3.2 Tipado Prisma | ✅ Pass | Filtros dinámicos tipados; sin `any` |
| §3.4 Errores API | ✅ Pass | Códigos canónicos; sin stack traces |
| §3.5 Logs y auditoría | ✅ Pass | Toda mutación crítica genera `AuditLog` |
| I-22 No secretos | ✅ Pass | Ningún valor secreto en docs ni specs |
| I-49 Migraciones aditivas | ✅ Pass | Solo añade `ContactoEmergencia`, enum audit y parámetros |
| Q-3 Frontera DAL | ✅ Pass | Todo acceso a BD pasa por repositorios DAL |

---

## Estado actual (verificado en fuente)

- **Usuario / Auth**: `RolUsuario` incluye `PARENT` y `COMITE_VALIDACION`; `verifyAuth` en `src/lib/auth.ts` es la fuente de verdad.
- **DAL**: patrón establecido en `src/lib/dal/repositories/` (reporte, solicitud-comite, usuario, etc.).
- **Motor de Estados**: entregado por SPEC-236 (planificado en rama actual). Publica eventos como `expediente.gravedad.subio_a_rojo` y expone el worker `pi-expediente-motor`.
- **Motor Notif**: servicio consumible con función `programar()` (entregado por SPEC-236). Esta spec solo añade catálogo/plantillas.
- **Vista comité**: `/admin/comite/consolidacion/[id]` es construida por SPEC-237; esta spec añade el botón y modal.
- **Audit**: `src/lib/audit.ts` con `logAudit`; `AccionAudit` se extiende aditivamente.
- **Validación E.164**: helper existente (o se añade si aún no existe) reutilizado por reportes y acudientes.
- **Seed**: `prisma/seed.ts` tiene patrón idempotente para parámetros y catálogos.

---

## Diseño por fase

### Fase 1 — Migración, seed y repositorios base

**Migración aditiva** (nombre tentativo `20260822010000_spec_239_contacto_emergencia`):

```text
model ContactoEmergencia {
  id             String   @id @default(cuid())
  padreUsuarioId String
  nombre         String
  relacion       String // MADRE | PADRE | TUTOR | HERMANO | OTRO
  telefono       String
  email          String?
  prioridad      Int
  activo         Boolean  @default(true)
  createdAt      DateTime @default(now()) @db.Timestamptz(6)
  updatedAt      DateTime @updatedAt @db.Timestamptz(6)

  padre Usuario @relation(fields: [padreUsuarioId], references: [id])

  @@index([padreUsuarioId, prioridad])
  @@map("contactos_emergencia")
}
```

- Añadir relación inversa `contactosEmergencia ContactoEmergencia[]` en `Usuario`.
- Añadir valores a `AccionAudit`: `CONTACTO_EMERGENCIA_CREADO`, `CONTACTO_EMERGENCIA_ACTUALIZADO`, `CONTACTO_EMERGENCIA_ELIMINADO`, `CONTACTO_EMERGENCIA_FALLBACK_USADO`, `EXPEDIENTE_ESCALADO_A_ROJO`, `EXPEDIENTE_EMERGENCIA_ACTIVADA`, `EXPEDIENTE_EMERGENCIA_SIN_CONTACTOS`, `EXPEDIENTE_COMITE_SLA_VENCIDO`.

**Seed** (`prisma/seed.ts`):

| Clave | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `padre.comite.sla_horas_gravedad_roja` | INTEGER | `12` | Horas de SLA efectivo al escalar a ROJO |

**Catálogo Motor Notif** (seed idempotente):

- La notificación admin/CEO usa la plantilla existente `expediente.gravedad.subio_a_rojo` (sembrada por SPEC-236).
- Evento `expediente.emergencia.activada` → destinatario contacto prioritario, canales `sms` + `email`, prioridad URGENTE.

**Repositorio** `src/lib/dal/repositories/contacto-emergencia.ts`:

- `findActivosPorPadre(padreUsuarioId)` — ordenados por `prioridad ASC`.
- `findByIdAndPadre(id, padreUsuarioId)` — para PATCH/DELETE con ownership.
- `crear(data)`.
- `actualizar(id, data)`.
- `eliminar(id)` o marcar inactivo.

**Extensión** `src/lib/dal/repositories/expediente.ts`:

- `marcarEscaladoRojo(expedienteId, { estado, slaEfectivoHoras, fechaEscaladoRojoEn })` — transacción que actualiza solo campos permitidos.

**Tests**: `src/lib/dal/repositories/contacto-emergencia.test.ts`.

---

### Fase 2 — Handler `expediente.gravedad.subio_a_rojo`

**Servicio** `src/lib/expediente/handlers/gravedad-subio-a-rojo.ts`:

- Leer parámetro `padre.comite.sla_horas_gravedad_roja` (default 12).
- Llamar `expedienteRepository.marcarEscaladoRojo(...)`.
- Programar notificación URGENTE admin/CEO vía `programar("expediente.gravedad.subio_a_rojo", { ... })` usando la plantilla existente de SPEC-236.
- Registrar `AuditLog` con acción `EXPEDIENTE_ESCALADO_A_ROJO`, nivel `CRITICAL`.

**Tests**: `src/lib/expediente/handlers/gravedad-subio-a-rojo.test.ts`.

---

### Fase 3 — Activación de emergencia (backend)

**Endpoint** `POST /api/admin/comite/expediente/[id]/activar-emergencia`:

- `verifyAuth` con rol `COMITE_VALIDACION`.
- Cargar expediente por `id`; verificar que `scoreGravedadActual === ROJO` (sino `409`).
- Determinar estado objetivo (`PENDIENTE_COMITE` o `EN_APROBACION_PADRE`) según reglas del Motor de Estados.
- Llamar `expedienteRepository.marcarEscaladoRojo()` para actualizar.
- Consultar contactos activos del padre ordenados por prioridad.
- Seleccionar primero activo; si no hay prioridad 1, probar 2 y 3 (fallback auditado).
- Si no hay contactos activos → `409` + `EXPEDIENTE_EMERGENCIA_SIN_CONTACTOS`.
- Programar notificación `expediente.emergencia.activada` por SMS y, si hay email, por email.
- Publicar evento `expediente.emergencia.activada`.
- Registrar `AuditLog` `EXPEDIENTE_EMERGENCIA_ACTIVADA`.

**Servicio** `src/lib/expediente/activar-emergencia.ts`:

- Lógica de negocio desacoplada del request/response.

**Tests**: `src/app/api/admin/comite/expediente/[id]/activar-emergencia/route.test.ts`.

---

### Fase 4 — CRUD de contactos (backend)

**Endpoints** (rol `PARENT`, ownership por `usuario.id`):

- `GET /api/padre/contacto-emergencia` → lista paginada, solo activos por defecto.
- `POST /api/padre/contacto-emergencia` → creación con validación E.164.
- `PATCH /api/padre/contacto-emergencia/[id]` → actualización.
- `DELETE /api/padre/contacto-emergencia/[id]` → baja lógica (`activo: false`) o física según política de retención.

**Schemas Zod** en `src/lib/schemas/index.ts`:

```ts
export const relacionContactoEmergenciaSchema = z.enum(["MADRE", "PADRE", "TUTOR", "HERMANO", "OTRO"]);
export const contactoEmergenciaBodySchema = z.object({
  nombre: z.string().min(1).max(100),
  relacion: relacionContactoEmergenciaSchema,
  telefono: telefonoE164Schema,
  email: z.string().email().optional(),
  prioridad: z.number().int().min(1).max(3),
});
```

**Tests**: `src/app/api/padre/contacto-emergencia/route.test.ts`, `[id]/route.test.ts`.

---

### Fase 5 — Extensión del worker `pi-expediente-motor`

**Lugar**: worker entregado por SPEC-236/D-72 (archivo a definir, ej. `scripts/workers/pi-expediente-motor.mjs`).

**Nuevo paso en tick**:

- Query de expedientes ROJO en estado `PENDIENTE_COMITE` o `EN_APROBACION_PADRE`.
- Filtrar donde `fechaEscaladoRojoEn < now() - interval '12 hours'` (zona Bogotá).
- Para cada uno: publicar evento `expediente.comite.sla_vencido`, programar notificación CRITICAL admin/CEO, auditar `EXPEDIENTE_COMITE_SLA_VENCIDO`.
- Fallo best-effort: loguear y continuar.

**Tests**: test unitario del tick con reloj/BD mockeados.

---

### Fase 6 — UI botón "activar emergencia"

**Vista**: `src/app/admin/comite/consolidacion/[id]/page.tsx` (modificada por SPEC-237).

**Componente**: reutilizar componente crítico existente (botón ruby con confirmación modal).

- Visible solo si `scoreGravedadActual === ROJO`.
- Color ruby (`bg-ruby-600` o token equivalente).
- Texto neutro: "Activar emergencia".
- Modal: explica que se notificará al contacto prioritario; botones "Confirmar" / "Cancelar".
- Al confirmar: llamada a `POST /api/admin/comite/expediente/[id]/activar-emergencia`; refrescar estado.

**Tests**: `src/app/admin/comite/consolidacion/[id]/page.test.tsx` o test de componente del botón.

---

### Fase 7 — Seed y catálogo Motor Notif

- Añadir parámetro `padre.comite.sla_horas_gravedad_roja = 12` en `prisma/seed.ts`.
- Añadir seed idempotente del Motor Notif para la plantilla (idempotente):
  - `expediente.emergencia.activada` (contacto prioritario, SMS + email).
  - La notificación admin/CEO al subir a ROJO reutiliza la plantilla `expediente.gravedad.subio_a_rojo` sembrada por SPEC-236.

---

### Fase 8 — Cierre

- Regenerar docs de arquitectura (`npm run arch:generate`) y dejar `npm run arch:check` verde.
- Gate local completo: `npx tsc --noEmit`, `npm run lint -- --no-cache`, `npm run arch:check`, `npm run test`, `npm run build`, `./scripts/dev-restart.sh`.
- Verificar que no se tocó `src/lib/ai/**` ni el código del Motor Notif.

---

## Project Structure

```text
prisma/migrations/20260822010000_spec_239_contacto_emergencia/migration.sql  # NUEVO
prisma/schema.prisma                                                          # MOD: +ContactoEmergencia +AccionAudit +Usuario relation
prisma/seed.ts                                                                # MOD: +param +catálogo Motor Notif
src/lib/dal/repositories/contacto-emergencia.ts                               # NUEVO
src/lib/dal/repositories/contacto-emergencia.test.ts                          # NUEVO
src/lib/dal/repositories/expediente.ts                                        # EXT: marcarEscaladoRojo()
src/lib/expediente/handlers/gravedad-subio-a-rojo.ts                          # NUEVO
src/lib/expediente/handlers/gravedad-subio-a-rojo.test.ts                     # NUEVO
src/lib/expediente/activar-emergencia.ts                                      # NUEVO
src/lib/expediente/activar-emergencia.test.ts                                 # NUEVO
src/app/api/admin/comite/expediente/[id]/activar-emergencia/route.ts          # NUEVO
src/app/api/admin/comite/expediente/[id]/activar-emergencia/route.test.ts     # NUEVO
src/app/api/padre/contacto-emergencia/route.ts                                # NUEVO
src/app/api/padre/contacto-emergencia/route.test.ts                           # NUEVO
src/app/api/padre/contacto-emergencia/[id]/route.ts                           # NUEVO
src/app/api/padre/contacto-emergencia/[id]/route.test.ts                      # NUEVO
src/lib/schemas/index.ts                                                      # MOD: +contactoEmergenciaBodySchema
src/app/admin/comite/consolidacion/[id]/page.tsx                              # MOD: +botón emergencia
docs/architecture/                                                            # REGENERAR
```

---

## Orden de implementación (tasks.md tras compuerta)

1. Migración + seed + enum audit.
2. Repositorio `ContactoEmergencia` + extensión `expedienteRepository.marcarEscaladoRojo()` + tests.
3. Handler `expediente.gravedad.subio_a_rojo` + tests.
4. Endpoint de activación de emergencia + servicio + tests.
5. CRUD de contactos de emergencia + tests.
6. Extensión del worker `pi-expediente-motor` + tests.
7. Botón y modal en vista de consolidación + tests.
8. Regenerar docs/architecture + gate local completo.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| SPEC-236/SPEC-237 aún no están implementados | Esta spec se planifica asumiendo sus contratos; si cambian, se reabre compuerta §4 |
| Fallo de `programar()` del Motor Notif | Best-effort: auditar y devolver 202 con advertencia; no abortar la activación |
| Contacto prioritario inactivo/ausente | Fallback 2 → 3 auditado; sin activos devolver 409 |
| Worker detenido y SLA vencido no detectado | El tick es periódico; se acepta latencia hasta el próximo ciclo |
| Leak de contactos entre padres | Todo acceso DAL filtra por `padreUsuarioId`; tests cross-user obligatorios |
| Teléfono inválido | Validación E.164 en API y Zod; lecturas solo de activos |

---

## Decisiones para compuerta §4

1. **Eliminación física vs. lógica de contactos**: propuesta usar baja lógica (`activo: false`) para conservar trazabilidad si un contacto fue usado en una activación. Si ZEUS prefiere borrado físico, se cambia.
2. **Fallback de contactos**: propuesta prioridad 1 → 2 → 3 si el primero está inactivo. Si no hay activos, error. No se notifica a múltiples contactos simultáneamente en esta fase.
3. **Zona horaria del SLA**: cálculos en `America/Bogota` sobre timestamps UTC. Confirmar si el CEO/ZEUS prefiere otra zona.
4. **Reutilización del componente crítico**: usar el botón/modal crítico existente del sistema de diseño; solo cambiar color a ruby y texto.
5. **Motor Notif**: solo catálogo/plantillas aditivas; no se modifica el código del motor.
