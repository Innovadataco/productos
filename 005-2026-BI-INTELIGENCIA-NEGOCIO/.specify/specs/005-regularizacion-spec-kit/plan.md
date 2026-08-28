# SPEC-005 · plan.md

## Sub-fases de ejecución

### Sub-fase D1 · Inicializar Spec Kit oficial

**Objetivo:** copiar la infraestructura Spec Kit de PI al repo BI y adaptar referencias.

**Orden de operaciones:**

1. Verificar que `feature/bi-scaffolding` es la rama activa y no hay worktrees en paralelo
2. Crear directorios destino:
   ```bash
   mkdir -p .specify/scripts/bash .specify/templates .specify/workflows/speckit .specify/integrations
   ```
3. Copiar los 17 elementos de PI (ruta exacta `../002-2026-PROTECCION-INFANTIL/.specify/`):
   - `scripts/bash/*.sh` (5 scripts: check-prerequisites.sh · common.sh · create-new-feature.sh · setup-plan.sh · setup-tasks.sh)
   - `templates/*.md` (5 templates: checklist-template.md · constitution-template.md · plan-template.md · spec-template.md · tasks-template.md)
   - `workflows/speckit/workflow.yml`
   - `workflows/workflow-registry.json`
   - `integrations/cline.manifest.json`
   - `integrations/speckit.manifest.json`
   - `integration.json` (raíz)
   - `feature.json` (raíz) — **leer primero** (candado 15): contiene `feature_directory` apuntando a la última SPEC de PI · adaptar a BI
   - `init-options.json` (raíz) — contiene referencias a `cline` · no contiene rutas específicas de PI · copiar sin cambios

4. Adaptar referencias a PI en archivos copiados:
   ```bash
   grep -rl "proteccion-infantil\|002-2026\|PI\b" .specify/scripts/ .specify/templates/ .specify/workflows/ .specify/integrations/ .specify/feature.json .specify/init-options.json .specify/integration.json
   ```
   Cambios esperados:
   - `feature.json`: actualizar `feature_directory` a `"specs/005-regularizacion-spec-kit"` (SPEC en curso · se actualiza por Spec Kit en cada nueva SPEC)
   - Scripts bash: revisar si contienen rutas hardcodeadas a PI · reemplazar por BI donde corresponda
   - Templates: revisar si contienen nombre proyecto · adaptar a BI

5. Documentar todos los cambios en `research.md` de esta SPEC (se escribe en la implementación)

**Criterio de éxito D1:**
- `find .specify/scripts/bash -type f` devuelve exactamente 5 archivos `.sh`
- `find .specify/templates -type f` devuelve exactamente 5 archivos `.md`
- `.specify/feature.json` contiene JSON válido sin referencias a PI
- `node -e "JSON.parse(require('fs').readFileSync('.specify/feature.json','utf8'))" && echo OK` → OK

---

### Sub-fase D2 · Reescribir SPEC-001 en formato oficial (post-mortem · código intacto)

**Objetivo:** reorganizar los 3 monolíticos de SPEC-001 en carpeta oficial sin perder información y sin tocar código.

**Precondición:** `git diff HEAD -- src/` debe mostrar CERO cambios antes de empezar D2.

**Orden de operaciones:**

1. Crear carpeta destino:
   ```bash
   mkdir -p .specify/specs/001-scaffolding-nextjs-auth
   ```

2. Escribir `001-scaffolding-nextjs-auth/spec.md`:
   - Base: `SPEC-001-scaffolding-nextjs-auth.md` existente (§1 objetivo · §3 candados)
   - Añadir: stack completo (Next.js 16.2.10 · TypeScript · Tailwind · jose@^6.0.10 · React 19.2.4) · UI copiada de PI (11 componentes) · 4 ratchets · CI workflow bi.yml (raíz monorepo) · auth JWT compartido con PI · fonts Inter+DM_Mono (verificados en fuente PI · candado 15)

