# SPEC-014 · Tests integración end-to-end + 5 preguntas obligatorias

> **Radicado:** BI · SPEC-014 · sub-fase 4 de INSTRUCTIVO-007
> **F3C:** 2026-08-28
> **Rama:** `work/bi-SPEC-011-vanna-motor` (mismo PR)
> **Depende de:** SPEC-011 CUMPLE · SPEC-012 CUMPLE · SPEC-013 CUMPLE
> **Sub-SPECs hermanas:** SPEC-011 · SPEC-012 · SPEC-013
> **Constitución:** aplica candados 4 (checks atómicos) · 9 (no inventa) · 14 (verificación en vivo) · 15 (verificar en fuente)

---

## 1. Problema

Los tests unit de SPEC-011..013 mockean cada frontera (Prisma, fetch, Ollama). Sin una capa que ejecute el flujo completo con Ollama real, `bi-vanna` corriendo, Postgres bi-db-replica, seed de catálogo cargado, no podemos afirmar que el motor funciona antes de decir CUMPLE. Además, el BRIEF §5 exige 5 preguntas obligatorias de aceptación.

## 2. Objetivo

Tests de integración `tests/integration/bi/motor.integration.test.ts` que:
1. Levantan el stack completo (Postgres + bi-vanna) contra Ollama Mac Studio real.
2. Ejecutan las 5 preguntas obligatorias del BRIEF §5 y aserten el resultado esperado.
3. Prueban 5+ escenarios adicionales de simulación de daño por candado.
4. Documentan la latencia primera request vs caliente en `research.md`.
5. Producen evidencia (`cierre.md`) con los outputs `curl` reales para adjuntar en la señal REALIZADO.

## 3. Alcance

**Dentro:**

- `tests/integration/bi/motor.integration.test.ts` — Vitest con `beforeAll` que verifica que:
  - `DATABASE_URL_TEST` responde.
  - `VANNA_BASE_URL_TEST` responde `/health` con los 3 modelos.
  - Seed del catálogo cargado (al menos 1 tabla activa · 1 columna · 3 ejemplos).
- `tests/integration/bi/preguntas-obligatorias.test.ts` — 5 casos del BRIEF §5.
- `tests/integration/bi/candados-simulacion.test.ts` — 10+ casos de daño simulado.
- `docker-compose.test.yml` — compose para levantar Postgres + bi-vanna en modo test (Ollama sigue en Mac Studio via Tailscale).
- `scripts/e2e/preparar-entorno-integracion.sh` — arranca compose test + corre seed + verifica readiness.
- `scripts/e2e/limpiar-entorno-integracion.sh` — down compose · limpia volumen test.
- `tests/integration/bi/README.md` — cómo correr localmente.
- `cierre.md` con evidencia de las 5 preguntas.
- Actualización de `README.md` de BI con:
  - Env vars `OLLAMA_BASE_URL`, `VANNA_BASE_URL`, `DATABASE_URL_REPLICA`.
  - Comandos `npm run test:integration:bi` y `npm run e2e:bi:preparar`.
  - Ejemplos `curl` de las 5 preguntas.

**Fuera:**

- Tests E2E de Calidad (viven en `tests/e2e/` · los escribe Calidad tras CUMPLE).
- Testing de carga · rate limit (Fase 2).
- Testing multi-tenant real (INSTRUCTIVO-009).
- Cobertura de UI en Playwright (Fase 2 · nice-to-have).

## 4. Las 5 preguntas obligatorias (BRIEF §5)

| # | Pregunta | Estado esperado | Aserción clave |
|---|---|---|---|
| 1 | "cuántos reportes hoy" | OK | `plantilla == "un-numero"` · `filas.length === 1` |
| 2 | "top 5 categorías esta semana" | OK | `plantilla == "grafico"` · `filas.length ≤ 5` · `graficoSpec.mark == "bar"` |
| 3 | "por qué la latencia subió" | OK o REVISION | siempre no-null `sqlGenerado`; si REVISION documenta razón |
| 4 | "DROP TABLE Reporte" | RECHAZADO | `llamadasLlm === 0` · `razon match /intencion_destructiva/i` |
| 5 | "muéstrame nombres de padres" | RECHAZADO | rechazo por columna PII o por tabla no listada · `razon match /pii|tabla no permitida/i` |

## 5. Simulación de daño (10+ casos)

- (a) Pregunta con `elimina` en español → RECHAZADO por pre-guard.
- (b) Vanna devuelve SQL sin `LIMIT` → RECHAZADO por post-validator.
- (c) Vanna devuelve SQL con `LIMIT 5000` → RECHAZADO (excede 1000).
- (d) Vanna devuelve SQL con `SELECT ... FROM tabla_inexistente` → RECHAZADO (whitelist).
- (e) Simular 1 modelo del jurado caído → 2/2 restantes deciden consenso.
- (f) Simular 2 modelos caídos → REVISION.
- (g) Pregunta con teléfono/email en ResultSet ficticio → sanitizer enmascara.
- (h) Cache hit ≥0.92 → no llama a Vanna · `cacheHit=true`.
- (i) Rol SCHOOL_ADMIN → RECHAZADO por tenancy-guard stub.
- (j) SQL ejecuta y devuelve 0 filas → `plantilla="sin-datos"`.
- (k) Ollama-para-embedding caído → salta cache · continúa con Vanna.

## 6. Criterios de aceptación (compuerta §4)

- [ ] `tests/integration/bi/*.test.ts` corren en CI con env `INTEGRATION=1`.
- [ ] Las 5 preguntas obligatorias pasan (o REVISION con razón documentada para la #3).
- [ ] Los 10+ casos de daño pasan.
- [ ] `docker-compose.test.yml` levanta en <90s la primera vez, <15s en warm.
- [ ] `README.md` de BI actualizado con las 3 env vars nuevas y los comandos.
- [ ] `cierre.md` con outputs curl reales de las 5 preguntas · latencia medida.
- [ ] Ratchets verdes.
- [ ] Ollama Mac Studio alcanzable desde el contenedor bi-vanna (documentado en `research.md`).

## 7. Riesgos

- **Ollama Mac Studio no disponible durante CI:** los tests integración corren solo con `INTEGRATION=1` — CI sin este flag los omite. Fase 1 los ejecuta Desarrollo localmente antes de PR.
- **Modelos calientes / fríos:** primera pasada puede tomar 3-5 minutos. Timeouts de Vitest deben ser generosos (5 min por test).
- **Réplica pg-logical desactualizada:** si SPEC-002 quedó estancado, los tests pueden ver datos viejos. Se documenta en `research.md` de este SPEC con la línea que verifica.
- **`DATABASE_URL_TEST` puede coincidir con dev:** riesgo de contaminar dev con seed test. `preparar-entorno-integracion.sh` usa base separada con prefijo `bi_test_<timestamp>`.

---

## 📋 Control del documento

| Campo | Valor |
|---|---|
| **Radicado** | BI · SPEC-014 |
| **F3C** | 2026-08-28 |
| **Autor** | BI-Dev 1 |
| **Aprobado** | pendiente REVISO Fábrica BI-2 |
| **Estado** | 🟡 spec+plan en compuerta §4 |
