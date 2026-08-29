# SPEC-011 · tasks.md · Fachada Next.js

> Marcar con `[x]` a medida que avanza. Bloques indentados = tests obligatorios de ese archivo.

## Tras REVISO (implementación)

- [ ] `src/lib/bi/tipos.ts` · contratos puros
- [ ] `src/lib/bi/pre-guard.ts` + regex ES/EN
  - [ ] test: DROP/DELETE/UPDATE/TRUNCATE/ALTER/GRANT bloqueados
  - [ ] test: sinónimos ES ("elimina", "borra", "vacía") bloqueados
  - [ ] test: consulta legítima ("cuántos reportes hoy") pasa
- [ ] `src/lib/bi/catalogo.ts` · schema JSON dinámico desde BD
  - [ ] test: schema con `additionalProperties: false` en cada objeto
  - [ ] test: filtro por `rolesPermitidos` funciona
  - [ ] test: tabla `activo:false` no aparece
- [ ] `src/lib/bi/post-validator.ts`
  - [ ] test: SQL sin `LIMIT` rechazado
  - [ ] test: `LIMIT 5000` rechazado (excede 1000)
  - [ ] test: tabla fuera de whitelist rechazada
  - [ ] test: JOIN sin ON rechazado
  - [ ] test: SELECT válido con LIMIT 100 aceptado
- [ ] `src/lib/bi/sanitizer.ts`
  - [ ] test: teléfono 3XXXXXXXXX enmascarado
  - [ ] test: email enmascarado
  - [ ] test: cédula en columna `documento` enmascarada
  - [ ] test: número en columna `total_reportes` intacto
- [ ] `src/lib/bi/plantillas.ts`
  - [ ] test: 0 filas → `sin-datos`
  - [ ] test: `[{total: 42}]` → `un-numero`
  - [ ] test: 5 filas con `categoria`+`count` → `grafico`
  - [ ] test: 100 filas → `tabla`
- [ ] `src/lib/bi/embedding.ts`
  - [ ] test: 200 OK devuelve `number[]` de 768
  - [ ] test: timeout devuelve `null`
- [ ] `src/lib/bi/cache-semantico.ts`
  - [ ] test: hit similitud 0.95 devuelve `{hit, sqlAprobado}`
  - [ ] test: miss (similitud 0.5) devuelve `null`
  - [ ] test: `guardarAprobacion` upserta correctamente
- [ ] `src/lib/bi/tenancy-guard.ts` (STUB)
  - [ ] test: ADMIN → permite
  - [ ] test: SCHOOL_ADMIN → niega con razón `activacion_diferida`
  - [ ] test: PARENT → niega con razón `activacion_diferida`
- [ ] `src/lib/bi/vanna-client.ts`
  - [ ] test: 200 consenso true → devuelve SQL + votos
  - [ ] test: 200 consenso false → `estado: REVISION`
  - [ ] test: timeout 60s → error terminal (log + throw)
- [ ] `src/lib/bi/motor.ts` · orquestador
  - [ ] test escenario A: DROP → RECHAZADO llamadasLlm=0 · fila en `bi_consulta_log`
  - [ ] test escenario B: cache hit → SQL cacheado ejecutado · `cacheHit=true`
  - [ ] test escenario C: miss cache · vanna consenso · post-validator OK · plantilla `un-numero`
  - [ ] test escenario D: miss cache · vanna consenso · post-validator rechaza tabla → RECHAZADO
  - [ ] test escenario E: miss cache · vanna SIN consenso → REVISION
  - [ ] test escenario F: SCHOOL_ADMIN → RECHAZADO por tenancy stub
  - [ ] test escenario G: SQL devuelve 0 filas → plantilla `sin-datos`
- [ ] `src/app/api/bi/preguntar/route.ts`
  - [ ] test: 200 con body válido
  - [ ] test: 400 con body inválido (falta `preguntaNL`)
  - [ ] test: 500 con motor throw · `consultaLogId` en body
- [ ] `scripts/ratchets/motor-plantillas-completas.sh`
- [ ] Endurecer `scripts/ratchets/imports-llm-solo-motor.sh`:
  - [ ] Ampliar regex para incluir `VANNA_BASE_URL` (además de `from 'ollama'|from 'openai'|http://.*11434|http://.*11435`)
  - [ ] Whitelist explícita: `motor.ts`, `vanna-client.ts`, `embedding.ts`, más tests (`.test.`/`.spec.`)
  - [ ] Test del propio ratchet: `tests/ratchets/imports-llm-solo-motor.test.sh` con violación inyectada + limpieza (exit 1 → exit 0)
- [ ] `research.md` con tabla candado→archivo→test + notas de decisiones

## Gate LOCAL

- [ ] `rm -rf .next && npm run build` verde
- [ ] `npm run test:unit -- src/lib/bi` — 20+ tests verdes
- [ ] `bash scripts/ratchets/run-all.sh` — todos verdes
- [ ] `git status` limpio salvo lo agregado

## Push

- [ ] `git add src/ scripts/ratchets/ tests/`
- [ ] `git commit -m "feat(bi): SPEC-011 fachada Next.js motor NL-to-SQL · candados 1/6/7/8/10/12/13"`
- [ ] `git push origin work/bi-SPEC-011-vanna-motor` (mismo PR)

## Señal a Fábrica

- [ ] `SendMessage → BI-Fabrica: desarrollo-bi-1: BI-SPEC-011 · REALIZADO · <hash>`
