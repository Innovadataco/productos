# SPEC-012 · plan.md · bi-vanna FastAPI + jurado

## Orden de implementación

### Capa 0 · Skeleton FastAPI
- `docker/vanna/main.py` con endpoints `/health` (siempre 200 mientras el proceso vive · consulta a Ollama con timeout 3s para poblar `modelosDisponibles`).
- `docker/vanna/requirements.txt` pinneado.
- `docker/vanna/Dockerfile` con healthcheck sin `curl`.
- Correr localmente `uvicorn docker.vanna.main:app --port 8001 --reload` · `curl /health` responde.

### Capa 1 · Ollama client
- `docker/vanna/ollama_client.py`:
  - `async def generar_estructurado(modelo, prompt, schema, system=None, options=None, keep_alive_h=24) -> dict`
  - `POST {OLLAMA_BASE_URL}/api/generate` con `{model, prompt, stream: false, format: schema, options: {temperature: 0, seed: 42, ...}, keep_alive: f"{keep_alive_h}h"}`.
  - Timeout 90s (primera carga de modelo).
  - Retorna `{data, rawResponse, metrics: {latenciaMs, promptTokens, responseTokens, loadDurationMs}}`.
  - Loguea a stdout con `logging.info` mismo formato que `ollama-client.ts` de PI.
- Test: mock `httpx.AsyncClient.post` con `respx`.

### Capa 2 · Schema builder (candado 3 · índices numéricos)
- `docker/vanna/schema_builder.py`:
  - `def construir_prompt_generacion(pregunta: str, catalogo: dict, contexto: dict) -> tuple[str, dict]` devuelve `(prompt, schema_respuesta_json)`.
  - Prompt (español, deny-by-default):
    ```
    Eres un traductor NL→SQL estricto. Solo puedes usar las tablas y columnas listadas.
    Devuelves un objeto JSON con {tabla_idx, columnas_idx, filtros, agregacion, limit}.
    Cualquier tabla o columna fuera de estas listas es un error.
    Ante duda → deny (deja la agregación vacía y explica en `nota`).
    
    Catálogo:
    - Tabla 0: bi_reporte_diario
      - Columna 0: fecha
      - Columna 1: categoria
      ...
    - Métricas:
      - reportes_graves: COUNT(*) FILTER (WHERE severidad='ALTA')
    
    Pregunta: "{pregunta}"
    Contexto adicional: {contexto_serializado}
    ```
  - `schema_respuesta_json` con `additionalProperties: false` en cada nivel · enums cerrados para `tabla_idx` (0..N-1) y `columnas_idx` (array de enum).
- Test: catálogo de 2 tablas · pregunta simple · assert schema tiene `additionalProperties: false` y enums cerrados.

### Capa 3 · Traductor idx → SQL + checks atómicos deny-by-default
- Como el LLM devuelve `{tabla_idx, columnas_idx, filtros: [...], agregacion, limit, nota}`, el servidor construye el SQL string usando los nombres canónicos del catálogo (candado 3). Nunca confía en `.strip()` de nombres textuales del LLM.
- Función `def construir_sql(respuesta_llm: dict, catalogo: dict) -> str`.
- **Candado 3 · rechazo por idx fuera de rango:** si `tabla_idx >= len(catalogo.tablas)`, `tabla_idx < 0`, o cualquier `columnas_idx[i]` fuera de rango de la tabla elegida → eleva excepción `IdxFueraDeRango(campo, valor, max)` → jurado registra voto inválido (no construye SQL).
- **Candado 4 · checks atómicos deny-by-default:** los 4 slots del schema son (métrica/agregacion, dimensión temporal, filtros, agrupación). Cualquier slot que venga `null` con `nota != ""` es señal de "falta información". Si ≥1 slot es null-con-nota en ≥2/3 modelos del jurado → no se ejecuta SQL · estado `REVISION` con razón `checks_atomicos_incompletos` · Next.js muestra la `nota` al usuario pidiendo clarificación. Nunca completa con supuestos (integra Candado 9). El prompt del schema_builder explicita: *"Ante duda → deja el slot nulo y explica en `nota`. Nunca inventes columna, tabla o filtro."*

### Capa 4 · Canonizador AST
- `docker/vanna/canonizador.py`:
  - `def canonicalizar(sql: str) -> str`:
    ```python
    from sqlglot import parse_one, exp
    tree = parse_one(sql, read="postgres")
    tree = tree.transform(lambda n: n.copy())  # deepcopy
    # normalizar orden de predicados AND
    def sort_and(node):
        if isinstance(node, exp.And):
            operandos = sorted(_flatten_and(node), key=lambda o: o.sql())
            return _rebuild_and(operandos)
        return node
    tree = tree.transform(sort_and)
    return tree.sql(pretty=False, normalize=True)
    ```
  - Trata como iguales: whitespace · comentarios · orden de predicados AND · alias `AS` opcionales.
  - NO trata como iguales: `IN (1,2)` vs `a=1 OR a=2` (deny-by-default).
