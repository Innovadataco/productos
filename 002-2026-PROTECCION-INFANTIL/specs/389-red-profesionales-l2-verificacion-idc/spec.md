# SPEC-389 · Red de Profesionales · L2 — IDC verifica

**Autor:** Dev PI-2 · **Fecha:** 2026-09-03 · **Brief:** `BRIEF-A-75-RED-DE-PROFESIONALES.md` (§7 · L2) · **Status:** 🟡 En desarrollo · **Depende de:** SPEC-388 · L1a (modelo Prisma compartido, hecho por Dev Guardianes) · **Coordina con:** SPEC-388 (L1 completo), SPEC-390 (L3, el padre encuentra) · **Impacto en arquitectura:** módulo nuevo `admin_verificacion_profesionales`, tabla `VerificacionProfesional` con historial N:1, worker cron nuevo, patrón de archivo protegido copiado de apelaciones (SPEC-110).

## 1 · Qué entrega este lote

La cola donde IDC verifica al profesional y le da (o le niega) el sello. Es el filtro entre "existe" (L1) y "el padre lo puede encontrar" (L3): sin `VerificacionProfesional.resultado = APROBADO` vigente, el perfil no aparece en el directorio del padre.

**Recorrido admin (rol ADMIN):**
1. Entra a `/dashboard/admin/profesionales/verificacion` y ve la cola de perfiles en `EN_REVISION`, ordenada por más antiguos primero.
2. Abre una ficha; el sistema audita quién abrió qué (ley 1918/2018 · art. 10).
3. Ve lo que cargó el profesional (nombre, título, especialidades, ciudad, tarifa, presentación, foto) + el **documento de autorización firmado** (servido detrás de auth+módulo, jamás por URL pública).
4. Recorre el **checklist de verificación** (jsonb) y va marcando los ítems consultados con su resultado.
5. Decide: **APROBADO**, **RECHAZADO** o **MAS_INFORMACION**.
6. Cada decisión graba un nuevo `VerificacionProfesional` (**historial N por profesional**, nunca una sola fila que se pisa) con `venceEn = revisadoEn + 4 meses` (ley 2375/2024).
7. Si APROBADO, el perfil pasa a `ACTIVO`. Si RECHAZADO, a `RECHAZADO`. Si MAS_INFORMACION, queda en `EN_REVISION` con nota.

**Del lado invisible al usuario:**
- Un mes antes de que venza una verificación aprobada: aviso al profesional y al ADMIN.
- Al vencer: el perfil pasa a `VENCIDO` y **deja de mostrarse** en el directorio del padre hasta la próxima verificación.
- Cada apertura de ficha graba `AuditLog.PROFESIONAL_VERIFICACION_CONSULTADO` + una fila en `AccesoVerificacionProfesional` (quién, cuándo, IP, user-agent). Sin esa bitácora, la reserva legal no está probada.

## 2 · Reglas duras (no negociables)

- **Reserva legal del resultado de antecedentes** (Ley 1918/2018 · art. 10). La API pública devuelve exclusivamente `{sello: "APROBADO"|"VENCIDO"|"AUSENTE", fechaVerificacion?, venceEn?}`. **Nunca** `resultado`, **nunca** `checklist`, **nunca** `autorizacionArchivoUrl`. Cuatro campos reservados, cuatro tests-candado que lo afirman.
- **Verificación cada 4 meses.** `venceEn = revisadoEn + 4 meses`. No 1 año. La constante se sella en un test.
- **Autorización previa, expresa, escrita y archivada.** El archivo va en almacenamiento cifrado en disco (patrón `apelacion-storage.ts`); en BD solo la ruta interna + hash. Servido solo tras `assertModulo(user, "admin_verificacion_profesionales")` + auditoría de acceso.
- **La cola solo muestra `EN_REVISION`.** `BORRADOR` (perfil a medio llenar del L1) NUNCA aparece — se llenaría de fichas vacías.
- **Módulo exclusivo del rol ADMIN** (criterio I-274 / SPEC-381 aplicado al revés: quien verifica no es quien publica; para el MVP el verificador es IDC=ADMIN).
- **`resultado` guardado por decisión, no calculado**; el `venceEn` se guarda al crear la verificación, no se recalcula al leer.

## 3 · Fuera de alcance

