# Plan · SPEC-388a · L1a — solo modelo

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: Guardianes (PI-1)

## Decisiones

**Se saca el modelo primero, sin nada más.** El CEO pidió partir L1 en L1a (modelo) + L1b (registro) porque Dev Infra ya arrancó L2 y espera este modelo. Un PR grande que trae todo bloquearía a otros; un PR chico que trae solo la migración destraba en media hora.

**Reusar `Usuario.fechaNacimiento` y `Usuario.documentoTipo/documentoNumero`, no duplicar en `PerfilProfesional`.** El CEO aprobó explícitamente (04:32). «Interno, nunca público» se cumple en la capa de DTO — la protección no vive en el modelo. Duplicar garantiza divergencia (dos fuentes de verdad para el mismo dato).

**`BORRADOR` como estado inicial**, no `EN_REVISION`. Adenda del CEO tras leer la recomendación #4: entre «creó la cuenta» y «se postuló» hay un tramo — el perfil a medio llenar. Sin este estado, la cola de IDC se llena de fichas vacías.

**Reprogramación como FILA NUEVA que hereda pago.** Adenda del CEO tras aviso de Calidad. Guardar la reprogramación como transición perdería el rastro del primer intento — y necesitamos ese historial para resolver los casos de «no llegó ninguno». Modelado con auto-relaciones `solicitudPrevia` (historial) y `pagoHeredadoDe` (no volver a cobrar), ambas opcionales — la mayoría de las solicitudes son la primera y pagan de cero.

**Migración manual, no `prisma migrate dev`.** El proyecto tiene el patrón de escribir el SQL a mano con `ADD VALUE IF NOT EXISTS` (idempotente) para poder repetir el deploy sin romper. Se validó localmente con `migrate reset --force --skip-seed` para asegurar que la migración aplica limpia desde cero.

**Placeholders `PROFESIONAL` en Records exhaustivos, no ampliar los archivos afectados.** Cinco archivos (dos páginas, tres tests) tienen `Record<RolUsuario, ...>` que TypeScript exige completo. Poner una entrada mínima (`"/"` o `""`) con un comentario claro es lo justo — el destino real del profesional (dashboard, tema, correo de test) lo define L1b/L5 cuando exista. Escribirlo ahora sería inventar diseño en el PR del modelo.

## Archivos

- `prisma/schema.prisma` — enum `RolUsuario += PROFESIONAL`; 4 enums nuevos + 5 modelos; back-relations en `Usuario`, `Ciudad`, `Expediente`.
- `prisma/migrations/20260903040000_spec_388a_red_profesionales_modelo/migration.sql` — migración aditiva.
- `docs/architecture/01-modelo-datos.md` — regenerado con `npx tsx scripts/arch/generar-modelo-datos.ts`.
- `src/app/consentimiento/page.tsx` · `src/app/dashboard/perfil/notificaciones/page.tsx` · `src/lib/e2e/helpers.ts` · `src/lib/e2e/journeys/aislamiento.test.ts` · `src/lib/e2e/journeys/sesion-roles.test.tsx` — placeholder `PROFESIONAL` para exhaustividad de `Record<RolUsuario, ...>`.
