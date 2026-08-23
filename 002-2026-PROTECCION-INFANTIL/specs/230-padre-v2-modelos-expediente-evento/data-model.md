# Data Model: Padre v2 · Modelos Expediente + Evento

**Date**: 2026-08-22
**Feature**: specs/230-padre-v2-modelos-expediente-evento/spec.md
**Branch**: work/002-pi-130

---

## Active Entities

### `Expediente`

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String | `@id @default(cuid())` | |
| `padreUsuarioId` | String | FK → `Usuario.id` | Usuario titular del expediente (rol `PARENT`) |
| `identificadorReportado` | String | | Teléfono, nick o perfil reportado |
| `plataformaId` | String? | | Identificador de plataforma (opcional, sin relación forzada) |
| `fechaApertura` | DateTime | `@db.Timestamptz(6)` | Momento de apertura del expediente |
| `fechaCierre` | DateTime? | `@db.Timestamptz(6)` | Solo cuando `estado = CERRADO` |
| `fechaEscalado` | DateTime? | `@db.Timestamptz(6)` | Marca de escalamiento formal |
| `estado` | Enum | `EstadoExpediente` | |
| `scoreGravedadActual` | Enum | `ScoreGravedad` `@default(VERDE)` | |
| `categoriasDominantesJson` | Json? | | Array de categorías predominantes serializado |
| `numEventos` | Int | `@default(0)` | Denormalizado; incrementado por `agregarEvento` |
| `ultimoEventoEn` | DateTime? | `@db.Timestamptz(6)` | |
| `autoCerradoPorInactividad` | Boolean | `@default(false)` | `true` solo si el cierre fue automático |
| `expedienteRelacionadoAnteriorId` | String? | FK → `Expediente.id` | Self-reference a expediente previo relacionado |
| `patronesDetectadosJson` | Json? | | Metadatos de patrones detectados |
| `createdAt` | DateTime | `@default(now()) @db.Timestamptz(6)` | |
| `updatedAt` | DateTime | `@updatedAt @db.Timestamptz(6)` | |

**Validation Rules / Invariants**:
- `padreUsuarioId` debe referenciar un `Usuario` con `rol = PARENT`.
- `fechaCierre` no nula solo cuando `estado = CERRADO`.
- `fechaEscalado` debe ser ≥ `fechaApertura`.
- `autoCerradoPorInactividad = true` ⇒ `estado = CERRADO`.
- `expedienteRelacionadoAnteriorId` ≠ `id` (no auto-referencia directa).

**State Transitions**:
```
ACTIVO → CONSOLIDANDO
ACTIVO → PENDIENTE_COMITE
ACTIVO → ESCALADO
CONSOLIDANDO → PENDIENTE_COMITE
CONSOLIDANDO → EN_APROBACION_PADRE
PENDIENTE_COMITE → EN_ACLARACION
EN_ACLARACION → ACTIVO
EN_ACLARACION → CERRADO
EN_APROBACION_PADRE → CERRADO
ESCALADO → PENDIENTE_COMITE
CERRADO → ACTIVO (reapertura manual)
```

---

### `EventoExpediente`

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String | `@id @default(cuid())` | |
| `expedienteId` | String | FK → `Expediente.id` | |
| `ordenSecuencial` | Int | | Monotónico creciente dentro del expediente |
| `reporteId` | String? | FK → `Reporte.id` (opcional) | Relación inversa en `Reporte`; no altera su modelo de negocio |
| `fechaEvento` | DateTime | `@db.Timestamptz(6)` | |
| `texto` | String | `@db.Text` | Texto del evento o reporte |
| `categoriaDetectada` | String? | | Se hidrata async tras clasificación IA |
| `confianzaClasificacion` | Float? | | Se hidrata async tras clasificación IA |
| `plataforma` | String? | | Plataforma asociada al evento |
| `adjuntosMetaJson` | Json? | | Solo metadatos textuales; sin multimedia |
| `createdAt` | DateTime | `@default(now()) @db.Timestamptz(6)` | |

**Validation Rules / Invariants**:
- `@@unique([expedienteId, ordenSecuencial])`.
- `ordenSecuencial` se asigna dentro de una transacción atómica: `MAX(ordenSecuencial) + 1` para el expediente.
- `reporteId` es opcional: permite eventos manuales o consolidaciones sin reporte vinculado.
- `categoriaDetectada` y `confianzaClasificacion` se crean nulos y se actualizan posteriormente por el flujo de clasificación; el repository no invoca `src/lib/ai/**`.

---

## Modified / New Enums

### `EstadoExpediente` (nuevo)

| Value | Meaning |
|-------|---------|
| `ACTIVO` | Recibiendo eventos, aún no consolidado |
| `CONSOLIDANDO` | Alcanzó umbral mínimo de reportes; en análisis |
| `PENDIENTE_COMITE` | Requiere decisión del comité |
| `EN_APROBACION_PADRE` | A la espera de confirmación/aclaración del padre |
| `EN_ACLARACION` | El padre solicitó aclaración |
| `CERRADO` | Finalizado (resuelto, archivado o auto-cerrado) |
| `ESCALADO` | Escalado a canal formal/externo |

### `ScoreGravedad` (nuevo)

| Value | Meaning |
|-------|---------|
| `VERDE` | Bajo riesgo |
| `AMARILLO` | Riesgo moderado |
| `ROJO` | Riesgo alto |

### `TipoRevisionComite` (nuevo)

Migración aditiva que crea el enum con ambos valores desde el inicio:

