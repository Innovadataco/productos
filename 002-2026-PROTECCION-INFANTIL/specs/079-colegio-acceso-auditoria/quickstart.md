# Quickstart — Spec 079: Colegio acceso y auditoría

> Este quickstart se completará tras la aprobación e implementación de las Partes 2 y 3. A continuación el borrador de los pasos a probar.

## Prerrequisitos

- BD de desarrollo con datos mínimos (`npm run db:seed`).
- Al menos un colegio de prueba creado desde `/dashboard/admin/colegios`.

## Parte 1 — Fix de vigencia

1. Crear un colegio con `inicioServicio` igual a hoy.
2. Intentar login con el SCHOOL_ADMIN del colegio.
3. Verificar que permite el acceso (estado `vigente`).
4. Probar con `inicioServicio` mañana → bloqueado (`no_iniciado`).
5. Probar con `finServicio` ayer → bloqueado (`vencido`).
6. Probar con `finServicio` hoy → permite acceso.

## Parte 2 — Gestión de acceso

1. Ir a `/dashboard/admin/colegios` y seleccionar un colegio.
2. Hacer clic en "Restablecer contraseña".
3. Verificar que aparece la contraseña temporal una sola vez.
4. Intentar login con el SCHOOL_ADMIN y la contraseña temporal.
5. Verificar que obliga a cambiar la contraseña.
6. Hacer clic en "Reenviar email de credenciales".
7. Verificar que se registra `COLEGIO_EMAIL_REENVIADO` en auditoría.

## Parte 3 — Auditoría del colegio

1. Loguearse como SCHOOL_ADMIN.
2. Ir a `/dashboard/colegio/auditoria`.
3. Verificar que se listan acciones `COLEGIO_*` del colegio propio.
4. Filtrar por `COLEGIO_CURSO_CREADO` y verificar resultados.
5. Intentar acceder a `/api/colegio/auditoria` con otro SCHOOL_ADMIN → 403 o lista vacía.
6. Loguearse como ADMIN y verificar que la vista de auditoría general sigue funcionando.
