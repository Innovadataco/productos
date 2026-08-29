# Tasks: SPEC-120 — Smoke prod-safe por rol

**Spec**: `specs/120-smoke-prod-safe/spec.md` · **Plan**: `plan.md`

## Fase 1 — Runner

- [x] T001 Crear `scripts/smoke-prod-safe.ts`: parseo de opciones
  (`--dry-run`, `--db-only`, `--base-url`, `--confirm-prod`, `--help`), guardas
  (DATABASE_URL, no-loopback) y descripción de BD sin credenciales.
- [x] T002 [P] `crearCuentasEfimeras()`: 5 usuarios bcrypt
  `smoke-<ts>-<rol>@test.invalid` + Tenant + Colegio (vigencia válida) +
  PerfilOperador (operador y comité, `creadoPorId` = admin efímero); Pais/Ciudad
  solo-lectura con fallback de creación propia; contraseña aleatoria no impresa.
- [x] T003 [P] `borrarCuentasEfimeras()` + `contarResiduosPropios()`: borrado
  FK-seguro por ID (RateLimit propio → PerfilOperador → Usuario → Colegio →
  Tenant → Ciudad/Pais propios), idempotente, con verificación de 0 residuo.
- [x] T004 `chequearRol()`: login 200 + rol correcto + cookie → endpoint del rol
  200 → logout 200 con Set-Cookie `Path=/`+`Max-Age=0`+`Secure` → 401 sin cookie.
  Cookie dual (`__Host-token`/`token`), timeout 15 s, sin valores sensibles en logs.
- [x] T005 Salida: tabla PASS/FAIL por rol, exit codes 0/1/2, `main()` con
  try/finally (borrado garantizado) y `--dry-run` sin efectos.

## Fase 2 — Verificación

- [x] T006 `--dry-run` y `--help`: exit 0, plan impreso, sin tocar BD ni red.
- [x] T007 Guarda no-loopback: sin `--confirm-prod` aborta con exit 2.
- [x] T008 `--db-only` contra BD de test (bajo candado de gate): ciclo PASS +
  SQL independiente: 0 filas `smoke-%` en Usuario/Tenant/Colegio.
- [x] T009 Corrida completa contra app local (Next dev :5099 con `.env`, BD dev):
  5/5 roles PASS, exit 0; SQL independiente: 0 residuo en BD dev.
- [x] T010 Camino de fallo (puerto muerto): tabla FAIL, exit 1, limpieza
  verificada en 0 (try/finally funciona).
- [x] T011 Gate: `npx tsc --noEmit` (exit 0) y
  `npx eslint scripts/smoke-prod-safe.ts` (exit 0).

## Fase 3 — Docs y cierre

- [x] T012 `docs/runbook.md`: sección 12d (uso, dry-run, db-only, prod con
  `--confirm-prod`, frecuencia/rate limit, residual aceptado, recuperación de
  residuo tras muerte abrupta, limitación de solo-lectura).
- [x] T013 Artefactos spec: `spec.md`, `plan.md`, `tasks.md`, `cierre.md`.
- [ ] T014 Commits selectivos (rutas explícitas `002-2026-PROTECCION-INFANTIL/…`;
  SIN push — lo entrega ZEUS) y reporte final.

## Notas

- No hay tests Vitest nuevos: el runner es un script operativo que se prueba a
  sí mismo contra entornos reales (T006–T010 son su suite). Añadirlo a la suite
  jsdom no aportaría (su valor es end-to-end contra HTTP+BD reales).
- El número de spec pasó de 118 a 120 durante la implementación: un agente en
  paralelo ocupó `specs/118-clics-muertos-colegio`.
