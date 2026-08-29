# Feature Specification: SPEC-296 — Migrar `email.ts` al Motor de Notificaciones (I-152)

**Feature Branch**: `work/002-PI-197`

**Created**: 2026-08-27

**Status**: `PLANEADO`

Impacto en arquitectura: `src/lib/email.ts` deja de emitir emails por sí mismo. Cada una de las 20 funciones exportadas se transforma en un **thin wrapper** que llama a `programar()` del motor con el evento/plantilla/destinatarios apropiados. Los 16 callsites externos NO cambian su import ni su firma (backward compatible). Se crean los eventos + plantillas + reglas faltantes en `prisma/seed.ts`. Se añade un ratchet CI que falla el build si un archivo fuera de `src/lib/notificaciones/` vuelve a introducir `resend.emails.send()`.

**Input** (BRIEF-A-41 §1, verificado en fuente): `src/lib/email.ts` tiene 20 funciones que llaman `resend.emails.send()` directamente (grep confirma). 16 callsites externos importan de `@/lib/email`. El bypass del motor implica: sin cola, sin reintentos, sin dedup, sin quietHours, sin fila en `Notificacion`, sin observabilidad en el monitor de 13 señales.

## Inventario formal (verificado por `grep -n "^export async" src/lib/email.ts`)

| # | Función `email.ts` | Callsites externos | Evento propuesto | Sujeto | Plantilla nueva? |
|---|---|---|---|---|---|
| 1 | `enviarCodigoVerificacion(email, codigo)` | `api/auth/verificar/solicitar` | `auth.codigo_verificacion` | usuario | ✅ crear |
| 2 | `enviarTokenRecuperacion(email, token)` | `api/auth/recuperar/solicitar` | `auth.password_recuperacion` | usuario | ✅ crear |
| 3 | `enviarEmailBienvenidaOperador(email, nombre, password)` | `api/admin/operadores` (2 rutas) | `usuario.bienvenida.operador` | usuario | ✅ crear |
| 4 | `enviarEmailBienvenidaComite(email, nombre, password)` | `api/admin/operadores` (2 rutas) | `usuario.bienvenida.comite` | usuario | ✅ crear |
| 5 | `enviarEmailCredencialesPadre(email, nombre, password)` | `api/auth/register` + `api/admin/padres/[id]/restablecer-password` | `usuario.credenciales.padre` | usuario | ✅ crear |
| 6 | `enviarAlertaComitePendientes(email, cantidad)` | `lib/operadores/notificacion-comite.ts` | `comite.pendientes.alerta` | usuario | ✅ crear |
| 7 | `enviarAvisoPlazoApelaciones(email, cantidad)` | (huérfano tras SPEC-* · sin callsite externo actual) | `comite.apelaciones.plazo` | usuario | ✅ crear |
| 8 | `enviarAlertaRevision(reporte)` | `lib/dal/services/reporte-processing/finalizacion.ts` | `reporte.revision.requerida` | reporte | ✅ crear |
| 9 | `enviarAlertaScoreCritico(reporte)` | `lib/dal/services/reporte-processing/finalizacion.ts` | `reporte.score_critico` | reporte | ✅ crear |
| 10 | `enviarAlertaCirculoConfianza(email, cantidad)` | `lib/dal/services/circulo-confianza/notificaciones.ts` | `padre.circulo_confianza.pendientes` | usuario | ✅ crear |
| 11 | `enviarAvisoReporteNuevoColegio(email)` | `lib/colegio/avisos.ts` | `colegio.reporte_nuevo` | colegio | ✅ crear |
| 12 | `enviarAvisoUmbralCursoColegio(email, curso, cantidad)` | `lib/colegio/avisos.ts` | `colegio.curso.umbral` | colegio | ✅ crear |
| 13 | `enviarAvisoEstudianteRepetidoColegio(email, alias, cantidad)` | `lib/colegio/avisos.ts` | `colegio.estudiante.repetido` | colegio | ✅ crear |
| 14 | `enviarResumenSemanalColegio(email, resumen)` | `lib/colegio/avisos-resumen.ts` | `colegio.resumen_semanal` | colegio | ✅ crear |
| 15 | `enviarAlertaColegio(email, cantidad)` | `lib/colegio/avisos.ts` | `colegio.alerta.pendientes` | colegio | ✅ crear |
| 16 | `enviarAlertasSuscriptores(payload)` | `lib/dal/services/reporte-processing/finalizacion.ts` | `suscriptores.reporte_publicado` | reporte | ✅ crear |
| 17 | `enviarAlertaInfra(params)` | `lib/ai/patron-coordinado.ts` | `infra.alerta` | admin | ✅ crear |
| 18 | `enviarAlertaRateLimit(params)` | `lib/anti-abuso/rate-limit-alerts.ts` | `infra.rate_limit` | admin | ✅ crear |
| 19 | `enviarEmailNotificacion(...)` | `lib/notificaciones/admin-service.ts` + `lib/dal/services/notificacion-admin.ts` | `admin.notificacion_generica` | admin | ✅ crear |
| 20 | `enviarAlertaDerivaMotor(params)` | (huérfano — sin callsite externo actual) | `motor.deriva.alerta` | admin | ✅ crear |

