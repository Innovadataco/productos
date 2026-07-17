# Spec 013 — Administración del Motor IA desde el Panel

## Estado
- **Estado:** CERRADA
- **Creada:** 2026-07-17
- **Cerrada:** 2026-07-17
- **Owner:** Equipo Protección Infantil

## Decisión de arquitectura: solo modelos locales (R2)

**Decisión del owner:** el motor de IA opera exclusivamente con modelos locales servidos por Ollama. La opción cloud queda descartada.

**Fundamento R2 (privacidad):** los textos de reportes contienen conversaciones sensibles de menores. El requisito R2 establece que estos textos solo pueden procesarse en entorno local o de red privada de confianza. Un modelo cloud implicaría enviar conversaciones a infraestructura externa, violando el principio de privacidad del producto.

**Implementación de la restricción:**
- El parámetro de sistema `system.ollama_base_url` solo acepta URLs locales/privadas.
- `isLocalOllamaUrl()` valida: `localhost`, `127.0.0.1/8`, RFC 1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) y Tailscale (`100.64.0.0/10`).
- `PATCH /api/config/parametros/system.ollama_base_url` rechaza URLs públicas con:  
  `"los textos de reportes solo pueden procesarse en entorno local/privado (R2)"`.
- Todos los consumidores de Ollama (`ollama-client.ts`, `embedder.ts`, `sandbox.ts`, `reporte-lifecycle.ts`, `worker-reportes.mjs`, scripts de backfill) leen la URL centralizada vía `getOllamaBaseUrl()` con fallback a `OLLAMA_BASE_URL`.

## Alcance

### Bloque A — Motor de clasificación (tab Modelos)
- Selector de modelo de clasificación local con validación contra modelos instalados.
- URL base de Ollama configurable como parámetro de sistema.
- Probar conexión antes de guardar.

### Bloque B — Gestor del eval (tab Eval)
- Fixture de eval migrado a tabla `CasoEval`.
- Alta/baja de casos desde el panel.
- Corrida de eval en background con historial.
- Anti-leakage: casos de eval nunca entran al dataset/embedding ni al retrieval RAG.

### Fuera de alcance de este spec
- El eval de PII (`scripts/eval-pii.ts`) mantiene su fixture en JSON (`scripts/eval-pii-fixture.json`) porque su schema (fragmentos esperados, capas de detección) no encaja en `CasoEval`. El gestor del panel cubre el eval de clasificación, que es el que el owner administra. Si en el futuro se requiere administrar PII desde el panel, se creará una tabla `CasoEvalPii` con schema propio.

## Arquitectura

### Modelos de datos

```prisma
enum CasoEvalFuente {
  SEMILLA
  MANUAL_ADMIN
  PRODUCCION_ANONIMIZADO
}

enum EvalRunEstado {
  PENDIENTE
  EN_PROGRESO
  COMPLETADA
  FALLIDA
  CANCELADA
}

model CasoEval {
  id                 String         @id @default(cuid())
  texto              String
  categoriaEsperada  String
  secundariaEsperada String?
  ruido              Boolean        @default(false)
  fuente             CasoEvalFuente @default(SEMILLA)
  activo             Boolean        @default(true)
  fixtureVersion     Int            @default(1)
  creadoPorId        String?
  creadoEn           DateTime       @default(now())
  creadoPor          Usuario?       @relation(fields: [creadoPorId], references: [id])

  @@index([categoriaEsperada])
  @@index([fuente])
  @@index([activo])
  @@index([fixtureVersion])
}

model EvalRun {
  id             String          @id @default(cuid())
  tipo           String          @default("f7")
  fixtureVersion Int
  estado         EvalRunEstado   @default(PENDIENTE)
  iniciadoEn     DateTime        @default(now())
  finalizadoEn   DateTime?
  resultadoJson  Json?
  error          String?
  creadoPorId    String?
  creadoPor      Usuario?        @relation(fields: [creadoPorId], references: [id])

  @@index([estado])
  @@index([fixtureVersion])
  @@index([creadoPorId])
}
```

### Endpoints admin

| Método | Ruta | Propósito |
|--------|------|-----------|
| GET | `/api/admin/ia/modelos` | Lista modelos instalados en Ollama excluyendo embeddings. |
| POST | `/api/admin/ia/ollama/probar` | Prueba conexión a una URL de Ollama. |
| GET | `/api/admin/ia/evals/casos` | Lista paginada de casos con filtros y conteos por categoría. |
| POST | `/api/admin/ia/evals/casos` | Alta de caso (incrementa `fixtureVersion`). |
| PATCH | `/api/admin/ia/evals/casos/[id]/desactivar` | Desactiva un caso (sin borrar; incrementa `fixtureVersion`). |
| POST | `/api/admin/ia/evals` | Encola nueva corrida de eval si no hay otra en curso. |
| GET | `/api/admin/ia/evals/[id]` | Estado y resultado de una corrida (polling). |
| GET | `/api/admin/ia/evals/historial` | Historial de corridas. |

### Arquitectura de la corrida en background

