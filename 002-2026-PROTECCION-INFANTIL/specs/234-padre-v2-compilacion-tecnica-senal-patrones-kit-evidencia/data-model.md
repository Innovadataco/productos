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
  id                         String             @id @default(cuid())
  expedienteId               String
  versionSecuencial          Int
  scoreGravedad              ScoreGravedad      @default(VERDE)
  scoreValor                 Float?             // valor numérico raw para trazabilidad/depuración
  categoriasDetectadasJson   Json?
  patronesDetectadosJson     Json?
  senalComunitariaJson       Json?
  resumenTextoGenerado       String             @db.Text
  pdfUrl                     String?
  pdfHash                    String?
  pdfGeneradoEn              DateTime           @db.Timestamptz(6)
  generadoPorId              String?            // actor/usuario que generó el informe; sin FK para permitir worker
  // Campos del comité (SPEC-237)
  tipoRevision               TipoRevisionComite @default(CONSOLIDACION_EXPEDIENTE)
  guiaAccionCategoriaIdPrincipal String?
  estadoAprobacion           String             @default("PENDIENTE_COMITE") // PENDIENTE_COMITE | APROBADO | CORREGIDO
  aprobadoPorMiembrosJson    Json?
  correccionesJson           Json?
  createdAt                  DateTime           @default(now()) @db.Timestamptz(6)
  updatedAt                  DateTime           @updatedAt @db.Timestamptz(6)

  expediente Expediente @relation(fields: [expedienteId], references: [id], onDelete: Cascade)

  @@unique([expedienteId, versionSecuencial])
  @@index([expedienteId, versionSecuencial])
  @@index([expedienteId, pdfGeneradoEn])
  @@index([pdfHash])
  @@map("informes_consolidados")
}
```

**Campos clave**:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `versionSecuencial` | `Int` | Incremental por expediente; la compilación lee `MAX(versionSecuencial) + 1`. |
| `scoreGravedad` | `ScoreGravedad` | Semáforo VERDE/AMARILLO/ROJO. |
| `scoreValor` | `Float?` | Valor numérico raw para trazabilidad/depuración. |
| `categoriasDetectadasJson` | `Json?` | Categorías detectadas con conteos y pesos (sin texto). |
| `patronesDetectadosJson` | `Json?` | Array de patrones N1 detectados con metadatos. |
| `senalComunitariaJson` | `Json?` | Snapshot agregado de la señal comunitaria. |
| `resumenTextoGenerado` | `String @db.Text` | Texto plano estructurado para PDF/lectura. |
| `pdfUrl` | `String?` | Ruta absoluta dentro del contenedor (`/data/informes/...`). |
| `pdfHash` | `String?` | Hash SHA256 del PDF. |
| `pdfGeneradoEn` | `DateTime` | Timestamp Bogotá de generación. |
| `generadoPorId` | `String?` | Id del actor (usuario o worker); sin FK obligatoria para permitir worker. |
| `tipoRevision` | `TipoRevisionComite` | `CONSOLIDACION_EXPEDIENTE` por defecto. |
| `estadoAprobacion` | `String` | `PENDIENTE_COMITE` / `APROBADO` / `CORREGIDO`. |

---

### `SenalComunitariaCache`

Caché de agregados comunitarios por identificador reportado. Solo agregados; no textos ni datos re-identificables.

```prisma
model SenalComunitariaCache {
  identificadorReportado    String   @id
  totalExpedientesActivos   Int      @default(0)
  totalExpedientesCerrados  Int      @default(0)
  totalExpedientesEscalados Int      @default(0)
  categoriasFrecuenciaJson  Json     // { GROOMING: 5, SEXTORSION: 2 }
  primeraAparicionEn        DateTime @db.Timestamptz(6)
  ultimaAparicionEn         DateTime @db.Timestamptz(6)
  paisesJson                Json     // { "CO": 12, "MX": 1 }
  ciudadesJson              Json
  plataformasJson           Json
  invalidado                Boolean  @default(false) // aditivo para el worker de refresco
  actualizadoEn             DateTime @updatedAt @db.Timestamptz(6)

  @@index([ultimaAparicionEn(sort: Desc)])
  @@map("senal_comunitaria_cache")
}
```

**Notas de privacidad**:

- `identificadorReportado` es PK en claro: dato del contexto reportado, necesario para SPEC-233 (búsqueda padre/admin); no es PII del denunciante ni texto de reporte.
- No guarda `reporteId`, texto original, nombres, teléfonos de padres ni cualquier otro dato re-identificable.
- `categoriasFrecuenciaJson`, `paisesJson`, `ciudadesJson`, `plataformasJson` son conteos agregados.

---

### `PatronExpediente`

Patrón N1 detectado dentro de un expediente.

```prisma
model PatronExpediente {
  id                String               @id @default(cuid())
  expedienteId      String
  tipoPatron        TipoPatronExpediente
  severidad         String               // "BAJA" | "MEDIA" | "ALTA"
  nivelConfianza    Float                // aditivo: 0..1 para trazabilidad/depuración
  descripcionTexto  String               @db.Text
  datosContextoJson Json?                // aditivo: datos estructurales de la regla
  detectadoEn       DateTime             @db.Timestamptz(6)
  createdAt         DateTime             @default(now()) @db.Timestamptz(6) // aditivo: trazabilidad forense

  expediente Expediente @relation(fields: [expedienteId], references: [id], onDelete: Cascade)

  @@index([expedienteId, severidad])
  @@index([expedienteId, detectadoEn])
  @@map("patrones_expediente")
}
```

**Campos clave**:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `tipoPatron` | `TipoPatronExpediente` | `ACELERACION`, `PROGRESION`, `PERPETRADOR_SERIAL`, `MULTIPLATAFORMA`. |
| `severidad` | `String` | `BAJA` / `MEDIA` / `ALTA`; usada por la fórmula de score (×1 / ×2). |
| `nivelConfianza` | `Float` | 0..1 calculado por la regla (aditivo, para trazabilidad). |
| `descripcionTexto` | `String @db.Text` | Texto descriptivo usado por el template del informe (ej. "⚠️ Aceleración temporal..."). |
| `datosContextoJson` | `Json?` | Datos estructurales de la regla: ratio, plataformas, etc. |
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
