# Cierre — Spec 024: Rol Comité de Validación + gestión de cuenta e integrantes

## Resumen de implementación

Se completó la gestión de la cuenta del comité, sus integrantes y la notificación por email. El rol `COMITE_VALIDACION`, el escalamiento y la bandeja ya estaban implementados; este cierre cubre la parte operativa de administración del comité.

## Qué se implementó

1. **Cuenta del comité (espejo de operadores)**:
   - Creación desde el admin mediante `POST /api/admin/operadores` con `rol: "COMITE_VALIDACION"`.
   - Activar/desactivar, regenerar contraseña, reenviar email y editar nombre usando los mismos endpoints de operadores (los endpoints ya soportaban el rol comité).
   - AuditLog: `COMITE_CREADO`, `COMITE_ACTIVADO`, `COMITE_DESACTIVADO`, `COMITE_PASSWORD_REGENERADA`, `COMITE_EMAIL_REENVIADO`.
   - Exclusividad: si el email ya pertenece a un operador, el backend rechaza la creación; viceversa.

2. **Integrantes del comité**:
   - Tabla `IntegranteComite` con nombres, apellidos, tipo/número de identificación, email, fechas de vigencia y estado.
   - El número de identificación se cifra con `param-encryption` antes de guardar y se descifra al leer para el admin.
   - CRUD: `GET/POST /api/admin/comite/integrantes` y `PATCH/DELETE /api/admin/comite/integrantes/[id]`.
   - AuditLog: `COMITE_INTEGRANTE_CREADO`, `COMITE_INTEGRANTE_ACTUALIZADO`, `COMITE_INTEGRANTE_INACTIVADO`.

3. **Notificación por email al comité**:
   - Parámetros `comite.notificaciones.enabled` y `comite.notificaciones.frecuencia_horas`.
   - Función `notificarComiteSiCorresponde()` en `src/lib/operadores/notificacion-comite.ts`.
   - Control de frecuencia mediante `PerfilOperador.ultimoEmailNotificacionEn`.
   - Email con la cantidad de casos pendientes y enlace a la bandeja.

4. **UI admin**:
   - Página `/dashboard/admin/comite/gestion` con subnav en `/dashboard/admin/comite`.
   - Formulario para crear la cuenta comité si no existe.
   - Tarjeta de la cuenta con acciones: regenerar contraseña, reenviar email, activar/desactivar, editar nombre.
   - Formulario y tabla para registrar, editar e inactivar integrantes.
   - Contraseña temporal se muestra una sola vez en pantalla para copiar.

## Archivos tocados

- `src/app/dashboard/admin/comite/page.tsx` (subnav agregado)
- `src/app/dashboard/admin/comite/components/ComiteSubNav.tsx` (nuevo)
- `src/app/dashboard/admin/comite/gestion/page.tsx` (nuevo)
- `src/lib/operadores/notificacion-comite.ts` (nuevo)
- `src/lib/email.ts` (plantillas de email para comité)
- `src/lib/operadores/notificacion-comite.test.ts` (nuevo)
- `src/lib/operadores/login-comite.test.ts` (nuevo)
- `prisma/schema.prisma` (enum `COMITE_VALIDACION`, `PerfilOperador.ultimoEmailNotificacionEn`, `IntegranteComite`, acciones `COMITE_*`)
- `prisma/migrations/20260719044508_add_integrante_comite/` (migración aplicada)
- `prisma/seed.ts` (parámetros `comite.notificaciones.*`)
- `specs/024-comite-validacion/spec.md` (estado cerrado)
- `specs/024-comite-validacion/cierre.md` (este archivo)

## Resultados de tests y verificación

- `npm run lint`: ✅ (1 warning preexistente en `src/lib/sms.ts`, no relacionado; 1 warning nuevo en `src/app/dashboard/admin/comite/gestion/page.tsx` por `useEffect` dependency, inocuo).
- `npx tsc --noEmit`: ✅
- `npm run build`: ✅
- `npm run test`: ✅ 77 archivos, 407 tests pasados.
- `npm run test:e2e` y smoke: se ejecutan tras el deploy en :5005.

## Prueba manual recomendada

1. Admin crea cuenta comité en `/dashboard/admin/comite/gestion` → recibe contraseña temporal.
2. Ingresar como comité con el email y la contraseña → obliga a cambiar contraseña.
3. Registrar integrantes con número de identificación → verificar que se cifra en BD.
4. Operador escala un caso → comité recibe notificación según frecuencia configurada.
5. Intentar crear un operador con el email del comité → debe bloquear.

## Decisiones y notas

- Exclusividad: un empleado es operador o comité, nunca ambos. Se valida en el endpoint de creación.
- El comité es último eslabón: no escala más.
- Privacidad: ningún endpoint de operador/comité expone datos del denunciante; los integrantes son solo visibles para admin.
- El número de identificación se descifra en el endpoint de lectura para admin; no se almacena en claro.

## Commit de cierre

- Hash del último commit: `b3dcdc6`.

## Verificación final

- `npx tsc --noEmit`: ✅
- `npm run build` (rebuild limpio `rm -rf .next`): ✅
- `npm run test`: ✅ 407 tests en 77 archivos.
- Smoke E2E en http://localhost:5005: ✅
- App y worker reiniciados en :5005.