- **20 funciones · 16 callsites externos únicos · 2 funciones huérfanas** (`enviarAvisoPlazoApelaciones`, `enviarAlertaDerivaMotor` — se migran igual porque el brief exige quitar TODO bypass).
- **20 eventos + 20 plantillas + 20 reglas** que hay que crear en `prisma/seed.ts`.
- **Cero eventos del motor existentes** encajan directamente (todos los del seed actual son de dominio expediente/suscripción/referido; los 20 de email.ts son de auth/comité/infra/reporte).

## Decisión de arquitectura: **thin wrapper**

**Wrapper** (opción A del brief §2.3) porque:
1. **Cero cambio en 16 callsites externos** — respeta directamente SC-4 (cero regresión).
2. La firma de cada wrapper preserva los parámetros originales (email/token/cantidad/…) y los reempaqueta como `variables` para `programar()`. Los tests unitarios de callers no se rompen.
3. Un PR posterior puede retirar `email.ts` cuando cada callsite migre a `programar()` directo — brief de higiene separado, fuera de A-41.
4. El grep ratchet se satisface: dentro de `email.ts` **no queda ninguna llamada a `resend.emails.send()`** — cada función llama `programar()` y punto. El único uso legítimo de Resend queda en `src/lib/notificaciones/envio.ts` (o donde el motor emite).

## Dependencias

- `src/lib/notificaciones/motor.ts` `programar()` (sin cambio).
- `prisma/seed.ts` — nueva sección `seedEventosEmailMigrados()` con 20 eventos/plantillas/reglas.
- `.github/workflows/ci-002-proteccion-infantil.yml` — ratchet grep.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Un padre nuevo recibe su código de verificación por email (Priority: P1)

Como padre nuevo quiero recibir mi código de verificación al registrarme, con el mismo asunto y contenido que hoy.

**Independent Test**: `POST /api/auth/verificar/solicitar` en dev → fila nueva en `Notificacion` con `evento="auth.codigo_verificacion"`, `destinatarioEmail=<padre>`, `estado="ENCOLADA"` (o `ENVIADA` fuera de quietHours). Cuerpo del email idéntico al de pre-fix.

**Acceptance Scenarios**:
1. **Given** el motor con la regla+plantilla `auth.codigo_verificacion` sembradas, **When** un caller llama `enviarCodigoVerificacion("p@x.co","1234")`, **Then** `programar()` crea 1 fila en `Notificacion` con `variables={codigo:"1234"}`, `plantillaClave="auth.codigo_verificacion.email"`, `canal=EMAIL`, `destinatarioEmail="p@x.co"`.
2. **Given** el usuario existe con `Preferencia{evento:"auth.codigo_verificacion.email",habilitada:false}` **y** la regla NO es `obligatoria=true`, **When** se llama al wrapper, **Then** NO se crea fila (respeta opt-out).
3. **Given** el usuario existe con la misma preferencia **y** la regla es `obligatoria=true` (auth siempre es obligatoria), **When** se llama al wrapper, **Then** SÍ se crea la fila (la preferencia se ignora en obligatorias).