3. Escribir `001-scaffolding-nextjs-auth/plan.md`:
   - Base: `SPEC-001-scaffolding-nextjs-auth.md` (§4 decisiones) + `SPEC-001-cierre.md` (gate local + ajustes no previstos)
   - Incluir: decisiones D-01-BI (fonts) · D-02-BI (sin worktree) · D-03-BI (ThemeProvider+mounted) · D-04-BI (jwt.test.ts vitest-environment node) · los 14 pasos del plan ejecutado

4. Escribir `001-scaffolding-nextjs-auth/tasks.md`:
   - Base: `SPEC-001-tasks.md` existente
   - **CRÍTICO:** Paso 15 marcado ✅ (el código está commiteado en `23c5100e`) — cierra I-07
   - Todos los demás pasos también marcados ✅ (todo está en git)

5. Escribir `001-scaffolding-nextjs-auth/research.md`:
   - Lecciones aprendidas del scaffolding
   - Error font (Instrument Sans → Inter+DM_Mono verificado en fuente PI · candado 15)
   - I-02: Spec Kit no inicializado (corrección honesta Fábrica)
   - I-03: CEO anterior cerró sin acuse R-008/R-009 (corrección honesta CEO IDC)
   - I-05: compuerta §4 retroactiva — SPEC-001 arrancó con prompt directo de Fábrica vía INSTRUCTIVO-001 (Fábrica emitió REVISO implícito al radiar el INSTRUCTIVO-001 sin compuerta separada) — documentado retroactivamente aquí. Cierra I-05.
   - I-07: Paso 15 en tasks.md inconsistente → corregido en tasks.md de esta carpeta

6. Verificar que código no cambió:
   ```bash
   git diff HEAD -- src/
   ```
   → debe mostrar CERO cambios

7. Eliminar los 3 monolíticos viejos:
   ```bash
   rm .specify/specs/SPEC-001-scaffolding-nextjs-auth.md
   rm .specify/specs/SPEC-001-tasks.md
   rm .specify/specs/SPEC-001-cierre.md
   ```

---

### Sub-fase D3 · Reescribir SPEC-002 desde cero con Spec Kit oficial

**Objetivo:** reconstruir el spec+plan de SPEC-002 perdido en I-04, en formato Spec Kit oficial.

**Fuentes técnicas:**
- INSTRUCTIVO-002 completo incluyendo ENMIENDA 2026-08-28
- Decisiones: D-11 · D-12 · D-13 · D-14 · D-16 · D-20

**Orden de operaciones:**

1. Crear carpeta destino:
   ```bash
   mkdir -p .specify/specs/002-docker-compose-replica-pg-logical
   ```

2. Escribir `002-docker-compose-replica-pg-logical/spec.md`:
   - Objetivo: `docker-compose.bi.yml` con 6 servicios (bi-superset · bi-vanna · bi-telegram · bi-superset-db · bi-db-replica · bi-next) · réplica pg_logical read-only desde pi-db
   - Alcance completo del INSTRUCTIVO-002 (secciones A..L)
   - Candados: 11 (tenancy) · 14 (verificación en vivo) · 15 (red Docker PI verificada en VPS)
   - Fuera de alcance: Vanna real (SPEC-003) · Cloudflare Tunnel ingress (SPEC-004) · cambios en PI

3. Escribir `002-docker-compose-replica-pg-logical/plan.md`:
   - Decisiones técnicas: D-11 (compose separado bi) · D-12 (pg_logical vs alternativas) · D-13 (puertos: Superset 8088 · Vanna 8001 · Réplica 5433 · Superset-DB 5434 · Next 3001) · D-14 (Cloudflare Tunnel) · D-16 (JWT compartido) · D-20 (réplica excluye tablas PII: Usuario · Password · Session)
   - Plan paso a paso: verificar red PI en VPS → escribir docker-compose.bi.yml → 3 Dockerfiles → scripts/replica-setup/ (4 SQL + instructivo Jelkin) → INVENTARIO-DE-SECRETOS.md → deploy-bi-prod.sh → gate local → push único

