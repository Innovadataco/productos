# Cierre: SPEC-120 — Smoke prod-safe por rol

**Fecha**: 2026-07-29 · **Bloque**: cola nocturna 002-PI-041, B8 · **Rama**: `feature/001-scaffolding`

## Qué se entregó

- **`scripts/smoke-prod-safe.ts`** (nuevo, único archivo de código) — runner
  prod-safe por rol. Uso:
  `node --env-file=<env> --import tsx scripts/smoke-prod-safe.ts [--dry-run|--db-only|--base-url <url>|--confirm-prod]`.
- **`docs/runbook.md`** — sección 12d (uso, frecuencia, residual aceptado,
  recuperación de residuo tras muerte abrupta).
- **`specs/120-smoke-prod-safe/`** — spec.md, plan.md, tasks.md, cierre.md.
  (El número pasó de 118 a 120: un agente en paralelo ocupó `specs/118-clics-muertos-colegio`.)

Commits: un commit `feat` (runner + runbook) y un commit `docs` (spec 120).
Sin push (la entrega la hace ZEUS). Hashes en el reporte del bloque B8.

## Cumplimiento de la regla dura

- **Nunca `resetDatabase` ni borrados masivos**: el script no importa nada de
  `src/lib/e2e/`; los únicos borrados son `deleteMany` por ID explícito de las
  filas que él mismo creó, en orden FK-seguro (RateLimit propio → PerfilOperador
  → Usuario → Colegio → Tenant → Ciudad/Pais propios), dentro de `try/finally`.
- **Nunca escribe fuera de sus cuentas efímeras**: 5 usuarios
  `smoke-<ts>-<rol>@test.invalid` + Tenant + Colegio + 2 PerfilOperador.
  Pais/Ciudad se leen (no se crean) si el entorno ya tiene; solo una BD vacía
  provoca creación propia, que también se borra.
- **Sin escrituras de negocio**: NO crea reportes (limitación deliberada, abajo).
- **Sin secretos en logs**: contraseña aleatoria por corrida, nunca impresa;
  `DATABASE_URL` se muestra como `host:puerto/bd` sin credenciales; cookies y
  tokens nunca se imprimen.

## Evidencia (todo ejecutado en local, 2026-07-29)

| Prueba | Comando / entorno | Resultado |
|---|---|---|
| Dry-run | `--dry-run` con `.env.test` | exit 0; plan completo impreso; sin tocar BD ni red |
| Ayuda | `--help` | exit 0 |
| Guarda no-loopback | `SMOKE_BASE_URL=https://pi.innovadataco.com` sin `--confirm-prod` | aborta, exit 2 |
| Ciclo de cuentas | `--db-only` con `.env.test` (bajo candado de gate) | PASS; crea 5 usuarios + Tenant + Colegio + 2 PerfilOperador y los borra |
| Residuo BD test | SQL `count(*)` en `Usuario`/`Tenant`/`Colegio` con patrón `smoke-%` | 0 / 0 / 0 |
| Flujo HTTP completo | app Next dev local (:5099, `.env` dev, BD dev) | **5/5 roles PASS** (login 200 → endpoint 200 → logout 200 con `Path=/`+`Max-Age=0`+`Secure` → 401 sin cookie), exit 0 |
| Camino cookie legacy | misma corrida (app con COOKIE_SECURE por defecto) | PASS con cookie `token` |
| Camino cookie `__Host-` | app levantada con `COOKIE_SECURE=true` | **5/5 PASS**, exit 0 (ejercita el camino de producción HTTPS salvo el TLS en sí) |
| Camino de fallo | `--base-url http://localhost:5999` (puerto muerto) | tabla FAIL por rol, exit 1, limpieza verificada en 0 (try/finally) |
| Residuo BD dev | SQL tras corridas OK y de fallo | 0 (incluye join PerfilOperador) |
| Gate | `npx tsc --noEmit` · `npx eslint scripts/smoke-prod-safe.ts` | exit 0 ambos |

Endpoints usados como acción principal (todos GET de solo lectura):
padre `/api/reportes/mis-reportes` · colegio `/api/colegio/estadisticas` ·
admin `/api/admin/estadisticas` · operador `/api/admin/reportes-revision` ·
comité `/api/admin/comite/pendientes`.

## Probado vs. no probado (honesto)

- **NO se corrió contra producción ni contra el VPS**: el runner se entrega, no
  se ejecuta (instrucción del bloque). La corrida real de producción queda para
  ZEUS con `--confirm-prod` (ver runbook 12d).
- Sí probado en local: ciclo de cuentas en BD de test, flujo HTTP completo
  contra app real (Next dev + BD dev), ambos caminos de cookie, camino de fallo
  con limpieza, guardas y dry-run.
- No probado: comportamiento tras SIGKILL a mitad de corrida (por diseño puede
  quedar residuo `smoke-%@test.invalid`; el runner lo reporta al inicio y el
  runbook documenta el borrado manual).

## Limitaciones y deuda técnica

1. **Cobertura de escritura omitida a propósito**: no hay reporte de prueba del
   padre. Encolar un job pg-boss que el worker de producción procesaría no es
   reversible FK-completo sin carrera. La escritura sigue cubierta por
   `scripts/smoke-e2e.ts` en dev/ensayo. Retomar solo si se diseña un modo de
   worker "no procesar reportes smoke" o borrado transaccional coordinado.
2. El smoke no ejercita proxy/middleware de páginas (solo API Routes): la
   cobertura de caminos UI por rol sigue siendo la de la suite E2E (SPEC-114)
   en entorno de test.
3. Los contadores de `RateLimit` por IP (scope login) quedan como cualquier
   tráfico real (efímeros por ventana); documentado como residual aceptado.