### User Story 2 — Ratchet CI detecta nuevos bypasses (Priority: P1 · brief §5)

Como Fábrica quiero que un PR futuro que introduzca `resend.emails.send()` fuera del motor falle el CI.

**Independent Test**: en el CI del PR de este SPEC, el paso `Ratchet Resend fuera del motor` corre; después del fix el grep devuelve 0 líneas.

**Acceptance Scenarios**:
1. **Given** este PR, **When** corre el ratchet, **Then** `grep -rn "resend\.emails\.send" src/ | grep -v "src/lib/notificaciones/" | grep -v test` devuelve **0 líneas** y el CI sigue verde.
2. **Given** un PR sintético que reintroduce `resend.emails.send(...)` en `src/lib/pagos/loquesea.ts`, **When** corre el ratchet, **Then** el CI falla con mensaje `❌ Nuevo callsite Resend directo fuera del motor`.

### User Story 3 — Cero regresión en los 16 callsites externos (Priority: P1 · brief SC-4)

Como consumidor de `@/lib/email`, sigo importando y llamando las funciones con la misma firma; el resultado observable (email idéntico llega al destinatario) no cambia.

**Acceptance Scenarios**:
1. **Given** un callsite `api/auth/register` que llama `enviarEmailCredencialesPadre(email, nombre, password)`, **When** corre el flujo completo de registro, **Then** el destinatario recibe email con mismo `subject` y `from` que hoy; el HTML tiene las mismas 3 variables (`nombre`, `email`, `password`).
2. **Given** todos los 16 callsites, **When** el CI corre sus tests existentes, **Then** ninguno se rompe (los tests de callers no re-mockean `resend.emails.send` — mockean la función de `@/lib/email` o llaman el flujo completo).

### Edge Cases

- ¿Y si el motor no encuentra reglas para un evento? — devuelve `{programadas:0}` con `console.warn`. **Riesgo silencioso.** Mitigación: el ratchet ampliado en `seed-motor-cobertura.test.ts` (nuevo) valida que cada uno de los 20 eventos tenga ≥ 1 regla activa post-seed.
- ¿Y si el destinatario no tiene `usuarioId` (solo email crudo, como `enviarCodigoVerificacion`)? — `programar()` acepta `destinatarios: [{email, variables}]` sin `usuarioId`; sin `usuarioId` no aplica opt-out (línea 100 de motor.ts).
- ¿Y si `enviarAlertasSuscriptores` tiene N destinatarios? — se pasa el array completo en `destinatarios: [...]`. `programar()` crea N filas.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Cada una de las 20 funciones exportadas de `src/lib/email.ts` DEBE reescribirse para llamar `programar()` del motor con el `evento` de la tabla del inventario. NO puede quedar ninguna llamada a `resend.emails.send()` dentro de `email.ts`.
- **FR-002**: La firma exportada de cada función NO cambia (mismos parámetros, mismo tipo de retorno). El wrapper convierte parámetros a `variables: Record<string, unknown>`.
- **FR-003**: Los 16 callsites externos NO se modifican en este SPEC (backward compat).
- **FR-004**: `prisma/seed.ts` DEBE ganar una función nueva `seedEventosEmailMigrados()` que crea idempotentemente los 20 eventos + 20 plantillas + 20 reglas, con:
  - `evento` según la tabla del inventario.
  - `plantillaClave` = `<evento>.email` (patrón `motor.ts`).
  - `asunto` y `cuerpoMarkdown` = idénticos al `<h2>/subject/html` que hoy vive en `email.ts` (copia literal).
  - Regla con `canal=EMAIL`, `obligatoria=true` para auth y credenciales, `obligatoria=false` para el resto.
  - `variablesSchema` opcional (JSON) con las claves usadas por la plantilla.
