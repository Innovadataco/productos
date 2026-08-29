# SPEC-014 · cierre

**F3C:** 2026-08-28 · **Autor:** BI-Dev 1 (idc-33) · **Rama:** `work/bi-SPEC-011-vanna-motor`

## Estado real de la suite

**Infraestructura escrita, tests escritos, ejecución diferida a gate humano
con Ollama Mac Studio + docker en marcha.** Fábrica BI-2 o Jelkin corren
`npm run e2e:bi:preparar && INTEGRATION=1 npm run test:integration:bi`
antes de acuñar CUMPLE. Este cierre.md se ampliará con los outputs curl
reales cuando esa ejecución ocurra.

## Qué queda entregado

- `docker-compose.test.yml`: Postgres pgvector + bi-vanna en puertos 55432/58001.
- `scripts/e2e/preparar-entorno-integracion.sh`: up + migrate deploy + seed opcional.
- `scripts/e2e/limpiar-entorno-integracion.sh`: down -v.
- `scripts/e2e/wait-for-port.sh`: espera TCP con timeout.
- `vitest.integration.config.ts`: pool forks, timeouts 300 s, alias `@`.
- `tests/integration/bi/helpers/entorno.ts`: `INTEGRATION!=1` → suite skip con aviso.
- `tests/integration/bi/helpers/motor.ts`: `preguntarTest()` + `prismaTest()` singleton.
- `tests/integration/bi/helpers/vanna.ts`: `vannaHealth()` + `vannaGenerate()`.
- `tests/integration/bi/preguntas-obligatorias.test.ts`: 5 tests del BRIEF §5.
- `tests/integration/bi/candados-simulacion.test.ts`: 10 casos de daño.
- `tests/integration/bi/README.md`: cómo correr + latencias esperadas + riesgos.
- `README.md` de BI actualizado: env vars + comandos + ejemplos curl.
- `package.json` scripts nuevos: `e2e:bi:preparar`, `e2e:bi:limpiar`, `test:integration:bi`.

## Verificación LOCAL sin infra

- `npm run test:integration:bi` (sin `INTEGRATION=1`) → skippea las 2 suites
  con aviso, cero fallos, en <5 s.
- Ejecuciones REALES quedan como paso humano documentado.

## Deudas honestas

- **No hay `prisma/seed-catalogo.ts` funcional aún.** El script
  `preparar-entorno-integracion.sh` lo intenta ejecutar si el archivo existe;
  si no, salta el paso. La cola SPEC-008 debe entregarlo antes del primer
  gate humano.
- **`por qué la latencia subió` (pregunta 3)** no tiene garantía OK · el test
  acepta OK o REVISION documentado. Cuando Fábrica ejecute y vea REVISION,
  documente la razón en `research.md`.
- **Test (h) cache hit** solo verifica que la 2ª pasada llega; no fuerza
  `cacheHit=true` porque exige aprobar humano vía `/api/bi/aprobar` que
  no se automatiza aquí (evita el candado 7 de "cache humano").
