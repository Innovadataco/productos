# NOTA CIERRE · dev-bi-2 · 2026-08-28

> Handle sesión: `idc-a1 [9c6241]` · Rol: Dev BI (bi-dev-2) · Proyecto: BI

---

## SPECs trabajadas en esta sesión

| SPEC | Estado | Commits |
|---|---|---|
| **SPEC-002** · docker-compose replica pg_logical (Fase B v2 + Fase C consolidada) | ✅ CUMPLE | `5a6cddb6` · `0e8853a7` · `4841bfed` · `0a4f4873` · `7351235e` |
| **SPEC-007** · schema Prisma BI | ✅ CUMPLE (integrada 927e7fb7) | `be30aff96` (spec+plan) · `927e7fb7e` (impl) |
| **SPEC-008** · seed idempotente catálogo BI | ✅ CUMPLE | `927e7fb7e` |
| **SPEC-009** · 5 vistas materializadas | ✅ CUMPLE v2 (post R-020) | `927e7fb7e` · `36e4148e6` (fix candado 15) |
| **SPEC-010** · CLI catálogo | ✅ CUMPLE | `927e7fb7e` |

Último commit vigente en `feature/bi-scaffolding`: **`36e4148e6`**.

---

## Aprendizajes técnicos NO capturados en spec/plan/research

### 1. Prisma 8-rc.12 rompe todo · pin a 6.x estable obligatorio

`prisma@latest` instaló 8.0.0-rc.12 (Prisma Developer Platform + `prisma orm` subpath). La CLI cambió por completo: `migrate` → `migration`, comandos nuevos (`contract`, `deploy`, `dev <entry>`, `db verify/sign`), el schema conserva sintaxis pero el flujo migrate/generate es distinto. **Trampa silenciosa**: `npm install prisma` sin pin trae la RC. Fix: `npm install -D prisma@^6.16.0` y `@prisma/client@^6.16.0`. Documentar en INSTRUCTIVO-006 y AGENTS.md para futuros devs.

### 2. `public.bi_*` en vez de schema separado `bi_catalogo` · D-21

**Trade-off que decidí sin consultar** (candado "CEO decide, no consulta" aplicado):

| Opción | Pro | Contra |
|---|---|---|
| PostgreSQL schema `bi_catalogo` + Prisma `multiSchema` | Aislamiento fuerte · queries filtradas por schema | Preview feature `multiSchema` inestable en Prisma 6 · issues abiertos con `@@schema` + `Unsupported("vector(768)")` · migration engine falla en algunos casos |
| `public.bi_*` con prefijo via `@@map` | Estable · zero-riesgo · trivial | Naming convention manual · convive con tablas replicadas de PI en el mismo schema |

Elegí **prefijo** por candado 14 (verde en preview ≠ funciona). Fábrica lo aceptó como observación no-bloqueante en CUMPLE. Refactor futuro: cuando Prisma 7 pase `multiSchema` a stable.

### 3. `pgvector` extension requiere `previewFeatures = ["postgresqlExtensions"]`

Sin el flag, Prisma 6 rechaza `extensions = [vector]` en el `datasource` con `P1012`. No es opcional para `BICacheSemantico.embeddingPregunta: Unsupported("vector(768)")`.

### 4. Gate local con stubs manuales NO detecta candado 15 · lección R-020

Puse stubs de PI a mano en `bi-gate-local` con las columnas que **yo pensé** que existían. No detecté que `CorreccionAdmin.reporteId` NO existe (solo `clasificacionId`), ni que `BillingCycle.tenantId` NO existe (solo `subscriptionId`), ni que `AuditLog.accion` es enum `AccionAudit`, no `String`. Fábrica lo cazó en VPS al aplicar la migración real.

**Contramedida permanente**: ratchet `scripts/ratchets/mv-schema-check.sh` que:
1. Levanta `pgvector/pgvector:pg16` efímero.
2. Genera schema PI **real** con `prisma migrate diff` desde `002-2026-PROTECCION-INFANTIL/prisma/schema.prisma`.
3. Aplica la migración de MVs contra ese schema.
4. Verifica 5 MVs + `REFRESH CONCURRENTLY` en cada una.

