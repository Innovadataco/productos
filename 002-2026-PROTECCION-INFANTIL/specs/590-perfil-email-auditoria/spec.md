# SPEC-590 · Perfil del padre: email editable + historial de cambios (decisión CEO)

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-08 · **Origen**: orden CEO (Jelkin), 06-09-2026. Rama `work/pi-SPEC-589-591-ajustes-padre`.

## Impacto en arquitectura: no

Sin rutas nuevas de navegación: se amplía un contrato existente (PATCH `/api/padre/perfil`) y se agrega un endpoint de consulta bajo el prefijo `/api/padre/**` ya cubierto por el proxy. Migración 100 % aditiva.

## El problema

El email del padre era inmutable después del registro. El CEO, en su recorrido de la app (06-09-2026), ordenó: (1) que el padre pueda cambiar su correo desde «Mi perfil», y (2) que exista un historial de cambios del perfil que el propio padre pueda consultar. Además, con «Continúa con Google» (SPEC-587) en producción, un cambio de email rompía la vinculación: la resolución de cuenta era solo por email, así que el próximo login OAuth crearía una cuenta DUPLICADA.

## Alcance

- **Modelo `Usuario`**: se agrega `googleSub String? @unique` — el `sub` del proveedor de Google, único e inmutable, ancla de identidad que sobrevive a cambios de email.
- **`AccionAudit`**: se agrega el valor `PERFIL_CAMBIO` (al final del enum, aditivo).
- **PATCH `/api/padre/perfil`**: acepta `email` (opcional, validado, normalizado a minúsculas + trim — mismo criterio que login SPEC-579 y OAuth SPEC-587). Unicidad case-insensitive: si el correo lo tiene OTRO usuario → 409 «Ese correo ya está en uso.»; si es el propio → 200 sin efectos colaterales.
- **Auditoría**: antes de escribir se compara contra el valor anterior (`detectarCambiosPerfil`); por cada campo que realmente cambia se escribe una fila `AuditLog` con `accion: PERFIL_CAMBIO` y `valorAnterior/valorNuevo` en JSON `{campo, valor}`. Un PATCH sin cambios no escribe nada.
- **Aviso de seguridad**: si cambió el email, se programa el evento `padre.perfil.email_cambiado` al correo NUEVO (el viejo pudo dejar de ser suyo). Si el envío falla NO se revierte el cambio: queda en log.
- **OAuth**: la resolución busca PRIMERO por `googleSub` y DESPUÉS por email. Al encontrar por email una cuenta con `googleSub === null` se le rellena el sub (backfill, nunca se pisa un sub distinto). Al crear cuenta nueva se persiste el sub desde el nacimiento.
- **Historial de cambios**: GET `/api/padre/perfil/auditoria` — devuelve SOLO los `PERFIL_CAMBIO` del propio usuario de la sesión (jamás acepta `usuarioId` por query), paginado (`page`/`pageSize`, estándar del repo), del más reciente al más viejo, con etiqueta legible por campo (fuente única `ETIQUETAS_CAMPO_PERFIL` compartida con el PATCH).
- **UI**: «Mi perfil» gana el campo «Correo electrónico» editable (fuera del camino guiado) y una sección «Historial de cambios» con etiqueta + anterior→nuevo + fecha en hora de Bogotá; el valor vacío se muestra como «vacío».

## Decisión de datos

- Migración aditiva `spec590_perfil_email_auditoria`: `ALTER TABLE "Usuario" ADD COLUMN "googleSub" TEXT` + `CREATE UNIQUE INDEX "Usuario_googleSub_key"` + `ALTER TYPE "AccionAudit" ADD VALUE 'PERFIL_CAMBIO'`. Nada destructivo.

## Functional Requirements

