# SPEC-606 · Revelar texto con CÓDIGO por correo (step-up sin contraseña)

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-09 · **Origen**: decisión del dueño — el step-up del texto sensible deja de ser por CONTRASEÑA y pasa a ser un CÓDIGO DE 6 DÍGITOS enviado al correo del padre (estándar industria). Diseño aprobado: `design/expediente-final-mockup.html` bloque ③ (modal de 6 casillas, vence en 10:00, reenviar, texto revelado con anillo de contador, cada revelado auditado). Rama `work/pi-SPEC-606-revelar-codigo`.

## Qué se aprueba

Reemplazar el step-up por contraseña (SPEC-340) por step-up con código de 6 dígitos por correo, para TODA cuenta `PARENT`:

1. **Flujo nuevo**: `POST /api/padre/step-up/codigo` genera un código CSPRNG de 6 dígitos, guarda SOLO su sha-256 en BD (vigencia 10 min, un solo código vigente por usuario, cooldown de reenvío 60 s), lo envía por el motor de notificaciones (fail-closed sin regla activa) y audita SIN el código. `POST /api/padre/step-up/verificar {codigo}` lo canjea (máx 5 intentos; un solo uso) y emite el MISMO `stepup_sello` de siempre: `GET /api/padre/reportes/[id]/texto` fluye intacto.
2. **UI** (`TextoSensible`): tras el 403 STEP_UP_REQUERIDO la pieza pide el código sola y muestra el panel del mockup — «Te enviamos un código», correo enmascarado (`j•••••@gmail.com`), 6 casillas, vigencia 10:00 visible, «Reenviar código» con cooldown. Al verificar, el texto se revela con anillo de cuenta regresiva y se retapa solo a los `padre.texto.retapado_minutos` como siempre.
3. **Motivo de fondo**: las cuentas «Continúa con Google» (SPEC-587) NO tienen contraseña que revalidar; SPEC-592 les improvisó un token firmado stateless. El código por correo es el camino correcto y se vuelve el ÚNICO camino — un solo flujo que mantener, auditar y explicar.

## User Stories

### US1 — El padre revela su texto con el código de su correo (P1)

Como padre con sesión vieja, quiero recibir un código de 6 dígitos en mi correo para ver el texto de mi reporte, sin necesidad de contraseña (puede que ni tenga).

- Al pulsar «Revelar texto» con sesión vieja (o sin sello fresco), el sistema envía el código AUTOMÁTICAMENTE y muestra el panel: aviso con el correo enmascarado, 6 casillas, «El código vence en 10:00» en cuenta regresiva y «Reenviar código» con cooldown de 60 s.
- Al escribir el código correcto, el texto aparece con el anillo de cuenta regresiva; a los `padre.texto.retapado_minutos` (default 10) se vuelve a tapar solo.
- Escenario de aceptación: padre con JWT de 1 hora pide revelar → llega correo con 6 dígitos → los escribe → texto visible con anillo 10:00 → a los ~10 min se oculta solo.

### US2 — El código es resistente al abuso (P1)

Como plataforma, el código debe ser inatacable por fuerza bruta y reuso.

- Código incorrecto: 401 con intentos restantes («Te quedan 4 intentos»); al 5º fallo el código MUERE (429, hay que pedir otro).
- Código vencido: 403 «El código venció. Solicita uno nuevo.»
- Un solo uso: el canje correcto consume el código; reusarlo da 401.
- Un solo código vigente por usuario: pedir otro expira los anteriores.
- Cooldown de reenvío: el segundo pedido antes de 60 s responde 429 con `reintentaEnSegundos` (y la UI aprovecha: el código ya enviado sigue sirviendo).
- Rate limit por scope propio en ambos endpoints (`stepup_codigo`, `stepup_verificar`).

### US3 — Todo queda auditado sin exponer nada (P1)

Como auditor, quiero el rastro completo del step-up sin que jamás aparezca el código ni el texto.

- `STEP_UP_CODIGO_SOLICITADO` (metadatos: solo `codigoHash`), `STEP_UP_CODIGO_VERIFICADO` (solo `codigoHash`), `STEP_UP_CODIGO_FALLIDO` (`motivo`: incorrecto/expirado/bloqueado + conteo de intentos).
- En reposo vive SOLO el sha-256 del código; el correo es el único lugar donde el código existe en claro.

