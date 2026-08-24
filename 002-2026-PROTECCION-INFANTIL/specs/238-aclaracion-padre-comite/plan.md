# Implementation Plan: SPEC-238 — Aclaración padre-comité (1 iteración máx)

**Branch**: `work/002-pi-padre-lote-core` | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)

---

## Summary

Añadir la entidad `AclaracionExpediente` y su repositorio DAL, tres endpoints (padre pide aclaración, comité responde, padre/worker cierra forzosamente) y extender el tick del worker `pi-expediente-motor` (SPEC-236) para vigilar el SLA de aclaraciones pendientes. Todo se ejecuta en transacciones atómicas junto a `aplicarTransicion` y se publican los eventos definidos en SPEC-236.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Next.js 16.2.10 App Router, Prisma 5.22.0, pg-boss |
| **Storage** | PostgreSQL 16 — migración ADITIVA (`AclaracionExpediente` + acciones de audit) |
| **Testing** | Vitest integration para endpoints y repositorio; unit para helpers de SLA |
| **Procesos** | Extensión de `scripts/pi-expediente-motor.mjs` (sin nuevo worker, D-72) |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto | ✅ Pass | La aclaración es texto; no multimedia |
| §1.3 Presunción de inocencia | ✅ Pass | Lenguaje descriptivo en estados y eventos |
| §1.6 Disputas | ✅ Pass | El padre puede pedir aclaración; el cierre forzoso por SLA respeta el flujo |
| §2.1 Stack heredado | ✅ Pass | Next.js + Prisma + JWT manual; no cambios de stack |
| §3.1 TypeScript strict | ✅ Pass | Sin `any`; tipos Prisma para filtros dinámicos |
| §3.5 Logs y auditoría | ✅ Pass | Cambios de estado en `AuditLog`; sin texto completo |
| I-22 No secretos | ✅ Pass | Ningún valor secreto en docs ni specs |
| I-49 Migraciones aditivas | ✅ Pass | Solo `AclaracionExpediente` y valores `AccionAudit`; cero DROP |
| Q-3 Frontera DAL | ✅ Pass | Todo acceso a `AclaracionExpediente` pasa por `AclaracionRepository` |

---

## Estado actual (verificado en fuente)

- **Roles**: `RolUsuario` incluye `PARENT` y `COMITE_VALIDACION` (`prisma/schema.prisma`).
- **Auth**: `verifyAuth` en `src/lib/auth.ts` soporta comprobación de rol.
- **DAL**: patrón `DbClient` + `withUnitOfWork` en `src/lib/dal/unit-of-work.ts`; repositorios existentes en `src/lib/dal/repositories/`.
- **Eventos/Colas**: `src/lib/queue.ts` centraliza publicación con pg-boss; ya existen helpers `send*` por feature.
- **Audit**: `src/lib/audit.ts` (`logAudit`) y `AccionAudit` en schema.
- **Dependencias upstream**: SPEC-236 entrega `Expediente`, `InformeConsolidado`, `aplicarTransicion`, worker `pi-expediente-motor` y parámetro `padre.comite.sla_horas_normal`. SPEC-237 entrega bandeja y permisos del comité. Ninguna de estas entidades existe aún en la rama actual.
- **No existe**: `AclaracionExpediente`, `aclaracion-repository.ts`, endpoints de aclaración ni eventos `expediente.aclaracion.*`.

---

## Diseño por fase

### Fase 1 — Migración, schema y repositorio DAL

**Migración aditiva** (nombre tentativo `20260823010000_spec_238_aclaracion_padre_comite`):

```text
model AclaracionExpediente {
  id                     String    @id @default(cuid())
  expedienteId           String    @unique
  informeConsolidadoId   String
  solicitadaEn           DateTime  @db.Timestamptz(6) @default(now())
  solicitudTexto         String    @db.Text
  respondidaEn           DateTime? @db.Timestamptz(6)
  respondidaPor          String?
  respuestaTexto         String?   @db.Text
  estado                 String    // PENDIENTE | RESPONDIDA | CERRADA_FORZOSAMENTE
  createdAt              DateTime  @db.Timestamptz(6) @default(now())

  expediente             Expediente           @relation(fields: [expedienteId], references: [id])
  informeConsolidado     InformeConsolidado   @relation(fields: [informeConsolidadoId], references: [id])
  respondidaPorUsuario   Usuario?             @relation(fields: [respondidaPor], references: [id])

  @@index([expedienteId])
  @@index([informeConsolidadoId])
  @@index([estado])
  @@index([solicitadaEn])
  @@map("aclaracion_expediente")
}
```

- Añadir relaciones inversas en `Expediente` (`aclaracion AclaracionExpediente?`), `InformeConsolidado` (`aclaraciones AclaracionExpediente[]`) y `Usuario` (`aclaracionesRespondidas AclaracionExpediente[]`).
- Añadir valores a `AccionAudit`: `ACLARACION_SOLICITADA`, `ACLARACION_RESPONDIDA`, `ACLARACION_CERRADA_FORZOSAMENTE`.

