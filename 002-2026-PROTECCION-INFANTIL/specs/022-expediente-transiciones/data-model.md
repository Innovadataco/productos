> # Data Model — Expediente interno de transiciones

**Date**: 2026-07-18
**Feature**: specs/022-expediente-transiciones/spec.md

---

## Nuevo enum: `ResponsableTransicion`

| Valor | Descripción |
|-------|-------------|
| `IA` | Transición originada por el clasificador IA |
| `WORKER` | Transición ejecutada por el worker de colas |
| `SISTEMA` | Transición automática del sistema (reglas, deduplicación, etc.) |
| `OPERADOR` | Transición realizada por un usuario con rol `OPERADOR` |
| `COMITE` | Transición realizada por un usuario con rol `COMITE_VALIDACION` |
| `ADMIN` | Transición realizada por un usuario con rol `ADMIN` o `SCHOOL_ADMIN` |

```prisma
enum ResponsableTransicion {
  IA
  WORKER
  SISTEMA
  OPERADOR
  COMITE
  ADMIN
}
```

---

## Nueva tabla: `TransicionReporte`

Cada fila representa una transición de estado de un reporte. Es append-only.

| Campo | Tipo | Constraints | Notas |
|-------|------|-------------|-------|
| `id` | String | `@id @default(cuid())` | Identificador único |
| `reporteId` | String | FK → `Reporte.id`, no null | Reporte afectado |
| `estadoAnterior` | `EstadoReporte` | no null | Estado antes de la transición |
| `estadoNuevo` | `EstadoReporte` | no null | Estado después de la transición |
| `responsableTipo` | `ResponsableTransicion` | no null | Tipo de actor |
| `responsableId` | String | FK → `Usuario.id`, opcional | ID del usuario cuando aplica |
| `motivo` | String | opcional, `@db.Text` | Razón de la transición |
| `metadatos` | Json | opcional | Datos flexibles: latencia, modelo, intento, etc. |
| `creadoEn` | DateTime | `@default(now())` | Timestamp |

**Relaciones:**
- `TransicionReporte.reporte` → `Reporte`
- `TransicionReporte.responsableUsuario` → `Usuario` (opcional)
- `Reporte.transiciones` → `TransicionReporte[]`

**Índices:**
- `reporteId`: consulta de timeline por reporte.
- `responsableTipo`: filtrado por tipo de actor.
- `responsableId`: filtrado por usuario.
- `creadoEn`: orden cronológico.

---

## Modelo existente modificado: `Reporte`

Se agrega la relación hacia `TransicionReporte`:

```prisma
model Reporte {
  // ... campos existentes ...
  transiciones TransicionReporte[]
}
```

No se modifica ningún campo existente de `Reporte`.

---

## Modelo existente referenciado: `Usuario`

Se agrega la relación inversa opcional desde `TransicionReporte`:

```prisma
model Usuario {
  // ... campos existentes ...
  transicionesReporte TransicionReporte[]
}
```

---

## Migración

`20260718xx_add_transicion_reporte`

```sql
-- Crear enum
CREATE TYPE "ResponsableTransicion" AS ENUM ('IA', 'WORKER', 'SISTEMA', 'OPERADOR', 'COMITE', 'ADMIN');

-- Crear tabla
CREATE TABLE "TransicionReporte" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "reporteId" TEXT NOT NULL,
    "estadoAnterior" "EstadoReporte" NOT NULL,
    "estadoNuevo" "EstadoReporte" NOT NULL,
    "responsableTipo" "ResponsableTransicion" NOT NULL,
    "responsableId" TEXT,
    "motivo" TEXT,
    "metadatos" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransicionReporte_pkey" PRIMARY KEY ("id")
);

-- FKs e índices
ALTER TABLE "TransicionReporte" ADD CONSTRAINT "TransicionReporte_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "Reporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransicionReporte" ADD CONSTRAINT "TransicionReporte_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "TransicionReporte_reporteId_idx" ON "TransicionReporte"("reporteId");
CREATE INDEX "TransicionReporte_responsableTipo_idx" ON "TransicionReporte"("responsableTipo");
CREATE INDEX "TransicionReporte_responsableId_idx" ON "TransicionReporte"("responsableId");
CREATE INDEX "TransicionReporte_creadoEn_idx" ON "TransicionReporte"("creadoEn");
```

---

## Invariantes

- `TransicionReporte` es append-only: no se permite UPDATE ni DELETE.
- `estadoAnterior` debe coincidir con el `estado` del reporte al momento de la transición (validación en helper).
- `responsableId` solo se setea cuando `responsableTipo` es `OPERADOR`, `COMITE` o `ADMIN`.
- `metadatos` no debe contener PII ni texto de reporte.