## Impacto en arquitectura: **SÍ** (schema + rutas; proxy y navegación intactos)

- **Migración aditiva** `20260909170000_spec606_stepup_codigo_email`: 3 valores nuevos de `AccionAudit` (`STEP_UP_CODIGO_SOLICITADO/VERIFICADO/FALLIDO`) + tabla `CodigoStepUp` (FK a `Usuario` con `ON DELETE CASCADE`, índice por `usuarioId`). Cero cambios destructivos.
- **Rutas**: `POST /api/padre/step-up/codigo` y `POST /api/padre/step-up/verificar` se REESCRIBEN (mismo path, nuevo motor). `POST /api/padre/step-up` (contraseña) se **ELIMINA** — su único consumidor era `TextoSensible` (verificado por grep en `src/`, `tests/`, `scripts/`); las rutas vivas quedan en la línea base regenerada (`npm run arch:check` en VERDE en este PR).
- **Servicio nuevo DAL**: `src/lib/dal/services/stepup-codigo.ts` (ciclo de vida del código). `src/lib/routing/stepup-sello.ts` pierde el token stateless de step-up (`firmarCodigoStepUpEmail`/`leerCodigoStepUpEmail`); el formato firmado queda EXCLUSIVO de «Crear contraseña» (SPEC-598, intacto).
- **Parámetros**: nuevo `padre.texto.codigo_minutos` (default 10, seed aditivo). `padre.texto.stepup_minutos` y `padre.texto.retapado_minutos` siguen gobernando (sello y retapado).
- **Rate limit**: scopes nuevos `stepup_codigo` (5/h) y `stepup_verificar` (15/10 min) en los defaults; override por `ParametroSistema` como todo scope.

## Functional Requirements

- **FR-001**: `POST /api/padre/step-up/codigo` DEBE servir a TODA cuenta `PARENT` autenticada (con o sin contraseña, con o sin Google). DEBE generar un código de 6 dígitos con CSPRNG (`randomInt`), persistir SOLO su sha-256 (`CodigoStepUp.codigoHash`), con vigencia `padre.texto.codigo_minutos` (default 10) y enviarlo por el motor de notificaciones (evento `padre.stepup.codigo`, fail-closed 502 sin regla activa; la fila huérfana se BORRA — ningún correo salió, el reintento no paga cooldown).
- **FR-002**: Un solo código vigente por usuario: cada solicitud DEBE expirar en la misma transacción los códigos anteriores no consumidos. Cooldown: un pedido con menos de 60 s desde el último código DEBE responder 429 con `reintentaEnSegundos` y `correoEnmascarado`.
- **FR-003**: `POST /api/padre/step-up/verificar` DEBE exigir formato de 6 dígitos (400), y operar sobre el código vigente más reciente del usuario: hash correcto → 204 + cookie `stepup_sello` (misma emisión de siempre, vida `padre.texto.stepup_minutos`) y código consumido (un solo uso, carrera cerrada con update condicional); incorrecto → 401 con intentos restantes; 5º fallo → 429 y el código queda consumido; vencido → 403; sin código vigente → 401.
- **FR-004**: Ambos endpoints DEBEN tener rate limit con scope propio (`stepup_codigo` 5/h; `stepup_verificar` 15/10 min; identifier = usuario) y auditar solicitud/verificación/fallo SIN el código ni el texto.
- **FR-005**: `GET /api/padre/reportes/[id]/texto` NO DEBE cambiar su autoridad (sesión joven o sello fresco entregan; si no, 403) pero su 403 DEBE ofrecer siempre `metodos: ["codigo_email"]`, sin ramificar por `googleSub`.
- **FR-006**: El step-up por contraseña (`POST /api/padre/step-up`) DEBE quedar eliminado (endpoint y su test); `firmarCodigoStepUpEmail`/`leerCodigoStepUpEmail` DEBEN salir de `stepup-sello.ts` (el token firmado queda solo para «Crear contraseña»).
- **FR-007**: La UI DEBE seguir el mockup (bloque ③): panel con «Te enviamos un código», correo enmascarado (inicial + `•••••` + dominio), 6 casillas con auto-avance/pegado, vigencia mm:ss visible, «Reenviar código» con su cooldown, éxito → texto con anillo de cuenta regresiva y retapado automático intacto. Tono NEUTRAL, sin voseo.
- **FR-008**: La spec DEBE declarar `## Impacto en arquitectura:` explícito (ratchet CI, SPEC-126) — ver la sección arriba.
- **FR-009**: Compatibilidad: `padre.texto.stepup_minutos` y `padre.texto.retapado_minutos` SIGUEN gobernando; el nuevo `padre.texto.codigo_minutos` DEBE sembrarse de forma aditiva (upsert por clave) sin pisar parámetros ajenos.

