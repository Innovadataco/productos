# Modelo de datos: SPEC-226 — Ejecución de acciones automáticas

## 1. Principios aplicados

- **Migraciones aditivas**: solo `CREATE TABLE`, `ALTER TYPE ... ADD VALUE`, `CREATE INDEX` y una relación inversa aditiva en `Recomendacion`. Cero `DROP`, cero cambios de tipo, cero borrado de datos.
- **Timestamptz(6)** en todos los campos de fecha nuevos.
- **DAL**: el acceso a `EjecucionAccion` pasa por un repositorio tipado (`src/lib/dal/repositories/ejecucion-accion.ts`); nada de SQL raw.
- **Sin PII**: `parametros` y `resultado` contienen ids de dominio (suscripción, bono, notificación, operador) y variables de negocio; nunca textos de reportes ni datos personales de reportados.

## 2. Entidades existentes consumidas (sin modificación)

| Entidad | Uso en SPEC-226 | Referencia |
|---------|-----------------|------------|
| `ReglaRecomendacion` (SPEC-221) | `modo`, `accionEjecutable`, `accionParametros`, `creadaPorAdminId` | brief §5.3 |
| `Recomendacion` (SPEC-221) | sujeto de la ejecución; se actualiza `estado`/`ejecutadaAutomatica` | brief §5.4 |
| `BonoPromocional` | destino de `CREAR_BONO` | `prisma/schema.prisma:794` |
| `Notificacion` / `NotificacionRegla` / `NotificacionPlantilla` | destino de `ENVIAR_NOTIFICACION`/`CREAR_ALERTA` (solo vía Motor Notif) | `prisma/schema.prisma:2279-2344` |
| `Usuario` (roles `OPERADOR`, `ADMIN`) | destinatario de `ASIGNAR_OPERADOR` y `CREAR_ALERTA` | `prisma/schema.prisma:428` |
| `ParametroSistema` | `ratelimit.analisis_accion.*`, `analisis.acciones.alertas_destinatarios` | `prisma/schema.prisma:592` |
| `AuditLog` / `AccionAudit` | trazabilidad con regla origen | `prisma/schema.prisma:46,613` |

## 3. Nuevas entidades aditivas

### 3.1 Enum `TipoAccionEjecutable`

```prisma
enum TipoAccionEjecutable {
  CREAR_BONO
  ENVIAR_NOTIFICACION
  ASIGNAR_OPERADOR
  CREAR_ALERTA
}
```

Mapeo con las claves criollas de `ReglaRecomendacion.accionEjecutable` (brief §9): `crear_bono` → `CREAR_BONO`, `enviar_notificacion` → `ENVIAR_NOTIFICACION`, `asignar_operador` → `ASIGNAR_OPERADOR`, `crear_alerta` → `CREAR_ALERTA`.

### 3.2 Enum `EstadoEjecucion`

```prisma
enum EstadoEjecucion {
  EJECUTADA
  REVERTIDA
  FALLIDA
}
```

### 3.3 Enum `OrigenEjecucion`

```prisma
enum OrigenEjecucion {
  AUTOMATICA      // worker de reglas, regla modo EJECUTA
  MANUAL_ADMIN    // endpoint aplicar (admin decide sobre una sugerencia)
}
```

### 3.4 Modelo `EjecucionAccion`

```prisma
model EjecucionAccion {
  id                  String               @id @default(cuid())
  recomendacionId     String
  reglaId             String
  tipoAccion          TipoAccionEjecutable
  parametros          Json                 // snapshot de accionParametros al ejecutar
  estado              EstadoEjecucion
  resultado           Json?                // ids creados: bonoId, programadas, operadorId, etc.
  motivoFallo         String?              // mensaje seguro (sin stack trace, sin PII)
  origenEjecucion     OrigenEjecucion
  ejecutadaPorAdminId String?              // si origenEjecucion = MANUAL_ADMIN
  ejecutadaEn         DateTime             @default(now()) @db.Timestamptz(6)
  revertidaEn         DateTime?            @db.Timestamptz(6)
  revertidaPorAdminId String?
  motivoReversion     String?
  createdAt           DateTime             @default(now()) @db.Timestamptz(6)

  recomendacion       Recomendacion        @relation(fields: [recomendacionId], references: [id])

  @@index([recomendacionId])
  @@index([reglaId, ejecutadaEn])
  @@index([estado, ejecutadaEn])
  @@map("ejecuciones_accion")
}
```

Notas:

- `reglaId` se desnormaliza (también accesible vía `recomendacion.reglaId`) para el rate-limit, las métricas por regla (SPEC-227) y el `AuditLog` sin join.
- `parametros` es snapshot deliberado: si la regla se edita después, la ejecución histórica conserva con qué parámetros actuó.
- La reversión NO crea una segunda fila: marca la misma `EjecucionAccion` como `REVERTIDA` (una acción = una fila; el historial de intentos fallidos sí genera filas `FALLIDA` adicionales).

