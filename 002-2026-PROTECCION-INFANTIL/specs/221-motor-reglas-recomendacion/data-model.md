# Modelo de datos: SPEC-221 — Motor de reglas de recomendación

## 1. Principios aplicados

- **Migraciones aditivas**: solo `CREATE TABLE`, `CREATE INDEX`, `ALTER TYPE ... ADD VALUE`. Cero `DROP`, cero cambio de tipo, cero borrado de datos.
- **Timestamptz(6)** en timestamps nuevos de negocio (`expiraEn`, `ultimaEvaluacionEn`, `generadaEn`), coherente con el módulo de pagos y notificaciones.
- **Sin FK dura al sujeto**: `sujetoTipo`/`sujetoId` siguen el precedente de `Notificacion` (`prisma/schema.prisma:2287-2288`); el sujeto puede ser `Suscripcion`, `Colegio` o `Usuario` y puede desaparecer sin romper la recomendación.
- **Cero PII de reportes**: ningún campo referencia `Reporte` ni identificadores reportados; `datosContexto` guarda solo variables comerciales del render.

## 2. Nuevos enums

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
```

Valor aditivo en enum existente:

```prisma
enum AccionAudit {
  // ... valores existentes ...
  RECOMENDACION_RESUELTA   // SPEC-221
}
```

## 3. Nuevas entidades

### 3.1 `ReglaRecomendacion` (tabla `reglas_recomendacion`)

Brief §5.3. Definición de una regla configurable del motor.

```prisma
model ReglaRecomendacion {
  id                     String    @id @default(cuid())
  clave                  String    @unique              // ej: "vencimiento.T_menos_7"
  nombre                 String                         // "Llamar a clientes que vencen esta semana"
  descripcion            String
  categoria              String                         // "renovacion" | "churn" | "crecimiento" | "anomalia"
  sqlQuery               String                         // SELECT/WITH parametrizada; sandboxed por ejecutor
  plantillaRecomendacion String                         // markdown con {{variables}}
  modo                   ModoRegla @default(RECOMIENDA) // D-77: RECOMIENDA por default
  accionEjecutable       String?                        // "crear_bono_retencion" | "enviar_notificacion" | ... (SPEC-226)
  accionParametros       Json?
  prioridad              Int       @default(50)         // 0=baja 100=alta
  umbralMinimo           Float?                         // requiere columna `valor` en la query
  frecuenciaMin          Int       @default(60)
  activa                 Boolean   @default(true)
  ultimaEvaluacionEn     DateTime? @db.Timestamptz(6)
  creadaPorAdminId       String
  createdAt              DateTime  @default(now()) @db.Timestamptz(6)
  updatedAt              DateTime  @updatedAt @db.Timestamptz(6)

  creadaPor      Usuario         @relation(fields: [creadaPorAdminId], references: [id], name: "ReglasCreadas")
  recomendaciones Recomendacion[]

  @@index([activa, prioridad(sort: Desc)])
  @@map("reglas_recomendacion")
}
```

### 3.2 `Recomendacion` (tabla `recomendaciones`)

Brief §5.4. Instancia generada por una regla para un sujeto candidato.

```prisma
model Recomendacion {
  id                  String              @id @default(cuid())
  reglaId             String
  titulo              String              // renderizado desde plantilla + variables
  descripcion         String
  categoria           String              // heredado de la regla
  prioridad           Int                 // heredado de la regla
  sujetoTipo          String?             // "Suscripcion" | "Colegio" | "Usuario"
  sujetoId            String?
  datosContexto       Json                // variables del render + snapshot comercial (sin PII de reportes)
  accionSugerida      String?             // "llamar" | "crear_bono" | "enviar_email" | ...
  accionParametros    Json?
  estado              EstadoRecomendacion @default(PENDIENTE)
  generadaEn          DateTime            @default(now()) @db.Timestamptz(6)
  resueltaEn          DateTime?           @db.Timestamptz(6)
  resueltaPorAdminId  String?
  motivoResolucion    String?
  expiraEn            DateTime            @db.Timestamptz(6) // default: generadaEn + analisis.recomendaciones.expiracion_dias
  ejecutadaAutomatica Boolean             @default(false)    // true solo cuando SPEC-226 ejecute reglas EJECUTA

  regla         ReglaRecomendacion @relation(fields: [reglaId], references: [id])
  resueltaPor   Usuario?           @relation(fields: [resueltaPorAdminId], references: [id], name: "RecomendacionesResueltas")

  @@index([estado, prioridad(sort: Desc), generadaEn(sort: Desc)])
  @@index([reglaId, sujetoId, estado])
  @@index([sujetoId])
  @@index([expiraEn])
  @@map("recomendaciones")
}
```

### 3.3 Relaciones inversas aditivas en `Usuario`

```prisma
model Usuario {
  // ... campos existentes sin cambios ...
  reglasRecomendacionCreadas ReglaRecomendacion[] @relation("ReglasCreadas")
  recomendacionesResueltas   Recomendacion[]     @relation("RecomendacionesResueltas")
}
```

Aditivo, sin columnas nuevas en `usuarios`.

## 4. Parámetros `ParametroSistema` (seed, categoría `SYSTEM`)

| Clave | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `analisis.recomendaciones.frecuencia_evaluacion_min` | INTEGER | 60 | Piso global de cadencia de evaluación (brief §5.7) |
| `analisis.recomendaciones.expiracion_dias` | INTEGER | 7 | Días hasta que una recomendación PENDIENTE expira (brief §5.4) |
| `analisis.recomendaciones.statement_timeout_ms` | INTEGER | 5000 | Timeout del sandbox SQL por regla |

Los demás parámetros `analisis.*` (pesos de score, digest, anomalías, sesiones) los siembra SPEC-220 u otras specs del mega-lote; esta spec solo siembra los suyos.

## 5. Reglas semilla (seed, modo `RECOMIENDA` todas)

| Clave | Categoría | Prioridad | Frecuencia (min) | Fuente de datos (schema real) |
|-------|-----------|-----------|------------------|-------------------------------|
| `vencimiento.T_menos_7` | renovacion | 90 | 720 | `Suscripcion.estado = ACTIVA` AND `fechaFin` en [ahora, ahora+7d] |
| `mora.T_mas_30` | churn | 80 | 720 | `Suscripcion.estado = SUSPENDIDA` AND `suspendidaEn < ahora-30d` |
| `padres_de_colegio_no_renovado` | churn | 70 | 1440 | `Suscripcion` COLEGIO `CANCELADA` + suscripciones `PADRE` activas vía `Usuario.tenantId` (tunable v1) |
| `crecimiento_ciudad_anomalo` | anomalia | 60 | 1440 | Conteo de `Suscripcion` nuevas por `Colegio.ciudadId`, semana actual vs. anterior, \|Δ\| > 25% (columna `valor` + `umbralMinimo = 25`) |
| `cliente_puntual_ahora_atrasado` | anomalia | 75 | 720 | `Suscripcion` con ≥2 `Pago` autorizados y estado actual `EN_GRACIA`/`SUSPENDIDA` |
| `alta_freemium_expira_manana` | renovacion | 85 | 360 | `Suscripcion.esFreemium = true` AND `freemiumFechaFin` en [ahora, ahora+1d] |
| `nuevo_referido_registrado_sin_pagar_7d` | crecimiento | 65 | 720 | `Suscripcion.codigoReferidoUsado IS NOT NULL` AND `createdAt < ahora-7d` AND sin `Pago` autorizado |

Convención de columnas de salida: `sujeto_tipo`, `sujeto_id`, `valor` (si hay umbral) + las variables que use cada `plantillaRecomendacion` (`{{colegio}}`, `{{fecha_fin}}`, `{{plan}}`, etc.). Las queries exactas viven en `src/lib/analisis/reglas/seed-reglas.ts` y se validan ejecutándolas en el test de seed contra la PostgreSQL de tests.

## 6. Migración propuesta (aditiva)

```sql
-- Enums nuevos
CREATE TYPE "ModoRegla" AS ENUM ('RECOMIENDA', 'EJECUTA');
CREATE TYPE "EstadoRecomendacion" AS ENUM ('PENDIENTE', 'APLICADA', 'IGNORADA', 'EXPIRADA');