## Criterios de aceptación

- [x] Solicitar: correo encolado con 6 dígitos, fila con solo hash, 502 sin regla, cooldown 429 con `reintentaEnSegundos`, cuenta con contraseña también 200 (tests).
- [x] Un solo vigente: pedir otro expira el anterior; el viejo no verifica (test).
- [x] Verificar: correcto → 204 + sello + texto fluye + consumido; ×5 → 429 y muere; vencido → 403; reuso → 401; formato → 400; sin sesión → 401 (tests).
- [x] Rate limit `stepup_codigo` con override por parámetro → 429 (test).
- [x] AuditLog de solicitud/verificación/fallo sin el código en `metadatos` (tests).
- [x] UI: panel automático tras el 403 con correo enmascarado, 6 casillas, 10:00 visible, reenvío con cooldown que despierta solo, éxito con anillo, retapado solo (tests de componente).
- [x] `npx tsc --noEmit`, `npm run lint`, shards 1-6, `npm run test:unit`, `npm run build`, `npm run arch:check` en VERDE.

## Assumptions

- El correo del padre YA es canal verificado (login mágico/códigos previos, SPEC-296/587): la posesión del correo es factor suficiente (misma autoridad que SPEC-592/598).
- El `stepup_sello` emitido tras verificar es por USUARIO (no por reporte): un padre con dos reportes en pantalla reutiliza el sello mientras viva — comportamiento heredado de SPEC-340, intacto.
- El cooldown de 60 s y el tope de 5 intentos son decisiones del dueño fijadas en el brief; viven como constantes del servicio (no parámetros).
- «Crear contraseña» (SPEC-598) conserva su token firmado stateless: su riesgo y UX ya quedaron aprobados; esta spec no lo toca.

## Implementación

- **Datos**: `prisma/schema.prisma` (modelo `CodigoStepUp` + 3 valores `AccionAudit` + relación en `Usuario`); migración aditiva `prisma/migrations/20260909170000_spec606_stepup_codigo_email/migration.sql`; `prisma/seed.ts` (parámetro `padre.texto.codigo_minutos` = 10, upsert aditivo).
- **Backend**: `src/lib/dal/services/stepup-codigo.ts` (nuevo — ciclo de vida del código); `src/app/api/padre/step-up/codigo/route.ts` y `src/app/api/padre/step-up/verificar/route.ts` (reescritas); `src/app/api/padre/step-up/route.ts` + `route.test.ts` (**eliminados** — step-up por contraseña); `src/app/api/padre/reportes/[id]/texto/route.ts` (403 siempre `codigo_email`); `src/lib/rate-limit.ts` (scopes `stepup_codigo`/`stepup_verificar`); `src/lib/routing/stepup-sello.ts` (fuera wrappers de step-up; token firmado solo SPEC-598).
- **UI**: `src/components/modules/padre/TextoSensible.tsx` (panel del código automático tras el 403 + anillo de retapado).
- **Tests**: `src/app/api/padre/step-up/codigo/route.test.ts` (10 casos, integración); `src/components/modules/padre/TextoSensible.test.tsx` (6 casos, unit — alta en `vitest.unit.includes.ts`); `src/lib/routing/stepup-sello.test.ts` y `src/app/api/auth/crear-password/route.test.ts` (ajustados); comentario al día en `src/app/api/auth/crear-password/codigo/route.ts`.
- **Arquitectura**: `docs/architecture/` regenerado (`arch:check` VERDE). Hallazgo preexistente: la línea base venía con drift de 16 rutas ajenas a esta spec (551→568); la regeneración la dejó al día.
