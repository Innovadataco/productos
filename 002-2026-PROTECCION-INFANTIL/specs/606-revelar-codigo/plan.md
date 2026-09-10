# Plan — SPEC-606 · Revelar texto con código por correo

**Fecha**: 2026-09-09 · Rama `work/pi-SPEC-606-revelar-codigo` (base `origin/main` a1ab0c6d2, SPEC-604 mergeada).

## Contexto

«Revelar texto» hoy: `GET /api/padre/reportes/[id]/texto` entrega si el JWT tiene < `padre.texto.stepup_minutos` (30) o hay `stepup_sello` fresco; si no → 403 STEP_UP_REQUERIDO → step-up por contraseña (`POST /api/padre/step-up`, reusando `AutenticacionService.login`). SPEC-592 improvisó para cuentas OAuth un token firmado stateless enviado por correo (`firmarCodigoStepUpEmail`). Decisión del dueño: un solo camino, código de 6 dígitos por correo para toda cuenta (diseño: bloque ③ de `design/expediente-final-mockup.html`).

## Enfoque

1. **Schema (aditivo)**: tabla `CodigoStepUp` (solo sha-256 del código, vigencia, intentos, consumo único) + 3 valores `AccionAudit`. Migración `20260909170000_spec606_stepup_codigo_email`.
2. **Servicio DAL** `src/lib/dal/services/stepup-codigo.ts`: generación CSPRNG, hash, enmascarado de correo, solicitud (expira anteriores en tx, cooldown 60 s, correo fail-closed con borrado de la fila huérfana, audit) y verificación (5 intentos, un solo uso con update condicional, audit de fallos).
3. **Rutas**: reescritura de `codigo` (sin candado solo-OAuth, scope `stepup_codigo`) y `verificar` (zod `\d{6}`, scope `stepup_verificar`, mapa de resultados a 204/401/403/429, emisión del sello intacta). Eliminación de `POST /api/padre/step-up` (contraseña) y su test — único consumidor era `TextoSensible`.
4. **Autoridad intacta**: `texto/route.ts` solo cambia el 403: `metodos: ["codigo_email"]` siempre. El sello y los parámetros existentes siguen gobernando.
5. **Limpieza**: `stepup-sello.ts` pierde los wrappers de step-up; el token firmado queda exclusivo de «Crear contraseña» (SPEC-598); su test se actualiza con token artesanal de propósito ajeno.
6. **UI**: `TextoSensible` pide el código sola tras el 403; panel con correo enmascarado, 6 casillas (auto-avance, backspace, pegado), vigencia mm:ss, reenvío con cooldown; texto revelado con anillo SVG de cuenta regresiva; retapado intacto por deadline absoluto.
7. **Seed aditivo**: `padre.texto.codigo_minutos` = 10. Defaults de rate-limit: `stepup_codigo` 5/h, `stepup_verificar` 15/10 min.
8. **Tests**: integración de los dos endpoints (10 casos), componente `TextoSensible` (6 casos, unit), ajuste `stepup-sello.test.ts` y `crear-password/route.test.ts`.

## Orden y dependencias

Migración → servicio → rutas → texto route → sello/limpieza → seed → UI → tests → artefactos → `arch:check` → gate completo → PR.

## Riesgos y mitigaciones

- **Carrera de doble verificación**: update condicional `consumidoEn: null` (una gana).
- **Cooldown tras 502**: la fila huérfana se borra (ningún correo salió → reintento libre).
- **Código vigente ajeno a un segundo reporte en pantalla**: el 429 de cooldown devuelve `correoEnmascarado` + `reintentaEnSegundos` y la UI ofrece las casillas igual (el código ya enviado sirve).
- **`prisma format`**: el schema del repo no es format-clean; NO formatear (diff ruidoso) — ediciones manuales alineadas.
