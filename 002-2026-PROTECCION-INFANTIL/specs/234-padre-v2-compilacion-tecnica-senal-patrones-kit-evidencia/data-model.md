# Data Model — SPEC-234 · Padre v2 · Compilación técnica + Señal + Patrones N1 + Kit evidencia

## Dependencias

Esta SPEC se apoya en los modelos introducidos por **SPEC-230**:

- `Expediente` (modelo)
- `EventoExpediente` (modelo)
- Enum `EstadoExpediente`
- Enum `ScoreGravedad` (`VERDE`, `AMARILLO`, `ROJO`)
- Tabla `ParametroSistema` con claves `padre.score.*` y `padre.patron.*`

No modifica campos de `Expediente`, `EventoExpediente` ni `Reporte`. Solo añade relaciones inversas mínimas en `Expediente` si ZEUS las ratifica en la compuerta §4.

---

## Nuevos enums

### `TipoPatronExpediente`

```prisma
enum TipoPatronExpediente {
  ACELERACION
  PROGRESION
  PERPETRADOR_SERIAL
  MULTIPLATAFORMA
}
```

---

## Nuevos modelos

### `InformeConsolidado`

Resultado inmutable de la compilación de un expediente. Cada compilación crea una nueva versión.

```prisma
model InformeConsolidado {
  id                      String          @id @default(cuid())
  expedienteId            String
  version                 Int
  scoreGravedad           ScoreGravedad   @default(VERDE)
  scoreValor              Float?
  categoriasDominantesJson Json?
  patronesJson            Json?
  senalComunitariaJson    Json?
  nivelConfianza          Float?
  markdown                String          @db.Text
  pdfRuta                 String?
  hashSha256              String?
  generadoPorId           String?
  fechaGeneracion         DateTime        @db.Timestamptz(6)
  vigenteHasta            DateTime?       @db.Timestamptz(6)
  createdAt               DateTime        @default(now()) @db.Timestamptz(6)
  updatedAt               DateTime        @updatedAt @db.Timestamptz(6)

  expediente Expediente @relation(fields: [expedienteId], references: [id], onDelete: Cascade)

  @@unique([expedienteId, version])
  @@index([expedienteId, version])
  @@index([expedienteId, fechaGeneracion])
  @@index([hashSha256])
  @@map("informes_consolidados")
}
```

**Campos clave**:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `version` | `Int` | Incremental por expediente; la compilación lee `MAX(version) + 1`. |
| `scoreGravedad` | `ScoreGravedad` | Semáforo VERDE/AMARILLO/ROJO. |
| `scoreValor` | `Float?` | Valor numérico raw (opcional, útil para depuración). |
| `categoriasDominantesJson` | `Json?` | Top categorías con conteos y pesos (sin texto). |
| `patronesJson` | `Json?` | Array de patrones N1 detectados con metadatos. |
| `senalComunitariaJson` | `Json?` | Snapshot agregado de la señal comunitaria. |
| `nivelConfianza` | `Float?` | Confianza global del informe (0..1). |
| `markdown` | `String @db.Text` | Texto plano estructurado para PDF/lectura. |
| `pdfRuta` | `String?` | Ruta absoluta dentro del contenedor (`/data/informes/...`). |
| `hashSha256` | `String?` | Hash del PDF (no del markdown). |
| `generadoPorId` | `String?` | Id del actor (usuario o worker); sin FK obligatoria para permitir worker. |
| `fechaGeneracion` | `DateTime` | Timestamp Bogotá de generación. |
| `vigenteHasta` | `DateTime?` | Hasta cuándo es válido el informe; null = indefinido. |

---

### `SenalComunitariaCache`

Caché de agregados comunitarios por identificador hasheado y plataforma. Sin PII: solo conteos, categorías agregadas y score.

