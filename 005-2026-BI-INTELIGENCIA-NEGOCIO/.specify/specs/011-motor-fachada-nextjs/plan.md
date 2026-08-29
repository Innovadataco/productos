# SPEC-011 · plan.md · Fachada Next.js del motor NL→SQL

## Estrategia general

Copia adaptada del patrón validado en PI (`src/lib/ai/` · candados 1-7 · guardas nunca reclasifican). La fachada NO llama a Ollama para generar SQL — delega en `bi-vanna` (FastAPI · SPEC-012). Solo llama a Ollama para embeddings (nomic-embed-text · candado 7 cache semántico).

## Orden de implementación (una capa a la vez · Gate LOCAL entre capas)

### Capa 0 · Tipos + config
- `src/lib/bi/tipos.ts` — tipos `EntradaMotor`, `RespuestaMotor`, `EstadoRespuesta`, `PlantillaId`.
- Sin lógica · solo contratos. Test unit `tipos.test.ts` inexistente (tipos puros).

### Capa 1 · Pre-guard (candado 6a)
- `src/lib/bi/pre-guard.ts` — función `evaluarPreGuard(preguntaNL): {permitido, razon?}`.
- Regex insensible a mayúsculas: `\b(drop|delete|update|truncate|alter|grant|revoke)\b` en inglés · `\b(borra|elimina|vací?a|destruye|resetea)\b` en español.
- Denegar por defecto: cualquier match → `{permitido: false, razon: "intencion_destructiva"}`.
- Test: 8 casos positivos (bloquea) + 4 negativos (deja pasar consultas legítimas).

### Capa 2 · Catálogo (candado 8) + tipos JSON Schema
- `src/lib/bi/catalogo.ts` — `construirSchemaJSON(rol): Promise<SchemaJSON>`:
  1. `prisma.bICatalogoTabla.findMany({ where: { activo: true, rolesPermitidos: { has: rol } }, include: { columnas: { where: { excluida: false } } } })`.
  2. Devuelve JSON Schema con enum cerrado de nombres de tabla y columnas · `additionalProperties: false` en cada objeto anidado.
  3. También devuelve `tablasPermitidas: string[]` y `columnasPorTabla: Record<string, string[]>` (los usa post-validator).
- Test: mock Prisma · devuelve 2 tablas ficticias · asertar `additionalProperties: false` en todos los niveles.

### Capa 3 · Post-validator (candado 6b)
- `src/lib/bi/post-validator.ts` — `validarSqlGenerado(sql, catalogoResuelto, usuario): {valido, razon?}`.
- Reglas ordenadas:
  1. Debe comenzar con `SELECT` (case-insensitive · después de trim).
  2. `\bLIMIT\s+(\d+)\b` requerido con valor ≤ 1000. Si falta o excede → `{valido: false, razon: "limit_missing_o_excedido"}`.
  3. Todas las tablas del `FROM`/`JOIN` deben estar en `catalogoResuelto.tablasPermitidas` (extraer con regex tolerante · si duda → rechaza).
  4. Ninguna columna en `SELECT` debe estar marcada `excluida=true` (que ya vino filtrada · pero se re-verifica con el catálogo bruto para blindar).
  5. Detectar `JOIN` sin `ON` (`\bJOIN\b(?![\s\S]*?\bON\b)`) → rechaza.
  6. Si el rol es `SCHOOL_ADMIN`/`PARENT` → el SQL debe contener `WHERE ... tenant_id = ...` (regex laxa; el bloqueo real vive en `tenancy-guard.ts` que decide si permite ejecutar).
- Usa `sqlparse`/`node-sql-parser` NO — mantiene stack simple con regex + verificación en fuente (la responsabilidad AST vive del lado Python en el jurado).
- Test: 10 casos (5 rechazo por cada razón + 5 aceptación).

### Capa 4 · Sanitizer (candado 13)
- `src/lib/bi/sanitizer.ts` — `sanearFilas(filas): {filas, piiDetectada}`.
- Patrones (todos configurables por constante · nunca env por SPEC-011):
  - Teléfono CO: `\b3\d{9}\b` → `***teléfono***`
  - Email: `\b[\w.+-]+@[\w-]+\.[\w.-]+\b` → `***email***`
  - Cédula: `\b\d{7,10}\b` en columnas con nombre `cedula|documento|dni` → `***documento***`
- No modifica claves; solo valores string. Números en columnas count/sum quedan intactos.
- Test: 5 casos con distintos patrones + 1 sin PII (idempotente).