1. El admin presiona **"Correr eval"** en `IaEvalManager`.
2. `POST /api/admin/ia/evals` verifica que no exista un `EvalRun` en estado `PENDIENTE` o `EN_PROGRESO`.
3. Calcula una estimación de duración: `max(1, ceil(casos * 7s / 60))` minutos.
4. Crea un `EvalRun` en estado `PENDIENTE` con la `fixtureVersion` activa.
5. Encola un job en pg-boss en la cola `eval-classifier-run` con `{ runId }`.
6. El `worker-reportes.mjs` consume el job y:
   - Pasa el `EvalRun` a `EN_PROGRESO`.
   - Carga casos activos con `loadActiveEvalCases()`.
   - Ejecuta `runF7Eval(examples)`.
   - Construye el reporte con `buildF7Report()`.
   - Persiste el resultado en `EvalRun.resultadoJson` y guarda copia en `eval-results/`.
   - Si falla, marca el run como `FALLIDA` con el mensaje de error.
7. La UI hace polling a `GET /api/admin/ia/evals/[id]` hasta que el estado es `COMPLETADA` o `FALLIDA`.

## Procedimientos operativos

### Cambiar el modelo de clasificación

1. Ir a **Dashboard → Admin → IA → Modelos**.
2. Verificar que la **URL de Ollama** sea correcta y presionar **"Probar conexión"**.
3. Seleccionar el modelo deseado en el dropdown (solo modelos no-embedding instalados).
4. (Opcional) Presionar **"Probar en playground"** para validar comportamiento con `SandboxOverrides.modelo_clasificacion`.
5. Si el modelo no tiene eval registrado, la UI muestra advertencia. Correr el eval para establecer línea de base antes de activarlo en producción.
6. Presionar **"Guardar como activo"** → actualiza `reportes.classification_model` + AuditLog `PARAM_UPDATE`.

> Cambiar modelo/URL **no reprocesa reportes existentes** (R1-R7 vigentes).

### Cambiar la URL base de Ollama

1. En el tab **Modelos**, modificar el campo **URL base de Ollama**.
2. Presionar **"Probar conexión"**.
3. Si la URL no es localhost/IP privada/RFC1918/Tailscale, el backend rechaza el guardado con el mensaje R2.
4. Guardar. El cambio aplica inmediatamente a todos los consumidores que usan `getOllamaBaseUrl()`.

### Gestión del fixture de eval

1. Ir a **Dashboard → Admin → IA → Eval → Casos**.
2. Ver el balance por categoría en los conteos (la semilla es 10 casos por categoría).
3. Para agregar un caso: completar texto, categoría esperada, categoría secundaria opcional y flag de ruido; enviar.
4. El backend crea el caso con `fuente=MANUAL_ADMIN` y asigna `fixtureVersion = MAX(fixtureVersion) + 1`.
5. La UI informa: `"El fixture cambió a vN. Las métricas anteriores corresponden a v(N-1); corré el eval para establecer la nueva línea de base."`
6. Para eliminar un caso: presionar **Desactivar**. El caso pasa a `activo=false` y `fixtureVersion` se incrementa. No hay borrado físico.
7. Para actualizar la línea de base: ir a **Correr eval**, confirmar la estimación de duración (~10-15 min) y presionar **Correr eval**.
8. El sistema ejecuta el eval en background. Al completar, la UI muestra métricas y comparación con la corrida anterior de la misma `fixtureVersion`.

## Anti-leakage

- `CasoEval` vive en tabla separada y nunca se inserta en `DatasetEntrenamiento` ni `EmbeddingDataset`.
- El retrieval RAG (`buscarEjemplosSimilares`) solo consulta `DatasetEntrenamiento JOIN EmbeddingDataset`.
- El modo eval aplica `excluirSimilitudMayorA: 0.98` para descartar coincidencias casi exactas.
- **Test anti-leakage:** `src/lib/ai/dataset-retrieval.test.ts` verifica que un caso activo de `CasoEval` no es recuperable por el RAG. Este test está entre los **140 tests** del suite y pasa.

## Migración y seed

- Migración Prisma: `20260717020000_add_caso_eval`.
- Seed: importa los 110 casos de `scripts/eval-fixture.json` como `fuente=SEMILLA`, `fixtureVersion=1`.
- Procedimiento de verificación sobre BD poblada: rollback → re-aplicación → validar conteos e índices hnsw.

## Eval de no-regresión

Corrida F7 sobre `fixtureVersion=1` (110 casos) confirma que la lectura desde BD reproduce exactamente los números de referencia:

| Métrica | Valor |
|---------|-------|
| Accuracy | 68.2% |
| Error silencioso | 20.8% |
| Revisión manual | 34.5% |
| Recall OTRO | 30.0% |

## Verificaciones de cierre

- [x] `npm run lint` ✅
- [x] `npx tsc --noEmit` ✅
- [x] `npm run build` ✅
- [x] `npm test` 140/140 ✅
  - Incluye `src/lib/ai/dataset-retrieval.test.ts` (anti-leakage) ✅
- [x] `scripts/smoke-e2e.ts` ✅
- [x] Eval F7 no-regresión sobre `fixtureVersion=1` ✅
- [x] Verificación de migración sobre BD poblada ✅

## Notas

- El worker debe estar corriendo (`npm run worker`) para que las corridas de eval en background se ejecuten.
- Las corridas se limitan a una a la vez verificando `EvalRun` en estado `PENDIENTE` o `EN_PROGRESO`.