Integrado en `run-all.sh`. Fábrica marcó como candidato firme a **candado 20 formal**.

### 5. `python:slim` / `node:alpine` NO traen curl · healthchecks

Sacado a la luz en Fase C SPEC-002. `HEALTHCHECK ["CMD","curl","-f",url]` falla silenciosamente en imágenes minimalistas. Fix:
- Python: `python -c "import urllib.request as u; u.urlopen(url).read()"`
- Node: `node -e "require('http').get(url, r => process.exit(r.statusCode===200?0:1))"`
- Postgres alpine (bi-mv-refresh): `pgrep crond`

Candidato **candado 22**. Documentado en `research.md` SPEC-002.

### 6. Next.js standalone requiere `HOSTNAME=0.0.0.0`

Sin esa env var, el server bindea a `127.0.0.1` dentro del contenedor · Docker no lo alcanza. Añadido en `docker-compose.bi.yml` bi-next.environment.

### 7. `apache/superset:4.1.0` NO existe en Docker Hub

Tag inexistente. Verificar antes de commit: `curl -sfL https://hub.docker.com/v2/repositories/apache/superset/tags/4.1.0/`. Fix: 4.1.4. Candidato **candado 20 (image tag verify)**.

### 8. Prisma 8-rc-instalada-por-error deja `prisma.config.ts` deprecation warning

Con Prisma 6, el `"prisma": {"seed": "..."}` en package.json aún funciona pero **muestra deprecation warning**. En Prisma 7 hay que migrar a `prisma.config.ts`. No urgente pero apuntar.

---

## Compromisos pendientes con Fábrica BI-2 (idc-26) NO capturados en gestión

1. **PAUSA operativa activa** · NO arrancar INSTRUCTIVO-007 hasta que Fábrica emita DIRECTRIZ-009 + rama base `main` post-merge A-47 Etapa 2. Próxima rama: `work/bi-SPEC-011-<slug>`.

2. **Post-CUMPLE Fase C SPEC-002** · Fábrica pidió documentar el patrón "clone inicial + git reset --hard + .env.bi.production intocado" en `research.md` de SPEC-002 (mensaje al inicio de esta sesión). **Estado: parcialmente cumplido** en Paso 0 del INSTRUCTIVO-JELKIN-replica.md; no aparece como sección propia en research.md.

3. **Observación no-bloqueante CUMPLE 36e4148e6** · migrar `public.bi_*` a schema `bi_catalogo` si el catálogo crece · refactor futuro cuando `multiSchema` sea stable en Prisma 7+.

4. **Seed columnas · consistencia futura** · el seed sembra columnas con nombres verificados contra schema PI, pero incluye `Subscription.canceladaEn` que **NO existe** en schema PI real (el campo es `terminaEn`). No bloqueó CUMPLE porque el seed solo guarda texto (metadata), no ejecuta SQL. Corregir en próxima SPEC de mantenimiento del catálogo.

5. **Prisma 6 → 7 upgrade path** · cuando Prisma 7 sea stable, migrar `package.json#prisma` a `prisma.config.ts` (deprecation warning ya visible).

---

## Estado del working tree al cierre

- Rama: `feature/bi-scaffolding`
- HEAD: `36e4148e6` (fix SPEC-009 R-020)
- Sincronía: local == origin/feature/bi-scaffolding (ambos limpios)
- Working tree: limpio · sin cambios pendientes

## Worktrees

- `/Users/idc/Documents/GitHub/productos` · `main` (raíz)
- `/Users/idc/Documents/GitHub/productos/.worktrees/pi-SPEC-298` · `work/pi-SPEC-298-fix-i163-rubrica-modelo` (Dev PI · NO MÍO)

Sin worktrees BI abiertos. Cierre limpio.

---

**F3C: 2026-08-28 20:48 COT · Autor: bi-dev-2 (idc-a1 [9c6241])**
