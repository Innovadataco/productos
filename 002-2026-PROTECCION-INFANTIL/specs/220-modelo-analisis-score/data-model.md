# Modelo de datos: SPEC-220 — Modelo Análisis + score de valor de cliente

## 1. Principios aplicados

- **Migraciones aditivas**: solo `CREATE TABLE`, `CREATE TYPE` (enums nuevos), `ALTER TYPE ... ADD VALUE` (enum existente), `CREATE INDEX` y relaciones inversas. Cero `DROP`, cero `ALTER COLUMN` destructivo, cero eliminación de datos.
- **Cero cambios de columnas** en tablas existentes (`Suscripcion`, `SesionLog`, `Reporte`, `AlertaColegio`, `SeguimientoCaso`, `Expediente`, `Usuario`, `ParametroSistema`, `AuditLog`); solo se añaden relaciones inversas (Prisma-level, sin DDL sobre esas tablas salvo índices nuevos en tablas nuevas).
- **Timestamptz(6)** en timestamps de negocio nuevos, siguiendo el patrón del módulo Pagos y `SesionLog`.
- **Sin PII por construcción**: los modelos nuevos guardan conteos, pesos, percentiles, plantillas y metadatos de reglas; nunca texto de reportes, identificadores reportados ni datos de menores.

## 2. Entidades existentes consumidas (sin modificación)

| Entidad | Uso en SPEC-220 | Referencia |
|---|---|---|
| `Suscripcion` | Titular del score (`tipoTitular`, `colegioId`, `usuarioId`, `estado`). Se añade relación inversa `scoreClientes ScoreCliente[]`. | `prisma/schema.prisma:723` |
| `Plan` | Contexto futuro de cohortes/plan (SPEC-222). Sin cambios. | `prisma/schema.prisma:677` |
| `Colegio` | Join a `tenantId` para componentes del titular COLEGIO. | `prisma/schema.prisma:873` |
| `SesionLog` | Fuente del componente SESIONES (`usuarioId`/`tenantId`). **Sin `suscripcionId`** (divergencia brief §5.1 documentada). | `prisma/schema.prisma:640` |
| `Reporte` | Fuente del componente REPORTES (`usuarioId`/`tenantId`, `eliminado = false`). | `prisma/schema.prisma:1427` |
| `SeguimientoCaso` | Fuente del componente CASOS (COLEGIO). | `prisma/schema.prisma:1304` |
| `AlertaColegio` | Fuente del componente ALERTAS (COLEGIO). | `prisma/schema.prisma:1188` |
| `Expediente` | Fuente del componente CASOS (PADRE). | `prisma/schema.prisma:2100` |
| `ParametroSistema` | Parámetros `analisis.*` (filas nuevas por seed; tabla sin cambios). | `prisma/schema.prisma:592` |
| `AuditLog` | Registro de purga de retención (filas nuevas; tabla sin cambios). | `prisma/schema.prisma:613` |
| `Usuario` | FKs `creadaPorAdminId`, `resueltaPorAdminId`, `destinatarioId` (relaciones inversas aditivas). | `prisma/schema.prisma:428` |

## 3. Nuevas entidades aditivas

### 3.1 `ScoreCliente` — snapshot mensual del score de valor

```prisma
model ScoreCliente {
  id                 String   @id @default(cuid())
  suscripcionId      String
  periodo            String // "YYYY-MM" mes calendario America/Bogota
  componenteReportes Int      @default(0)
  componenteCasos    Int      @default(0)
  componenteAlertas  Int      @default(0)
  componenteSesiones Int      @default(0)
  pesoReportes       Float
  pesoCasos          Float
  pesoAlertas        Float
  pesoSesiones       Float
  scoreTotal         Float
  percentilEnCohorte Float?
  calculadoEn        DateTime @default(now()) @db.Timestamptz(6)

  suscripcion Suscripcion @relation(fields: [suscripcionId], references: [id], onDelete: Cascade)

  @@unique([suscripcionId, periodo])
  @@index([periodo, scoreTotal(sort: Desc)])
  @@map("score_clientes")
}
```

- `@@unique([suscripcionId, periodo])`: idempotencia del recálculo (upsert).
- `peso*`: snapshot de los pesos al momento del cálculo (auditoría del histórico).
- `onDelete: Cascade`: si se elimina una suscripción, sus snapshots van con ella (son datos derivados del cliente, no evidencia).

