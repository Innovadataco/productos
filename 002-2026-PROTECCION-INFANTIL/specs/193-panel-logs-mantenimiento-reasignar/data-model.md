# Data Model — Panel de Logs + Mantenimiento + Reasignar Operador

**Date**: 2026-08-21  
**Feature**: [spec.md](spec.md)

---

## Nuevo enum: `NivelLog`

| Valor | Descripción |
|-------|-------------|
| `DEBUG` | Información de depuración detallada |
| `INFO` | Información general de operación |
| `WARN` | Advertencia, no crítica |
| `ERROR` | Error que puede requerir intervención |

```prisma
enum NivelLog {
  DEBUG
  INFO
  WARN
  ERROR
}
```

---

## Nueva tabla: `WorkerLog`

Cada fila representa un evento de log emitido por uno de los servicios de infraestructura.

| Campo | Tipo | Constraints | Notas |
|-------|------|-------------|-------|
| `id` | String | `@id @default(cuid())` | Identificador único |
| `servicio` | String | no null | Nombre del servicio: `pi-app`, `pi-worker`, `pi-monitor`, `pi-simulador-abuso` |
| `nivel` | `NivelLog` | no null | Nivel del mensaje |
| `mensaje` | String | no null, `@db.VarChar(500)` | Texto corto del log, sin PII ni texto de reporte |
| `contextoJson` | Json | opcional | Datos estructurados asociados al evento |
| `creadoEn` | DateTime | `@default(now())` | Timestamp de emisión |

**Índices:**

- `(servicio, creadoEn DESC)`: consultas filtradas por servicio ordenadas cronológicamente.
- `(nivel, creadoEn DESC)`: consultas filtradas por nivel ordenadas cronológicamente.
- `creadoEn` (explícito o cubierto por los anteriores): soporte de rangos de fecha y purga.

**Relaciones:**

`WorkerLog` no tiene FKs a otras tablas. Es una entidad de infraestructura aislada para evitar bloqueos y mantener la posibilidad de truncados/agregaciones sin afectar datos de negocio.

---

## Diagrama textual de relaciones

```text
┌─────────────────┐         ┌──────────────────┐
│   WorkerLog     │         │ ParametroSistema │
├─────────────────┤         ├──────────────────┤
│ id (PK)         │         │ id (PK)          │
│ servicio        │         │ clave (unique)   │
│ nivel           │         │ valor            │
│ mensaje         │         │ tipo             │
│ contextoJson    │         │ categoria        │
│ creadoEn        │         └──────────────────┘
└─────────────────┘                  │
                                     │
                                     ▼
                            ┌──────────────────┐
                            │ AuditLog         │
                            ├──────────────────┤
                            │ id (PK)          │
                            │ accion           │
                            │ metadatos        │
                            │ creadoEn         │
                            └──────────────────┘

Reporte ◄────(UPDATE operadorId)──── Usuario(OPERADOR)
   │
   └──► TransicionReporte (nueva fila REPORTE_REASIGNADO_MANUAL)
```

---

## Parámetros nuevos en `ParametroSistema`

Se agregan en la sección `monitoreoNuevos` de `prisma/seed.ts`:

| Clave | Tipo | Default | Categoría | Descripción |
|-------|------|---------|-----------|-------------|
| `monitoreo.logs.enabled` | `BOOLEAN` | `true` | `SYSTEM` | Habilita/deshabilita la persistencia de logs en `WorkerLog` |
| `monitoreo.logs.nivel_minimo` | `STRING` | `WARN` | `SYSTEM` | Nivel mínimo para persistir (`DEBUG`, `INFO`, `WARN`, `ERROR`) |
| `monitoreo.logs.max_muestras_ui` | `INTEGER` | `500` | `SYSTEM` | Máximo de filas que la UI puede solicitar en una sola consulta |

Estos parámetros no son públicos (`esPublico=false`) y no son secretos (`esSecreto=false`).

---

## Modelos existentes referenciados (sin cambios estructurales)

### `Reporte`

No se agregan ni eliminan campos. Solo se actualiza `operadorId` durante una reasignación.

```prisma
model Reporte {
  // ... campos existentes ...
  operadorId String?
  // ... resto sin cambios ...
}
```

### `Usuario`

No se modifica. El destino de una reasignación se valida contra `rol=OPERADOR` y `estado=activo`.

### `TransicionReporte`

Se usa para registrar la reasignación. No cambia su esquema; se inserta una fila con:

- `estadoAnterior` y `estadoNuevo` iguales (la reasignación no cambia el estado del reporte).
- `responsableTipo=ADMIN`.
- `responsableId` = `adminId`.
- `motivo` = motivo ingresado.
- `metadatos` = `{ tipo: 'REPORTE_REASIGNADO_MANUAL', operador_anterior, operador_nuevo, admin_id }`.

### `AuditLog`

Se agregan dos valores al enum `AccionAudit`:

- `LOGS_MANTENIMIENTO_PURGA`
- `REPORTE_REASIGNADO_MANUAL`

No cambia la estructura de la tabla.

---

## Migración

`20260821xx_add_worker_log`

```sql
-- Crear enum
CREATE TYPE "NivelLog" AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR');

-- Crear tabla
CREATE TABLE "WorkerLog" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "servicio" TEXT NOT NULL,
    "nivel" "NivelLog" NOT NULL,
    "mensaje" VARCHAR(500) NOT NULL,
    "contextoJson" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerLog_pkey" PRIMARY KEY ("id")
);

-- Índices
CREATE INDEX "WorkerLog_servicio_creadoEn_idx" ON "WorkerLog"("servicio", "creadoEn" DESC);
CREATE INDEX "WorkerLog_nivel_creadoEn_idx" ON "WorkerLog"("nivel", "creadoEn" DESC);
CREATE INDEX "WorkerLog_creadoEn_idx" ON "WorkerLog"("creadoEn");

-- Extender enum AccionAudit (aditivo)
ALTER TYPE "AccionAudit" ADD VALUE 'LOGS_MANTENIMIENTO_PURGA';
ALTER TYPE "AccionAudit" ADD VALUE 'REPORTE_REASIGNADO_MANUAL';
```

---

## Invariantes

- `WorkerLog` es append-only para escritores (workers); solo el mantenimiento manual ejecuta `DELETE` bajo `ADMIN`.
- `mensaje` no contiene PII, texto de reporte ni identificadores sensibles; esos datos van en `contextoJson` de forma estructurada y controlada.
- Los parámetros `monitoreo.logs.*` solo son editables por `ADMIN`.
- La purga nunca afecta logs del día en curso: `hasta` debe ser anterior a la fecha actual.
- Cada purga genera exactamente un `AuditLog` con `filas_borradas >= 0`.
