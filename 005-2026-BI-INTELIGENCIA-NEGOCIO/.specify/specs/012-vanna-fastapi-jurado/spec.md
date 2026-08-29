# SPEC-012 · Vanna FastAPI + jurado multi-modelo AST

> **Radicado:** BI · SPEC-012 · sub-fase 2 de INSTRUCTIVO-007
> **F3C:** 2026-08-28
> **Rama:** `work/bi-SPEC-011-vanna-motor` (mismo PR)
> **Depende de:** SPEC-011 spec+plan (misma cola) · Ollama Mac Studio 100.91.87.86:11435 · KEEP_ALIVE=24h
> **Sub-SPECs hermanas:** SPEC-011 · SPEC-013 · SPEC-014
> **Constitución:** aplica candados 2 · 3 · 4 · 5 · 15 (candado 4 · checks atómicos deny-by-default · absorbido aquí desde SPEC-014)

---

## 1. Problema

La fachada `src/lib/bi/motor.ts` (SPEC-011) necesita delegar la generación de SQL a un servicio único (candado 1). No existe todavía ese servicio. Además, el jurado 2/3 multi-modelo con canonicalización AST (candado 5) requiere `sqlparse`/`sqlglot` maduros, que viven mejor en Python que en Node.

## 2. Objetivo

Crear el servicio `bi-vanna` (contenedor Python · FastAPI) que:

1. Expone `POST /generate` con la interfaz consumida por `vanna-client.ts`.
2. Llama a Ollama con structured output (candado 2 · `format: schema` · temp 0 · seed 42).
3. Presenta al LLM un catálogo con índices numéricos (candado 3) · recibe `{tabla_idx, columnas_idx, ...}` y traduce a nombres canónicos.
4. Ejecuta jurado 3 modelos SECUENCIALMENTE (memoria limitada · 36 GB Mac vs 43 GB suma modelos): `qwen2.5:14b` · `gemma2:27b` · `aya-expanse:32b`.
5. Canonicaliza el AST del SQL de cada modelo (con `sqlglot`) y compara.
6. Si ≥2/3 producen el mismo AST → `consenso=true` + devuelve el SQL canónico.
7. Si NO consenso → `consenso=false` · devuelve los 3 SQLs · fachada devuelve `estado: REVISION`.
8. Expone `GET /health` con `{ok, modelosDisponibles, ollamaLatMs}` para el healthcheck de compose.

## 3. Alcance

**Dentro:**

- `docker/vanna/main.py` — FastAPI app con endpoints `/generate` y `/health`.
- `docker/vanna/jurado.py` — orquesta 3 modelos secuenciales + canonicalización AST + voto mayoría.
- `docker/vanna/schema_builder.py` — recibe schemaJSON desde la fachada, construye prompt del LLM con enum cerrado + índices numéricos.
- `docker/vanna/ollama_client.py` — cliente HTTP simple hacia Ollama (`POST /api/generate` · structured output).
- `docker/vanna/canonizador.py` — `canonicalizar(sql: str) -> str` usando `sqlglot.transpile(sql, read="postgres", write="postgres", pretty=False, normalize=True)`.
- `docker/vanna/requirements.txt` — pinneadas: `fastapi==0.115.*`, `uvicorn[standard]==0.32.*`, `ollama==0.4.*`, `sqlglot==25.*`, `pydantic==2.*`, `pytest==8.*`, `httpx==0.28.*`.
- `docker/vanna/Dockerfile` — `python:3.13-slim` · healthcheck `python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/health').read()"` (sin `curl` per aprendizaje SPEC-010).
- `docker/vanna/tests/test_jurado.py` — pytest · 8+ casos.
- `docker/vanna/tests/test_canonizador.py` — pytest · 6+ casos (equivalencias `SELECT a, b` == `SELECT b, a`? NO por defecto; `SELECT * FROM r WHERE 1=1 AND a=1` == `SELECT * FROM r WHERE a=1` sí).
- `docker/vanna/tests/test_schema_builder.py` — pytest · 4+ casos.
- Actualización de `docker-compose.bi.yml` agregando el servicio `bi-vanna` con healthcheck + depends_on Ollama.
- `.env.example` (o `README.md`): `OLLAMA_BASE_URL`, `LLM_MODELS_JURADO` (default `"qwen2.5:14b,gemma2:27b,aya-expanse:32b"`), `KEEP_ALIVE` (default `"24h"`), `PORT=8001`.

**Fuera:**

- La fachada Next.js (SPEC-011).
- Retraining de Vanna con feedback humano (deuda Fase 1).
- Modelos alternativos (llama3, mistral). Los 3 fijos son los del motor rúbrica PI (memoria muscular).
- Cualquier acceso a la BD BI · el servicio NO toca Postgres · solo devuelve SQL para que la fachada lo ejecute.

## 4. Interfaz HTTP