### Capa 5 · Plantillas (candado 10)
- `src/lib/bi/plantillas.ts` — `elegirPlantilla(filas, sqlGenerado): {plantilla, respuestaNarrativa, graficoSpec?}`.
- Ramas:
  - `filas.length === 0` → `sin-datos` · texto: *"No hay datos operativos para esa consulta en tu ámbito. Puede ser que aún no se registren eventos de esa categoría o el criterio sea muy específico."*
  - `filas.length === 1 && Object.keys(filas[0]).length === 1 && typeof valor === "number"` → `un-numero` · texto: *"Hay {N} {tipo}."* donde `{tipo}` deriva del alias de la columna.
  - `filas.length ≥ 1 && filas.length ≤ 25 && (todas las filas tienen ≥ 1 numérico + 1 categórico)` → `grafico` · genera Vega-Lite bar mark.
  - default → `tabla`.
- Texto viene 100% de constantes locales · NUNCA del LLM.
- Test: 4 casos (uno por plantilla) + un stress de 1000 filas → `tabla`.

### Capa 6 · Cache semántico (candado 7)
- `src/lib/bi/embedding.ts` — `vectorizar(texto): Promise<number[]>` llamando `POST {OLLAMA_BASE_URL}/api/embeddings` con `model: "nomic-embed-text"`. Timeout 5s. Si falla → devuelve `null` (motor decide qué hacer).
- `src/lib/bi/cache-semantico.ts`:
  - `buscarSimilar(embedding, umbral=0.92): Promise<{hit, sqlAprobado, entryId} | null>`
    - `SELECT id, sql_aprobado, 1 - (embedding_pregunta <=> $1::vector) AS similitud FROM bi_cache_semantico WHERE embedding_pregunta IS NOT NULL ORDER BY embedding_pregunta <=> $1::vector LIMIT 1`
    - Devuelve hit si `similitud >= umbral`.
  - `guardarAprobacion({preguntaNL, sql, aprobadoPor, embedding, consultaLogId})`: upsert con `preguntaNL @unique`.
- Test: mock `$queryRaw` · 3 casos (hit alto, miss, embedding null).

### Capa 7 · Tenancy guard STUB (candado 11)
- `src/lib/bi/tenancy-guard.ts` — `evaluarTenancy(usuario): {permite, razon?, filtroSQL?}`:
  - `ADMIN` → `{permite: true}`.
  - `SCHOOL_ADMIN`/`PARENT` → `{permite: false, razon: "activacion_multi_tenant_diferida_a_INSTRUCTIVO_009"}`.
- Test: 3 casos.

### Capa 8 · Vanna client (única fachada a bi-vanna)
- `src/lib/bi/vanna-client.ts` — `generarSql({preguntaNL, schemaJSON, contexto}): Promise<{sqlGenerado?, votosJurado, consenso, latencias, error?}>`.
- `fetch(process.env.VANNA_BASE_URL + "/generate", ...)` con `AbortSignal.timeout(60_000)`.
- Log en `logger` (mismo patrón que `ollama-client.ts` de PI).
- Test: mock `fetch` · 3 casos (200 con consenso, 200 sin consenso, timeout).

### Capa 9 · Motor · orquestador
- `src/lib/bi/motor.ts` — `preguntar(input): Promise<RespuestaMotor>`:
  1. `evaluarPreGuard` → si bloquea, `bi_consulta_log.create({estado: "RECHAZADO", ...})` y retorna `{estado: "RECHAZADO", llamadasLlm: 0, ...}`.
  2. `evaluarTenancy` → si niega, log + return `RECHAZADO`.
  3. `vectorizar(preguntaNL)` → si OK, `buscarSimilar` → si hit, saltar Vanna, ir directo a SQL.
  4. Si miss: `construirSchemaJSON(rol)` + `vannaClient.generarSql(...)` → si sin consenso, log + return `REVISION`.
  5. `validarSqlGenerado(sqlGenerado, catalogoResuelto, usuario)` → si inválido, log + return `RECHAZADO`.
  6. Ejecutar SQL con `$queryRawUnsafe(sqlGenerado)` sobre la conexión réplica (`DATABASE_URL_REPLICA` env · si no existe, fallback a `DATABASE_URL` con warning en `research.md`).
  7. `sanearFilas(rows)`.
  8. `elegirPlantilla(rows, sqlGenerado)`.
  9. `bi_consulta_log.update({estado: "OK", latenciaMs, sqlGenerado, fuenteCache})`.
  10. Return `RespuestaMotor` completo.
- Test: 12 escenarios end-to-end en unit (con `fetch` y `prisma` mockeados).

### Capa 10 · Endpoint HTTP
- `src/app/api/bi/preguntar/route.ts`:
  - Zod schema para body.
  - Sacar usuario de la sesión (mock por ahora si no hay auth wired · `research.md` documenta).
  - Llamar `motor.preguntar()` y `NextResponse.json(resultado)`.
- Test: 3 casos (200 OK, 400 body inválido, 500 fallo motor).

### Capa 11 · Ratchets

**11.1 · Ratchet nuevo `motor-plantillas-completas.sh`**
- `grep -q "sin-datos\|un-numero\|tabla\|grafico" src/lib/bi/plantillas.ts` × 4 · fail si falta alguna.
- Añadir a `run-all.sh`.

