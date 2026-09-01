# Phase 1 · Data Model · SPEC-341

## Nuevo modelo Prisma

### `AnalisisExpediente`

Un registro inmutable por (expediente, versión). Uno vigente `PUBLICADO` a la
vez por expediente + histórico completo (nunca se borra salvo cascada por
baja del expediente).

```prisma
model AnalisisExpediente {
  id                 String              @id @default(cuid())
  expedienteId       String
  versionSecuencial  Int                 // creciente por expediente (1, 2, 3...)
  alcance            AlcanceAnalisis
  hashCadena         String              // SHA-256 hex de (ultimoEventoEn ISO, numEventos, categoriasDominantesJson normalizado)
  corteN             Int                 // numEventos incluidos en el payload al momento de armar
  texto              String              @db.Text
  categoriaDominante CategoriaConducta?  // resuelta al armar el payload; NULL solo si el expediente no tiene categoría
  guiaAccionId       String?             // FK a la GuiaAccionCategoria publicada usada para "Qué puedes hacer" (null si no había)
  modeloUsado        String              // nombre del modelo Ollama que corrió
  promptSistemaHash  String              // SHA-256 del prompt sistema al momento de generar (auditoría de cambios de prompt)
  latenciaMs         Int
  estado             EstadoAnalisis      @default(GENERANDO)
  motivoFallo        String?             // solo si estado = FALLIDO
  generadoEn         DateTime            @default(now()) @db.Timestamptz(6)
  publicadoEn        DateTime?           @db.Timestamptz(6)  // solo cuando pasa a PUBLICADO

  expediente   Expediente             @relation(fields: [expedienteId], references: [id], onDelete: Cascade)
  guiaAccion   GuiaAccionCategoria?   @relation(fields: [guiaAccionId], references: [id])

  @@unique([expedienteId, versionSecuencial])
  @@index([expedienteId, estado])                        // "dame el vigente publicado"
  @@index([expedienteId, hashCadena, estado])            // "existe uno con este hash publicado?"
  @@index([expedienteId, versionSecuencial(sort: Desc)]) // "el más reciente"
  @@index([estado, generadoEn])                          // panel admin de la cola
}

enum AlcanceAnalisis {
  PADRE_COMPLETO
  COLEGIO_BLINDADO
}

enum EstadoAnalisis {
  GENERANDO
  PUBLICADO
  FALLIDO
}
```

## Invariantes

- **Inmutabilidad post-publicado**: una fila con `estado=PUBLICADO` no puede
  cambiar ningún campo salvo por cascada de borrado del expediente. Se enforca
  a nivel de aplicación (DAL) — Postgres no soporta triggers de esto sin más
  código.
- **Único vigente**: puede haber a lo sumo 1 fila `PUBLICADO` por
  `(expedienteId, hashCadena)` — la constraint natural es `@@unique([expedienteId, versionSecuencial])`
  y la app garantiza incrementar `versionSecuencial` en cada publicación.
- **Cola limpia**: si al pasar a `PUBLICADO`, la anterior con mismo
  `expedienteId` queda automáticamente "obsoleta" (no se marca — se deduce
  por MAX(versionSecuencial)). El query DAL siempre pide "el max publicado".
- **Ancho del texto**: `texto` es `@db.Text` porque el análisis puede llegar
  a 1–3 KB. El prompt sistema garantiza brevedad narrativa.

## Máquina de estados

```text
        (encola)                (publica)
GENERANDO ────────► PUBLICADO   ─── (fin de vida)
    │
    │  (timeout · error 5xx · frase prohibida)
    ▼
  FALLIDO
```

- GENERANDO → PUBLICADO: cuando el worker guarda el texto validado.
- GENERANDO → FALLIDO: timeout > `tiempo_estimado_seg × 3`, error del cliente
  Ollama, o `validar-salida.ts` detecta frase prohibida (FR-014).
- PUBLICADO/FALLIDO son terminales — no vuelven a GENERANDO.

## Relación con `Expediente`

```text
Expediente 1 ──── N AnalisisExpediente
       │
       │ (categoriasDominantesJson, numEventos, ultimoEventoEn)
       │        └───────► input del hashCadena
       │
       └── (onDelete: Cascade → los análisis se van con el expediente)
```

## Notas de migración

- **Backfill**: NO se genera análisis para expedientes existentes.
  Se dispararán solos en la primera apertura post-deploy (candado brief:
  "cero trabajo invisible"). Si el CEO decide después regenerar en masa,
  es una tarea separada con su propio script.
- **Impacto en `Expediente`**: NINGUNO. Modelo aditivo.
- **Constraint retro**: `@@unique([expedienteId, versionSecuencial])` es
  nueva → sin filas previas no rompe nada.
