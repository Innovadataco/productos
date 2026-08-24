# Modelo de datos: SPEC-224 — Panel de reglas configurables

## 1. Principios aplicados

- **Migraciones aditivas**: solo `CREATE TABLE`, `ADD COLUMN` con default, `ALTER TYPE ... ADD VALUE` e índices `IF NOT EXISTS`. Cero `DROP`, cero cambio de tipo, cero borrado de datos.
- **Timestamptz(6)** en timestamps nuevos, coherente con `Suscripcion`/`Pago` del módulo Pagos.
- **Los modelos de SPEC-221 no se redefinen**: esta spec los consume y solo añade lo que le falte de forma aditiva.

## 2. Entidades existentes consumidas (definidas en SPEC-221)

### 2.1 `ReglaRecomendacion`

Campos relevantes (brief §5.3):

| Campo | Uso en SPEC-224 |
|-------|-----------------|
| `id` | PK; parámetro de ruta `[id]`. |
| `clave` | Única e **inmutable** tras creación (identidad para worker e historial). |
| `nombre` / `descripcion` / `categoria` | Editables; columnas de la tabla del panel. |
| `sqlQuery` | Editado en el editor; validado estáticamente y testeable en solo lectura. |
| `plantillaRecomendacion` | Editada; sus `{{variables}}` se verifican contra las columnas del test. |
| `modo` | `ModoRegla` (`RECOMIENDA`/`EJECUTA`); solo cambia por el endpoint dedicado con confirmación fuerte. |
| `accionEjecutable` / `accionParametros` | Editables; requeridos para que `EJECUTA` tenga efecto (SPEC-226). |
| `prioridad` (0-100) / `umbralMinimo` / `frecuenciaMin` / `activa` | Editables; `prioridad` ordena la tabla del panel. |
| `creadaPorAdminId` | Trazabilidad de creación. |

### 2.2 `Recomendacion`

Solo lectura: conteo por `reglaId` con `generadaEn >= ahora - 7 días` para la columna "Generadas (7d)" de la tabla.

## 3. Nuevas entidades aditivas de SPEC-224

### 3.1 `ReglaRecomendacionHistorial` (tabla nueva)

```prisma
// SPEC-224 (002-PI-125): versionado auditable de reglas de recomendación.
model ReglaRecomendacionHistorial {
  id                String   @id @default(cuid())
  reglaId           String
  version           Int
  snapshot          Json     // estado completo de la regla ANTES del cambio
  motivo            String
  cambiadoPorAdminId String
  creadoEn          DateTime @default(now()) @db.Timestamptz(6)

  regla        ReglaRecomendacion @relation(fields: [reglaId], references: [id])
  cambiadoPor  Usuario            @relation(fields: [cambiadoPorAdminId], references: [id])

  @@unique([reglaId, version])
  @@index([reglaId, creadoEn(sort: Desc)])
  @@map("regla_recomendacion_historial")
}
```

- El snapshot se inserta en la misma transacción que actualiza la regla (atomicidad garantizada; `logAudit` soporta `tx`, `src/lib/audit.ts:19-48`).
- `@@unique([reglaId, version])` hace imposible perder o duplicar una versión.
- Sin `ON DELETE CASCADE`: las reglas no se borran en v1 (solo se desactivan), así que el historial es permanente.

### 3.2 Columna aditiva en `ReglaRecomendacion` (condicional)

```sql
-- Solo si SPEC-221 no incluyó el campo version:
ALTER TABLE "regla_recomendacion" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
```

Si SPEC-221 ya lo incluye, esta migración no aplica y se documenta.

### 3.3 Valores aditivos de `AccionAudit`

```sql
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'REGLA_CREADA';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'REGLA_ACTUALIZADA';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'REGLA_ACTIVADA';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'REGLA_DESACTIVADA';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'REGLA_PROMOVIDA_EJECUTA';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'REGLA_REVERTIDA_RECOMIENDA';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'REGLA_SQL_TEST';
```

En el schema Prisma se añaden al final del enum (`prisma/schema.prisma:46`) con comentario `// SPEC-224 (002-PI-125): ciclo de vida y promoción de reglas de recomendación.`

