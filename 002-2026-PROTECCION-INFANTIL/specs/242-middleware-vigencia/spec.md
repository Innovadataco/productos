# Feature Specification: Middleware de vigencia + guardas por layout + banner ámbar EN_GRACIA

**Feature Branch**: `work/002-PI-145`  
**SPEC**: 242  
**Created**: 2026-08-25  
**Status**: IMPLEMENTADO  
**Input**: INSTRUCTIVO-002-PI-145 · BRIEF-ACTIVACION-Y-COBROS §5.4/§9.2/§11 Lote 1 fila #3 · D-52/D-69/D-72/D-74

Impacto en arquitectura: agrega valor `PENDIENTE_AUTORIZACION` al enum `EstadoSuscripcion` de forma aditiva, crea helper puro `src/lib/pagos/vigencia-middleware.ts` con cálculo de vigencia en timezone `America/Bogota` vía `date-fns-tz`, modifica layouts `src/app/dashboard/padre/layout.tsx` y `src/app/dashboard/colegio/layout.tsx` para aplicar guarda de suscripción (permitir `ACTIVA`, banner ámbar en `EN_GRACIA`, redirigir a `/dashboard/<rol>/suscripcion` en otros estados), crea `src/app/reportar/layout.tsx` para registrar `AuditLog` `reporte-sin-suscripcion` sin bloquear, y provee tests unitarios del helper + integración de layouts + 3 escenarios de frontera de medianoche Bogotá.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Guarda de vigencia en dashboard (Priority: P1)

El sistema debe bloquear el acceso a las funciones de pago del dashboard cuando la suscripción del usuario no está en estado `ACTIVA` o `EN_GRACIA`. El middleware se ejecuta en los layouts `/dashboard/padre/**` y `/dashboard/colegio/**`, carga la suscripción activa del usuario y decide si permite la ruta, redirige a `/dashboard/<rol>/suscripcion` o inyecta un banner de advertencia.

**Why this priority**: Da consumidor real al motor de vigencia (SPEC-213), cierra BUG-07 y protege el modelo de cobros sin fricción social.

**Independent Test**: Un usuario autenticado con suscripción `SUSPENDIDA` intenta acceder a cualquier ruta de su dashboard y siempre es redirigido a `/dashboard/<rol>/suscripcion`.

**Acceptance Scenarios**:

1. **Given** un usuario con `Suscripcion.estado = ACTIVA`, **When** navega a cualquier ruta de `/dashboard/padre/**` o `/dashboard/colegio/**`, **Then** el sistema permite el acceso sin banners de bloqueo.
2. **Given** un usuario con `Suscripcion.estado = EN_GRACIA`, **When** navega en su dashboard, **Then** puede operar y ve un banner ámbar con el mensaje "Tu plan vence pronto".
3. **Given** un usuario con `Suscripcion.estado = SUSPENDIDA`, `CANCELADA` o `PENDIENTE_AUTORIZACION`, **When** intenta acceder a una ruta protegida, **Then** es redirigido a `/dashboard/<rol>/suscripcion` con el mensaje correspondiente.
4. **Given** un usuario sin fila `Suscripcion`, **When** navega en su dashboard, **Then** es redirigido a `/dashboard/<rol>/suscripcion` con mensaje "Elige un plan".
5. **Given** un padre en estado `SUSPENDIDA`, **When** accede a `/reportar`, **Then** el sistema permite la ruta y registra `AuditLog` `reporte-sin-suscripcion`.
6. **Given** un usuario en cualquier estado, **When** accede a `/dashboard/<rol>/perfil` o `/dashboard/<rol>/suscripcion`, **Then** el sistema nunca bloquea esas rutas.
7. **Given** un usuario cuya suscripción vence cerca de medianoche en Bogotá, **When** se evalúa el estado, **Then** el cálculo respeta `America/Bogota` y no adelanta/atrasa el cambio de estado.

---

## Edge Cases

- **Doble redirect**: si el middleware de consentimiento (SPEC-241) y el de vigencia redirigen ambos, el encadenamiento debe ser `auth → consentimiento → vigencia`; `/consentimiento` nunca es bloqueado por vigencia.
- **Rol desconocido o anónimo**: rutas públicas (`/`, `/login`, `/registro`, `/reportar`, `/consulta`, etc.) no ejecutan el middleware de vigencia.
- **Operador / Admin / Comité**: roles internos no tienen suscripción propia; el middleware solo aplica a `/dashboard/padre/**` y `/dashboard/colegio/**`.
- **Suscripción con `fechaFin` en el futuro pero `estado` legacy incorrecto**: se usa el campo `estado` de `Suscripcion` (fuente única); si difiere, el motor de vigencia (SPEC-213) es responsable de corregirlo, no este middleware.
- **Request a API bajo `/api/pagos/**`**: la autorización y vigencia se validan en cada endpoint; el middleware de páginas no reemplaza esas guardas.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE introducir `src/middleware.ts` (Next.js App Router) o su equivalente server-side en layouts, aplicable a `/dashboard/padre/**` y `/dashboard/colegio/**`.
- **FR-002**: El middleware DEBE cargar la suscripción activa del usuario mediante `SuscripcionRepository.obtenerActivaPorUsuarioId` (SPEC-213).
- **FR-003**: El middleware DEBE permitir cualquier ruta cuando `Suscripcion.estado = ACTIVA`.
- **FR-004**: El middleware DEBE permitir cualquier ruta e inyectar un banner ámbar cuando `Suscripcion.estado = EN_GRACIA`.
- **FR-005**: El middleware DEBE redirigir a `/dashboard/<rol>/suscripcion` cuando el estado sea `SUSPENDIDA`, `CANCELADA`, `PENDIENTE_AUTORIZACION` o no exista suscripción.
- **FR-006**: El middleware DEBE respetar las excepciones sin bloqueo: `/dashboard/<rol>/perfil`, `/dashboard/<rol>/suscripcion` y `/reportar` (solo padre).
- **FR-007**: El middleware DEBE registrar en `AuditLog` cada acceso a `/reportar` sin suscripción activa con `accion: 'reporte-sin-suscripcion'`.
- **FR-008**: El middleware DEBE calcular el estado en timezone `America/Bogota` usando `date-fns-tz`; prohibido `new Date()` nativo para comparaciones de vigencia.
- **FR-009**: El middleware DEBE encadenarse después del check de consentimiento: `/consentimiento` no debe ser bloqueado por vigencia.
- **FR-010**: El sistema DEBE proveer tests de middleware para cada estado y excepción, incluyendo frontera de medianoche en Bogotá.