### 3.2 `ReglaRecomendacion` — definición de regla (lógica en SPEC-221/224)

```prisma
model ReglaRecomendacion {
  id                     String    @id @default(cuid())
  clave                  String    @unique // ej: "vencimiento.T_menos_7"
  nombre                 String
  descripcion            String
  categoria              String // "renovacion" | "churn" | "crecimiento" | "anomalia"
  sqlQuery               String
  plantillaRecomendacion String // markdown con {{variables}}
  modo                   ModoRegla @default(RECOMIENDA)
  accionEjecutable       String?
  accionParametros       Json?
  prioridad              Int       @default(50) // 0=baja, 100=alta
  umbralMinimo           Float?
  frecuenciaMin          Int       @default(60)
  activa                 Boolean   @default(true)
  creadaPorAdminId       String
  createdAt              DateTime  @default(now()) @db.Timestamptz(6)
  updatedAt              DateTime  @updatedAt @db.Timestamptz(6)

  creadaPor       Usuario         @relation(fields: [creadaPorAdminId], references: [id])
  recomendaciones Recomendacion[]

  @@index([activa, prioridad(sort: Desc)])
  @@map("reglas_recomendacion")
}
```

### 3.3 `Recomendacion` — instancia generada (lógica en SPEC-221/227)

```prisma
model Recomendacion {
  id                  String              @id @default(cuid())
  reglaId             String
  titulo              String
  descripcion         String
  categoria           String
  prioridad           Int
  sujetoTipo          String? // "Suscripcion" | "Colegio" | "Usuario" (polimórfico, sin FK)
  sujetoId            String?
  datosContexto       Json
  accionSugerida      String?
  accionParametros    Json?
  estado              EstadoRecomendacion @default(PENDIENTE)
  generadaEn          DateTime            @default(now()) @db.Timestamptz(6)
  resueltaEn          DateTime?           @db.Timestamptz(6)
  resueltaPorAdminId  String?
  motivoResolucion    String?
  expiraEn            DateTime            @db.Timestamptz(6)
  ejecutadaAutomatica Boolean             @default(false)

  regla       ReglaRecomendacion @relation(fields: [reglaId], references: [id])
  resueltaPor Usuario?           @relation(fields: [resueltaPorAdminId], references: [id])

  @@index([estado, prioridad(sort: Desc), generadaEn(sort: Desc)])
  @@index([sujetoId])
  @@map("recomendaciones")
}
```

### 3.4 `DigestSemanal` — resumen semanal (lógica en SPEC-223)

```prisma
model DigestSemanal {
  id             String    @id @default(cuid())
  periodo        String // "2026-W34" ISO week America/Bogota
  destinatarioId String
  generadoEn     DateTime  @default(now()) @db.Timestamptz(6)
  enviadoEn      DateTime? @db.Timestamptz(6)
  top5Decisiones Json
  kpisSemana     Json
  kpisVsPrevia   Json
  enlacePanel    String
  estado         String // "generado" | "enviado" | "fallido" (valores cerrados, patrón AlertaColegio.estado)

  destinatario Usuario @relation(fields: [destinatarioId], references: [id])

  @@unique([periodo, destinatarioId])
  @@map("digest_semanal")
}
```

### 3.5 `Anomalia` — detección por reglas (lógica en SPEC-225)

```prisma
model Anomalia {
  id                 String    @id @default(cuid())
  tipo               String // "PAGO_ATRASADO_CLIENTE_HISTORICAMENTE_PUNTUAL" | "CRECIMIENTO_ANOMALO_CIUDAD" | "USO_CAIDO_ABRUPTO" | ...
  sujetoTipo         String?
  sujetoId           String?
  severidad          String // "BAJA" | "MEDIA" | "ALTA" (valores cerrados)
  descripcion        String
  datosContexto      Json
  detectadaEn        DateTime  @default(now()) @db.Timestamptz(6)
  resueltaEn         DateTime? @db.Timestamptz(6)
  resueltaPorAdminId String?

  resueltaPor Usuario? @relation(fields: [resueltaPorAdminId], references: [id])

  @@index([tipo, detectadaEn(sort: Desc)])
  @@index([severidad, detectadaEn(sort: Desc)])
  @@map("anomalias")
}
```

### 3.6 Enums nuevos y valor aditivo