`POST /generate`
```json
{
  "preguntaNL": "cuántos reportes graves esta semana",
  "schemaJSON": {                    // catálogo dinámico que envía la fachada (SPEC-011 catalogo.ts)
    "tablas": [{"idx": 0, "nombre": "bi_reporte_diario", "columnas": [{"idx": 0, "nombre": "fecha"}, {"idx": 1, "nombre": "categoria"}, ...]}],
    "metricas": [{"nombre": "reportes_graves", "formula": "COUNT(*) FILTER (WHERE severidad='ALTA')"}]
  },
  "contexto": {
    "usuarioRol": "ADMIN",
    "contextoDashboard": "motor-ia",
    "filtrosContexto": {"periodo": "7d"}
  }
}
```

Response 200:
```json
{
  "consenso": true,
  "sqlGenerado": "SELECT categoria, COUNT(*) FROM bi_reporte_diario WHERE ...",
  "votosJurado": [
    {"modelo": "qwen2.5:14b", "sqlCrudo": "...", "sqlCanonico": "...", "latenciaMs": 4200},
    {"modelo": "gemma2:27b", "sqlCrudo": "...", "sqlCanonico": "...", "latenciaMs": 5100},
    {"modelo": "aya-expanse:32b", "sqlCrudo": "...", "sqlCanonico": "...", "latenciaMs": 6800}
  ],
  "grupoCanonicoDominante": "SELECT categoria, ...",
  "latencias": {"totalMs": 16250, "canonizacionMs": 45}
}
```

Response 200 con consenso false:
```json
{
  "consenso": false,
  "sqlGenerado": null,
  "votosJurado": [ ...3 SQL distintos... ],
  "grupoCanonicoDominante": null,
  "razon": "sin_consenso_2_de_3"
}
```

Response 500: `{"error": "ollama_unreachable" | "modelo_no_disponible" | "..."}`

`GET /health` → `{"ok": true, "modelosDisponibles": ["qwen2.5:14b", "gemma2:27b", "aya-expanse:32b"], "ollamaLatMs": 45}`

## 5. Criterios de aceptación (compuerta §4)

- [ ] `docker/vanna/` existe con todos los archivos listados.
- [ ] `requirements.txt` pinneadas · sin `>=` sueltos.
- [ ] Dockerfile con `python:3.13-slim` · healthcheck con `urllib.request` (sin `curl`).
- [ ] `jurado.py` ejecuta modelos SECUENCIALMENTE (Ollama en Mac Studio solo puede cargar 1 modelo grande a la vez).
- [ ] `canonizador.py` usa `sqlglot` y trata como equivalentes: whitespace, orden de predicados AND, alias, comas trailing.
- [ ] Test unit pytest cubre: (a) 3 SQL idénticos → consenso, (b) 2 iguales 1 distinto → consenso, (c) 3 distintos → no-consenso, (d) 1 modelo error → 2/2 restantes deciden, (e) 2 errores → no-consenso automático.
- [ ] `docker-compose.bi.yml` actualizado con `bi-vanna` + healthcheck.
- [ ] `research.md` documenta: (a) por qué secuencial vs paralelo, (b) latencia primera request medida en gate local, (c) por qué `sqlglot` y no `sqlparse` (sqlglot canonicaliza).

## 6. Fuera de alcance / decisiones diferidas

| Tema | Diferido a |
|---|---|
| Fachada Next.js consumiendo `/generate` | SPEC-011 |
| Tests integración end-to-end (fachada + vanna real) | SPEC-014 |
| Retraining Vanna con `bi_cache_semantico` como training set | Fase 1 post-CUMPLE |
| Estrategia si Ollama Mac cae | Fachada devuelve plantilla "servicio IA no disponible" (SPEC-011 · candado 10) |

## 7. Riesgos

- **43 GB de modelos vs 36 GB de RAM Mac Studio:** los 3 modelos NO caben simultáneos. Ollama descarga y recarga → primera request tras un modelo distinto tarda ~90s (medido en PI). KEEP_ALIVE=24h mitiga cuando la carga es estable.
- **Ollama con temp 0 · seed 42 · structured output:** replicable pero puede fallar en modelos que no soportan `format:schema` — se validó en PI con `qwen2.5:14b`. `gemma2:27b` y `aya-expanse:32b` deben soportar (`ollama-client.ts` PI usa los tres). Test gate local con los 3.
- **`sqlglot` puede no canonicalizar equivalencias semánticas complejas:** e.g. `WHERE a IN (1,2)` vs `WHERE a=1 OR a=2`. La estrategia es DENY-BY-DEFAULT: si el AST no es idéntico → considerar como voto distinto. Falsos negativos (no consenso cuando debería) van a REVISION humana → seguro por diseño.
- **Ollama en VPS via Tailscale:** el contenedor `bi-vanna` correrá en el VPS Hostinger · debe alcanzar `100.91.87.86:11435`. La verificación real vive en el gate local del despliegue (post-implementación). Si no alcanza → fachada devuelve fallback y `bi-vanna` responde 500 con `ollama_unreachable`.

---

## 📋 Control del documento

| Campo | Valor |
|---|---|
| **Radicado** | BI · SPEC-012 |
| **F3C** | 2026-08-28 |
| **Autor** | BI-Dev 1 |
| **Aprobado** | pendiente REVISO Fábrica BI-2 |
| **Estado** | 🟡 spec+plan en compuerta §4 |
