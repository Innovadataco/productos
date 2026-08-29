# Modelo de datos: SPEC-225 — Detección de anomalías dinero-vs-valor

## 1. Principios aplicados

- **Migraciones aditivas**: solo `CREATE TABLE`, `CREATE TYPE`, `CREATE INDEX` y (si aplica) `ALTER TYPE ... ADD VALUE`. Cero `DROP`, cero alteración destructiva.
- **Timestamptz(6)**: todos los timestamps nuevos usan `@db.Timestamptz(6)`, convención del schema actual.
- **No se modifican columnas existentes** de `Suscripcion`, `Pago`, `SesionLog`, `Reporte` ni `Ciudad`; solo se añade una relación inversa aditiva en `Usuario` (anomalías resueltas).
- El modelo `Anomalia` se crea **en esta spec** por mandato explícito del instructivo 002-PI-126 ("Modelo Anomalia + worker de detección"). Si al implementar SPEC-220 ya lo hubiera materializado, se omite esta migración y se ajustan solo los campos faltantes de forma aditiva.

## 2. Nuevas entidades

### 2.1 Enum `SeveridadAnomalia`

```prisma
enum SeveridadAnomalia {
  BAJA
  MEDIA
  ALTA
}
```

### 2.2 Enum `TipoAnomalia`

```prisma
enum TipoAnomalia {
  PAGO_ATRASADO_CLIENTE_HISTORICAMENTE_PUNTUAL
  CRECIMIENTO_ANOMALO_CIUDAD
  USO_CAIDO_ABRUPTO
  CANCELACION_COLEGIO_GRANDE
  CAIDA_RECAUDO_CIUDAD
  CANCELACIONES_MASIVAS_24H
}
```

### 2.3 Modelo `Anomalia`

Refleja `BRIEF-ANALISIS-DINERO-VS-VALOR.md` §5.6, con tipos enum en vez de `String` libre (TypeScript estricto; el brief usa String como pseudocódigo).

```prisma
// SPEC-225 (002-PI-126): anomalía del negocio detectada por reglas (sin IA).
// datosContexto contiene SOLO agregados (conteos, porcentajes, umbrales, ids
// internos); nunca texto de reportes ni PII (Ley 1581).
model Anomalia {
  id                 String            @id @default(cuid())
  tipo               TipoAnomalia
  sujetoTipo         String?           // "Suscripcion" | "Colegio" | "Ciudad" | null (global)
  sujetoId           String?
  severidad          SeveridadAnomalia
  descripcion        String
  datosContexto      Json
  detectadaEn        DateTime          @default(now()) @db.Timestamptz(6)
  resueltaEn         DateTime?         @db.Timestamptz(6)
  resueltaPorAdminId String?

  resueltaPorAdmin   Usuario?          @relation("AnomaliasResueltas", fields: [resueltaPorAdminId], references: [id])

  @@index([tipo, detectadaEn(sort: Desc)])
  @@index([severidad, detectadaEn(sort: Desc)])
  @@index([resueltaEn])
  @@map("anomalias")
}
```

Relación inversa aditiva en `Usuario` (no modifica columnas):

```prisma
model Usuario {
  // ... campos existentes ...
  anomaliasResueltas Anomalia[] @relation("AnomaliasResueltas")
}
```

Notas de diseño:

- `sujetoTipo`/`sujetoId` quedan como `String` (sin FK dura) porque el sujeto puede ser `Suscripcion`, `Colegio` o `Ciudad` — una FK polimórfica no es expresable en Prisma. La integridad la garantiza el detector (siempre escribe ids leídos de la BD en el mismo tick).
- No hay campo `tenantId`: las anomalías son globales de plataforma (agregan todos los tenants), coherente con el rol único ADMIN del módulo.
- La deduplicación (`resueltaEn IS NULL` por tipo+sujeto) se resuelve en código; el índice `@@index([resueltaEn])` acelera ese `findFirst`.

### 2.4 Valor aditivo en `AccionAudit` (si se aprueba en compuerta)

```sql
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'ANOMALIA_RESUELTA';
```

## 3. Filas sembradas (sin cambios de schema)

### 3.1 `ParametroSistema` — namespace `analisis.anomalias.*`

Todas `categoria = SYSTEM`, `esPublico = false`, `esSecreto = false`, seed idempotente por `clave`:

