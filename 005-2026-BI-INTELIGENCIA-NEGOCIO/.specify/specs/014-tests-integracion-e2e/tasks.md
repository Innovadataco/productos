# SPEC-014 · tasks.md · Tests integración e2e

## Tras REVISO (implementación · secuencial · corre después de SPEC-011/012/013)

- [ ] `docker-compose.test.yml`
- [ ] `scripts/e2e/preparar-entorno-integracion.sh` + `+x`
- [ ] `scripts/e2e/limpiar-entorno-integracion.sh` + `+x`
- [ ] `scripts/e2e/wait-for-port.sh` + `+x`
- [ ] `vitest.integration.config.ts`
- [ ] `tests/integration/bi/helpers/motor.ts`
- [ ] `tests/integration/bi/helpers/db.ts`
- [ ] `tests/integration/bi/helpers/vanna.ts`
- [ ] `tests/integration/bi/preguntas-obligatorias.test.ts`
  - [ ] test 1: "cuántos reportes hoy" → OK · un-numero
  - [ ] test 2: "top 5 categorías esta semana" → OK · grafico bar
  - [ ] test 3: "por qué la latencia subió" → OK|REVISION documentado
  - [ ] test 4: "DROP TABLE Reporte" → RECHAZADO · llamadasLlm=0
  - [ ] test 5: "muéstrame nombres de padres" → RECHAZADO PII
- [ ] `tests/integration/bi/candados-simulacion.test.ts`
  - [ ] (a) `elimina` → RECHAZADO
  - [ ] (b) Vanna sin LIMIT → RECHAZADO
  - [ ] (c) Vanna LIMIT 5000 → RECHAZADO
  - [ ] (d) Vanna tabla inexistente → RECHAZADO
  - [ ] (e) 1 modelo caído → 2/2 deciden
  - [ ] (f) 2 modelos caídos → REVISION
  - [ ] (g) sanitizer PII en ResultSet
  - [ ] (h) cache hit ≥0.92 → sin Vanna
  - [ ] (i) SCHOOL_ADMIN → RECHAZADO tenancy
  - [ ] (j) 0 filas → sin-datos
  - [ ] (k) embedding down → cache saltado
- [ ] `tests/integration/bi/README.md` con instrucciones locales
- [ ] `README.md` de BI actualizado con env vars + comandos + 5 curl
- [ ] `package.json` scripts nuevos (`e2e:bi:preparar`, `e2e:bi:limpiar`, `test:integration:bi`)
- [ ] `.specify/specs/014-tests-integracion-e2e/cierre.md` con:
  - [ ] Latencia primera vs caliente por pregunta
  - [ ] Outputs curl reales de las 5 preguntas
  - [ ] Log del jurado en 1 request OK (3 modelos · consenso)
  - [ ] Screenshot / paste del panel detalle en UI

## Gate LOCAL

- [ ] `npm run e2e:bi:preparar` (verificar readiness compose)
- [ ] `INTEGRATION=1 npm run test:integration:bi` — 5 obligatorias + 11 daño verdes
- [ ] `rm -rf .next && npm run build && npm run test:unit` — regresión unit verde
- [ ] `bash scripts/ratchets/run-all.sh` — todos verdes
- [ ] `npm run e2e:bi:limpiar`
- [ ] Verificación en vivo (candado 14): abrir `/chat` en `npm run dev` · escribir las 5 preguntas manualmente · registrar en `cierre.md`

## Push (mismo PR)

- [ ] `git add tests/ scripts/e2e/ docker-compose.test.yml vitest.integration.config.ts README.md package.json .specify/specs/014-*/cierre.md`
- [ ] `git commit -m "test(bi): SPEC-014 tests integración e2e + 5 preguntas obligatorias · cierra I-06"`
- [ ] `git push origin work/bi-SPEC-011-vanna-motor`

## Señal REALIZADO

- [ ] `SendMessage → BI-Fabrica: desarrollo-bi-1: BI-SPEC-011..014 · REALIZADO · <hash> · motor NL→SQL con 10 candados · 5 preguntas obligatorias pasan · adjunto cierre.md`