```prisma
model SenalComunitariaCache {
  id                String   @id @default(cuid())
  identificadorHash String
  plataformaId      String?
  periodo           String   // Ej: "2026-08" o "ALL"; acota el tamaño de la caché.
  totalReportes     Int      @default(0)
  totalAprobados    Int      @default(0)
  categoriasJson    Json?
  scoreComunitario  Float?
  refrescadoEn      DateTime @db.Timestamptz(6)
  expiraEn          DateTime @db.Timestamptz(6)
  invalidado        Boolean  @default(false)
  version           Int      @default(0)
  createdAt         DateTime @default(now()) @db.Timestamptz(6)
  updatedAt         DateTime @updatedAt @db.Timestamptz(6)

  plataforma Plataforma? @relation(fields: [plataformaId], references: [id])

  @@unique([identificadorHash, plataformaId, periodo])
  @@index([identificadorHash, plataformaId])
  @@index([expiraEn])
  @@index([invalidado, refrescadoEn])
  @@map("senal_comunitaria_cache")
}
```

**Notas de privacidad**:

- `identificadorHash` es SHA-256 del identificador reportado (sal opcional si aplica). No almacena el identificador en claro.
- No guarda `reporteId`, texto, ciudad, nombres ni cualquier otro dato re-identificable.
- `categoriasJson` solo contiene conteos por categoría (ej. `{ "GROOMING": 3, "SPAM": 1 }`).

---

### `PatronExpediente`

Patrón N1 detectado dentro de un expediente.

```prisma
model PatronExpediente {
  id               String               @id @default(cuid())
  expedienteId     String
  tipoPatron       TipoPatronExpediente
  nivelConfianza   Float
  metadatosJson    Json?
  detectadoEn      DateTime             @db.Timestamptz(6)
  createdAt        DateTime             @default(now()) @db.Timestamptz(6)

  expediente Expediente @relation(fields: [expedienteId], references: [id], onDelete: Cascade)

  @@index([expedienteId, tipoPatron])
  @@index([expedienteId, detectadoEn])
  @@map("patrones_expediente")
}
```

**Campos clave**:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `tipoPatron` | `TipoPatronExpediente` | `ACELERACION`, `PROGRESION`, `PERPETRADOR_SERIAL`, `MULTIPLATAFORMA`. |
| `nivelConfianza` | `Float` | 0..1 calculado por la regla. |
| `metadatosJson` | `Json?` | Datos estructurales de la regla: ratio, plataformas, etc. |
| `detectadoEn` | `DateTime` | Momento del evento/ventana que disparó el patrón. |

---

## Relaciones inversas opcionales

Si ZEUS ratifica la relación inversa en la compuerta §4, se añade en el modelo `Expediente`:

```prisma
model Expediente {
  // ... campos de SPEC-230 ...
  informes  InformeConsolidado[]
  patrones  PatronExpediente[]
}
```

Si no se ratifica, se consulta por FK directamente desde los repositorios DAL (sin romper Q-3).

---

## Parámetros de sistema

Nuevo parámetro a sembrar:

| Clave | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `padre.senal_comunitaria.refresh_min` | `INTEGER` | `60` | Minutos entre refrescos de la caché por parte del worker. |

Parámetros reutilizados de SPEC-230:

- `padre.score.peso_num_reportes`
- `padre.score.peso_categoria_grave`
- `padre.score.peso_aceleracion`
- `padre.score.peso_senal_comunitaria`
- `padre.score.umbral_amarillo`
- `padre.score.umbral_rojo`
- `padre.patron.aceleracion_ratio_minimo`
- `padre.patron.senal_comunitaria_perpetrador_serial`
- `padre.patron.multiplataforma_min`

---

## Rate-limit

Nuevo scope sugerido para el endpoint público:

```typescript
// src/lib/rate-limit.ts — añadir a DEFAULTS
verificar_pdf: { windowSeconds: 60, maxRequests: 30 }
```

ZEUS puede ajustar los valores en la compuerta §4.
