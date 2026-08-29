# Data Model — 096-expediente-reporte

## Tabla nueva: PasoProcesamiento (migración aditiva)

```prisma
model PasoProcesamiento {
  id         String   @id @default(cuid())
  reporteId  String
  reporte    Reporte  @relation(fields: [reporteId], references: [id], onDelete: Cascade)
  etapa      String   // clave de etapa del parámetro admin.expediente.etapas: "guardas" | "deduplicacion" | "contexto_rag" | "decision" | ...
  veredicto  String?  // p. ej. "rafaga_detectada", "sin_senal", "duplicado"
  detalle    Json?    // payload libre por paso: veredicto por guarda, casos RAG, score de deduplicación
  latenciaMs Int?
  creadoEn   DateTime @default(now())

  @@index([reporteId, creadoEn])
  @@map("pasos_procesamiento")
}
```

- Migración: `prisma migrate dev --name NNN_paso_procesamiento` — ADITIVA (tabla nueva + índice + relación inversa en `Reporte`); nunca reset.
- Escritura best-effort desde los helpers del pipeline (`src/app/api/reportes/procesar/helpers/`): try/catch + log `[Expediente]`, nunca rompe el flujo.
- `onDelete: Cascade`: si un reporte se elimina (disputa Ley 1581), sus pasos no quedan huérfanos.

## Parámetros nuevos

Seed upsert idempotente en `prisma/seed.ts` (patrón de `ia.rubrica.*`, líneas ~930-949: `update: {}`, `create` completo).

| Clave | Tipo | Default | Categoría | Público |
|-------|------|---------|-----------|---------|
| `admin.expediente.etapas` | `JSON` | array de 10 etapas (estructura abajo) | `SYSTEM` | ❌ |
| `mensaje.padre.canales` | `JSON` | array `[{nombre, contacto, descripcion}]` (abajo) | `SYSTEM` | ❌ |

### `admin.expediente.etapas` — default (ADR_004: nada quemado en código)

Cada entrada: `{ orden, fase, faseNombre, clave, nombre, icono, capa, gated, campos[], camposGated[]? }`.
`capa: 1` = datos ya persistidos en modelos existentes; `capa: 2` = requiere PasoProcesamiento (degrada a "sin instrumentar").

```jsonc
[
  { "orden": 1, "fase": "A", "faseNombre": "Ingesta", "clave": "recepcion", "nombre": "Recepción", "icono": "inbox", "capa": 1, "gated": false,
    "campos": ["creadoEn", "numeroSeguimiento", "plataforma", "pais", "ciudad", "esAnonimo", "edadVictima", "estado"] },
  { "orden": 2, "fase": "A", "faseNombre": "Ingesta", "clave": "peso_fuente", "nombre": "Peso de fuente", "icono": "scale", "capa": 1, "gated": false,
    "campos": ["pesoAplicado", "cuentaDiasAntiguedad", "reportesPrevios", "reportesConfirmados", "reportesDescartados"],
    "camposGated": ["ipHash", "fingerprintHash"] },
  { "orden": 3, "fase": "B", "faseNombre": "Preparación", "clave": "embedding", "nombre": "Embedding", "icono": "vector", "capa": 1, "gated": false,
    "campos": ["modeloUsado", "creadoEn", "latenciaMs"] },
  { "orden": 4, "fase": "B", "faseNombre": "Preparación", "clave": "deduplicacion", "nombre": "Deduplicación", "icono": "copy", "capa": 2, "gated": false,
    "campos": ["reporteOrigenId", "scoreSimilitud"] },
  { "orden": 5, "fase": "B", "faseNombre": "Preparación", "clave": "guardas", "nombre": "Guardas baratas", "icono": "shield", "capa": 2, "gated": false,
    "campos": ["esRafaga", "keywordsDetectadas", "prioridadAlta"] },
  { "orden": 6, "fase": "C", "faseNombre": "Evaluación", "clave": "contexto_rag", "nombre": "Contexto RAG", "icono": "book", "capa": 2, "gated": false,
    "campos": ["casosSimilares", "categoriasVecinas"] },
  { "orden": 7, "fase": "C", "faseNombre": "Evaluación", "clave": "clasificacion", "nombre": "Clasificación por rúbrica", "icono": "brain", "capa": 1, "gated": false,
    "campos": ["categorias", "confianza", "usoCascada", "modeloCascada", "latenciaMs", "promptTokens", "responseTokens"],
    "camposGated": ["rawResponse"] },
  { "orden": 8, "fase": "D", "faseNombre": "Cierre", "clave": "anonimizacion", "nombre": "Anonimización PII", "icono": "mask", "capa": 1, "gated": false,
    "campos": ["contienePii", "piiDetectada", "anonimizacionValidadaPorId", "anonimizacionValidadaEn"],
    "camposGated": ["textoOriginal"] },
  { "orden": 9, "fase": "D", "faseNombre": "Cierre", "clave": "decision", "nombre": "Decisión", "icono": "gavel", "capa": 2, "gated": false,
    "campos": ["transiciones"] },
  { "orden": 10, "fase": "D", "faseNombre": "Cierre", "clave": "finalizacion", "nombre": "Finalización", "icono": "flag", "capa": 1, "gated": false,
    "campos": ["estado", "reintentos", "processingError"] }
]
```