**Repositorio** `src/lib/dal/repositories/aclaracion-repository.ts`:

- `findById(id)` — incluye `respondidaPorUsuario` select básico.
- `findByExpedienteId(expedienteId)` — relación única por expediente.
- `crear(data: Prisma.AclaracionExpedienteUncheckedCreateInput)`.
- `responder(id, respondidaPor, respuestaTexto, respondidaEn)` — actualiza estado a `RESPONDIDA`.
- `marcarCerradaForzosamente(id)` — actualiza estado a `CERRADA_FORZOSAMENTE`.
- Acepta `tx?: Prisma.TransactionClient` en constructor (patrón DAL).

**Tests**: `src/lib/dal/repositories/aclaracion-repository.test.ts` (crear, buscar, unique constraint).

---

### Fase 2 — Servicio de orquestación

**Servicio** `src/lib/dal/services/aclaracion-expediente.ts`:

- `solicitarAclaracion({ expedienteId, padreUsuarioId, informeConsolidadoId, solicitudTexto, request? })`:
  - Valida que el expediente esté en `EN_APROBACION_PADRE`, que el padre sea titular y que no exista aclaración.
  - Dentro de `withUnitOfWork` crea la aclaración `PENDIENTE`, aplica `aplicarTransicion(expedienteId, 'EN_ACLARACION', ...)` y publica `expediente.aclaracion.solicitada` best-effort.
  - Registra `AuditLog`.
- `responderAclaracion({ aclaracionId, comiteUsuarioId, respuestaTexto, request? })`:
  - Valida que la aclaración esté `PENDIENTE` y que el comité tenga acceso.
  - Dentro de `withUnitOfWork` actualiza la aclaración a `RESPONDIDA`, aplica `aplicarTransicion(expedienteId, 'EN_APROBACION_PADRE', ...)` y publica `expediente.aclaracion.respondida`.
  - Registra `AuditLog`.
- `cerrarForzosamente({ expedienteId, actor, request? })`:
  - Valida expediente en `EN_APROBACION_PADRE` con aclaración en `RESPONDIDA` o `CERRADA_FORZOSAMENTE`.
  - En tx actualiza aclaración a `CERRADA_FORZOSAMENTE` (si no lo está) y aplica `aplicarTransicion(expedienteId, 'CERRADO', ...)`.
  - Registra `AuditLog`.
  - Idempotente: si ya está cerrado, retorna sin error.

El servicio consume `AclaracionRepository`, `ExpedienteRepository` (o el que SPEC-236 entregue) y `aplicarTransicion`.

---

### Fase 3 — Endpoints

**`POST /api/padre/expediente/[id]/pedir-aclaracion`**

- `verifyAuth("PARENT")`.
- Lee `id` de la ruta; body `{ solicitudTexto: string }` validado con Zod (`min(1)`, `max(2000)`).
- Verifica propiedad del expediente (padre titular).
- Llama a `solicitarAclaracion`.
- Retorna `201` con la aclaración creada (sin texto completo en log/audit).

**`POST /api/admin/comite/aclaracion/[id]/responder`**

- `verifyAuth("COMITE_VALIDACION")`.
- Lee `id` de la aclaración; body `{ respuestaTexto: string }` validado con Zod.
- Verifica acceso al expediente/aclaración (mismo tenant/colegio según SPEC-237).
- Llama a `responderAclaracion`.
- Retorna `200` con la aclaración actualizada.

**`POST /api/padre/expediente/[id]/cerrar-forzoso`**

- `verifyAuth("PARENT")` o aceptar llamada interna con `X-Worker-Secret`.
- Valida que el expediente esté en `EN_APROBACION_PADRE`.
- Llama a `cerrarForzosamente`.
- Retorna `200`.

**Tests**: un `.test.ts` por endpoint en su misma carpeta.

---

### Fase 4 — Extensión del worker `pi-expediente-motor`

- El tick del worker (SPEC-236) añade una pasada sobre `AclaracionExpediente` con `estado = 'PENDIENTE'`.
- Para cada fila, lee `padre.comite.sla_horas_normal` (entero, horas) y compara `solicitadaEn + sla_horas_normal < ahoraBogota()`.
- Si venció: publica evento `expediente.comite.sla_vencido` vía pg-boss con payload `{ expedienteId, aclaracionId }`.
- El mismo worker (o handler interno con worker secret) consume/escucha el evento y llama a `cerrarForzosamente`.
- **No se crea un worker nuevo** (D-72); solo se extiende el existente.

**Helpers**:

- `src/lib/fecha-bogota.ts` (o similar) con `ahoraBogota()` y `sumarHorasBogota(fecha, horas)` usando `America/Bogota`.

**Tests**: `src/lib/dal/services/aclaracion-expediente.test.ts` cubre el tick simulado con fechas controladas.

---

### Fase 5 — UI mínima del comité

