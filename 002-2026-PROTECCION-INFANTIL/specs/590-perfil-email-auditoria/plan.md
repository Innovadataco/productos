# SPEC-590 · Plan — Perfil del padre: email editable + historial de cambios

Ver `spec.md` (decisión CEO, FR-001–FR-007) y `tasks.md` (fases y tareas).

## Contexto y decisión

El CEO (Jelkin, 06-09-2026) ordenó dos cosas: (1) el padre puede cambiar su correo desde «Mi perfil» (hoy inmutable tras el registro) y (2) existe un historial de cambios del perfil consultable por el propio padre. Complicación real: con «Continúa con Google» (SPEC-587) en producción, la resolución de cuenta solo por email crearía una cuenta DUPLICADA al cambiar el correo — el email deja de ser ancla de identidad.

## Enfoque técnico

- **Ancla de identidad OAuth**: `Usuario.googleSub String? @unique` — el `sub` de Google, único e inmutable. Migración 100 % aditiva (`spec590_perfil_email_auditoria`): ADD COLUMN + unique index + `ALTER TYPE "AccionAudit" ADD VALUE 'PERFIL_CAMBIO'` (al final del enum).
- **Resolución OAuth en dos pasos**: primero por `googleSub`; si no, por email — y al encontrar por email una cuenta con `sub` nulo se le rellena (backfill; jamás se pisa un sub distinto). Al crear cuenta nueva se persiste el sub desde el nacimiento. Todo en `AutenticacionOauthService` (frontera Q-3).
- **PATCH `/api/padre/perfil`**: acepta `email` opcional, normalizado minúsculas + trim (mismo criterio que login SPEC-579 y OAuth). Unicidad case-insensitive: 409 si lo tiene OTRO usuario; 200 sin efectos si reenvía el propio.
- **Auditoría por diff** (`src/lib/padre/perfil-cambios.ts`, fuente única): antes de escribir se compara contra el valor anterior; por cada campo que realmente cambia, una fila `AuditLog` (`PERFIL_CAMBIO`, `valorAnterior/valorNuevo` como `{campo, valor}`). PATCH sin cambios no escribe nada.
- **Aviso de seguridad**: cambió el email → evento `padre.perfil.email_cambiado` al correo NUEVO (el viejo pudo dejar de ser suyo). Fallo de envío: log, sin revertir.
- **Historial**: GET `/api/padre/perfil/auditoria` con scope ESTRICTAMENTE propio (sin `usuarioId` por query), paginado estándar, DESC, etiquetas legibles por campo desde `ETIQUETAS_CAMPO_PERFIL` (compartida con el PATCH — una sola fuente).
- **UI**: PerfilPadreForm gana el campo email (fuera del camino guiado); HistorialCambiosPerfil (nuevo) lista etiqueta + anterior→nuevo + fecha en hora de Bogotá; vacío se muestra como «vacío».

## Riesgos y mitigaciones

- **Cuenta duplicada tras cambio de email**: mitigado por `googleSub` + backfill; las cuentas que nunca vuelvan a entrar por Google quedan sin sub, inofensivo (la resolución por email sigue).
- **Fuga por scope del historial**: el GET ignora cualquier parámetro de usuario y acota por el id de la sesión en el repositorio (`cambiosPerfilPaginados`).
- **Auditoría ruidosa**: solo se escribe cuando el valor realmente cambia (diff, no snapshot), evitando filas basura por reenvíos.