| Clave | Tipo | Default |
|---|---|---|
| `analisis.anomalias.tick_min` | INTEGER | 60 |
| `analisis.anomalias.mora_dias_umbral_media` | INTEGER | 15 |
| `analisis.anomalias.mora_dias_umbral_alta` | INTEGER | 30 |
| `analisis.anomalias.crecimiento_pct_umbral` | FLOAT | 25 |
| `analisis.anomalias.uso_caido_pct_umbral` | FLOAT | 50 |
| `analisis.anomalias.caida_recaudo_pct_umbral` | FLOAT | 30 |
| `analisis.anomalias.cancelaciones_24h_umbral` | INTEGER | 5 |
| `analisis.anomalias.colegio_grande_min_reportes` | INTEGER | 50 |
| `analisis.anomalias.base_minima_comparacion` | INTEGER | 3 |
| `analisis.anomalias.email_inmediato_habilitado` | BOOLEAN | true |

### 3.2 Motor Notif (catálogo aditivo, patrón `prisma/seed.ts:1918-1955`)

`NotificacionRegla`:

| evento | rol | offset | canal | obligatoria |
|---|---|---|---|---|
| `analisis.anomalia.detectada` | `ADMIN` | `+0m` | `EMAIL` | true |
| `analisis.anomalia.detectada` | `ADMIN` | `+0m` | `IN_APP` | true |

`NotificacionPlantilla` (Markdown, español neutro, sin voseo):

- `analisis.anomalia.detectada.email` — asunto: "Anomalía crítica detectada: {{tipoAnomalia}}"; cuerpo con `{{descripcion}}`, `{{severidad}}`, `{{fechaDeteccion}}`, `{{urlAnomalia}}`.
- `analisis.anomalia.detectada.in_app` — versión corta con `{{tipoAnomalia}}` y `{{urlAnomalia}}`.

## 4. Migración propuesta (aditiva)

Generada con `npx prisma migrate dev` a partir del schema; forma esperada:

```sql
CREATE TYPE "TipoAnomalia" AS ENUM (
  'PAGO_ATRASADO_CLIENTE_HISTORICAMENTE_PUNTUAL',
  'CRECIMIENTO_ANOMALO_CIUDAD',
  'USO_CAIDO_ABRUPTO',
  'CANCELACION_COLEGIO_GRANDE',
  'CAIDA_RECAUDO_CIUDAD',
  'CANCELACIONES_MASIVAS_24H'
);
CREATE TYPE "SeveridadAnomalia" AS ENUM ('BAJA', 'MEDIA', 'ALTA');

CREATE TABLE "anomalias" (
  "id" TEXT NOT NULL,
  "tipo" "TipoAnomalia" NOT NULL,
  "sujeto_tipo" TEXT,
  "sujeto_id" TEXT,
  "severidad" "SeveridadAnomalia" NOT NULL,
  "descripcion" TEXT NOT NULL,
  "datos_contexto" JSONB NOT NULL,
  "detectada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resuelta_en" TIMESTAMPTZ(6),
  "resuelta_por_admin_id" TEXT,
  CONSTRAINT "anomalias_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "anomalias_resuelta_por_admin_id_fkey"
    FOREIGN KEY ("resuelta_por_admin_id") REFERENCES "usuarios"("id")
);

CREATE INDEX "anomalias_tipo_detectada_en_idx" ON "anomalias"("tipo", "detectada_en" DESC);
CREATE INDEX "anomalias_severidad_detectada_en_idx" ON "anomalias"("severidad", "detectada_en" DESC);
CREATE INDEX "anomalias_resuelta_en_idx" ON "anomalias"("resuelta_en");

ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'ANOMALIA_RESUELTA';
```

## 5. Consultas de las reglas (resumen)

| Regla | Tablas leídas | Escritura |
|---|---|---|
| Mora anómala | `Suscripcion`, `Pago` | `Anomalia` |
| Crecimiento ciudad | `Suscripcion`, `Colegio` | `Anomalia` |
| Uso caído | `SesionLog` | `Anomalia` |
| Cancelación colegio grande | `Suscripcion`, `Reporte` (COUNT) | `Anomalia` |
| Caída recaudo ciudad | `Pago`, `Suscripcion`, `Colegio` | `Anomalia` |
| Cancelaciones 24h | `Suscripcion` | `Anomalia` |

Todas las lecturas usan índices existentes (`Suscripcion`: `[estado, fechaFin]`, `[tipoTitular, estado]`; `Pago`: `[estado, fechaReporte]`, `[suscripcionId, createdAt]`; `SesionLog`: `[tenantId, iniciadaEn DESC]`); no se requieren índices nuevos sobre tablas existentes.

## 6. Retención

Las anomalías son metadatos de negocio sin PII; no se purgan en v1. Si el volumen lo justifica, una retención (p. ej. 24 meses, coherente con `analisis.score.retencion_meses` del brief §14) se radica como spec aparte.
