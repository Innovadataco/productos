# SPEC-598 · «Crear contraseña» para cuentas Google (sin contraseña local)

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-08 · **Origen**: spec aprobada por el dueño (Jelkin), 08-09-2026. Rama `work/pi-SPEC-598-crear-password-oauth`.

## Impacto en arquitectura: sí (acotado)

Migración 100 % aditiva (`Usuario.passwordCreadaEn DateTime?`). Sin endpoints de lectura nuevos ni cambios de roles/proxy; se agregan dos rutas API de sesión (`/api/auth/crear-password` + `/codigo`). La línea base se regeneró (`docs/architecture/01-modelo-datos.md`) y `npm run arch:check` queda VERDE.

## El problema

Las cuentas que entran por «Continúa con Google» (SPEC-587) nacen con `passwordHash` = bcrypt de una contraseña aleatoria (el hash aleatorio ES la ausencia de clave local) + `googleSub`. El endpoint `/api/auth/cambiar-password` exige `passwordActual`, así que estos usuarios están bloqueados de facto: la UI les ofrece «Cambiar contraseña» y no pueden completarla. Decisión CEO (patrón estándar de la industria: Google/Microsoft/GitHub/Firebase): ofrecer **«Crear contraseña»** a las cuentas Google sin clave propia, quedando la cuenta con AMBOS métodos de acceso.

## Alcance

- **Detección «sin contraseña propia» — criterio elegido**: campo nuevo `Usuario.passwordCreadaEn DateTime?` (aditivo, nullable). Las cuentas OAuth tienen hash SIEMPRE (aleatorio), así que «passwordHash existe» no distingue nada. La condición de «sin contraseña propia» es `googleSub != null AND passwordCreadaEn IS NULL`. Se escribe el timestamp en los cinco sitios donde se crea/reemplaza una clave real: `registrar`, `completarRegistro`, `cambiarPassword`, `restablecerPassword` (esto último cubre al usuario OAuth que ya creó clave por «¿Olvidaste tu contraseña?» — desde entonces ve «Cambiar contraseña» normal) y el nuevo `crearPassword`. Rechazado: inferir por audit (frágil, depende de trazas) y flag booleano (el timestamp da lo mismo y es más útil).
- **Menú (NavHeader)**: con `googleSub && !passwordCreadaEn` la entrada dice «Crear contraseña»; si no, «Cambiar contraseña». Mismo destino (`/cambiar-password`); la página decide el flujo según la sesión. `/api/me` expone `googleSub` y `passwordCreadaEn` para ello.
- **Flujo «Crear contraseña»**: NO pide contraseña actual. Pide nueva contraseña dos veces + código de un solo uso enviado a su email. El email ya está verificado (vino de Google); el código confirma posesión. Al crearla: email de aviso de seguridad (`enviarEmailCambioPassword`, patrón SPEC-322/SPEC-415), audit `USUARIO_CAMBIO_PASSWORD` (acción canónica, misma que usa el restablecer) y la cuenta queda con ambos métodos.
- **Verificación por código — decisión de reuso**: MISMO formato del step-up por email (SPEC-592, `stepup-sello.ts`: token HMAC-SHA256 firmado con JWT_SECRET, 10 min, sin tabla de estado) pero con **propósito propio** (`crear_password` vs `stepup_email`): el claim `proposito` impide que un código pedido para ver un texto sirva para crear una contraseña y viceversa. Misma vigencia y misma autoridad (titular del correo), alcance separado. Rechazado: reusar el propósito `stepup_email` (un código de lectura quedaría habilitado para mutar credenciales).
- **APIs nuevas**: `POST /api/auth/crear-password/codigo` (firma el código y lo envía vía motor de notificaciones, fail-closed si no hay regla activa; rate-limit `crear_password_codigo` con defaults fail-open) y `POST /api/auth/crear-password` (valida titularidad de la cuenta OAuth-sin-clave → 409 si no aplica, confirmación de contraseña, longitud mínima desde `security.password_min_length`, código → 401 si es inválido/vencido, persiste vía `AutenticacionService.crearPassword`).
- **Seed**: plantilla + regla del evento `auth.crear_password.codigo` (mismo patrón que `padre.stepup.codigo`, SPEC-592).
- **Caso 1 (email+contraseña normal)**: sin cambios de comportamiento.

## Functional Requirements