**11.2 · Endurecer `imports-llm-solo-motor.sh` (Candado 1 · fachada única)**
- Ampliar la regex actual (que solo caza `from 'ollama'|from 'openai'|http://.*11434|http://.*11435`) para incluir referencias a `VANNA_BASE_URL` fuera de la whitelist. Diseño concreto:
  ```bash
  #!/bin/bash
  PATRON="from 'ollama'|from 'openai'|http://.*11434|http://.*11435|VANNA_BASE_URL"
  if grep -rnE "$PATRON" src/ 2>/dev/null | \
     grep -v "src/lib/bi/motor.ts" | \
     grep -v "src/lib/bi/vanna-client.ts" | \
     grep -v "src/lib/bi/embedding.ts" | \
     grep -v "\.test\." | grep -v "\.spec\." ; then
      echo "❌ Import LLM/Vanna directo · usa src/lib/bi/motor.ts, vanna-client.ts o embedding.ts"
      exit 1
  fi
  echo "✅ imports-llm-solo-motor OK"
  ```
- Cualquier archivo nuevo que llame `fetch(process.env.VANNA_BASE_URL + ...)` fuera de `vanna-client.ts` hace fallar el ratchet. Esto sostiene Candado 1 por regla automatizada · NO por convención.
- Test de la propia regla: crear `tests/ratchets/imports-llm-solo-motor.test.sh` que:
  1. Introduce un archivo temporal `src/tmp-viola.ts` con `fetch(process.env.VANNA_BASE_URL + '/x')`.
  2. Corre el ratchet · aserta exit code 1.
  3. Elimina el archivo · corre otra vez · aserta exit 0.

## Dependencias externas nuevas

- **Ninguna** en el `package.json` de Next.js — todo se hace con `fetch` nativo + `@prisma/client` ya presente. (`react-vega` entra en SPEC-013.)

## Env vars nuevas

- `OLLAMA_BASE_URL` (default `http://100.91.87.86:11435` · Tailscale Mac Studio · no es secreto)
- `VANNA_BASE_URL` (default `http://bi-vanna:8001` · nombre servicio en compose · no es secreto)
- `DATABASE_URL_REPLICA` (opcional en Fase 1 · usa `DATABASE_URL` si no existe)

Documentar en `README.md` de BI en SPEC-014 (junto con ejemplos curl).

## Gate LOCAL antes de PUSH

```bash
rm -rf .next
npm run build
npm run test:unit -- src/lib/bi
bash scripts/ratchets/run-all.sh
```

Todos verdes → commit + push.

## Mapping candado → archivo → test (para research.md)

| Candado | Archivo | Test funcional | Test simulación de daño |
|---|---|---|---|
| 1 (enum cerrado) | `catalogo.ts` | schema válido con tablas del catálogo | mutar catálogo · nuevo enum incluye la tabla |
| 6a (pre-guard) | `pre-guard.ts` | "DROP TABLE" → RECHAZADO llamadasLlm=0 | agregar sinónimo "elimina" · sigue RECHAZADO |
| 6b (post-validator) | `post-validator.ts` | SQL con tabla no listada → rechazo | SQL con JOIN sin ON → rechazo |
| 7 (cache humano) | `cache-semantico.ts` | hit ≥0.92 devuelve SQL cacheado | miss embedding null · sigue a Vanna |
| 8 (catálogo BD) | `catalogo.ts` | schema regenerado tras UPDATE en `bi_catalogo_tabla` | tabla desactivada desaparece del enum |
| 10 (plantillas) | `plantillas.ts` | 4 tipos de ResultSet → 4 plantillas | ResultSet monocelda numérico → un-numero |
| 12 (traza) | `motor.ts` | `bi_consulta_log` tiene fila por request | rechazo pre-guard también deja fila con `error` |
| 13 (sanitizer) | `sanitizer.ts` | teléfono/email/cédula enmascarados | fila con nombre en columna arbitraria queda intacta (no sobre-actuación) |

Los candados 2, 3, 4, 5 (structured outputs · índices numéricos · checks atómicos deny-by-default · jurado) viven en SPEC-012 (Python · prompt engineering + tests dedicados). El candado 14 (verificación en vivo) se cubre en SPEC-014 con las 5 preguntas obligatorias.

## Compuerta §4 · candado 17

Tras escribir este `plan.md`, `spec.md`, `tasks.md`, `research.md`:
1. `git add .specify/specs/011-*`
2. `git commit -m "chore(bi): SPEC-011 spec+plan · fachada Next.js · esperando REVISO"`
3. `git push origin work/bi-SPEC-011-vanna-motor`
4. `gh pr create --base main --head work/bi-SPEC-011-vanna-motor --title "SPEC-011..014 · Vanna motor real con candados · spec+plan" --body "..."`
5. `SendMessage → BI-Fabrica: desarrollo-bi-1: BI-SPEC-011..014 · spec+plan LISTO · <hash>`
6. **STOP** hasta REVISO.
