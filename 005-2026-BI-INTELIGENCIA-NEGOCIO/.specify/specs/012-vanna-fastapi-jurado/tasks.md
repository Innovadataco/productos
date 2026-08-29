# SPEC-012 · tasks.md · bi-vanna FastAPI + jurado

## Tras REVISO

- [ ] `docker/vanna/requirements.txt` pinneado
- [ ] `docker/vanna/Dockerfile` con healthcheck urllib
- [ ] `docker/vanna/main.py` skeleton `/health` + `/generate`
- [ ] `docker/vanna/ollama_client.py` structured output · temp 0 · seed 42 · keep_alive
  - [ ] test: 200 OK devuelve `{data, metrics}`
  - [ ] test: timeout eleva excepción con log
  - [ ] test: JSON inválido eleva excepción con log
  - [ ] test **Candado 2**: inspecciona el body enviado a Ollama (mock `httpx.AsyncClient.post` con `respx`) y aserta que el payload contiene `options.temperature == 0` Y `options.seed == 42` Y `format == schema` Y `stream == false`. Fail si falta cualquiera.
  - [ ] test **Candado 2**: `keep_alive` viaja como `"24h"` (o el valor de `KEEP_ALIVE_H`) en el body.
- [ ] `docker/vanna/schema_builder.py` construye prompt + schema con enum cerrado + índices
  - [ ] test: catálogo 2 tablas · schema tiene `additionalProperties: false` en cada nivel
  - [ ] test: enum `tabla_idx` de 0..N-1
- [ ] `docker/vanna/traductor_idx.py` (o función en `main.py`) — `construir_sql(respuesta_llm, catalogo)`
  - [ ] test **Candado 3 · IdxFueraDeRango**: LLM devuelve `{tabla_idx: 99, columnas_idx: [0]}` con catálogo de 2 tablas → eleva `IdxFueraDeRango(tabla_idx=99, max=1)`. El jurado registra ese voto como inválido, no construye SQL.
  - [ ] test **Candado 3**: `columnas_idx: [0, 42]` con tabla que tiene 3 columnas → eleva `IdxFueraDeRango(columna_idx=42, max=2)`.
  - [ ] test **Candado 3**: idx negativo (`tabla_idx: -1`) → eleva `IdxFueraDeRango` (no se acepta pese a que Python indexe hacia atrás).
  - [ ] test happy path: `{tabla_idx: 0, columnas_idx: [0, 1]}` devuelve SQL con nombres canónicos del catálogo (nunca strings del LLM).
- [ ] `docker/vanna/canonizador.py` con `sqlglot`
  - [ ] test: dos SQL con distinto whitespace → canónica idéntica
  - [ ] test: dos SQL con orden AND distinto → canónica idéntica
  - [ ] test: dos SQL con alias `AS x` vs sin `AS` → canónica idéntica
  - [ ] test: `IN(1,2)` vs `=1 OR =2` → canónicas DISTINTAS (deny)
  - [ ] test: SQL inválido eleva excepción
  - [ ] test: normalizar `WHERE 1=1 AND a=1` → `WHERE a=1`
- [ ] `docker/vanna/jurado.py` orquestador
  - [ ] test (a) 3 idénticos → consenso
  - [ ] test (b) 2 iguales 1 distinto → consenso
  - [ ] test (c) 3 distintos → no-consenso
  - [ ] test (d) 1 error + 2 iguales → consenso
  - [ ] test (e) 2 errores + 1 SQL → no-consenso
  - [ ] test (f) 3 errores → no-consenso `sin_votos_validos`
  - [ ] test (g) 2 semánticamente equivalentes (post-canónica) → consenso
  - [ ] test (h) `WHERE 1=1 AND a=1` vs `WHERE a=1` → consenso
  - [ ] test **Candado 4 · checks atómicos deny-by-default (i)**: pregunta ambigua "dame algo" · los 3 modelos devuelven respuesta con `agregacion == null` y `nota != ""` (marcador de "falta métrica") · el jurado NO construye SQL · devuelve `consenso=false` con razón `checks_atomicos_incompletos`. Definición operativa de "check atómico" para SPEC-012: los 4 slots del schema (`métrica`, `dimensión temporal`, `filtros`, `agrupación`) son campos requeridos-o-nulos-con-nota; si ≥1 slot viene nulo con nota "falta X" en ≥2/3 modelos → estado REVISION, se pide clarificación al usuario, no se ejecuta SQL.
  - [ ] test **Candado 4 (ii)**: pregunta "cuántos" sin sujeto (falta métrica concreta) · aserta REVISION.
- [ ] `main.py` /generate integrado con Pydantic body validator
  - [ ] test integración: 200 con consenso true
  - [ ] test integración: 200 con consenso false + razón
  - [ ] test integración: 500 con `ollama_unreachable`
- [ ] `main.py` /health devuelve `{ok, modelosDisponibles, ollamaLatMs}`
  - [ ] test integración: mock ollama /api/tags → 3 modelos listados
  - [ ] test integración: ollama down → `{ok: false}`
- [ ] `docker-compose.bi.yml` agrega servicio `bi-vanna` con healthcheck
  - [ ] `docker compose -f docker-compose.bi.yml config` valida sin errores
  - [ ] healthcheck responde tras `docker compose up bi-vanna`
- [ ] `research.md` con latencia primera request medida + decisión sqlglot vs sqlparse

## Gate LOCAL

- [ ] `cd docker/vanna && python -m pytest -v` — todos verdes
- [ ] `docker build -t bi-vanna:local .` sin errores
- [ ] `docker run --rm -p 8001:8001 -e OLLAMA_BASE_URL=... bi-vanna:local` levanta
- [ ] `curl http://localhost:8001/health` responde con 3 modelos disponibles
- [ ] `curl -X POST /generate` con pregunta simple devuelve SQL con consenso
- [ ] `bash scripts/ratchets/run-all.sh` verde

## Push (mismo PR SPEC-011..014)

- [ ] `git add docker/vanna/ docker-compose.bi.yml`
- [ ] `git commit -m "feat(bi): SPEC-012 bi-vanna FastAPI + jurado 2/3 con AST · candados 2/3/5"`
- [ ] `git push origin work/bi-SPEC-011-vanna-motor`

## Señal

- [ ] `SendMessage → BI-Fabrica: desarrollo-bi-1: BI-SPEC-012 · REALIZADO · <hash> · latencia 1ra request <medida>ms`