-- Valor aditivo en enum existente
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'RECOMENDACION_RESUELTA';

-- Tablas nuevas (DDL completo generado por `npx prisma migrate dev`)
CREATE TABLE "reglas_recomendacion" ( ... );
CREATE TABLE "recomendaciones" ( ... );

-- Índices
CREATE INDEX "reglas_recomendacion_activa_prioridad_idx" ON "reglas_recomendacion"("activa", "prioridad" DESC);
CREATE INDEX "recomendaciones_estado_prioridad_generada_idx" ON "recomendaciones"("estado", "prioridad" DESC, "generadaEn" DESC);
CREATE INDEX "recomendaciones_regla_sujeto_estado_idx" ON "recomendaciones"("reglaId", "sujetoId", "estado");
CREATE INDEX "recomendaciones_sujeto_idx" ON "recomendaciones"("sujetoId");
CREATE INDEX "recomendaciones_expira_idx" ON "recomendaciones"("expiraEn");
```

## 7. Notas de implementación

- La deduplicación `(reglaId, sujetoId, estado = PENDIENTE)` se aplica en lógica de aplicación (SELECT + UPDATE/INSERT en TX), no con constraint único parcial (Prisma no lo expresa y `sujetoId` es nullable). El índice `recomendaciones_regla_sujeto_estado_idx` soporta el lookup.
- No se crea FK de `Recomendacion.sujetoId` a ninguna tabla: integridad por aplicación, precedente `Notificacion.sujetoId`.
- Si SPEC-220 ya creó estas tablas en la misma rama (solapamiento documentado en `research.md` §3.1), la migración de esta spec se reduce a los campos/índices faltantes; nunca se recrean ni se alteran destructivamente.