4. Escribir `002-docker-compose-replica-pg-logical/tasks.md`:
   - **Todas las tareas SIN marcar [ ]** (implementación pendiente hasta INSTRUCTIVO-002 real arranque)
   - **Los 2 tests obligatorios de la ENMIENDA 1eaa214 como tareas explícitas:**
     - `[ ] Test 7 · Paridad master↔réplica`: ...
     - `[ ] Test 8 · INSERT rechazado por bi_reader`: ...
   - Lista completa: docker-compose.bi.yml · Dockerfile.vanna · Dockerfile.telegram · Dockerfile.next · superset_config.py · SQL 01..04 en scripts/replica-setup/ · INVENTARIO-DE-SECRETOS.md · deploy-bi-prod.sh · gate local (docker compose config) · push único

5. Escribir `002-docker-compose-replica-pg-logical/research.md`:
   - Decisión pg_logical vs pg_basebackup streaming (D-12)
   - Decisión réplica sin PII (D-20 · Ley 1581)
   - Tabla de puertos (D-13)
   - Por qué Cloudflare Tunnel vs Certbot (D-14)
   - Por qué JWT compartido (D-16)
   - I-04: spec+plan anterior se perdió porque nunca se commitió (candado 17 adoptado)

---

### Sub-fase D4 · Verificación estructural PI vs BI

**Orden:**

1. Ejecutar:
   ```bash
   find .specify -type f | sort > /tmp/bi-specify.txt
   find ../002-2026-PROTECCION-INFANTIL/.specify -type f | sort > /tmp/pi-specify.txt
   diff /tmp/pi-specify.txt /tmp/bi-specify.txt
   ```

2. Diferencias ESPERADAS (no son errores):
   - BI no tiene `.specify/specs/*` de PI (esperado)
   - BI tiene `.specify/specs/001-...` · `.specify/specs/002-...` · `.specify/specs/005-...` (nuevas)
   - BI puede tener `feature.json` con contenido adaptado

3. Diferencias INESPERADAS → PARA · avisa Fábrica BI-2 con output exacto del diff

4. Adjuntar salida del diff en `research.md` de SPEC-005

---

### Gate local (antes del push final)

```bash
git diff HEAD -- src/               # CERO cambios en código
git diff HEAD -- scripts/ tests/ package.json tsconfig.json  # CERO cambios
bash scripts/ratchets/run-all.sh    # 4/4 verdes
node -e "JSON.parse(require('fs').readFileSync('.specify/feature.json','utf8'))" && echo "feature.json OK"
node -e "JSON.parse(require('fs').readFileSync('.specify/init-options.json','utf8'))" && echo "init-options.json OK"
node -e "JSON.parse(require('fs').readFileSync('.specify/integration.json','utf8'))" && echo "integration.json OK"
find .specify -type f | sort        # adjuntar en señal REALIZADO
```

---

### Push único

```bash
git add .specify/
git status   # solo .specify/ · cero en src/ scripts/ tests/
git commit -m "feat(bi): SPEC-005 Spec Kit oficial + SPEC-001/002 reescritas en formato oficial"
git push origin feature/bi-scaffolding
```

---

## Decisiones técnicas

| Decisión | Valor | Razón |
|---|---|---|
| Fuente Spec Kit | Copiar de PI (002-2026-PROTECCION-INFANTIL) | PI ya lo tiene validado y funcional · INSTRUCTIVO-005 §21 |
| Adaptación feature.json | Actualizar `feature_directory` a specs en curso | El campo apunta a la última SPEC activa |
| No inicializar con `speckit init` | Copiar directo | Evita dependencias del CLI local · coherente con modelo PI |
| Worktree | No requerido | Sin paralelismo activo · D-02-BI |
| Orden sub-fases | D1 → D2 → D3 → D4 → gate → push | D1 genera templates que D2/D3 pueden usar como referencia |

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 madrugada COT |
| **Autor** | bi-dev-2 (Desarrollo BI) |
| **Estado** | ⏳ spec+plan listo · esperando REVISO Fábrica BI-2 |