- **FR-001**: El sistema DEBE permitir al padre editar su email desde «Mi perfil», normalizándolo a minúsculas + trim y rechazando con 400 formatos inválidos.
- **FR-002**: El sistema DEBE rechazar con 409 un email que ya pertenece a OTRO usuario, y DEBE aceptar sin efectos colaterales (sin auditoría, sin aviso) el reenvío del propio email.
- **FR-003**: El sistema DEBE escribir una fila `AuditLog` (`PERFIL_CAMBIO`, anterior→nuevo por campo) por cada campo del perfil que realmente cambie, y NO DEBE escribir nada cuando el PATCH no cambia nada.
- **FR-004**: El sistema DEBE enviar un aviso al correo NUEVO cuando este cambia (evento `padre.perfil.email_cambiado`), sin bloquear ni revertir el cambio si el envío falla.
- **FR-005**: El sistema DEBE resolver la cuenta OAuth primero por `googleSub` (inmutable) y después por email, con backfill del sub en cuentas previas sin él y sin pisar un sub distinto.
- **FR-006**: El sistema DEBE exponer GET `/api/padre/perfil/auditoria` con scope estrictamente propio (sin `usuarioId` por query), paginado y ordenado del más reciente al más viejo.
- **FR-007**: El historial DEBE mostrar etiquetas legibles de campo (fuente única compartida entre PATCH y GET) y el valor vacío como «vacío».

## Criterios de aceptación

- [x] Migración aditiva aplica en BD de test; `prisma generate` regenera el cliente con `googleSub` y `PERFIL_CAMBIO`.
- [x] `tsc --noEmit` verde; ESLint verde en archivos tocados.
- [x] Tests nuevos en verde: PATCH perfil (email editable/normalizado/409/auditoría/sin-cambios/GET devuelve email), OAuth (resolución por sub, backfill, no-pisa-sub, creación persiste sub), auditoría (401, scope propio, paginación, orden DESC, etiqueta).
- [x] Test de callback OAuth de Google (SPEC-587) sigue en verde con la resolución nueva.
- [x] `email.migracion.test.ts` en verde con el evento `padre.perfil.email_cambiado` migrado.
- [x] `npm run arch:check` verde (artefacto 01-modelo-datos regenerado).

## Implementación

- Migración: `prisma/migrations/20260908003050_spec590_perfil_email_auditoria/migration.sql` (aplicada vía `prisma migrate deploy` contra la BD de test `proteccion_infantil_test` — el entorno no es interactivo para `migrate dev`).
- Schema: `prisma/schema.prisma` — `Usuario.googleSub String? @unique` + valor `PERFIL_CAMBIO` al final de `AccionAudit`, ambos con comentario SPEC-590.
- Detección de cambios y etiquetas (fuente única): `src/lib/padre/perfil-cambios.ts` (nuevo).
- API: `src/app/api/padre/perfil/route.ts` (PATCH con email + unicidad + auditoría + aviso) y `src/app/api/padre/perfil/auditoria/route.ts` (nuevo, GET con scope propio).
- DAL: `src/lib/dal/repositories/usuario.ts` (`obtenerPerfilPadre` y `actualizarPerfilPadre` incluyen `email`); `src/lib/dal/repositories/audit-log.ts` (`cambiosPerfilPaginados`, scope propio + shape `[items, total]`); `src/lib/dal/services/autenticacion-oauth.ts` (resolución por sub + backfill + persistir sub al crear).
- Email: `src/lib/email-padre.ts` (`enviarAvisoCambioEmail`, evento `padre.perfil.email_cambiado`) re-exportado en `src/lib/email.ts`; plantilla y regla sembradas en `prisma/seed.ts`.
- UI: `src/components/modules/padre/PerfilPadreForm.tsx` (campo email fuera del camino) + `src/components/modules/padre/HistorialCambiosPerfil.tsx` (nuevo) en `src/app/dashboard/padre/perfil/page.tsx`.
- Tests: `src/app/api/padre/perfil/route.test.ts`, `src/app/api/padre/perfil/auditoria/route.test.ts` (nuevo), `src/lib/dal/services/autenticacion-oauth.test.ts` (nuevo), `src/lib/email.migracion.test.ts`.
- Línea base: `docs/architecture/01-modelo-datos.md` regenerado.

## Deuda / notas

- El aviso `padre.perfil.email_cambiado` va SOLO al correo nuevo por decisión de producto (el viejo pudo dejar de ser del titular). Si el CEO pide aviso al viejo también, es una regla/variable más en el seed.
- El backfill de `googleSub` por email solo ocurre en el login OAuth; las cuentas existentes que nunca vuelvan a entrar por Google quedan sin sub (inofensivo: la resolución por email sigue funcionando).
- `paisId`/`ciudadId` se auditan por id (UUID), no por nombre legible — el historial muestra el identificador. Si se quiere nombre, tocaría enriquecer en el GET con el catálogo geográfico (decisión de producto futura).
