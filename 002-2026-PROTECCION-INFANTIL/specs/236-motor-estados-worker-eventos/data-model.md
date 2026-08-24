# Modelo de datos: SPEC-236 — Motor de estados + worker + 11 eventos Motor Notif

## 1. Principios aplicados

- **Migraciones aditivas**: todos los cambios son `ADD` o `CREATE`; ningún `DROP`, `ALTER COLUMN TYPE` destructivo ni eliminación de datos.
- **Timestamptz(6)**: campos de timestamp usan `Timestamptz(6)` en Prisma (`DateTime` con `@db.Timestamptz(6)`).
- **No se modifican columnas existentes** de `Expediente`, `EventoExpediente` ni `InformeConsolidado`; solo se añaden relaciones inversas o tablas/catálogos nuevos si son aditivas y autorizadas.
- **DAL Q-3**: el acceso a datos de expediente pasa por repositorios DAL (`src/lib/dal/repositories/expediente.ts` o equivalente); los guards no ejecutan SQL raw.

## 2. Entidades existentes (definidas en SPEC-230 / SPEC-234)

SPEC-236 consume los modelos `Expediente`, `EventoExpediente`, `InformeConsolidado` y `Usuario` entregados por SPEC-230/SPEC-234. No los redefine ni modifica sus columnas; solo añade relaciones inversas o tablas/catálogos nuevos si son aditivos y autorizados.

### 2.1 `Expediente`

Campos relevantes para el motor de estados:

| Campo | Uso en SPEC-236 |
|-------|-----------------|
| `id` | PK; referencia en transiciones y eventos. |
| `padreUsuarioId` | FK a `Usuario.id`; identifica al titular del expediente. |
| `estado` | `EstadoExpediente`; sujeto de la máquina de estados. |
| `scoreGravedadActual` | `ScoreGravedad`; usado para vigilancia ROJO y SLA. |
| `numEventos` | Contador para el guard `ACTIVO → CONSOLIDANDO`. |
| `ultimoEventoEn` | Timestamp de última actividad; usado para auto-cierre por inactividad. |
| `fechaCierre` | Timestamp de cierre; se actualiza en transiciones a `CERRADO`. |
| `autoCerradoPorInactividad` | Flag para distinguir cierre automático del manual. |
| `patronesDetectadosJson` | Contexto para notificaciones y logs. |
| `createdAt` / `updatedAt` | Trazabilidad forense. |

### 2.2 `EventoExpediente`

Campos relevantes:

| Campo | Uso en SPEC-236 |
|-------|-----------------|
| `id` | PK. |
| `expedienteId` | FK a `Expediente`. |
| `ordenSecuencial` | Orden en el timeline. |
| `reporteId` | Vínculo al reporte origen. |
| `fechaEvento` | Fecha real del evento. |
| `texto` | Texto sensible; la retención lo reemplaza por `[retenido]`. |
| `categoriaDetectada` / `confianzaClasificacion` / `plataforma` / `adjuntosMetaJson` | Metadatos de contexto. |
| `createdAt` | Trazabilidad. |

### 2.3 `InformeConsolidado`

Campos relevantes:

| Campo | Uso en SPEC-236 |
|-------|-----------------|
| `id` | PK. |
| `expedienteId` | FK a `Expediente`. |
| `versionSecuencial` | Versión del informe. |
| `nivelConfianza` | Confianza global del informe (extra justificado; no score de persona). |
| `scoreGravedadActual` (en `Expediente`) | Score de gravedad vigente del expediente (VERDE/AMARILLO/ROJO). |
| `categoriasDetectadasJson` / `patronesDetectadosJson` / `senalComunitariaJson` | Contexto del informe. |
| `resumenTextoGenerado` | Texto sensible; la retención lo reemplaza por `[retenido]`. |
| `pdfUrl` / `pdfHash` / `pdfGeneradoEn` | Evidencia generada; `pdfUrl` se reemplaza por `[retenido]` en purga. |
| `estadoAprobacion` | Guard `PENDIENTE_COMITE → EN_APROBACION_PADRE`. |
| `aprobadoPorMiembrosJson` / `correccionesJson` | Trazabilidad del comité (SPEC-237). |
| `generadoPorId` / `tipoRevision` / `guiaAccionCategoriaIdPrincipal` | Metadatos de generación y revisión. |
| `createdAt` / `updatedAt` | Trazabilidad. |

### 2.4 `AclaracionExpediente`

No se define en esta spec. El motor de estados referencia `AclaracionExpediente` (SPEC-238) únicamente en guards de transición (`EN_APROBACION_PADRE ↔ EN_ACLARACION`). Ver SPEC-238 para su schema.

### 2.5 Enums reutilizados