### `mensaje.padre.canales` — default (revisable por legal, editable sin desplegar)

```jsonc
[
  { "nombre": "Línea 141 ICBF", "contacto": "141",
    "descripcion": "Línea gratuita del ICBF para reportar riesgos contra niños, niñas y adolescentes" },
  { "nombre": "Te Protejo", "contacto": "https://teprotejo.org",
    "descripcion": "Canal para reportar material de abuso sexual infantil en internet" },
  { "nombre": "CAI Virtual — Policía Nacional", "contacto": "123",
    "descripcion": "Emergencias y denuncias de la Policía Nacional" }
]
```

Documentar ambos en `docs/configuracion/parametros-sistema.md` (sección nueva, tabla maestra Clave|Tipo|Default|Categoría|Público|Usado|Descripción|Cómo probar).

## Permiso revelar-original (I-12) — cómo queda

- Módulo nuevo en `CATALOGO_MODULOS` (`src/lib/permisos-catalogo.ts`):
  `{ clave: "expediente_revelar_original", nombre: "Revelar texto original", categoria: "operador", esCritico: true, orden: 31, padre: "bandeja_reportes" }`.
- Seed: el upsert del catálogo lo crea; el backfill `clavesPorRol` (`ADMIN: modulosSeed.map(m => m.clave)`) lo otorga SOLO a ADMIN. OPERADOR conserva solo `bandeja_reportes` → sin revelación por defecto (denegar-por-defecto + jerarquía AND de `puedeAccederAModulo`).
- `src/app/api/admin/reportes/[id]/revelar-original/route.ts`: reemplaza `rol !== "ADMIN"` por `assertModulo(user, "expediente_revelar_original")`; el AuditLog `TEXTO_ORIGINAL_REVELADO` ya existe y se conserva.
- El endpoint del expediente usa `puedeAccederAModulo` para el gating (incluir campos gated + `revelado:true`) y registra el mismo AuditLog cuando revela.

## Modelos leídos (sin cambios de schema)

- `Reporte` (~593-660): estado, reporteOrigenId, esRafaga, keywordsDetectadas, prioridadAlta, processingError, anonimizacionValidadaPorId/En, textoOriginal (cifrado AES-256-GCM — NUNCA se descifra sin permiso + audit).
- `ClasificacionIA` (~851-876): categoria, confianza, contienePii, piiDetectada, modeloUsado, latenciaMs, promptTokens, responseTokens, rawResponse (GATED), usoCascada, modeloCascada, rel `rubricaVotos`.
- `ClasificacionRubricaVoto` (~1101-1113): modelo, categoria, cumple, preguntasJson — ÚNICA fuente de votos.
- `FuenteReporte` (~718-735): pesoAplicado, cuentaDiasAntiguedad, reportesPrevios/Confirmados/Descartados; ipHash/fingerprintHash (GATED).
- `EmbeddingReporte` (~923-933): modeloUsado, creadoEn.
- `TransicionReporte` (~684-702): estadoAnterior/Nuevo, responsableTipo, motivo, metadatos.
- `ReintentoReporte` (~704-716): intento, exitoso, error.

## Deuda registrada

- **`ClasificacionIA.votos` (Json)**: redundante con `ClasificacionRubricaVoto` (misma información, sin garantía de formato). El expediente NO lo usa. Candidato a retiro futuro (migración separada, requiere verificar que nada más lo lee).
- **Métricas por modelo de rúbrica**: latencia/tokens/fallback por modelo se pierden en el `createMany` de votos (solo quedan agregados en `ClasificacionIA`). Si se necesitan por modelo, ampliar `ClasificacionRubricaVoto` en spec futura.
