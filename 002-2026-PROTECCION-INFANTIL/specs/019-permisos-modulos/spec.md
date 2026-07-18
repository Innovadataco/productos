# Spec 019 — Gestor de permisos de módulos

> Estado: **EN DISEÑO**.
> Diseño: [`diseno.md`](diseno.md).

## Alcance

Permitir que el admin active/desactive **módulos y submódulos** del panel interno por **usuario interno** (`ADMIN`, `SCHOOL_ADMIN`, `OPERADOR`). No gestiona permisos por acción ni afecta a usuarios finales (`PARENT`).

## Decisiones del owner

1. Solo usuarios internos (empleados) son sujetos de permisos de módulo.
2. Denegar por defecto: si un módulo no está configurado para un usuario, ese usuario no tiene acceso.
3. La validación debe estar en backend por ruta; no basta con ocultar el menú.
4. El admin owner (o un rol equivalente) nunca puede bloquearse a sí mismo (candado anti-lockout).
5. Se gestiona desde el módulo de configuración admin existente (`/dashboard/admin/configuracion`).

## Requisitos

- Modelo de datos para permisos de módulos por usuario.
- Catálogo de módulos permisibles vs módulos siempre-admin-fijos.
- UI de configuración integrada en la pantalla de configuración existente.
- Guard de rutas que verifique permisos antes de responder (API y páginas).
- `AuditLog` de cambios de permisos.
- Migración de datos que otorgue permisos por defecto a admins existentes.

## Riesgos mitigados

- Lockout del admin: candado explícito.
- Bypass por URL: validación en backend.
- Escalación: solo admins pueden modificar permisos.

## R7

No aplica: no toca el pipeline de clasificación.
