# SPEC-598 · Plan — «Crear contraseña» para cuentas Google

Ver `spec.md` (FR-001–FR-005) y `tasks.md` (fases y tareas).

## Contexto y decisión

Las cuentas OAuth (SPEC-587) no tienen contraseña elegida por el dueño: su `passwordHash` es aleatorio. `/api/auth/cambiar-password` exige la actual → bloqueo de facto. Decisión CEO (estándar industria): «Crear contraseña» para cuentas Google sin clave propia; la cuenta queda con ambos métodos y desde entonces «Cambiar contraseña» funciona normal.

## Enfoque técnico

- **Detección**: `Usuario.passwordCreadaEn DateTime?` (migración aditiva). Condición «sin contraseña propia»: `googleSub != null AND passwordCreadaEn IS NULL`. Se escribe en los cinco sitios donde se crea/reemplaza una clave real (incluido `restablecerPassword`, que cubre al OAuth que ya creó clave por «olvide»).
- **Verificación**: código de un solo uso al correo, MISMO formato stateless del step-up (SPEC-592) con **propósito propio** (`crear_password`): el claim separa códigos de lectura de códigos de mutación de credenciales. Vigencia 10 min; fail-closed en el envío (sin regla activa, error; no expectativa rota).
- **DAL**: `AutenticacionService.crearPassword` verifica titularidad (googleSub + sin clave) y escribe hash + `passwordCreadaEn` + limpia `debeCambiarPassword` (simetría con `cambiarPassword`).
- **Rutas**: `POST /api/auth/crear-password/codigo` (firma + envío vía motor de notificaciones, rate-limit `crear_password_codigo`) y `POST /api/auth/crear-password` (valida 409/400/401 en ese orden, persiste, aviso de seguridad con rastro SPEC-415, audit `USUARIO_CAMBIO_PASSWORD`).
- **UI**: misma página `/cambiar-password` en dos modos (la sesión decide): «crear» omite la contraseña actual y agrega código + botón «Enviar código». El menú del header cambia solo la etiqueta; `AdminNav` queda igual (un ADMIN no puede ser cuenta OAuth hoy).
- **Seed**: plantilla + regla `auth.crear_password.codigo` (patrón SPEC-592).

## Riesgos y mitigaciones

- **Código de step-up reciclado para crear contraseña**: mitigado por el claim `proposito` (test candado cruzado).
- **OAuth que creó clave por «olvide»**: `restablecerPassword` escribe `passwordCreadaEn` → el menú vuelve a «Cambiar» automáticamente.
- **Enumeración de cuentas**: las dos rutas exigen sesión; el 409 no revela nada a anónimos.
- **Aviso de correo caído**: try/catch con `logger.error` (candado SPEC-415, la ruta nueva entra al grupo B).