### 3.5 Relación inversa aditiva en `Recomendacion` (modelo de SPEC-221)

```prisma
// Aditivo, sin tocar columnas existentes:
ejecuciones  EjecucionAccion[]
```

### 3.6 Valores aditivos de `AccionAudit`

```prisma
// Aditivo (ALTER TYPE ... ADD VALUE):
ANALISIS_ACCION_EJECUTADA
ANALISIS_ACCION_FALLIDA
ANALISIS_ACCION_REVERTIDA
```

Metadatos del log: `reglaId`, `reglaClave`, `recomendacionId`, `ejecucionAccionId`, `tipoAccion`, `origenEjecucion`, resumen del resultado (ids). Nunca textos de reportes ni PII.

## 4. Parámetros de sistema (seed idempotente, upsert por clave)

| Clave | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `ratelimit.analisis_accion.window_seconds` | INTEGER | 3600 | Ventana del rate-limit por regla |
| `ratelimit.analisis_accion.max_requests` | INTEGER | 20 | Máx. ejecuciones por regla por ventana |
| `analisis.acciones.alertas_destinatarios` | JSON | `[]` | usuarioIds admin destinatarios de `crear_alerta`; vacío = todos los ADMIN activos |

## 5. Catálogo Motor Notificaciones (seed aditivo, upsert)

| Registro | Detalle |
|----------|---------|
| Evento `analisis.alerta.admin` | Regla rol `ADMIN`, canal `EMAIL`; plantilla `es` con `{{severidad}}`, `{{mensaje}}`, `{{reglaClave}}`, `{{urlPanel}}` |
| Evento `analisis.operador.asignacion` | Regla rol `OPERADOR`, canales `EMAIL` + `IN_APP`; plantilla `es` con `{{tituloRecomendacion}}`, `{{descripcionRecomendacion}}`, `{{urlPanel}}` |

Solo upserts por clave; no se modifican eventos, reglas ni plantillas existentes.

## 6. Migración propuesta (aditiva)

```sql
-- Generada con `npx prisma migrate dev`; equivalente esperado:

CREATE TYPE "TipoAccionEjecutable" AS ENUM ('CREAR_BONO', 'ENVIAR_NOTIFICACION', 'ASIGNAR_OPERADOR', 'CREAR_ALERTA');
CREATE TYPE "EstadoEjecucion" AS ENUM ('EJECUTADA', 'REVERTIDA', 'FALLIDA');
CREATE TYPE "OrigenEjecucion" AS ENUM ('AUTOMATICA', 'MANUAL_ADMIN');

ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'ANALISIS_ACCION_EJECUTADA';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'ANALISIS_ACCION_FALLIDA';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'ANALISIS_ACCION_REVERTIDA';

CREATE TABLE "ejecuciones_accion" (
  "id" TEXT NOT NULL,
  "recomendacionId" TEXT NOT NULL,
  "reglaId" TEXT NOT NULL,
  "tipoAccion" "TipoAccionEjecutable" NOT NULL,
  "parametros" JSONB NOT NULL,
  "estado" "EstadoEjecucion" NOT NULL,
  "resultado" JSONB,
  "motivoFallo" TEXT,
  "origenEjecucion" "OrigenEjecucion" NOT NULL,
  "ejecutadaPorAdminId" TEXT,
  "ejecutadaEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revertidaEn" TIMESTAMPTZ(6),
  "revertidaPorAdminId" TEXT,
  "motivoReversion" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ejecuciones_accion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ejecuciones_accion_recomendacionId_fkey"
    FOREIGN KEY ("recomendacionId") REFERENCES "recomendaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "ejecuciones_accion_recomendacionId_idx" ON "ejecuciones_accion"("recomendacionId");
CREATE INDEX "ejecuciones_accion_reglaId_ejecutadaEn_idx" ON "ejecuciones_accion"("reglaId", "ejecutadaEn");
CREATE INDEX "ejecuciones_accion_estado_ejecutadaEn_idx" ON "ejecuciones_accion"("estado", "ejecutadaEn");
```

- `ON DELETE RESTRICT`: las recomendaciones no se borran en v1; si algún día se purgan, la trazabilidad de acciones manda.
- El nombre físico de la tabla de `Recomendacion` (`recomendaciones`) se confirmará contra el `@@map` que defina SPEC-221; si difiere, se ajusta la FK.

## 7. Notas de implementación

- La deduplicación de recomendaciones (`(reglaId, sujetoId)`) vive en SPEC-221; esta spec asume que una recomendación ejecutable es única por ventana de vida.
- Los índices `[reglaId, ejecutadaEn]` y `[estado, ejecutadaEn]` soportan el rate-limit por regla, las métricas de SPEC-227 (tasa de ejecución/reversión por regla) y la búsqueda de la ejecución `EJECUTADA` para rollback.
- Ningún campo almacena contenido de reportes; `parametros`/`resultado` son metadatos de negocio (Ley 1581 OK).