- `src/app/dashboard/admin/comite/aclaracion/[id]/page.tsx`: muestra solicitud y formulario de respuesta; llama a `POST /api/admin/comite/aclaracion/[id]/responder`.
- No se implementa UI del padre (SPEC-232).

---

### Fase 6 — Tests de calidad

- **Unicidad concurrente**: dos `POST` simultáneos del mismo padre → uno `201`, otro `409`.
- **Guardas de rol**: `COMITE_VALIDACION` no puede pedir aclaración; `PARENT` no puede responder; usuario de otro tenant no ve la aclaración.
- **Atomicidad**: si `aplicarTransicion` lanza, la tx hace rollback y no queda aclaración parcial.
- **SLA Bogotá**: fecha de solicitud más SLA produce vencimiento correcto en zona horaria Colombia.
- **Cierre forzoso**: worker post-SLA y endpoint manual producen el mismo estado final.
- **Idempotencia**: repetir cierre forzoso no genera errores ni doble audit.

---

## Project Structure

```text
prisma/migrations/20260823010000_spec_238_aclaracion_padre_comite/migration.sql  # NUEVO
prisma/schema.prisma                                                                # MOD: +AclaracionExpediente +relaciones +AccionAudit
src/lib/dal/repositories/aclaracion-repository.ts                                   # NUEVO
src/lib/dal/services/aclaracion-expediente.ts                                       # NUEVO
src/lib/schemas/index.ts                                                            # MOD: +pedirAclaracionSchema +responderAclaracionSchema
src/app/api/padre/expediente/[id]/pedir-aclaracion/route.ts                         # NUEVO
src/app/api/padre/expediente/[id]/pedir-aclaracion/route.test.ts                  # NUEVO
src/app/api/admin/comite/aclaracion/[id]/responder/route.ts                         # NUEVO
src/app/api/admin/comite/aclaracion/[id]/responder/route.test.ts                  # NUEVO
src/app/api/padre/expediente/[id]/cerrar-forzoso/route.ts                           # NUEVO
src/app/api/padre/expediente/[id]/cerrar-forzoso/route.test.ts                    # NUEVO
src/app/dashboard/admin/comite/aclaracion/[id]/page.tsx                             # NUEVO
scripts/pi-expediente-motor.mjs                                                     # MOD: +tick SLA aclaraciones
src/lib/queue.ts                                                                    # MOD: +sendEventoExpedienteAclaracionSolicitada / Respondida / SlaVencido (según patrón SPEC-236)
tests: src/lib/dal/repositories/aclaracion-repository.test.ts
       src/lib/dal/services/aclaracion-expediente.test.ts
docs/architecture/                                                                  # REGENERAR
```

---

## Orden de implementación (tasks.md tras compuerta)

1. Migración aditiva y relaciones inversas.
2. `AclaracionRepository` y tests de repositorio.
3. Servicio `aclaracion-expediente.ts` con transacciones y eventos.
4. Endpoints de padre y comité con validación Zod y tests.
5. Extensión del worker `pi-expediente-motor` (tick SLA + evento `sla_vencido`) y tests.
6. UI mínima de respuesta del comité.
7. Regenerar `docs/architecture` y gate local completo.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| `aplicarTransicion` aún no existe (depende de SPEC-236) | Definir contrato claro en data-model.md; no implementar hasta que SPEC-236 esté mergeado |
| Carrera al crear aclaración | `@@unique([expedienteId])` en BD + manejo de P2002 como `409` |
| Rollback parcial si falla la transacción | Crear aclaración y `aplicarTransicion` dentro de la misma `prisma.$transaction` |
| Worker publica evento pero falla el cierre | El cierre se aplica primero en BD; el evento es best-effort |
| Comité de plataforma vs. comité por colegio | Validar acceso en el servicio usando el `tenantId`/`colegioId` del expediente (SPEC-237) |
| Texto sensible en logs | AuditLog solo con metadatos; nunca `solicitudTexto` ni `respuestaTexto` |

---

## Decisiones para compuerta §4

1. **Ubicación de `aplicarTransicion`**: asumir que SPEC-236 lo expone en `src/lib/dal/services/expediente-lifecycle.ts` (o ruta equivalente); si cambia, se ajusta el import del servicio.
2. **Worker SLA**: extender `scripts/pi-expediente-motor.mjs` (sin nuevo worker, D-72); el cierre forzoso se ejecuta a través del mismo servicio usado por el endpoint, validando con worker secret.
3. **Eventos**: publicar `expediente.aclaracion.solicitada` y `expediente.aclaracion.respondida` best-effort vía pg-boss; el evento `expediente.comite.sla_vencido` lo publica el worker.
4. **Cierre forzoso idempotente**: retornar `200` sin cambios si el expediente ya está `CERRADO`; esto simplifica tanto el endpoint manual como el worker.
5. **UI del padre**: fuera de alcance (SPEC-232); los endpoints quedan listos para cuando se implemente.
