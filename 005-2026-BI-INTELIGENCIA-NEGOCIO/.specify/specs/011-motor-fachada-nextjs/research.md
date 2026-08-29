# SPEC-011 · research.md · Fachada Next.js del motor NL→SQL

## Decisiones tomadas al escribir spec+plan (para REVISO)

### D-011-01 · El jurado 2/3 vive en Python, no en Node
El BRIEF-A-05 §3.1 pone el jurado dentro de `bi-vanna` (FastAPI). Motivos:
1. Vanna.ai (librería base) está en Python · su ecosistema `sqlparse` + `sqlglot` para canonicalizar AST es maduro.
2. La fachada Next.js debe permanecer estateless y I/O-bound; el jurado hace 3 llamadas Ollama y comparación AST → mejor aislado.
3. Un solo lugar de contacto con Ollama para SQL → candado 1 más limpio.

Fachada Next.js SOLO toca Ollama para `nomic-embed-text` (embedding cache · candado 7). El ratchet `imports-llm-solo-motor.sh` se ENDURECE (no solo se amplía whitelist): la regex agrega `VANNA_BASE_URL` para cazar `fetch(process.env.VANNA_BASE_URL + ...)` fuera de `vanna-client.ts`. Whitelist explícita: `motor.ts`, `vanna-client.ts`, `embedding.ts` + tests. Test del propio ratchet inyecta violación y valida exit 1. Candado 1 queda sostenido por regla automatizada, no por convención.

### D-011-02 · Post-validator con regex, no AST
El BRIEF pide validación post-LLM (whitelist tablas · LIMIT · sin cross-join sin ON · sin PII). Opciones:
- (A) `node-sql-parser`/`sqlglot-wasm` → AST completo · más robusto pero peso extra.
- (B) Regex + verificación en fuente (extraer tablas del `FROM`/`JOIN` con regex tolerante, si duda rechaza).

Elegimos (B) porque:
- El AST fuerte ya lo hace el jurado en Python (SPEC-012).
- La fachada actúa como segunda capa · no como única capa. Deny-by-default sobre regex es suficiente.
- Cero deps nuevas en Next.js.

Compromiso: si en integración (SPEC-014) descubrimos SQL válido que la regex marca falso-positivo → se sube el listón moviendo a `node-sql-parser`. Documentado como riesgo.

### D-011-03 · Cache semántico con `pgvector` + `$queryRaw`
`bi_cache_semantico.embeddingPregunta` es `Unsupported("vector(768)")` en Prisma. La búsqueda por similitud se hace con SQL raw:
```sql
SELECT id, sql_aprobado, 1 - (embedding_pregunta <=> $1::vector) AS similitud
FROM bi_cache_semantico
WHERE embedding_pregunta IS NOT NULL
ORDER BY embedding_pregunta <=> $1::vector
LIMIT 1
```
El ratchet `cero-sql-raw.sh` debe seguir permitiendo `cache-semantico.ts` (verificar excepción vigente antes de commit).

### D-011-04 · `tenancy-guard.ts` es STUB · devuelve `permite: false` para roles no-ADMIN
Por §4 del INSTRUCTIVO-007, la activación completa se difiere a INSTRUCTIVO-009. Para no dejar el motor abierto a rol `SCHOOL_ADMIN`/`PARENT` accidentalmente, el stub NIEGA con razón explícita `activacion_multi_tenant_diferida_a_INSTRUCTIVO_009`. Fase 1 (ADMIN interno) queda cubierta.

### D-011-05 · `DATABASE_URL_REPLICA` opcional
BRIEF-A-05 §3.1 pide ejecutar SQL contra `bi-db-replica` (usuario `bi_reader` read-only). En Fase 1 la réplica logical ya está creada (SPEC-002 CUMPLE) pero podemos no tener la env var lista. Fallback: `DATABASE_URL`. Warning en log al arrancar si `DATABASE_URL_REPLICA` no existe. Producción de Fase 1 se despliega con la env presente.

### D-011-06 · Zero deps nuevas en package.json
Toda la fachada usa `fetch` nativo + `@prisma/client`. `react-vega` entra en SPEC-013 (UI). Reduce riesgo de vulnerabilities y mantiene `npm audit` limpio.

## Verificación en fuente (candado 15)