- Test: 6 pares (3 equivalentes → misma canónica · 3 no equivalentes → distintas canónicas).

### Capa 5 · Jurado
- `docker/vanna/jurado.py`:
  - `async def deliberar(pregunta, schema_json, contexto) -> ResultadoJurado`:
    1. Construir prompt + schema con `schema_builder`.
    2. Ejecutar SECUENCIALMENTE los 3 modelos (`for modelo in cfg.modelos_jurado`).
    3. Por cada modelo: llamar `ollama_client.generar_estructurado` → `construir_sql` → `canonicalizar`.
    4. Si el modelo falla (timeout / SQL inválido / idx fuera de rango) → registrar voto `{modelo, error, sql_canonico: null}` · seguir.
    5. Agrupar votos válidos por `sql_canonico`. Encontrar grupo dominante.
    6. `consenso = len(grupo_dominante) >= 2` (2/3).
    7. Si consenso: `sql_generado = grupo_dominante[0].sql_crudo` (el primero para preservar formato legible · post-validator Node valida).
    8. Retornar `{consenso, sql_generado, votos_jurado, grupo_canonico_dominante, latencias}`.
- Test cases:
  - (a) 3 SQL idénticos → consenso true
  - (b) 2 iguales 1 distinto → consenso true · dominante = los 2
  - (c) 3 distintos → consenso false
  - (d) 1 error 2 iguales → consenso true (2/2 restantes deciden)
  - (e) 2 errores 1 SQL → consenso false (necesita mínimo 2 votos válidos concordantes)
  - (f) 3 errores → consenso false · razón `sin_votos_validos`
  - (g) 2 SQL semánticamente equivalentes (whitespace distinto) → consenso true tras canonicalizar
  - (h) SQL con `WHERE 1=1 AND a=1` vs `WHERE a=1` → canonicalizador debe dar la misma canónica

### Capa 6 · Endpoint /generate
- `main.py` recibe body Pydantic · llama `jurado.deliberar` · devuelve JSON.
- Excepciones ollama → 500 con `error: ollama_unreachable`.
- Test integración con `httpx.AsyncClient` sobre app FastAPI · mockeando el `ollama_client`.

### Capa 7 · Endpoint /health
- Llama `ollama_client` con prompt trivial de 1 token · mide latencia · lista modelos disponibles con `GET {OLLAMA_BASE_URL}/api/tags`.
- Si Ollama no responde en 3s → `{ok: false, ollamaError: "..."}` HTTP 200 (compose healthcheck se define por otro path).

### Capa 8 · Dockerfile + compose
- `Dockerfile`:
  ```
  FROM python:3.13-slim
  WORKDIR /app
  COPY requirements.txt .
  RUN pip install --no-cache-dir -r requirements.txt
  COPY . .
  HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8001/health', timeout=3).getcode()==200 else 1)"
  CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
  ```
- `docker-compose.bi.yml` (nuevo servicio):
  ```yaml
  bi-vanna:
    build: ./docker/vanna
    environment:
      OLLAMA_BASE_URL: http://100.91.87.86:11435
      LLM_MODELS_JURADO: "qwen2.5:14b,gemma2:27b,aya-expanse:32b"
      KEEP_ALIVE_H: "24"
    ports:
      - "8001:8001"
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8001/health', timeout=3).getcode()==200 else 1)"]
      interval: 30s
      timeout: 5s
      start_period: 15s
      retries: 3
  ```

## Env vars

- `OLLAMA_BASE_URL` (no secreto)
- `LLM_MODELS_JURADO` (CSV · no secreto)
- `KEEP_ALIVE_H` (número · no secreto)
- `PORT` (default 8001)

## Ratchets aplicables

- `cero-secretos.sh` (pasa · no hay secretos)
- No hay ratchet grep para `imports-llm-solo-motor` en Python · el candado 1 se sostiene por convención: `bi-vanna` es la ÚNICA imagen que instala `ollama` en Python.

## Gate LOCAL

```bash
cd docker/vanna
python -m pytest tests/ -v
docker build -t bi-vanna:local .
docker run --rm -e OLLAMA_BASE_URL=http://100.91.87.86:11435 -p 8001:8001 bi-vanna:local &
sleep 5
curl -s http://localhost:8001/health | jq .
curl -s -X POST http://localhost:8001/generate -H "Content-Type: application/json" -d @tests/fixtures/request-cuantos-reportes.json | jq .
```

## Compuerta §4

Commit spec+plan → REVISO → implementación.
