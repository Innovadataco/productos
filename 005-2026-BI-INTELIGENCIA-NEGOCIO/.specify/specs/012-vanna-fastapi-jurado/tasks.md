# SPEC-012 · tasks.md · bi-vanna FastAPI + jurado

## Tras REVISO

- [ ] `docker/vanna/requirements.txt` pinneado
- [ ] `docker/vanna/Dockerfile` con healthcheck urllib
- [ ] `docker/vanna/main.py` skeleton `/health` + `/generate`
- [ ] `docker/vanna/ollama_client.py` structured output · temp 0 · seed 42 · keep_alive
  - [ ] test: 200 OK devuelve `{data, metrics}`
  - [ ] test: timeout eleva excepción con log
  - [ ] test: JSON inválido eleva excepción con log
- [ ] `docker/vanna/schema_builder.py` construye prompt + schema con enum cerrado + índices
  - [ ] test: catálogo 2 tablas · schema tiene `additionalProperties: false` en cada nivel
  - [ ] test: enum `tabla_idx` de 0..N-1
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
