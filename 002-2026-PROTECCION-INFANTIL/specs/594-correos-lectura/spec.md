# Feature Specification: Correos de lectura — reglas del dueño

**Feature Branch**: `[594-correos-lectura]`

**Created**: 2026-09-08

**Status**: IMPLEMENTADO

## Impacto en arquitectura: no (cambio interno de componentes y servicios existentes; sin cambios en schema Prisma, proxy ni navegación)

**Input**: Bugs mostrados en vivo por el dueño (2026-09-07/08): correos de «lectura» al padre por lecturas internas, doble correo al clasificar, y aviso disparado al abrir pantallas en vez de al revelar.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rol interno lee: cero correos al padre (Priority: P1)

Cuando un operador/admin/comité lee el texto de un reporte (render del detalle, corrección, clasificación, validación), el padre NO recibe ningún correo. La lectura queda solo en la auditoría interna (`LecturaReporte`).

**Why this priority**: La lectura interna es la operación normal de clasificación; avisarla al padre genera alarma innecesaria y fue el bug más visible (el padre recibió «un miembro de nuestro equipo (ADMIN) leyó el texto…» por abrir el detalle).

**Acceptance Scenarios**:

1. **Given** un reporte con padre dueño, **When** un admin abre el detalle, **Then** el padre recibe 0 correos.
2. **Given** un reporte con padre dueño, **When** un operador corrige la clasificación (operación que descifra texto y original), **Then** el padre recibe 0 correos (antes: 2 idénticos).
3. **Given** cualquier lectura interna, **When** se completa, **Then** `LecturaReporte` sigue registrando quién, qué campo y cuándo.

### User Story 2 - Un solo disparo (Priority: P1)

Ningún evento le dispara al padre dos correos idénticos por una misma acción.

**Why this priority**: El doble disparo («se clasificó tu reporte» x2) destruye la confianza en los avisos.

**Acceptance Scenarios**:

1. **Given** una corrección de clasificación, **When** se guarda, **Then** se crea 0 notificación `padre.reporte.texto_leido` (evento eliminado del seed y del código).
2. **Given** el evento `padre.reporte.acceso_canjeado`, **When** un profesional canjea el código, **Then** el padre recibe exactamente 1 aviso con quién canjeó y cuándo.

### User Story 3 - Aviso de lectura externa solo en la acción real (Priority: P1)

El aviso al padre por acceso externo se dispara en el CANJE del código (la acción que abre la sesión de lectura), nunca al abrir pantallas ni por cada lectura de la sesión.

**Acceptance Scenarios**:

1. **Given** un código vigente, **When** el profesional lo canjea, **Then** el padre recibe 1 correo `padre.reporte.acceso_canjeado` (quién, rol, identificador, fecha).
2. **Given** una sesión de visualización abierta, **When** el profesional lee el texto N veces, **Then** no se envía correo adicional por cada lectura.
3. **Given** un reporte anónimo, **When** cualquiera intenta el flujo de código, **Then** se rechaza (sin flujo externo, decisión 6 de SPEC-584).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `registrarLecturaTexto` NO DEBE programar notificaciones: rol interno lee → cero correos; queda solo `LecturaReporte`.
- **FR-002**: El evento `padre.reporte.texto_leido` DEBE eliminarse del seed (plantillas y reglas) y del código: nadie lo programa.
- **FR-003**: El aviso de acceso externo DEBE seguir siendo `padre.reporte.acceso_canjeado`, disparado una sola vez en el canje.
- **FR-004**: Los correos al padre NO DEBEN incluir texto del reporte ni datos sensibles (solo metadatos: identificador, rol, fecha).

## Success Criteria *(mandatory)*

- **SC-001**: Flujo completo de clasificación de un reporte (abrir detalle + corregir) genera 0 correos al padre y el historial interno refleja las acciones reales.
- **SC-002**: Canje de código genera exactamente 1 correo al padre.

## Assumptions

- La regla «cero correos por lectura interna» es deliberada aunque la Ley 1581 permita informar: la información queda disponible por habeas data y el panel del padre no muestra este historial (endpoint restringido a internos).

---

## Implementación *(al cerrar)*

- `src/lib/dal/services/auditoria-lectura.ts`: eliminado el bloque de notificación; queda solo la escritura fail-loud en `LecturaReporte`.
- `prisma/seed.ts` (`seedAccesoCifradoTextos`): eliminadas plantillas/reglas de `padre.reporte.texto_leido`; agregado `padre.stepup.codigo.email` (SPEC-592).
- Tests: `src/app/api/reportes/acceso/acceso.test.ts` — «SPEC-592: el GET del detalle admin es un RENDER» y «SPEC-594: la corrección tampoco notifica».

### Diagnóstico: por qué el correo del código no llegaba (SPEC-592c)

1. **El `relation does not exist` de psql**: el modelo Prisma `Notificacion` tiene `@@map("notificaciones")` (`prisma/schema.prisma`): la tabla real es `notificaciones`, no `Notificacion`. La consulta del dueño apuntaba a un nombre que no existe; los correos sí se persisten (verificar con `SELECT evento, estado, destinatario_email, ultimo_error FROM notificaciones ORDER BY created_at DESC LIMIT 20;`).
2. **Cadena de envío**: `programar()` inserta en `notificaciones` (estado ENCOLADA) → worker `worker-notificaciones.mjs` (contenedor `pi-notificaciones` en el VPS) envía vía Resend. Si el correo no llega, los lugares a mirar son: `ultimo_error`/`estado` de la fila, `docker logs pi-notificaciones` (errores Resend: dominio no verificado, API key, bounces) y los bounces (`notificacion_contactos_bloqueados`). Con el fix de esta spec el evento `padre.stepup.codigo` es fail-closed: si no hay regla activa o el encolado falla, la UI lo sabe (502) en vez de quedar en silencio.
3. Estado al cierre del PR: diagnóstico de código completado; la verificación en producción (logs del contenedor) queda pendiente de acceso al VPS en la sesión de cierre.