Notas de uso:
- `REGLA_SQL_TEST` registra solo metadatos (huella del query, duración, filas de muestra, admin). **Nunca** filas de resultado ni texto de reportes.
- Promoción/reversión registran `valorAnterior`/`valorNuevo` con el modo y el motivo en `metadatos`.

### 3.4 Parámetros `ParametroSistema` (seed idempotente, upsert por `clave`)

| Clave | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `analisis.reglas.test_timeout_ms` | INTEGER | 5000 | `statement_timeout` del test SQL (aplicado acotado 1000..30000) |
| `analisis.reglas.test_max_filas` | INTEGER | 50 | Máximo de filas en la muestra del test (aplicado acotado 1..200) |

### 3.5 Permiso de módulo

- Fila aditiva en el catálogo `src/lib/permisos-catalogo.ts` (orden 76, `esCritico: true`, categoría `admin`): clave `analisis_admin`, nombre "Análisis · Reglas".
- Seed aditivo en `PermisoModulo`: concedido a `ADMIN` (upsert por `(rol, moduloClave)` según el patrón existente del seed).

## 4. Índices

- `ReglaRecomendacionHistorial`: `@@unique([reglaId, version])` + `@@index([reglaId, creadoEn DESC])` (historial por regla, lo único que consulta el panel).
- Conteo 7 días: usa el índice existente de `Recomendacion` (`@@index([estado, prioridad, generadaEn])` en SPEC-221 incluye `generadaEn`); si la cardinalidad lo exige, índice aditivo `CREATE INDEX IF NOT EXISTS ... ON "recomendacion"("regla_id", "generada_en")` — decidir en implementación tras medir; con el volumen actual (miles de filas) el conteo por regla es trivial.

## 5. Migración propuesta (aditiva)

```sql
-- Generada con `npx prisma migrate dev`; equivalente lógico:

CREATE TABLE IF NOT EXISTS "regla_recomendacion_historial" (
  "id" TEXT NOT NULL,
  "regla_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "motivo" TEXT NOT NULL,
  "cambiado_por_admin_id" TEXT NOT NULL,
  "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "regla_recomendacion_historial_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "regla_recomendacion_historial_regla_id_fkey"
    FOREIGN KEY ("regla_id") REFERENCES "regla_recomendacion"("id"),
  CONSTRAINT "regla_recomendacion_historial_cambiado_por_fkey"
    FOREIGN KEY ("cambiado_por_admin_id") REFERENCES "usuarios"("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "regla_historial_regla_version_key"
  ON "regla_recomendacion_historial"("regla_id", "version");
CREATE INDEX IF NOT EXISTS "regla_historial_regla_creado_idx"
  ON "regla_recomendacion_historial"("regla_id", "creado_en" DESC);

ALTER TABLE "regla_recomendacion"
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'REGLA_CREADA';
-- ... (resto de valores §3.3)
```

Los nombres físicos de tabla/columna se ajustan a los `@map` que defina SPEC-221; la migración real sale de `prisma migrate dev`, nunca escrita a mano salvo los `ALTER TYPE ... ADD VALUE IF NOT EXISTS` (que Prisma genera sin `IF NOT EXISTS` y se ajustan en la migración manual siguiendo el precedente del repo).

## 6. Notas de implementación

- **Cumplimiento Ley 1581 / sin PII**: el historial guarda snapshots de configuración de reglas (SQL, plantillas, umbrales), nunca datos de reportes ni de personas. El `AuditLog` del test SQL tampoco persiste filas de resultado.
- **Retención**: el historial de versiones no se purga en v1 (volumen ínfimo: unas pocas filas por regla al año).
- **Relación inversa**: `ReglaRecomendacion.historial ReglaRecomendacionHistorial[]` (aditiva, no modifica columnas).
- **DAL**: el CRUD de reglas usa Prisma tipado directo en un repositorio (`src/lib/dal/repositories/`) o servicio de `src/lib/analisis/reglas/`; filtros dinámicos con `Prisma.ReglaRecomendacionWhereInput`, nunca `any`.
