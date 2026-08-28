# SPEC-005 · tasks.md

## Sub-fase D1 · Inicializar Spec Kit oficial

- [ ] D1-01 · Verificar rama activa es `feature/bi-scaffolding` (`git branch --show-current`)
- [ ] D1-02 · Crear directorios: `mkdir -p .specify/scripts/bash .specify/templates .specify/workflows/speckit .specify/integrations`
- [ ] D1-03 · Leer `feature.json` de PI en fuente antes de copiar (candado 15)
- [ ] D1-04 · Leer `init-options.json` de PI en fuente antes de copiar (candado 15)
- [ ] D1-05 · Copiar `scripts/bash/*.sh` (5 archivos: check-prerequisites · common · create-new-feature · setup-plan · setup-tasks)
- [ ] D1-06 · Copiar `templates/*.md` (5 archivos: checklist · constitution · plan · spec · tasks)
- [ ] D1-07 · Copiar `workflows/speckit/workflow.yml`
- [ ] D1-08 · Copiar `workflows/workflow-registry.json`
- [ ] D1-09 · Copiar `integrations/cline.manifest.json`
- [ ] D1-10 · Copiar `integrations/speckit.manifest.json`
- [ ] D1-11 · Copiar `integration.json` (raíz)
- [ ] D1-12 · Copiar `feature.json` (raíz)
- [ ] D1-13 · Copiar `init-options.json` (raíz)
- [ ] D1-14 · Hacer grep de referencias a PI en archivos copiados: `grep -rl "proteccion-infantil\|002-2026" .specify/scripts/ .specify/templates/ .specify/workflows/ .specify/integrations/ .specify/feature.json .specify/integration.json`
- [ ] D1-15 · Adaptar `feature.json`: actualizar `feature_directory` a `"specs/005-regularizacion-spec-kit"` (o el valor apropiado para BI)
- [ ] D1-16 · Adaptar cualquier otro archivo con referencias PI encontradas en D1-14
- [ ] D1-17 · Verificar `feature.json` JSON válido: `node -e "JSON.parse(require('fs').readFileSync('.specify/feature.json','utf8'))" && echo OK`
- [ ] D1-18 · Verificar `init-options.json` JSON válido
- [ ] D1-19 · Verificar `integration.json` JSON válido
- [ ] D1-20 · `find .specify/scripts/bash -type f` devuelve exactamente 5 archivos `.sh`
- [ ] D1-21 · `find .specify/templates -type f` devuelve exactamente 5 archivos `.md`

## Sub-fase D2 · Reescribir SPEC-001 en formato oficial (post-mortem)

- [ ] D2-01 · Verificar CERO cambios en código: `git diff HEAD -- src/` antes de empezar D2
- [ ] D2-02 · Crear carpeta: `mkdir -p .specify/specs/001-scaffolding-nextjs-auth`
- [ ] D2-03 · Escribir `001-scaffolding-nextjs-auth/spec.md` (base: SPEC-001-scaffolding-nextjs-auth.md existente)
- [ ] D2-04 · Escribir `001-scaffolding-nextjs-auth/plan.md` (base: spec.md existente + cierre.md)
- [ ] D2-05 · Escribir `001-scaffolding-nextjs-auth/tasks.md` con Paso 15 marcado ✅ (cierra I-07)
- [ ] D2-06 · Escribir `001-scaffolding-nextjs-auth/research.md` (menciona I-02 · I-03 · I-05 · corrección honesta CEO)
- [ ] D2-07 · Verificar CERO cambios en código: `git diff HEAD -- src/` después de escribir research.md
- [ ] D2-08 · `rm .specify/specs/SPEC-001-scaffolding-nextjs-auth.md`
- [ ] D2-09 · `rm .specify/specs/SPEC-001-tasks.md`
- [ ] D2-10 · `rm .specify/specs/SPEC-001-cierre.md`

## Sub-fase D3 · Reescribir SPEC-002 desde cero con Spec Kit oficial

- [ ] D3-01 · Crear carpeta: `mkdir -p .specify/specs/002-docker-compose-replica-pg-logical`
- [ ] D3-02 · Escribir `002-docker-compose-replica-pg-logical/spec.md` (fuente: INSTRUCTIVO-002 + enmienda)
- [ ] D3-03 · Escribir `002-docker-compose-replica-pg-logical/plan.md` (incluye decisiones D-11..D-20)
- [ ] D3-04 · Escribir `002-docker-compose-replica-pg-logical/tasks.md` con los 2 tests obligatorios de la enmienda `1eaa214`:
  - [ ] D3-04a · **Test 7 · Paridad master↔réplica** — `psql -h pi-db -U proteccion -d proteccion_infantil -c "SELECT count(*) FROM \"Reporte\";"` vs `psql -h localhost -p 5433 -U bi_reader -d proteccion_infantil -c "SELECT count(*) FROM \"Reporte\";"` → counts iguales o réplica ≤ master con lag < 10s. Repetir para "Colegio" y "Suscripcion". INSERT en master → esperar 10s → verificar en réplica.
  - [ ] D3-04b · **Test 8 · INSERT rechazado por bi_reader** — `psql -h localhost -p 5433 -U bi_reader -d proteccion_infantil -c "INSERT INTO \"Colegio\" (id, nombre) VALUES ('test', 'test');"` → debe fallar con `ERROR: cannot execute INSERT in a read-only transaction` o `ERROR: permission denied`. Si acepta INSERT → **PARA · avisa CEO · NO se emite REALIZADO**.