```sql
CREATE TYPE "TipoRevisionComite" AS ENUM ('REVISION_REPORTE', 'CONSOLIDACION_EXPEDIENTE');
```

Confirmado por ZEUS: no se usa `ALTER TYPE ADD VALUE` porque el enum no existía previamente.

---

## Entity Relationships

```
Usuario ||--o{ Expediente : "padre titular"
Expediente ||--o{ EventoExpediente : "contiene"
Expediente ||--o| Expediente : "expedienteRelacionadoAnteriorId"
Reporte ||--o{ EventoExpediente : "eventos (relación inversa)"
```

La relación `EventoExpediente → Reporte` requiere la relación inversa `Reporte.eventos` para que Prisma valide la FK; esta inversa no añade columnas a `reportes`.

---

## Seed Data (Required)

### Nuevos enums

```typescript
enum EstadoExpediente {
  ACTIVO
  CONSOLIDANDO
  PENDIENTE_COMITE
  EN_APROBACION_PADRE
  EN_ACLARACION
  CERRADO
  ESCALADO
}

enum ScoreGravedad {
  VERDE
  AMARILLO
  ROJO
}
```

### Parámetros del módulo Padre (`padre.*`)

Seed idempotente (anti-I-100): `where { clave }`, `update {}`, `create { ... }` para no pisar valores ya configurados.

| Clave | Valor | Tipo | Categoría | Público | Descripción |
|-------|-------|------|-----------|---------|-------------|
| `padre.expediente.auto_cierre_meses` | `6` | INTEGER | SYSTEM | ❌ | Meses de inactividad para auto-cierre |
| `padre.expediente.consolidacion_min_reportes` | `2` | INTEGER | SYSTEM | ❌ | Mínimo de reportes para pasar a CONSOLIDANDO |
| `padre.expediente.max_aclaraciones` | `1` | INTEGER | SYSTEM | ❌ | Máximo de aclaraciones por expediente |
| `padre.expediente.rate_limit_eventos_24h` | `999` | INTEGER | SYSTEM | ❌ | Límite de eventos que un padre puede agregar en 24h |
| `padre.comite.sla_horas_normal` | `48` | INTEGER | SYSTEM | ❌ | SLA de comité para casos normales |
| `padre.comite.sla_horas_gravedad_roja` | `12` | INTEGER | SYSTEM | ❌ | SLA de comité para expedientes ROJO |
| `padre.comite.miembros_minimos_aprobacion` | `2` | INTEGER | SYSTEM | ❌ | Miembros mínimos del comité para aprobación |
| `padre.score.peso_num_reportes` | `2` | FLOAT | SYSTEM | ❌ | Peso del número de reportes en score |
| `padre.score.peso_categoria_grave` | `5` | FLOAT | SYSTEM | ❌ | Peso de categoría grave en score |
| `padre.score.peso_aceleracion` | `3` | FLOAT | SYSTEM | ❌ | Peso de aceleración de reportes en score |
| `padre.score.peso_senal_comunitaria` | `4` | FLOAT | SYSTEM | ❌ | Peso de señal comunitaria en score |
| `padre.score.umbral_amarillo` | `20` | INTEGER | SYSTEM | ❌ | Score mínimo para gravedad AMARILLO |
| `padre.score.umbral_rojo` | `50` | INTEGER | SYSTEM | ❌ | Score mínimo para gravedad ROJO |
| `padre.categorias_graves_json` | `'["GROOMING","SEXTORSION","EXTORSION","DIFUSION_NO_CONSENTIDA","SOLICITUD_ENCUENTRO","COMPARTIMIENTO_SEXUAL"]'` | STRING | SYSTEM | ❌ | JSON array de códigos de categorías graves |
| `padre.patron.aceleracion_ratio_minimo` | `2.0` | FLOAT | SYSTEM | ❌ | Ratio mínimo de aceleración para detectar patrón |
| `padre.patron.senal_comunitaria_perpetrador_serial` | `5` | INTEGER | SYSTEM | ❌ | Reportes que señalan posible perpetrador serial |
| `padre.patron.multiplataforma_min` | `2` | INTEGER | SYSTEM | ❌ | Mínimo de plataformas distintas para patrón multiplataforma |
| `padre.guia.umbral_confianza_categoria_minimo` | `0.4` | FLOAT | SYSTEM | ❌ | Confianza mínima de clasificación para mostrar categoría |

---

## Indexes

| Table | Fields | Reason |
|-------|--------|--------|
| `Expediente` | `[padreUsuarioId, estado]` | Listar expedientes de un padre filtrados por estado |
| `Expediente` | `[identificadorReportado]` | Buscar expedientes por identificador |
| `Expediente` | `[estado, updatedAt DESC]` | Bandejas operativas ordenadas por recencia |
| `EventoExpediente` | `[expedienteId, ordenSecuencial]` | Unique; garantiza secuencia monotónica |
| `EventoExpediente` | `[expedienteId, fechaEvento DESC]` | Listar eventos de un expediente por recencia |

---

## Design Notes

- Todos los campos `DateTime` usan `@db.Timestamptz(6)` para almacenar zona horaria (D-69 timezone Bogotá).
- `EventoExpediente` no almacena contenido multimedia; `adjuntosMetaJson` solo contiene metadatos textuales, cumpliendo la constitución (solo texto).
- `categoriaDetectada` se modela como `String?` (no como `CategoriaConducta`) para desacoplar el expediente del enum central y permitir evolución sin modificarlo.
- La relación con `Reporte` es opcional; la relación inversa `Reporte.eventos` se añade únicamente para que Prisma valide la FK, sin cambiar columnas de la tabla `reportes`.