```prisma
enum ModoRegla {
  RECOMIENDA
  EJECUTA
}

enum EstadoRecomendacion {
  PENDIENTE
  APLICADA
  IGNORADA
  EXPIRADA
}

// Valor aditivo en enum existente (patrón: comentario con SPEC):
enum AccionAudit {
  // ... valores existentes ...
  // SPEC-220 (002-PI-121): purga de retención de snapshots de score.
  ANALISIS_SCORE_PURGA
}
```

## 4. Parámetros de sistema (seed aditivo, idempotente)

Tabla `ParametroSistema` existente; filas nuevas vía `prisma/seed.ts` (upsert por `clave`, `CategoriaParametro.SYSTEM`, `esPublico: false`, `esSecreto: false`):

| Clave | Tipo | Default | Descripción |
|---|---|---|---|
| `analisis.score.peso_reportes` | FLOAT | 3 | Peso del componente Reportes |
| `analisis.score.peso_casos` | FLOAT | 5 | Peso del componente Casos |
| `analisis.score.peso_alertas` | FLOAT | 2 | Peso del componente Alertas |
| `analisis.score.peso_sesiones` | FLOAT | 1 | Peso del componente Sesiones |
| `analisis.score.frecuencia_recalculo_horas` | INTEGER | 24 | Horas entre recálculos del score (cron worker) |
| `analisis.score.retencion_meses` | INTEGER | 24 | Meses de retención de snapshots antes de purga (Ley 1581) |
| `analisis.recomendaciones.frecuencia_evaluacion_min` | INTEGER | 60 | Minutos entre evaluaciones del motor de reglas (SPEC-221) |
| `analisis.digest.dia_semana` | INTEGER | 1 | Día de envío del digest (1 = lunes) |
| `analisis.digest.hora_bogota` | INTEGER | 8 | Hora Bogotá de envío del digest |
| `analisis.anomalias.crecimiento_pct_umbral` | FLOAT | 25 | % de cambio que dispara anomalía de crecimiento |
| `analisis.anomalias.mora_dias_umbral_alta` | INTEGER | 30 | Días de mora para severidad ALTA |
| `analisis.anomalias.mora_dias_umbral_media` | INTEGER | 15 | Días de mora para severidad MEDIA |

Nota: `analisis.sesiones.timeout_inactividad_min` y `analisis.sesiones.ping_actividad_min` pertenecen a SPEC-206 (ya sembrados); no se duplican.

## 5. Relaciones inversas a añadir (Prisma-level, aditivas)

```prisma
// En Suscripcion:
scoreClientes ScoreCliente[]

// En Usuario (con nombres de relación para no colisionar):
reglasRecomendacionCreadas ReglaRecomendacion[]
recomendacionesResueltas   Recomendacion[]
anomaliasResueltas         Anomalia[]
digestsSemanal             DigestSemanal[]
```

## 6. Migración propuesta (aditiva)

Generada con `npx prisma migrate dev --name analisis_modelo_score`. Contenido esperado (solo aditivo):

```sql
CREATE TYPE "ModoRegla" AS ENUM ('RECOMIENDA', 'EJECUTA');
CREATE TYPE "EstadoRecomendacion" AS ENUM ('PENDIENTE', 'APLICADA', 'IGNORADA', 'EXPIRADA');
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'ANALISIS_SCORE_PURGA';

CREATE TABLE "score_clientes" ( ... );
CREATE TABLE "reglas_recomendacion" ( ... );
CREATE TABLE "recomendaciones" ( ... );
CREATE TABLE "digest_semanal" ( ... );
CREATE TABLE "anomalias" ( ... );
-- + CREATE INDEX / UNIQUE INDEX de cada @@index/@@unique
-- + ALTER TABLE ... ADD CONSTRAINT FK hacia suscripciones/usuarios/reglas_recomendacion
```

Verificación pre-merge: el SQL de la migración NO debe contener `DROP`, `ALTER COLUMN ... TYPE` sobre tablas existentes ni `DELETE`.

## 7. Notas de implementación

- La comparación de retención se hace sobre el string `periodo` (`"YYYY-MM"`): la ordenación lexicográfica coincide con la cronológica, por lo que `periodo < periodoLimite` es una query trivial e indexada.
- `sujetoTipo`/`sujetoId` sin FK es deliberado (polimorfismo del brief §5.4/§5.6); la integridad la valida la capa de servicio en SPEC-221/225.
- Si en el futuro el CEO pide el "resumen histórico agregado" del brief §14, se añadirá una tabla `ScoreClienteResumen` en una SPEC posterior sin tocar esta migración.