- **FR-005**: `seedEventosEmailMigrados()` DEBE llamarse desde el `main()` del seed junto a los otros seeders de notificaciones.
- **FR-006**: DEBE agregarse un paso `Ratchet Resend fuera del motor` al job `verificaciones` de `.github/workflows/ci-002-proteccion-infantil.yml` que corre:
  ```bash
  BYPASS=$(grep -rn "resend\.emails\.send" src/ --include="*.ts" --include="*.tsx" \
      | grep -v "src/lib/notificaciones/" | grep -v "\.test\." || true)
  if [ -n "$BYPASS" ]; then echo "❌ Nuevo callsite Resend directo fuera del motor"; echo "$BYPASS"; exit 1; fi
  ```
- **FR-007**: DEBE existir un test de integración `src/lib/email.migracion.test.ts` que corre el seed y verifica:
  - Los 20 eventos tienen ≥ 1 regla activa `canal=EMAIL` con plantilla existente.
  - Al llamar `enviarCodigoVerificacion` (representante), `Notificacion.count(where:{evento:"auth.codigo_verificacion"})` sube en 1.
  - Al llamar `enviarEmailBienvenidaOperador`, la fila creada tiene la plantilla y variables correctas.
- **FR-008**: NO se toca `src/lib/notificaciones/motor.ts`, `src/lib/notificaciones/envio.ts`, `src/lib/notificaciones/quiet-hours.ts`, `src/lib/notificaciones/offset.ts`.
- **FR-009**: NO se cambia `prisma/schema.prisma` (cero migración, D-81).
- **FR-010**: NO se toca ningún archivo bajo `src/app/dashboard/`.
- **FR-011**: NO se migra `src/lib/email/notificacion-spam.ts` — es interno del motor (subcarpeta bajo el propio motor), no bypass.
- **FR-012**: Se conserva `import { resend } from "./email-cliente"` (o similar) SOLO si `email.ts` necesita la instancia — mejor: se elimina el import de Resend del propio `email.ts` completamente. La instancia Resend queda encapsulada en `src/lib/notificaciones/envio.ts`.

### Key Entities

- `src/lib/email.ts` — 20 funciones convertidas a wrappers.
- `prisma/seed.ts` — `seedEventosEmailMigrados()`.
- `.github/workflows/ci-002-proteccion-infantil.yml` — nuevo step ratchet.
- `src/lib/email.migracion.test.ts` (nuevo) — integration test.

## Success Criteria *(mandatory)*

- **SC-A41-1 (brief §4.1)**: `grep -rn "resend\.emails\.send" src/ | grep -v "src/lib/notificaciones/" | grep -v test` = **0 líneas**.
- **SC-A41-2 (brief §4.2)**: cada evento migrado genera fila en `Notificacion` con estado apropiado tras un flow real.
- **SC-A41-3 (brief §4.3)**: paso ratchet CI verde en el PR de este SPEC.
- **SC-A41-4 (brief §4.4)**: cero regresión en los 16 callsites externos (los tests existentes de los callers pasan sin modificarlos).
- **SC-A41-5 (brief §4.5)**: test de integración `email.migracion.test.ts` verde en CI.
- **SC-A41-6 (brief §4.6)**: `cierre.md` con el inventario final, la decisión (wrapper) y la lista de plantillas creadas.

## Assumptions

- Las plantillas Markdown del motor pueden reproducir el HTML actual de los emails de `email.ts` con equivalencia visual. Si un email actual usa HTML muy custom, se conserva el mismo cuerpo dentro del campo `cuerpoMarkdown` (Motor renderiza Markdown → HTML con soporte de `<h2>`, `<p>`, `<strong>`, `<a>` que ya usa).
- La ausencia de reglas en el seed pre-fix es la causa por la que estos eventos no estaban en el motor — no hay reglas viejas que borrar, solo agregar.
- `programar()` es idempotente frente a llamados repetidos (dedup por sujeto+destinatario) — verificado en motor.ts:120.
- Las 2 funciones huérfanas (`enviarAvisoPlazoApelaciones`, `enviarAlertaDerivaMotor`) se migran también para satisfacer FR-001, aunque no tengan callsite hoy. Si aparecen en el futuro, ya están migradas.
