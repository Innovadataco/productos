# Feature Specification: SPEC-120 — Smoke prod-safe por rol

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-07-29

**Status**: FINALIZADO (ver `cierre.md`)

**Input**: Cola nocturna 002-PI-041, bloque B8 (ZEUS): la suite E2E de la SPEC-114
(`src/lib/e2e/`) NO puede correr contra producción porque cada recorrido hace
`resetDatabase()`. Se necesita un runner distinto, prod-safe, que por cada rol
compruebe **entrar → hacer su acción principal → salir**, sin dejar NADA residual.

## Regla dura (del bloque B8, no negociable)

El runner **jamás** escribe fuera de sus cuentas efímeras y **jamás** ejecuta
`resetDatabase` ni nada destructivo. Todo lo que crea lo borra (por ID explícito,
en orden FK-seguro) incluso si falla (`try/finally`).

## User Stories

### US1 — Verificación post-deploy por rol (Priority: P1)

Como operador de plataforma, tras un deploy quiero correr un smoke contra
producción que pruebe el ciclo de sesión completo de los 5 roles, para detectar
en minutos que un rol no puede entrar, actuar o salir — sin riesgo para los datos.

**Acceptance Scenarios**

1. **Dado** un entorno con app y BD accesibles, **cuando** corro el runner,
   **entonces** por cada rol (PARENT, SCHOOL_ADMIN, ADMIN, OPERADOR,
   COMITE_VALIDACION) verifica: login HTTP 200 → endpoint principal del rol
   HTTP 200 → logout HTTP 200 → endpoint 401 sin cookie.
2. **Dado** el logout, **cuando** se recibe la respuesta, **entonces** el runner
   exige Set-Cookie de borrado con `Path=/` y `Max-Age=0` en todas las cookies de
   sesión y `Secure` en al menos una (la `__Host-`, spec 106).
3. **Dado** cualquier fallo a mitad de corrida, **cuando** el runner termina,
   **entonces** las cuentas efímeras quedan borradas igualmente y el runner
   verifica 0 filas propias residuales.

### US2 — Cuentas efímeras autogestionadas (Priority: P1)

Como operador, no quiero crear cuentas a mano ni acordarme de borrarlas: el
runner las crea al inicio vía Prisma directo contra la BD del entorno
(requiere `DATABASE_URL`) y las borra al final en orden FK-seguro.

**Acceptance Scenarios**

1. **Dado** `DATABASE_URL` definida, **cuando** inicia, **entonces** crea 5
   usuarios `smoke-<ts>-<rol>@test.invalid` (bcrypt, contraseña aleatoria por
   corrida, nunca impresa), más Tenant+Colegio para el colegio y PerfilOperador
   para operador y comité (patrón del alta real por admin).
2. **Dado** el borrado, **cuando** termina, **entonces** elimina en orden:
   RateLimit propio (`admin_read`) → PerfilOperador → Usuario → Colegio →
   Tenant (→ Ciudad/Pais solo si los tuvo que crear por entorno sin datos).
3. **Dado** un entorno con Pais/Ciudad ya sembrados (dev/prod), **cuando** crea
   el colegio, **entonces** reutiliza esas filas en modo solo-lectura (no crea
   ni toca catálogos).

### US3 — Operación segura y auditable (Priority: P1)

Como responsable de producción, quiero señales contra ejecución accidental y
una salida clara: `--dry-run`, guarda de URL no-loopback, tabla PASS/FAIL y
exit code distinto de 0 si algo falla, sin valores sensibles en logs.

**Acceptance Scenarios**

1. **Dado** `--dry-run`, **cuando** corro el runner, **entonces** imprime el
   plan completo sin tocar BD ni red (exit 0).
2. **Dada** una URL base no-loopback sin `--confirm-prod`, **cuando** corro el
   runner, **entonces** aborta con exit 2 y mensaje claro.
3. **Dado** un fallo de red total, **cuando** corro el runner, **entonces**
   marca FAIL por rol, sale con exit 1 y la limpieza sigue verificándose en 0.

