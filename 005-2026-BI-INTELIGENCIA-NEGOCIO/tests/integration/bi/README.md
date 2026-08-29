# Tests de integración BI · SPEC-014

Suite end-to-end contra la fachada Next.js + Vanna FastAPI reales + Postgres
con catálogo cargado + Ollama Mac Studio (Tailscale).

## Requisitos

- Docker en marcha.
- Tailscale conectado a Mac Studio con Ollama corriendo en `100.91.87.86:11435`.
- Los 3 modelos del jurado pre-descargados (`ollama pull` en el Mac):
  - `qwen2.5:14b`
  - `gemma2:27b`
  - `aya-expanse:32b`
- Repo BI con `npm install` corrido.

## Cómo correr

```bash
npm run e2e:bi:preparar        # levanta bi-test-db + bi-vanna-test + migra + seed
INTEGRATION=1 npm run test:integration:bi
npm run e2e:bi:limpiar         # apaga compose test + limpia volumen
```

Sin `INTEGRATION=1` las dos suites se skippean (test.skip) con un aviso;
esto permite `npm run test:integration:bi` de humo en CI sin infra.

## Latencias esperadas (Ollama caliente · KEEP_ALIVE=24h)

| Pregunta | Estado | Latencia primera (ms) | Latencia caliente (ms) |
|---|---|---|---|
| cuántos reportes hoy | OK · un-numero | 5000-9000 | 150-500 (con cache humano) |
| top 5 categorías | OK · grafico | 5000-9000 | 200-600 |
| por qué la latencia subió | OK o REVISION | 5000-12000 | 200-800 |
| DROP TABLE Reporte | RECHAZADO | < 20 (pre-guard) | < 20 |
| nombres de padres | RECHAZADO | 100-6000 | 100-600 |

La primera pasada tras `docker compose up` puede tardar hasta ~90 s por la
carga en frío de `aya-expanse:32b` (20 GB). Los timeouts de Vitest son 300 s.

## Riesgos conocidos

- **Ollama Mac Studio no disponible:** `beforeAll` falla con mensaje claro.
- **Réplica pg-logical desactualizada:** los tests usan `bi_test` fresca
  seedeada, no la réplica; consulta contra la réplica se cubre en SPEC-017.
- **Modelos caídos en el jurado:** el jurado tolera 1 de 3 · si caen 2 →
  REVISION (cubierto en tests de daño (e) / (f) a nivel unit en
  `docker/vanna/tests/test_jurado.py`).