- `prisma/schema.prisma` líneas 20-129: los 6 modelos (`BICatalogoTabla`, `BICatalogoColumna`, `BICatalogoMetrica`, `BICatalogoEjemplo`, `BIConsultaLog`, `BICacheSemantico`) están definidos y su `@@map` respeta el prefijo `bi_`.
- `src/lib/bi/motor.ts` líneas 1-3: stub actual retorna string fijo · confirmado.
- `scripts/ratchets/`: `imports-llm-solo-motor.sh` · `no-additional-properties-true.sh` · `cero-secretos.sh` · `cero-sql-raw.sh` · `mv-schema-check.sh` presentes.
- `docker-compose.bi.yml` presente (no revisado a fondo · lo audita SPEC-012 cuando toque agregar `bi-vanna`).
- Patrón validado PI: `productos/002-2026-PROTECCION-INFANTIL/src/lib/ai/{rubrica.ts, guardas-decision.ts, cache-semantico.ts, ollama-client.ts, schemas.ts}` — leído.
  - **Nota:** el INSTRUCTIVO-007 §PASO 1.9 apuntaba a `src/lib/motor/`, pero el patrón real vive en `src/lib/ai/`. Fábrica BI-2 confirmó la ruta correcta y corregirá el INSTRUCTIVO.

## Mapping candado → cobertura

| Candado | Cubre en SPEC-011 | Cubre en otro SPEC |
|---|---|---|
| 1 · enum cerrado JSON Schema | ✅ `catalogo.ts` construye schema | consumido por SPEC-012 |
| 2 · structured outputs · temp 0 · seed 42 | — | ✅ SPEC-012 (ollama-client Python) |
| 3 · índices numéricos | — | ✅ SPEC-012 |
| 4 · checks atómicos deny-by-default | parcial (Zod en endpoint) | ✅ SPEC-012 (prompt engineering + test dedicado "sin métrica → REVISION") |
| 5 · jurado 2/3 | — | ✅ SPEC-012 |
| 6a · pre-LLM guard | ✅ `pre-guard.ts` | — |
| 6b · post-LLM validator | ✅ `post-validator.ts` | — |
| 7 · cache semántico | ✅ `cache-semantico.ts` + `embedding.ts` | UI de feedback en SPEC-013 |
| 8 · catálogo como DATO | ✅ `catalogo.ts` | — |
| 9 · no inventa (sin datos) | ✅ `plantillas.ts` (rama `sin-datos`) | verificación en vivo SPEC-014 |
| 10 · plantillas deterministas | ✅ `plantillas.ts` | — |
| 11 · tenancy guard | ✅ STUB `tenancy-guard.ts` | activación completa INSTRUCTIVO-009 |
| 12 · traza completa | ✅ `motor.ts` escribe `bi_consulta_log` | — |
| 13 · sanitizer PII | ✅ `sanitizer.ts` | — |
| 14 · verificación en vivo | parcial (endpoint testeable) | ✅ SPEC-014 (5 preguntas obligatorias) |
| 15 · verificar en fuente | aplicado a este research.md | — |
| 17 · compuerta §4 | ✅ commit spec+plan pre-implementación | — |

## Latencia esperada por request (con Ollama caliente · KEEP_ALIVE=24h)

Estimación con base en PI (ollama-client · rúbrica multi-modelo secuencial):

| Paso | Latencia (ms) |
|---|---|
| pre-guard | < 5 |
| embedding (nomic-embed-text · 1 modelo pequeño) | 60-120 |
| cache lookup pgvector | 20-80 |
| vanna generate (jurado 3 modelos SECUENCIALES caliente) | 4500-8000 |
| post-validator | < 20 |
| SQL execution (réplica) | 50-400 |
| sanitizer | < 15 |
| **total (miss cache)** | **~5-9 s** |
| **total (hit cache)** | **~150-500 ms** |

Primera request tras arranque: el modelo más grande (aya-expanse:32b · 20 GB) tarda ~90 s en cargar en Mac Studio (36 GB RAM). Documentar en `research.md` de SPEC-012 tras medir en gate local.

## Riesgos no cubiertos aún

1. **`DATABASE_URL_REPLICA` no configurada en dev local:** los tests unit no la necesitan (mockeamos Prisma) · SPEC-014 la exige en `.env.test`.
2. **`bi-vanna` no existe todavía:** los tests unit mockean `fetch`. Tests integración reales viven en SPEC-014.
3. **Regex del post-validator puede tener falsos-positivos con CTEs (`WITH ... AS (SELECT ...)`):** Fase 1 no espera CTEs (dashboards simples). Si aparece en SPEC-014, endurecemos.
4. **`OLLAMA_BASE_URL` apunta a Tailscale:** en el VPS (fuera de la Mac) sí se necesita Tailscale funcional. Verificación real difiere a SPEC-012 gate local.
