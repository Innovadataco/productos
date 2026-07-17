# Data Model: Rediseño del Clasificador IA

## Enum de categorías (taxonomía grooming LATAM 2024-2026)

```prisma
enum CategoriaConducta {
  CONTACTO_INSISTENTE
  SOLICITUD_MATERIAL
  OFRECIMIENTO_REGALOS
  SUPLANTACION_IDENTIDAD
  SOLICITUD_ENCUENTRO
  COMPARTIMIENTO_SEXUAL
  OTRO
  EXTORSION
  CONTENIDO_GENERADO_IA
  DIFUSION_NO_CONSENTIDA
  DOXING
}
```

**Definiciones de la taxonomía extendida**:
- **EXTORSION**: chantaje/coerción usando contenido íntimo real o generado digitalmente (deepfakes, nudificación) para obtener dinero, más material, encuentros u otros beneficios.
- **CONTENIDO_GENERADO_IA**: creación/uso de deepfakes sexuales o nudificación digital que simulan al NNA.
- **DIFUSION_NO_CONSENTIDA**: publicación o reenvío de fotos/videos íntimos del NNA sin permiso.
- **DOXING**: publicación maliciosa de información privada del NNA (domicilio, teléfono, datos escolares) para exponer, acosar o facilitar que otros lo hagan.

## Migraciones Prisma requeridas

### Migración 1: ampliar enum CategoriaConducta

Añadir las 4 categorías nuevas al enum existente.

### Migración 2: ClasificacionIA — multi-label, votos y agresor par

```prisma
model ClasificacionIA {
  // ... campos existentes ...
  categoriasSecundarias Json?    // [{ categoria, score }]
  votos                 Json?    // [{ categoria, score, rawResponse? }]
  usoCascada            Boolean  @default(false)
  modeloCascada         String?
  posibleAgresorPar     Boolean  @default(false)
  // campos existentes: categoria, confianza, contienePii, piiDetectada, etc.
}
```

### Migración 3: EmbeddingDataset

```prisma
model EmbeddingDataset {
  id         String   @id @default(cuid())
  datasetId  String   @unique
  vector     Unsupported("vector(768)")
  modeloUsado String
  creadoEn   DateTime @default(now())

  dataset DatasetEntrenamiento @relation(fields: [datasetId], references: [id], onDelete: Cascade)

  @@index([vector])
}
```

### Migración 4: Reporte — prioridad y keywords

```prisma
model Reporte {
  // ... campos existentes ...
  prioridadAlta      Boolean   @default(false)
  keywordsDetectadas String[]
}
```

### Migración 5: DatasetEntrenamiento — flag de PII auditada

```prisma
model DatasetEntrenamiento {
  // ... campos existentes ...
  textoAnonimizado Boolean @default(false)
  embedding        EmbeddingDataset?
}
```

## Relaciones

```text
Reporte 1:1 ClasificacionIA
ClasificacionIA 1:1 CorreccionAdmin
CorreccionAdmin 1:1 DatasetEntrenamiento
DatasetEntrenamiento 1:1 EmbeddingDataset
```

## Estados del reporte en el pipeline

```text
PENDIENTE -> PROCESANDO -> [CLASIFICADO | REVISION_MANUAL | CORREGIDO | DUPLICADO]
CLASIFICADO -> CORREGIDO (vía admin)
```

## Reglas de integridad

- `Reporte.texto` y `Reporte.textoOriginal` nunca se modifican por el pipeline (R1).
- `ClasificacionIA.categoria` siempre refleja la categoría principal derivada del multi-label.
- `DatasetEntrenamiento.texto` debe ser la versión anonimizada cuando `textoAnonimizado=true`.