## Edge Cases

- **Sin Pais/Ciudad en la BD** (p.ej. test vacía): los crea propios y los borra
  en la limpieza; si ya existen, solo los lee.
- **Residuo de corridas anteriores** (`smoke-*@test.invalid` por un SIGKILL):
  lo reporta como info al inicio; no toca filas que no son suyas.
- **Rate limit de login por IP** (default 10/5 min): una corrida = 5 logins;
  documentado en el runbook para no encadenar corridas.
- **Cookie dual** (`__Host-token` en HTTPS, `token` legacy en HTTP): el runner
  acepta cualquiera de las dos al hacer login y exige el borrado de ambas.

## Functional Requirements

- **FR-001**: El sistema DEBE proveer un runner (`scripts/smoke-prod-safe.ts`)
  ejecutable con `node --env-file=<env> --import tsx`, con URL base configurable
  (`SMOKE_BASE_URL` / `--base-url`; default `NEXT_PUBLIC_APP_URL` o localhost).
- **FR-002**: El runner DEBE crear las cuentas efímeras vía Prisma directo
  (bcrypt + filas Usuario/Colegio/Tenant/PerfilOperador) y borrarlas en orden
  FK-seguro al terminar, incluso si falla (try/finally).
- **FR-003**: El runner NUNCA DEBE ejecutar `resetDatabase`, borrados masivos ni
  escrituras fuera de sus filas propias (borrado por ID explícito con deleteMany).
- **FR-004**: Por rol DEBE comprobar: login 200 → endpoint principal 200 →
  logout 200 (Set-Cookie `Path=/`, `Max-Age=0`, `Secure` presente) → 401 sin cookie.
- **FR-005**: La escritura de negocio (reporte de prueba del padre) QUEDA OMITIDA
  por diseño: encolar un job pg-boss que el worker procesaría no es reversible
  FK-completo sin carrera. Se documenta como limitación.
- **FR-006**: DEBE ofrecer `--dry-run` (plan sin efectos), `--db-only` (solo
  ciclo de cuentas) y guarda `--confirm-prod` para URLs no-loopback.
- **FR-007**: La salida DEBE ser una tabla PASS/FAIL por rol con exit code
  `0`/`1`/`2`, sin contraseñas, tokens ni valores de cookies en los logs.
- **FR-008**: Tras la limpieza DEBE verificar y reportar 0 filas propias
  residuales (si quedan, FAIL y mensaje con el patrón exacto a borrar a mano).

## Success Criteria

- **SC-1**: Corrida completa contra entorno local: 5/5 roles PASS, exit 0.
- **SC-2**: Verificación SQL independiente tras la corrida: 0 filas `smoke-%`.
- **SC-3**: Camino de fallo (app caída): tabla FAIL, exit 1, limpieza en 0 igualmente.
- **SC-4**: `--dry-run` no toca BD ni red (exit 0); guarda no-loopback aborta (exit 2).
- **SC-5**: `npx tsc --noEmit` y `npx eslint scripts/smoke-prod-safe.ts` en verde.

## Assumptions

- La BD del entorno objetivo está migrada y sembrada (permisos de módulo por rol,
  catálogo Pais/Ciudad); el runner no siembra nada de eso salvo el fallback
  documentado de Pais/Ciudad.
- El operador que lo corre en producción tiene `DATABASE_URL` del VPS en un
  `.env.production` local fuera de git (I-22: valores nunca en docs ni commits).
- Los contadores de ventana de `RateLimit` por IP (scope login) son infraestructura
  compartida y efímera; no se consideran residuo y no se borran.

## Implementación (cierre)

- `scripts/smoke-prod-safe.ts` — runner (creación/borrado de cuentas, chequeos
  HTTP por rol, dry-run, db-only, guarda no-loopback, tabla PASS/FAIL).
- `docs/runbook.md` — sección 12d con uso, frecuencia, residual aceptado y
  recuperación de residuo tras muerte abrupta.
- Evidencia y probado/no-probado: ver `cierre.md`.