- [ ] D3-05 · Escribir `002-docker-compose-replica-pg-logical/research.md` (pg_logical vs alternativas · D-20 PII · tabla puertos · por qué Cloudflare · por qué JWT compartido · I-04)

## Sub-fase D4 · Verificación estructural

- [ ] D4-01 · `find .specify -type f | sort > /tmp/bi-specify.txt`
- [ ] D4-02 · `find ../002-2026-PROTECCION-INFANTIL/.specify -type f | sort > /tmp/pi-specify.txt`
- [ ] D4-03 · `diff /tmp/pi-specify.txt /tmp/bi-specify.txt` — verificar que diferencias son solo las esperadas (specs distintas)
- [ ] D4-04 · Adjuntar salida del diff en `research.md` de SPEC-005

## Gate local (antes del push final)

- [ ] G-01 · `git diff HEAD -- src/` → CERO cambios en código de producto
- [ ] G-02 · `git diff HEAD -- scripts/ tests/ package.json tsconfig.json` → CERO cambios en código
- [ ] G-03 · `bash scripts/ratchets/run-all.sh` → 4/4 verdes
- [ ] G-04 · `node -e "JSON.parse(require('fs').readFileSync('.specify/feature.json','utf8'))" && echo OK`
- [ ] G-05 · `node -e "JSON.parse(require('fs').readFileSync('.specify/init-options.json','utf8'))" && echo OK`
- [ ] G-06 · `node -e "JSON.parse(require('fs').readFileSync('.specify/integration.json','utf8'))" && echo OK`

## Push único

- [ ] P-01 · `git add .specify/`
- [ ] P-02 · `git status` → confirmar que solo toca `.specify/` · cero en `src/` · `scripts/` · `tests/`
- [ ] P-03 · `git commit -m "feat(bi): SPEC-005 Spec Kit oficial + SPEC-001/002 reescritas en formato oficial"`
- [ ] P-04 · `git push origin feature/bi-scaffolding`

## Verificación en vivo (candado 14 · estructural)

- [ ] V-01 · `find .specify -type f | sort` → adjuntar salida completa en señal REALIZADO
- [ ] V-02 · Emitir señal: `bi-dev-2: BI-SPEC-005 · REALIZADO · <hash> · Spec Kit inicializado + SPEC-001/002 reescritas`

---

## Criterios de aceptación (referencia para Fábrica BI-2)

- [ ] `find .specify/scripts/bash -type f` devuelve 5 archivos
- [ ] `find .specify/templates -type f` devuelve 5 archivos
- [ ] `.specify/feature.json`, `.specify/init-options.json`, `.specify/integration.json` existen y son JSON válido
- [ ] `.specify/integrations/` existe con 2 archivos JSON
- [ ] `.specify/specs/001-scaffolding-nextjs-auth/` con `spec.md` · `plan.md` · `tasks.md` · `research.md`
- [ ] `.specify/specs/002-docker-compose-replica-pg-logical/` con los 4 archivos
- [ ] `.specify/specs/005-regularizacion-spec-kit/` con los 4 archivos (incluyendo este tasks.md)
- [ ] `.specify/specs/SPEC-001-*.md` (3 monolíticos) ya NO existen
- [ ] `tasks.md` de SPEC-001 tiene Paso 15 marcado ✅
- [ ] `research.md` de SPEC-001 menciona I-02 · I-03 · I-05 · corrección honesta CEO
- [ ] `tasks.md` de SPEC-002 incluye los 2 tests obligatorios de la enmienda `1eaa214`
- [ ] `research.md` de SPEC-005 adjunta el diff estructural PI vs BI
- [ ] `git diff HEAD -- src/` muestra CERO cambios en código de producto
- [ ] `bash scripts/ratchets/run-all.sh` → 4/4 verdes
- [ ] Compuerta §4 respetada: spec+plan pusheado antes de implementar · REVISO de Fábrica BI-2

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 madrugada COT |
| **Autor** | bi-dev-2 (Desarrollo BI) |
| **Estado** | ⏳ spec+plan listo · esperando REVISO Fábrica BI-2 |
