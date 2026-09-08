# Feature Specification: Revelado auditado del texto (fixes en vivo del dueño)

**Feature Branch**: `[592-revelado-auditado]`

**Created**: 2026-09-08

**Status**: IMPLEMENTADO

## Impacto en arquitectura: no (cambio interno de componentes y servicios existentes; sin cambios en schema Prisma, proxy ni navegación)

**Input**: Bugs mostrados en vivo por el dueño (2026-09-07/08) en el detalle del reporte de la bandeja admin y en el texto propio del padre OAuth.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Un solo bloque de texto en el detalle (Priority: P1)

El operador/admin abre el detalle de un reporte y ve UN solo bloque con el texto vigente. El «Texto original» (evidencia) solo aparece tras pulsar «Revelar original» (acción auditada), y si resulta idéntico al texto vigente (reporte sin anonimización) NO se repite: se informa con una nota.

**Why this priority**: Mostrar el mismo párrafo dos veces («Texto actual» + «Texto original») confunde la revisión y resta credibilidad al expediente.

**Acceptance Scenarios**:

1. **Given** un reporte cuyo texto vigente es idéntico al original, **When** el admin revela el original, **Then** el panel muestra la nota «El texto original es idéntico al texto vigente» en vez de un segundo bloque con el mismo contenido.
2. **Given** un reporte anonimizado (texto vigente ≠ original), **When** el admin revela el original, **Then** se muestra el original en el panel, junto al texto vigente.
3. **Given** cualquier reporte, **When** el detalle se abre sin pulsar «Revelar original», **Then** el panel del original solo muestra el botón «Revelar original».

### User Story 2 - Sin ruido en el historial de accesos (Priority: P1)

El «Historial de accesos al texto» registra SOLO acciones reales de lectura/revelado (clic en «Revelar original», canje de código, corrección). Abrir el detalle (render) NO genera entradas.

**Why this priority**: El dueño vio 3 entradas en el mismo segundo al abrir el detalle; un historial con ruido no sirve para investigar accesos indebidos.

**Acceptance Scenarios**:

1. **Given** un operador con permiso, **When** abre el detalle del reporte, **Then** NO se crea fila en `LecturaReporte` ni se envía notificación.
2. **Given** un admin, **When** pulsa «Revelar original», **Then** la revelación queda en `LecturaReporte` (campo `textoOriginal`) y en `AuditLog` (`TEXTO_ORIGINAL_REVELADO`).
3. **Given** una corrección de categoría, **When** el operador la guarda, **Then** las lecturas de texto que la operación haga internamente siguen auditadas en `LecturaReporte`.

### User Story 3 - Padre OAuth: step-up sin contraseña (Priority: P1)

El padre que entró con Google no tiene contraseña. Al revelar el texto de su propio reporte con sesión vieja, el sistema le ofrece enviar un código temporal a su correo (vigencia 10 minutos) como alternativa al check de contraseña. Al verificarlo, se emite el mismo sello step-up de la vía por contraseña.

**Why this priority**: Sin esto el padre OAuth queda bloqueado para siempre: no tiene contraseña y el código no llegaba.

**Acceptance Scenarios**:

1. **Given** padre OAuth (googleSub != null) con sesión de más de 30 min, **When** pide el texto, **Then** el 403 `STEP_UP_REQUERIDO` incluye `metodos: ["codigo_email"]`.
2. **Given** padre con contraseña, **When** pide el texto, **Then** el 403 incluye `metodos: ["password"]`.
3. **Given** padre OAuth, **When** solicita el código, **Then** se programa el correo `padre.stepup.codigo` con el código firmado (vigencia 10 min) y sin regla activa la solicitud falla (502, fail-closed).
4. **Given** el código recibido, **When** lo verifica, **Then** recibe la cookie `stepup_sello` y el texto se entrega; un código errado o de otro usuario responde 401.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El detalle del reporte DEBE mostrar un solo bloque con el texto vigente; el original solo se revela por acción explícita y, si es idéntico al vigente, NO se repite (nota informativa).
- **FR-002**: El GET del detalle admin (`/api/admin/reportes-revision/[id]`) NO DEBE registrar lectura en `LecturaReporte` (es render). La opción `registrarLectura: false` de `descifrarCampoReporte` existe para esto.
- **FR-003**: Las acciones explícitas (revelar original, canje de código, corrección, validación de anonimización) DEBEN seguir auditando en `LecturaReporte`.
- **FR-004**: El 403 `STEP_UP_REQUERIDO` DEBE indicar los métodos disponibles (`password` / `codigo_email`) según `Usuario.googleSub`.
- **FR-005**: DEBE existir `POST /api/padre/step-up/codigo` (solicita código; 409 si la cuenta tiene contraseña; fail-closed si no hay regla activa) y `POST /api/padre/step-up/verificar` (emite el sello step-up; 401 si el código es inválido, vencido o de otro usuario).
- **FR-006**: El código temporal DEBE ser un token firmado (HMAC-SHA256) con propósito `stepup_email`, no transferible entre usuarios y con vigencia de 10 minutos. Sin tabla de estado nueva (sin migración).

## Success Criteria *(mandatory)*

- **SC-001**: Abrir el detalle 5 veces seguidas deja 0 filas nuevas en `LecturaReporte` y 0 notificaciones.
- **SC-002**: Revelar el original de un reporte sin anonimizar muestra la nota de idéntico, no un segundo bloque.
- **SC-003**: Un padre OAuth completa revelar-texto con sesión vieja usando solo su correo, en menos de 3 interacciones.

## Assumptions

- La detección de «cuenta sin contraseña» es `Usuario.googleSub != null` (SPEC-590); las cuentas OAuth tienen `passwordHash` aleatorio (SPEC-587).
- El aviso de lectura al padre por acceso EXTERNO sigue siendo el correo de CANJE del código (`padre.reporte.acceso_canjeado`), que es la acción real de revelado — ver SPEC-594.

---

## Implementación *(al cerrar)*

- `src/components/modules/reporte-detalle/TextoOriginalPanel.tsx`: prop `textoActual`; si el revelado es idéntico, nota en vez de duplicar.
- `src/components/modules/AdminReporteDetalle.tsx`: pasa `reporte.texto`.
- `src/lib/dal/services/descifrar-contenido.ts`: `OpcionesDescifrado.registrarLectura` (default true).
- `src/app/api/admin/reportes-revision/[id]/route.ts`: GET con `{ registrarLectura: false }`.
- `src/lib/routing/stepup-sello.ts`: `firmarCodigoStepUpEmail` / `leerCodigoStepUpEmail` (10 min, propósito `stepup_email`).
- `src/app/api/padre/step-up/codigo/route.ts` y `src/app/api/padre/step-up/verificar/route.ts`: rutas nuevas.
- `src/app/api/padre/reportes/[id]/texto/route.ts`: `metodos` en el 403.
- `src/components/modules/padre/TextoSensible.tsx`: flujo «Enviar código a mi correo» / «Verificar código».
- Tests: `src/app/api/padre/step-up/codigo/route.test.ts` (6 casos), `src/app/api/reportes/acceso/acceso.test.ts` (render sin auditoría, corrección sin notificación).

### Deuda técnica

- El código step-up es stateless (no single-use): dentro de sus 10 minutos puede verificarse más de una vez. Aceptado: el usuario ya tiene sesión válida; el correo es el factor.
- Diagnóstico del correo que no llega en producción: ver spec 594 y el reporte del PR (modelo `Notificacion` → tabla `notificaciones`; logs del worker `pi-notificaciones` en el VPS).
