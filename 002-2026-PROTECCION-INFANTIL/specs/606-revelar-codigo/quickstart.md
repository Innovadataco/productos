# Quickstart — SPEC-606 (validación manual)

Pre: `./scripts/dev-restart.sh` (app en :5005, BD migrada con `20260909170000_spec606_stepup_codigo_email`, seed corrido — siembra `padre.texto.codigo_minutos` y la regla `padre.stepup.codigo`).

## Flujo feliz (5 min)

1. Entra como padre (`/login`), abre un reporte propio (Mis expedientes → Ver expediente).
2. Con sesión vieja (o tras esperar `padre.texto.stepup_minutos`, default 30), pulsa **«👁 Revelar texto»**.
3. Sin pedir contraseña, aparece el panel **«Te enviamos un código»**: correo enmascarado (`x•••••@dominio`), 6 casillas, «El código vence en 10:00» contando y «Reenviar código (60 s)» deshabilitado.
4. Revisa el correo (buzón del padre o la tabla `notificaciones` si el envío está en cola): asunto «Tu código para ver el texto de tu reporte», 6 dígitos.
5. Escríbelos (o pégalos: las casillas se llenan solas) → **Confirmar** → el texto aparece con el anillo de cuenta regresiva (10:00) y el aviso «Cada revelado queda auditado».
6. A los `padre.texto.retapado_minutos` (default 10) el texto se tapa solo.

## Casos de borde

- **Código incorrecto**: «Código incorrecto. Te quedan N intentos.» Al 5º: «Superaste los intentos permitidos. Solicita un código nuevo.»
- **Reenviar**: habilitado recién a los 60 s; envía otro correo y el código ANTERIOR deja de valer.
- **Vencido**: espera 10 min (`padre.texto.codigo_minutos`) → «El código venció. Solicita uno nuevo.»
- **Cuenta Google** (sin contraseña): mismo flujo — es su único camino desde SPEC-606.
- **Auditoría**: `SELECT accion, "creadoEn" FROM "AuditLog" WHERE accion LIKE 'STEP_UP_%' ORDER BY "creadoEn" DESC;` — solicitud, verificación y fallos, SIN el código.

## Regresión que NO debe pasar

- No existe UI de contraseña en el step-up (ni endpoint `POST /api/padre/step-up`: 404).
- «Crear contraseña» (Mi perfil, cuentas Google) sigue funcionando con su código — SPEC-598 intacto.
