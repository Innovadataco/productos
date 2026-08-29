# SPEC-014 · plan.md · Tests integración end-to-end

## Orden de implementación

### Capa 0 · docker-compose.test.yml
- Fork mínimo de `docker-compose.bi.yml` con:
  - Puertos alternos (Postgres 55432 · bi-vanna 58001) para no chocar con dev.
  - Volumen `bi-postgres-test-data` separado.
  - Sin bind mounts de código (los tests usan la imagen construida `bi-vanna:test`).

### Capa 1 · scripts de setup
- `scripts/e2e/preparar-entorno-integracion.sh`:
  ```bash
  #!/usr/bin/env bash
  set -euo pipefail
  export DATABASE_URL_TEST="postgresql://bi:bi@localhost:55432/bi_test_$(date +%s)"
  docker compose -f docker-compose.test.yml up -d --build
  # esperar readiness
  ./scripts/e2e/wait-for-port.sh localhost 55432 90
  ./scripts/e2e/wait-for-port.sh localhost 58001 90
  # migraciones + seed
  DATABASE_URL="$DATABASE_URL_TEST" npx prisma migrate deploy
  DATABASE_URL="$DATABASE_URL_TEST" npx tsx prisma/seed-catalogo.ts
  echo "$DATABASE_URL_TEST" > .env.integration
  ```
- `scripts/e2e/limpiar-entorno-integracion.sh` · `docker compose -f docker-compose.test.yml down -v`.
- `scripts/e2e/wait-for-port.sh` · loop `nc -z host port` con timeout.

### Capa 2 · Helpers de test
- `tests/integration/bi/helpers/motor.ts` con `preguntar()` que llama al endpoint local `/api/bi/preguntar` (Next.js corriendo en modo test o import directo del handler).
- `tests/integration/bi/helpers/db.ts` para consultar `bi_consulta_log` post-request.
- `tests/integration/bi/helpers/vanna.ts` con `/health` y `/generate` (para validar bi-vanna aislado antes de la fachada).

### Capa 3 · Suite `preguntas-obligatorias.test.ts`
- 5 tests · uno por pregunta.
- Timeout 300s cada uno (primera request puede necesitar descarga de `aya-expanse:32b`).
- Aserta: estado + plantilla + estructura mínima + fila en `bi_consulta_log`.

### Capa 4 · Suite `candados-simulacion.test.ts`
- Tests (a)-(k) del spec §5.
- Para simular fallos de Vanna: setear temporalmente `VANNA_BASE_URL` a un mock server (`msw/node`) para las cases (e), (f).
- Para simular Ollama-embedding caído: mock del cliente embedding en `src/lib/bi/embedding.ts` con Vitest mocks.

### Capa 5 · Ratchet de latencias
- Al final de la suite, imprimir tabla:
  ```
  Pregunta                   | Estado    | Latencia (ms) | cacheHit
  cuántos reportes hoy       | OK        | 4200          | false
  cuántos reportes hoy (rerun)| OK       | 320           | true
  ...
  ```
- Guardar en `tests/integration/bi/ultimo-run.md` para adjuntar en `cierre.md`.

### Capa 6 · README de BI actualizado
- Sección "Motor NL→SQL":
  - Env vars: `OLLAMA_BASE_URL`, `VANNA_BASE_URL`, `DATABASE_URL_REPLICA`, `LLM_MODELS_JURADO`.
  - Comandos:
    ```bash
    npm run e2e:bi:preparar   # levanta compose test + migra + seed
    npm run test:integration:bi
    npm run e2e:bi:limpiar    # apaga compose test
    ```
  - Ejemplos `curl` para las 5 preguntas obligatorias.

### Capa 7 · scripts en package.json
```json
{
  "scripts": {
    "e2e:bi:preparar": "bash scripts/e2e/preparar-entorno-integracion.sh",
    "e2e:bi:limpiar": "bash scripts/e2e/limpiar-entorno-integracion.sh",
    "test:integration:bi": "vitest run --config vitest.integration.config.ts tests/integration/bi"
  }
}
```

### Capa 8 · `vitest.integration.config.ts`
- Timeout 300000, `setupFiles` que carga `.env.integration`.
- `pool: "forks"` para aislamiento entre tests.

## Env vars

- `INTEGRATION=1` (marca CI para correr esta suite).
- `DATABASE_URL_TEST` (creado por preparar-entorno).
- `VANNA_BASE_URL_TEST` (fijo `http://localhost:58001` para local).
- Reutiliza `OLLAMA_BASE_URL` de dev.

## Gate LOCAL

```bash
npm run e2e:bi:preparar
INTEGRATION=1 npm run test:integration:bi
npm run e2e:bi:limpiar
```

## Compuerta §4

Commit spec+plan → REVISO → implementación.