```prisma
enum EstadoExpediente {
  // Valores definidos en SPEC-230.
  // Relevantes para SPEC-236: ACTIVO, CONSOLIDANDO, PENDIENTE_COMITE,
  // EN_APROBACION_PADRE, EN_ACLARACION, CERRADO, ESCALADO.
}

enum ScoreGravedad {
  VERDE
  AMARILLO
  ROJO
}
```

## 3. Nuevas entidades aditivas para SPEC-236

### 3.1 Parámetros de sistema

No se crean nuevas tablas; se añaden filas a `ParametroSistema` (existente) mediante seed.

| Clave | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `padre.expediente.consolidacion_min_reportes` | INTEGER | 3 | Mínimo de eventos para pasar a CONSOLIDANDO |
| `padre.expediente.motor.tick_min` | INTEGER | 15 | Minutos entre ticks del worker |
| `padre.expediente.auto_cierre_meses` | INTEGER | 6 | Meses de inactividad para auto-cierre |
| `padre.expediente.retencion_cerrados_meses` | INTEGER | 24 | Meses tras cierre para purgar textos |

### 3.2 Eventos de Motor Notif (catálogo aditivo)

Se asume que PR #83 provee una tabla similar a:

```prisma
model EventoNotificacion {
  id            String    @id @default(cuid())
  clave         String    @unique
  descripcion   String
  canalesDefault String[]
  creadoEn      DateTime  @default(now()) @db.Timestamptz(6)

  templates     NotificacionTemplate[]
  @@map("eventos_notificacion")
}

model NotificacionTemplate {
  id              String    @id @default(cuid())
  eventoClave     String
  idioma          String    @default("es")
  asunto          String
  cuerpoTexto     String
  cuerpoHtml      String?
  variablesEsperadas String[]
  creadoEn        DateTime  @default(now()) @db.Timestamptz(6)
  actualizadoEn   DateTime  @updatedAt @db.Timestamptz(6)

  evento          EventoNotificacion @relation(fields: [eventoClave], references: [clave])

  @@unique([eventoClave, idioma])
  @@map("notificacion_templates")
}
```

SPEC-236 añade 11 filas a `EventoNotificacion` y 11 templates en `NotificacionTemplate` (idioma `es`). Ver `spec.md` §FR-018/019 y `tasks.md` para detalle.

### 3.3 AuditLog

No se modifica la tabla `AuditLog`. Se usan acciones existentes o se añade un valor al enum `AccionAudit` de forma aditiva si es necesario:

- `EXPEDIENTE_TRANSICION_ESTADO`
- `EXPEDIENTE_RETENIDO`
- `EXPEDIENTE_SLA_VENCIDO`
- `EXPEDIENTE_GRAVEDAD_SUBIO_A_ROJO`

## 4. Índices necesarios

- `Expediente.estado`, `Expediente.scoreGravedadActual`, `Expediente.ultimoEventoEn` para queries del worker.
- `Expediente.padreUsuarioId` para queries por titular.
- `EventoExpediente.expedienteId`, `EventoExpediente.createdAt` para historial y retención.
- `InformeConsolidado.expedienteId`, `InformeConsolidado.estadoAprobacion` para guards.

## 5. Migración propuesta (aditiva)

```sql
-- Solo si SPEC-230/SPEC-234 no creó aún los campos de Expediente. Si ya existen, esta migración no aplica.
-- Se generará con `npx prisma migrate dev` a partir de ajustes al schema.

-- Ejemplo de valores de enum aditivos (PostgreSQL permite ADD VALUE):
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'EXPEDIENTE_TRANSICION_ESTADO';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'EXPEDIENTE_RETENIDO';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'EXPEDIENTE_SLA_VENCIDO';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'EXPEDIENTE_GRAVEDAD_SUBIO_A_ROJO';

-- Índices aditivos (si no existen):
CREATE INDEX IF NOT EXISTS "expedientes_estado_idx" ON "expedientes"("estado");
CREATE INDEX IF NOT EXISTS "expedientes_score_gravedad_actual_idx" ON "expedientes"("score_gravedad_actual");
CREATE INDEX IF NOT EXISTS "expedientes_ultimo_evento_en_idx" ON "expedientes"("ultimo_evento_en");
```

## 6. Notas de implementación

- Si SPEC-230 no incluye `scoreGravedadActual` como campo de `Expediente`, la migración de SPEC-236 no lo añade a menos que se autorice explícitamente; en ese caso se documenta como aditivo.
- La relación inversa `Expediente.eventos`, `Expediente.informesConsolidados` y `Expediente.aclaracion` se considera aditiva y no modifica columnas existentes.
- El worker usa `SELECT ... FOR UPDATE` solo cuando aplica una transición; las lecturas de monitoreo son lecturas consistentes sin bloqueo.