- L1 completo (registro del profesional, autorización inicial, formulario "Soy profesional"): Dev Guardianes.
- L3 (directorio del padre): otro Dev; este spec solo debe garantizar que el filtro `estado=ACTIVO ∧ verificacion vigente` bloquee `VENCIDO/RECHAZADO/EN_REVISION` cuando exista.
- L4-L7 (cita, panel del profesional, cierre, plata): otras specs.
- Canal del aviso "1 mes antes": este lote lo publica como notificación in-app + email genérico; los canales por rol vendrán con el brief de notificaciones cuando toque.
- Botón "solicitar re-verificación" desde el panel del profesional (será L5).

## 4 · Modelo (recibido de L1a — SPEC-388)

Este spec **usa** el modelo, no lo define. Espero de SPEC-388 · L1a:

- `enum RolUsuario += PROFESIONAL`
- `enum EstadoPerfilProfesional { BORRADOR, EN_REVISION, ACTIVO, RECHAZADO, VENCIDO, SUSPENDIDO }`
- `model PerfilProfesional` (1:1 con Usuario, reusa `fechaNacimiento` + documento de `Usuario`, sin duplicar)
- `model VerificacionProfesional` (N:1 con PerfilProfesional, con `checklist` jsonb, `resultado` enum, `autorizacionArchivoUrl`, `venceEn`, `revisadoPorId`, `revisadoEn`)
- `model AccesoVerificacionProfesional` (bitácora de acceso a la ficha, patrón `AccesoDocumentoApelacion`)

Al llegar el hash de L1a, este spec se sella y las tareas se generan.

## 5 · Endpoints