- **FR-001**: El sistema DEBE mostrar «Crear contraseña» (en vez de «Cambiar contraseña») solo cuando la sesión tiene `googleSub != null` y `passwordCreadaEn == null`; en cualquier otro caso DEBE mostrar «Cambiar contraseña».
- **FR-002**: El flujo «Crear contraseña» NO DEBE pedir contraseña actual y DEBE exigir código de un solo uso válido (firma, propósito `crear_password`, titular, vigencia de 10 min) enviado al correo de la cuenta; un código de propósito distinto DEBE rechazarse.
- **FR-003**: El sistema DEBE rechazar con 409 el flujo «Crear contraseña» en cuentas que ya tienen contraseña propia (con o sin Google) y con 400 cuando la confirmación no coincide o la longitud mínima no se cumple.
- **FR-004**: Al crear la contraseña, el sistema DEBE persistir `passwordCreadaEn`, enviar el aviso de seguridad (sin bloquear el flujo si el correo falla, con log de rastro), auditar `USUARIO_CAMBIO_PASSWORD` y permitir el inicio de sesión con email+contraseña desde ese momento, conservando el acceso por Google.
- **FR-005**: La verificación y escritura del hash DEBEN vivir en el DAL (`AutenticacionService.crearPassword`), nunca en la ruta.

## Criterios de aceptación

- [x] Migración aditiva aplicada en BD de test; `prisma generate` regenera el cliente con `Usuario.passwordCreadaEn`.
- [x] Tests nuevos en verde: happy path (hash + `passwordCreadaEn` + audit + login con la nueva), código inválido/vencido/de otro propósito (401), confirmación distinta (400), cuenta no-OAuth (409), OAuth con clave ya creada (409), solicitud de código (200 OAuth-sin-clave / 409 no-OAuth), menú según `googleSub`/`passwordCreadaEn`, separación de propósitos del sello.
- [x] `restablecerPassword` escribe `passwordCreadaEn` (caso «OAuth que creó clave por olvide» cubierto por el criterio).
- [x] `tsc --noEmit` verde; ESLint verde en archivos tocados; `npm run arch:check` verde (01-modelo-datos regenerado).

## Implementación

- Migración: `prisma/migrations/20260908090000_spec598_password_creada_en/migration.sql` (aditiva, `ADD COLUMN "passwordCreadaEn" TIMESTAMPTZ(6)`; aplicada con `prisma migrate deploy`).
- Schema: `prisma/schema.prisma` — `Usuario.passwordCreadaEn` con comentario del criterio.
- Sello: `src/lib/routing/stepup-sello.ts` — helper genérico `firmarCodigoEmail`/`leerCodigoEmail` con claim `proposito`; wrappers `firmarCodigoCrearPassword`/`leerCodigoCrearPassword` (los del step-up quedan delegando, sin cambios de firma).
- DAL: `src/lib/dal/services/autenticacion.ts` — `crearPassword` (titularidad OAuth-sin-clave en el DAL, simetría con `cambiarPassword`) + `passwordCreadaEn` en registrar/completarRegistro/cambiarPassword/restablecerPassword.
- Rutas: `src/app/api/auth/crear-password/codigo/route.ts` (código + envío, fail-closed, rate-limit `crear_password_codigo`) y `src/app/api/auth/crear-password/route.ts` (validación completa + aviso de seguridad + audit). `/api/me` expone `googleSub`/`passwordCreadaEn`.
- UI: `src/components/modules/NavHeader.tsx` (etiqueta condicional), `src/app/cambiar-password/page.tsx` (modo crear: código + nueva + confirmar, sin contraseña actual, refresca sesión al terminar), `src/lib/contexts/AuthContext.tsx` (tipo User).
- Seed: `prisma/seed.ts` — plantilla y regla `auth.crear_password.codigo`.
- Candados: `src/lib/errores-no-mudos.test.ts` suma la ruta nueva al grupo B (aviso de seguridad con rastro); `vitest.unit.includes.ts` suma el test del sello.
- Línea base: `docs/architecture/01-modelo-datos.md` regenerado.

## Deuda / notas

- El rate-limit `crear_password_codigo` usa los defaults del limitador (60 s / 30 req, fail-open) igual que `acceso_codigo` del step-up; si se quiere ajustar, son dos claves `ratelimit.crear_password_codigo.*` en `ParametroSistema` sin cambio de código.
- `AdminNav.tsx` (menú del admin) conserva «Cambiar contraseña»: las cuentas OAuth son siempre PARENT (el resolvedor OAuth fija rol PARENT), un ADMIN no puede ser cuenta Google hoy.
- Los códigos no tienen uso único forzado en servidor (mismo diseño stateless del step-up, SPEC-592): dentro de los 10 minutos un código puede presentarse dos veces; al crear la contraseña la cuenta deja de aceptar el flujo (409), lo que acota la ventana a un intento útil.
