# Plan · SPEC-789

## Enfoque

Reusar el patrón existente `should-skip-pi.mjs` (decisión por archivos cambiados, módulo aparte bajo test unitario), NO `on: paths:`.

1. **Módulo de decisión** `scripts/ci/should-run-e2e-pi.mjs`: `deberCorrerE2E(files)` → true si algún archivo cambiado cae bajo un prefijo del arnés (esquema/siembra/suite). CLI que imprime `true`/`false`.
2. **Test** `scripts/ci/should-run-e2e-pi.test.mjs`: fija los casos (esquema, seed, e2e, pgboss, .env.test → true; src/, docs, otro producto, prefijo similar → false; listas mixtas y vacía). Registrado en `vitest.unit.includes.ts` para que corra en el job `test-unit` (si no se registra, no corre en CI).
3. **Cableado en `ci.yml`**:
   - `should-skip` gana un segundo output `e2e` computado con el MISMO `files_changed`.
   - `test-e2e.if` = `skip != 'true' && (event != 'pull_request' || e2e == 'true')`.
   - Comentario de racionalidad al lado de la condición.

## Por qué NO `on: paths:`

Un `paths:` que no dispara el workflow deja los checks REQUERIDOS en *pendiente* para siempre → bloquea merges de otros productos (candado I-249, documentado en `should-skip-pi.mjs`). El `if:` a nivel de job produce conclusión `skipped`, que GitHub trata como éxito.

## Por qué "siempre en main"

El número oficial de e2e sale de `main` (SPEC-774: se verifica en cada merge). Condicionar en `main` cegaría la única medición integrada. La distinción de evento vive en el `if:` (`github.event_name`), no en el módulo (que solo sabe de archivos).

## Verificación

- `should-run-e2e-pi.test.mjs` verde (vía `vitest.unit.config.ts`).
- Smoke del CLI: schema→true, solo-src→false, este PR→false.
- Job `test-unit` completo verde (incluye `specs-discipline`).
- YAML de `ci.yml` bien formado (lo valida GitHub al recibir el push; candado `trigger-push-main` sigue verde: `push: branches: [main]` intacto).
