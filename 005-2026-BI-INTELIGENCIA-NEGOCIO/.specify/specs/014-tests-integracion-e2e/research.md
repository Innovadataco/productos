# SPEC-014 · research.md · Tests integración e2e

## Decisiones

### D-014-01 · Ollama Mac Studio permanece fuera del compose test
Ollama vive en Mac Studio (100.91.87.86:11435 · KEEP_ALIVE=24h) y sirve a PI (motor rúbrica) y BI. Meterlo en compose test rompería el KEEP_ALIVE compartido y forzaría redescargar 43 GB de modelos en cada test. Los tests integración asumen Ollama Mac accesible via Tailscale.

Documentado en `research.md`: si Ollama Mac cae → tests marcan skip con razón `ollama_mac_unreachable`, no fallan.

### D-014-02 · Compose test con puertos alternos
55432 (Postgres) y 58001 (bi-vanna) para no chocar con la instancia dev habitual.

### D-014-03 · BD test efímera por corrida
`DATABASE_URL_TEST` incluye timestamp (`bi_test_<epoch>`) para paralelismo si Desarrollo corre 2 suites en la misma laptop. Al terminar, `limpiar-entorno-integracion.sh` no borra la BD por defecto (queda para forensia si un test falla) · se limpia con `docker compose down -v`.

### D-014-04 · Timeouts generosos (300 s por test)
Primera request en frío puede tardar 90-120 s cargando `aya-expanse:32b`. Los siguientes tests reutilizan modelos calientes. Un timeout único de 300 s cubre ambas condiciones sin flaky.

### D-014-05 · Simulación de daño con `msw/node` + mocks Vitest
Para casos (e) y (f) (modelos caídos) — no queremos tumbar Ollama real; en su lugar, `msw` intercepta las llamadas a `bi-vanna:58001/generate` durante ese test específico y responde `{consenso: false}` o error simulado. Los otros tests usan el bi-vanna real.

### D-014-06 · Verificación en vivo (candado 14) queda en cierre.md
Los tests automatizados cubren candados 1-13 y 15. Candado 14 (verificación en vivo) requiere Jelkin/Desarrollo abriendo `/chat` y ejecutando las 5 preguntas manualmente. Se documenta en `cierre.md` con screenshots y outputs.

### D-014-07 · Solo Fase 1 (uso interno)
Multi-tenant real (candado 11 completo · SCHOOL_ADMIN, PARENT) queda diferido a INSTRUCTIVO-009. El test (i) sólo verifica el STUB de SPEC-011.

## Verificación en fuente

- Antes de escribir tests, correr:
  ```bash
  curl -s http://100.91.87.86:11435/api/tags | jq '.models[].name' | sort
  ```
  y asegurar que `qwen2.5:14b`, `gemma2:27b`, `aya-expanse:32b` están listados.
- Confirmar que `prisma migrate deploy` no rompe con la BD test vacía (verificar con `--dry-run` en preparar-entorno).
- Confirmar seed catálogo (SPEC-008) es idempotente (segundo run · cero cambios).

## Riesgos

1. **Ollama Mac Studio con OTRA sesión pesada:** si PI está clasificando reportes cuando corremos integración, la RAM se satura. Documentar convención: correr tests integración BI cuando PI no esté procesando cola.
2. **`msw/node` no compatible con Node 22+:** verificar en gate local · usar `nock` como fallback.
3. **Vitest `pool: "forks"` en integración:** aísla tests pero cada fork abre pool Prisma nuevo. Verificar que Postgres test acepta suficiente `max_connections` (subir a 100 si el default 25 es bajo).

## Convención de cierre.md

`cierre.md` de SPEC-014 (obligatorio para señal REALIZADO) debe contener:
1. Comando exacto usado para preparar el entorno.
2. Output de `npm run test:integration:bi` (últimas 50 líneas).
3. Los 5 outputs `curl` reales, formato:
   ```
   ### Pregunta 1 · "cuántos reportes hoy"
   $ curl -X POST http://localhost:3000/api/bi/preguntar -d '{"preguntaNL":"cuántos reportes hoy","usuario":{"id":"admin","rol":"ADMIN"}}'
   {"estado":"OK","plantilla":"un-numero",...}
   Latencia primera: XXX ms · caliente: YYY ms
   ```
4. Log del jurado en 1 request OK (`docker logs bi-vanna | grep "jurado" | tail -20`).
5. Screenshot del panel detalle en UI (`/chat` con la primera pregunta).
6. Cualquier desviación respecto al plan (documentar honestamente · candado de corrección honesta).