Todos bajo `assertModulo(user, "admin_verificacion_profesionales")` (solo ADMIN por el seed de I-274).

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/admin/profesionales/verificacion` | Cola paginada, filtro por estado (default `EN_REVISION`), orden antiguos primero |
| GET | `/api/admin/profesionales/verificacion/[id]` | Ficha con perfil + última verificación + historial · graba auditoría + bitácora |
| GET | `/api/admin/profesionales/verificacion/[id]/autorizacion` | Streamea el PDF de autorización (patrón `apelaciones/[id]/documento`) · graba auditoría + bitácora |
| POST | `/api/admin/profesionales/verificacion/[id]/aprobar` | Crea `VerificacionProfesional{resultado:APROBADO, venceEn:+4m}`, activa perfil |
| POST | `/api/admin/profesionales/verificacion/[id]/rechazar` | Crea `VerificacionProfesional{resultado:RECHAZADO}`, marca perfil `RECHAZADO` |
| POST | `/api/admin/profesionales/verificacion/[id]/mas-info` | Crea `VerificacionProfesional{resultado:MAS_INFORMACION}`, deja perfil `EN_REVISION` con nota |

**API pública (para L3, expuesta aquí como candado):** helper puro `sellosProfesional(profesionalId)` que devuelve solo `{sello, fechaVerificacion?, venceEn?}`. Un test verifica que ni `resultado`, ni `checklist`, ni `autorizacionArchivoUrl`, ni `notaInterna` estén en la respuesta.

## 6 · Worker / cron

Nuevo script `scripts/worker-verificacion-profesionales.mjs` análogo a `worker-sesiones.mjs`:
- Cada N minutos (parametrizable, arranca en 60): busca verificaciones vigentes con `venceEn` entre `now+29d` y `now+31d` que no tengan aviso enviado; publica notificación (in-app + email) al profesional y al ADMIN; marca la verificación con `avisoVencimientoEnviadoEn`.
- Busca verificaciones con `venceEn < now`; pasa el perfil a `VENCIDO`; graba auditoría `PROFESIONAL_VERIFICACION_VENCIDA`.

Test unitario del helper puro (sin BD): dado un set de fechas, decide qué acciones tomar. Igual patrón que `worker-sesiones.test.mjs`.

## 7 · Pantalla admin

`src/app/dashboard/admin/profesionales/verificacion/page.tsx` (lista) + `[id]/page.tsx` (ficha).

- Header consistente con el resto del admin.
- Lista: tabla con nombre visible, título, ciudad, días en cola, botón "Ver".
- Ficha: dos columnas — izquierda perfil + PDF de autorización embebido (via el endpoint protegido, no `<img src="url pública">`), derecha checklist + acciones + historial de verificaciones previas.
- Al abrir la ficha, la auditoría se dispara del lado servidor (`getInitialProps` server-only).

## 8 · Tests

**Unit (candados):**
1. `sellos-profesional-reserva-legal.test.ts` — helper público NUNCA devuelve `resultado`, `checklist`, `autorizacionArchivoUrl`, `notaInterna`.
2. `venceEn-4-meses.test.ts` — la función `calcularVenceEn(revisadoEn)` devuelve exactamente +4 meses (Ley 2375/2024).
3. `cola-solo-en-revision.test.ts` — el filtro de la cola excluye `BORRADOR`, `ACTIVO`, `RECHAZADO`, `VENCIDO`, `SUSPENDIDO`.
4. `seed-modulo-verificacion-profesionales.test.ts` — el nuevo módulo existe en el catálogo, categoría `admin`, y **solo ADMIN** lo tiene en `clavesPorRol`.
5. `worker-verificacion-profesionales.test.mjs` — helper puro de decisión (avisar / vencer / no hacer nada) sobre un set de fechas.

**Integration (contra BD real):**
6. `endpoints-verificacion-profesionales.test.ts` — GET cola/detalle/autorizacion, POST aprobar/rechazar/mas-info; asserta creación del `VerificacionProfesional` con `venceEn=+4m`, cambio de estado del perfil, auditoría + bitácora grabadas.
7. `guardia-modulo-verificacion.test.ts` — cada endpoint devuelve 403 para OPERADOR/PARENT/SCHOOL_ADMIN/COMITE_VALIDACION/COMITE_CONVIVENCIA.
8. `autorizacion-servida-solo-con-modulo.test.ts` — el PDF de autorización se sirve solo tras auth+modulo; graba `AccesoVerificacionProfesional`.

**E2E (Calidad):** recorrido "IDC aprueba un profesional" fuera del alcance de este spec — lo cubre el plan de pruebas cuando el worktree lo tenga.

## 9 · Notas de decisión

- **Rol único ADMIN vs rol dedicado `VERIFICADOR_PROFESIONALES`:** decidí ADMIN para el MVP (Jelkin no ha pedido un rol nuevo). El módulo queda listo para asignárselo a otro rol el día que se cree, sin tocar endpoint.
- **Reusar `Usuario.fechaNacimiento` y `Usuario.documento`:** decisión del CEO (2026-09-03 04:34) tras análisis de Dev Guardianes. Evita duplicación y respeta la fuente única.
- **`BORRADOR` fuera de la cola:** decisión del CEO en el mismo mensaje. Un perfil "a medio llenar" no es trabajo de IDC hasta que el profesional lo envíe.
- **`resultado` en el candado de reserva legal:** decisión del CEO en el mismo mensaje, extendiendo la lista original que yo había propuesto (`autorizacionArchivoUrl`, `checklist`).
- **Aviso a 1 mes antes de vencer:** ventana [+29d, +31d] con marca `avisoVencimientoEnviadoEn` para idempotencia del cron.

## 10 · Ley aplicable (citada, no negociable)

- **Ley 1918 de 2018** (verificación de antecedentes de quienes trabajan con menores).
- **Ley 2375 de 2024** (reforma): frecuencia máxima **cuatro meses**, no anual.
- **Sentencia C-407/2020** (tumbó parte del texto original de la 1918 — el texto viejo que circula no aplica).
- **Autorización previa, expresa, escrita** archivada; resultado reservado; consulta auditada.

Toda la interfaz del código con la ley pasa por este spec y por los tests-candado — si un cambio futuro rompe la reserva o el intervalo, el test lo caza antes del deploy.

## 11 · Definition of Done

- [ ] Modelo L1a recibido y en `origin/main` (Dev Guardianes reporta hash).
- [ ] Migración de este spec (solo si hay campo nuevo del lado de la verificación no cubierto por L1a; idealmente ninguno).
- [ ] Módulo `admin_verificacion_profesionales` en catálogo + grant a ADMIN + reconciliador BD prod (patrón I-274).
- [ ] Los 6 endpoints implementados con guardián + rate limit + validador Zod + auditoría + tests.
- [ ] Pantallas admin `verificacion` + `verificacion/[id]` construidas y probadas en vivo.
- [ ] Worker cron + su helper puro + test unitario.
- [ ] Los 8 tests (5 unit + 3 integration) verdes.
- [ ] Reservada la lista de candado: `resultado`, `checklist`, `autorizacionArchivoUrl`, `notaInterna`.
- [ ] Gate CI verde (tsc + lint + unit + integration + arch:check).
- [ ] Recorrido en vivo del CEO en el entorno desplegado antes de decir CUMPLE (regla de la casa).
