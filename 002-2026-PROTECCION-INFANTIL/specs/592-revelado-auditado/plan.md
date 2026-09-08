# Plan: Revelado auditado del texto (SPEC-592)

## Contexto

Tres bugs en vivo del dueño en el detalle del reporte (bandeja admin) y en el texto propio del padre OAuth. No requiere migraciones: el código step-up es un token firmado stateless.

## Cambios por bug

### (a) Texto duplicado
- `TextoOriginalPanel.tsx`: prop `textoActual`; si el revelado === actual → nota «idéntico al vigente», no segundo bloque.
- `AdminReporteDetalle.tsx`: pasar `reporte.texto`.

### (b) Ruido en historial de accesos
- `descifrar-contenido.ts`: `OpcionesDescifrado.registrarLectura` (default true, fail-loud intacto cuando audita).
- `src/app/api/admin/reportes-revision/[id]/route.ts`: GET del detalle con `registrarLectura: false` (render ≠ acción).
- Acciones explícitas (revelar-original, canje, correcciones, validar-anonimizacion) sin cambios: siguen auditando.

### (c) Padre OAuth bloqueado
- `stepup-sello.ts`: `firmarCodigoStepUpEmail`/`leerCodigoStepUpEmail` (HMAC, propósito `stepup_email`, 10 min, no transferible).
- `POST /api/padre/step-up/codigo`: 409 si googleSub === null; fail-closed (502) sin regla activa.
- `POST /api/padre/step-up/verificar`: emite `stepup_sello`; 401 si inválido/vencido/ajeno.
- `GET /api/padre/reportes/[id]/texto`: `metodos` en el 403 según googleSub.
- `TextoSensible.tsx`: flujo «Enviar código a mi correo» → «Verificar código».
- `prisma/seed.ts`: plantilla + regla `padre.stepup.codigo.email` (obligatoria).

## Testing

- `src/app/api/padre/step-up/codigo/route.test.ts`: metodos en 403, envío, verificación, 401, 409, 502, no transferible.
- `src/app/api/reportes/acceso/acceso.test.ts`: render sin auditoría ni notificación.

## Decisiones

- Stateless (sin tabla nueva): la posesión del correo es el factor; replay de 10 min aceptado (sesión ya válida).
- `texto_leido` eliminado del seed (ver SPEC-594).
