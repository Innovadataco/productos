# Plan — Spec 119: Vigencia del servicio por cliente

**Fecha**: 2026-07-29 | **Spec**: `specs/119-vigencia-servicio-cliente/spec.md`

## Decisión central

**Una sola función que decide, pocos puntos documentados que la aplican.** Se generaliza
`verificarVigenciaColegio` en `verificarVigenciaCliente(usuarioId)` dentro del mismo archivo
(`src/lib/colegio/vigencia.ts`); la función vieja queda como alias delegado, así los ~20
puntos que ya la llaman (layout colegio + APIs `/api/colegio/**` + `/api/me/colegio`) no se
tocan y su comportamiento es byte a byte el mismo.

## ¿Dónde se aplica y por qué no en el middleware?

`src/lib/proxy.ts` corre en el edge runtime de Next.js: verifica el JWT con `jose` y NO tiene
acceso a la BD (no puede importar Prisma). La vigencia es un dato de BD que cambia en caliente
(el admin la extiende y debe surtir efecto de inmediato), así que el corte va en los mismos
sitios donde ya vive el de colegio: **login + layouts (pantalla) + APIs (JSON 403)**.

## Qué ve EXACTAMENTE un cliente vencido al intentar entrar

- **Padre vencido, en el login** (`/login`): escribe credenciales válidas → el servidor
  responde `403 { error: { message, code: "FORBIDDEN" } }` → la tarjeta de login muestra un
  recuadro rojo con: *"Tu período de servicio ha vencido. Tus reportes e información siguen
  guardados. Contacta con el soporte de la plataforma para renovar tu acceso."* No se crea
  sesión ni cookie. (Antes de esta spec la página mostraba siempre "Credenciales
  incorrectas" porque `AuthContext.login` descartaba el cuerpo del error; se corrige para
  padre y colegio.)
- **Padre vencido, con sesión activa** (la ventana venció estando dentro): al navegar a
  `/mis-reportes` o cualquier `/dashboard/*` → pantalla completa **"Servicio no vigente"**
  con el mismo mensaje y un botón "Volver al inicio" que cierra sesión y vuelve a `/login`
  (mismo patrón visual que la pantalla del colegio vencido). Las llamadas API reciben 403
  JSON con el mismo mensaje.
- **Colegio vencido**: exactamente lo que ve hoy (login 403 con mensaje del colegio; pantalla
  del layout `dashboard/colegio` con su mensaje y botón de salida). Sin cambios.
- **Padre sin vigencia definida**: entra normal (no se corta a nadie por omisión del dato).

## Modelo de datos (migración aditiva)

`Usuario.inicioServicio DateTime?` y `Usuario.finServicio DateTime?` (tabla `"Usuario"`).
`null` = sin vigencia definida = acceso permitido. Justificación de no crear modelo propio:
la ventana es un atributo 1:1 del cliente; un modelo aparte añade join en el camino caliente
de login sin dar nada a cambio, y el `null` en columna expresa "sin definir" sin filas
huérfanas. Para `SCHOOL_ADMIN` la ventana sigue siendo la del `Colegio` (no se duplica).

## Cambios por archivo

1. `prisma/schema.prisma` + migración `20260729150000_add_vigencia_servicio_usuario`
   (2 columnas nullable, aditiva).
2. `src/lib/colegio/vigencia.ts`: `verificarVigenciaCliente` (única decisión),
   `verificarVigenciaColegio` → alias; `assertVigenciaCliente(usuarioId)` lanza
   `AppError(message, FORBIDDEN, 403)` para APIs. Mensajes de padre nuevos; de colegio intactos.
3. `src/app/api/auth/login/route.ts`: el chequeo deja de ser solo-`SCHOOL_ADMIN` y llama a
   `verificarVigenciaCliente` para `PARENT` y `SCHOOL_ADMIN` (guarda `inactivo` de SPEC-117
   intacta, antes del chequeo).
4. `src/lib/contexts/AuthContext.tsx` + `src/app/login/page.tsx`: `login()` devuelve el
   `error.message` del servidor y la página lo muestra (fallback al texto genérico).
5. `src/components/modules/ServicioVencidoScreen.tsx` (nuevo, server): pantalla "Servicio no
   vigente" reutilizando `ColegioLogoutButton`.
6. `src/app/mis-reportes/layout.tsx` (nuevo) y `src/app/dashboard/layout.tsx`: guarda de
   vigencia para `PARENT` (el resto de roles pasa; admin/colegio tienen sus propios layouts).
7. APIs de padre: `POST /api/reportes` (rama autenticada), `GET /api/reportes/mis-reportes`,
   `GET /api/reportes/mis-reportes/[id]` → una línea `await assertVigenciaCliente(user.id)`.
8. Gestión admin padres: `PATCH /api/admin/padres/[id]/vigencia/route.ts` (nuevo;
   `verifyAuth("ADMIN")` + `assertModulo(admin, "padres")` + rate limit + Zod + fin>inicio +
   AuditLog `USER_UPDATE`); `GET /api/admin/padres` añade las dos fechas al select;
   `PadresPageClient.tsx` muestra la vigencia y la edita (modal con dos fechas + quitar).
9. Colegio: nada — `PATCH /api/admin/colegios/[id]` y su UI ya gestionan
   `inicioServicio`/`finServicio` (verificado en `ColegiosPageClient.tsx:234-262`).

## Qué NO se toca (reglas innegociables)

- Consulta pública (`/api/consulta`, home): abierta a todos, con o sin sesión.
- Worker / `/api/reportes/procesar`: un reporte enviado sigue su curso aunque la cuenta venza.
- Datos: vencer no borra ni altera reportes, usuarios ni agregados.
- Mensajes/estados del flujo colegio existente.

## Tests (primero el test que falla, después el arreglo)

- `src/lib/colegio/vigencia-cliente.test.ts` (nuevo): padre sin vigencia → vigente; padre
  `no_iniciado`/`vencido` → estados y mensaje; colegio vencido por la MISMA función;
  `finServicio` hoy → vigente; roles internos → vigente.
- `src/app/api/auth/login/route.test.ts` (nuevo): padre sin vigencia → 200; padre vencido →
  403 + mensaje claro; colegio vencido → 403 (mismo mecanismo); extender ventana (PATCH
  admin) → login 200; reportes del vencido intactos en BD.
- `src/app/api/reportes/mis-reportes/route.test.ts` y `src/app/api/reportes/route.test.ts`
  (extender): padre vencido → 403 con mensaje.
- `src/app/api/admin/padres/[id]/vigencia/route.test.ts` (nuevo): 401/403/404, PATCH fija y
  limpia ventana, fin<=inicio → 400, AuditLog registrado.
- Consulta pública anónima 200: caso dentro del test de login/reportes (GET `/api/consulta`
  sin sesión sobre identificador del vencido).

## Gate

Candado `/tmp/pi-gate-lock` (mkdir con reintento + `trap` para `rmdir`) antes de cualquier
vitest/build: `npx tsc --noEmit` + `npm run lint` + tests tocados + `npm run build`; suite
completa una vez al final bajo el mismo candado. Sin push, sin deploy, sin `dev-restart`.