### Key Entities

- **Suscripcion**: fuente única de vigencia; campo `estado` (ya existente).
- **Usuario**: rol (`PARENT`, `SCHOOL_ADMIN`) determina el prefijo del dashboard.
- **AuditLog**: traza de accesos a `/reportar` sin suscripción.

---

## Success Criteria *(mandatory)*

- **SC-001**: El 100% de los usuarios con estado no activo son redirigidos a `/suscripcion` en < 100 ms.
- **SC-002**: El banner ámbar aparece únicamente en estado `EN_GRACIA` y en ningún otro.
- **SC-003**: `/reportar` es accesible para padres en todos los estados de suscripción.
- **SC-004**: `/perfil` y `/suscripcion` son accesibles para padres y colegios en todos los estados.
- **SC-005**: Cero dobles redirects infinitos entre consentimiento y vigencia.
- **SC-006**: Los tests de frontera de timezone pasan para al menos 3 escenarios (antes, durante y después de medianoche Bogotá).

---

## Assumptions

- El motor de vigencia (SPEC-213) mantiene actualizado `Suscripcion.estado`; este middleware solo lo consume.
- `SuscripcionRepository.obtenerActivaPorUsuarioId` ya existe; si no, se extiende aditivamente en el mismo repositorio.
- SPEC-241 implementa el middleware de consentimiento y whitelist de `/consentimiento`; este SPEC se encarga de no bloquear esa ruta.
- El banner ámbar se implementa como componente `Alerta` del design system; no se crea un componente nuevo salvo que sea estrictamente necesario.
- `EsperandoAutorizacion` es un placeholder mínimo en `/dashboard/<rol>/suscripcion` para el estado `PENDIENTE_AUTORIZACION`; su diseño completo llega en Lote 2.

---

## Implementación

- `prisma/schema.prisma`: extensión aditiva de `EstadoSuscripcion` (+`PENDIENTE_AUTORIZACION`) y `AccionAudit` (+`REPORTE_SIN_SUSCRIPCION`).
- `prisma/migrations/20260825054000_spec_242_vigencia_middleware/migration.sql`: `ALTER TYPE ... ADD VALUE IF NOT EXISTS` idempotente para ambos enums.
- `src/lib/dal/repositories/pagos-repository.ts`: métodos `obtenerSuscripcionPorUsuarioId` y `obtenerSuscripcionActivaPorUsuarioId`.
- `src/lib/pagos/vigencia-middleware.ts`: helper puro con `resolverEstadoVigencia`, `esRutaExenta`, `redireccionSuscripcion`, `debeMostrarBanner`, `mensajeParaEstado` y `ahoraBogota` (timezone `America/Bogota`).
- `src/lib/pagos/vigencia-middleware.test.ts`: 12 tests unitarios por estado, exenciones y 3 escenarios de frontera de medianoche Bogotá.
- `src/app/dashboard/padre/layout.tsx` y `src/app/dashboard/colegio/layout.tsx`: guarda de vigencia server-side, banner ámbar para `EN_GRACIA`, redirección a `/suscripcion` en estados bloqueados, respetando `/consentimiento`, `/perfil`, `/suscripcion` y `/reportar`.
- `src/app/reportar/layout.tsx`: Server Component que permite siempre el acceso y audita `REPORTE_SIN_SUSCRIPCION` cuando un padre autenticado no tiene suscripción activa.
- `src/app/dashboard/padre/suscripcion/page.tsx` y `src/app/dashboard/colegio/suscripcion/page.tsx`: placeholders exentos de la guarda.
- `src/components/modules/PadreLogoutButton.tsx`: botón de cierre de sesión reutilizable para el placeholder padre.
- Documentación Spec-Kit: `tasks.md`, `data-model.md`, `quickstart.md`, `contracts/vigencia.md`.
- Gate local: `npx tsc --noEmit` ✅, `npm run lint` ✅ (0 errores, 47 warnings preexistentes), tests focus ✅ (36 passed), `npm run build` ✅, `npm run arch:check` ✅.
