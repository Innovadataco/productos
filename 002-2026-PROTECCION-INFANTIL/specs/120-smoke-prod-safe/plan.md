# Implementation Plan: SPEC-120 — Smoke prod-safe por rol

**Spec**: `specs/120-smoke-prod-safe/spec.md` · **Status**: FINALIZADO

## Contexto y decisión de arquitectura

La suite E2E (SPEC-114, `src/lib/e2e/`) prueba caminos completos pero cada
recorrido hace `resetDatabase()`: inutilizable contra producción. Este plan
define un runner **distinto y complementario** cuya invariante es: todo lo que
crea, lo borra por ID; nada destructivo, nada residual.

## Decisiones (con alternativas evaluadas)

1. **Cuentas efímeras vía Prisma directo** (elegida) vs. cuentas creadas a mano
   por el admin vía UI. La UI exige intervención humana por corrida, deja
   residuo si el humano olvida borrar, y el alta real envía emails de bienvenida
   (Resend) — efecto externo inaceptable en un smoke. Prisma directo replica el
   patrón del alta (bcrypt + Usuario/Colegio/Tenant/PerfilOperador, como la
   verificación de deploy 002-PI-040 y `src/lib/reporte-test-utils.ts`) y
   garantiza borrado FK-seguro automatizado. Requisito documentado:
   `DATABASE_URL` del entorno objetivo.
2. **Solo lectura + ciclo de sesión** (elegido) vs. reporte de prueba del padre
   con borrado FK-completo. Un reporte encola un job pg-boss que el worker de
   producción consume (embedding, clasificación, filas de pipeline, posibles
   insumos de agregación): borrarlo FK-completo mientras el worker puede estar
   procesándolo es una carrera y viola la regla dura. Se OMITE y se documenta
   como limitación (la escritura la cubre `scripts/smoke-e2e.ts` en dev/ensayo).
3. **Endpoints de acción principal** (todos GET de solo lectura):
   - PARENT → `/api/reportes/mis-reportes` (`verifyAuth("PARENT")`)
   - SCHOOL_ADMIN → `/api/colegio/estadisticas` (`verifyAuth("SCHOOL_ADMIN")`)
   - ADMIN → `/api/admin/estadisticas` (rol ADMIN)
   - OPERADOR → `/api/admin/reportes-revision` (bandeja; OPERADOR/ADMIN/comité)
   - COMITE_VALIDACION → `/api/admin/comite/pendientes` (comité/ADMIN)
   Además del 200, el login valida `user.rol` en el cuerpo: cubre autenticación,
   autorización por rol y permisos de módulo (`assertModulo`) del entorno.
4. **Cookie dual**: login acepta `__Host-token` (HTTPS) o `token` (HTTP, spec
   106); el chequeo de logout exige `Path=/` + `Max-Age=0` en todas las cookies
   de sesión borradas y `Secure` en al menos una (la `__Host-` siempre la lleva).
5. **Pais/Ciudad solo-lectura**: el Colegio efímero referencia catálogos
   existentes; solo si el entorno no tiene ninguno (BD de test vacía) crea
   propios y los borra. Cero escritura en catálogos de producción.
6. **Borrado FK-seguro** (deleteMany por ID, idempotente): RateLimit propio
   (`admin_read`, identifier = usuario efímero) → PerfilOperador → Usuario →
   Colegio → Tenant → Ciudad/Pais propios. `AuditLog` nunca se genera (login y
   GETs no auditan) y su FK a Usuario es SetNull; `RateLimit` por IP (login) es
   infraestructura compartida efímera: se documenta, no se toca.
7. **Guardas operativas**: `--dry-run` sin efectos; URL no-loopback exige
   `--confirm-prod` (o `SMOKE_CONFIRM_PROD=1`); sin `DATABASE_URL` aborta (exit 2).
8. **Sin secretos en logs**: contraseña aleatoria por corrida
   (`crypto.randomBytes`, nunca impresa); `DATABASE_URL` se describe como
   `host:puerto/bd` sin credenciales; cookies/tokens jamás impresos.

## Estructura

- `scripts/smoke-prod-safe.ts` (nuevo, único archivo de código):
  - `crearCuentasEfimeras()` / `borrarCuentasEfimeras()` / `contarResiduosPropios()`
  - `chequearRol()` — los 4 pasos HTTP con timeout 15 s y `redirect: manual`
  - `imprimirPlan()` (dry-run) · `main()` con try/finally y exit codes 0/1/2
- `docs/runbook.md` — sección 12d (uso, frecuencia, residual aceptado, recuperación
  de residuo tras muerte abrupta).
- `specs/120-smoke-prod-safe/` — spec/plan/tasks/cierre.

## Riesgos y mitigaciones

- **Muerte abrupta (SIGKILL) sin finally**: residuo identificable por patrón
  `smoke-%@test.invalid`; runbook documenta el borrado manual.
- **Rate limit de login por IP**: 5 logins/corrida < 10/5 min default; documentado.
- **App dev con compilación lenta**: precalentar rutas o reintentar; timeout 15 s.

## Verificación (ver cierre.md para evidencia)

1. `--dry-run` exit 0 sin tocar nada.
2. `--db-only` contra BD de test (bajo candado de gate): ciclo crear/borrar PASS
   + verificación SQL independiente 0 residuo.
3. Corrida completa contra app local (Next dev :5099, BD dev): 5/5 PASS, exit 0,
   SQL 0 residuo.
4. Camino de fallo (puerto muerto): tabla FAIL, exit 1, limpieza 0.
5. `npx tsc --noEmit` y `npx eslint scripts/smoke-prod-safe.ts` en verde.
