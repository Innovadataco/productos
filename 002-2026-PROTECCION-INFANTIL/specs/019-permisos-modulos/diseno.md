# Diseño — Spec 019: Gestor de permisos de módulos

> Estado: **EN REVISIÓN** (`🛑` esperando ok del owner antes de implementar).
> Fecha del diseño: 2026-07-18.

## 1. Principios rector

- **Denegar por defecto**: un módulo no configurado para un usuario interno es inaccesible para ese usuario.
- **No toca usuarios finales**: `PARENT` y flujos públicos quedan fuera del alcance.
- **Protección en backend**: la validación ocurre en la API route/página, no solo en el menú.
- **Anti-lockout**: el admin owner (o rol equivalente) nunca se puede quitar permisos críticos sobre sí mismo.
- **Sin duplicar auth/roles**: se apoya en `RolUsuario`, `verifyAuth` y `esAdminRol` existentes.

## 2. Modelo de datos

### 2.1 Nuevas tablas

```prisma
model ModuloPermisible {
  id          String   @id @default(cuid())
  clave       String   @unique
  nombre      String
  descripcion String?
  categoria   String   // ej: "admin", "operador"
  esCritico   Boolean  @default(false) // módulos que requieren guard anti-lockout
  orden       Int      @default(0)
  creadoEn    DateTime @default(now())
  actualizadoEn DateTime @updatedAt

  permisos PermisoModulo[]
}

model PermisoModulo {
  id        String @id @default(cuid())
  usuarioId String
  moduloId  String
  habilitado Boolean @default(false)
  asignadoPorId String?
  creadoEn  DateTime @default(now())
  actualizadoEn DateTime @updatedAt

  usuario Usuario @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  modulo  ModuloPermisible @relation(fields: [moduloId], references: [id], onDelete: Cascade)
  asignadoPor Usuario? @relation("PermisoAsignadoPor", fields: [asignadoPorId], references: [id])

  @@unique([usuarioId, moduloId])
  @@index([usuarioId])
}
```

Ampliar `RolUsuario` NO es necesario; los permisos son una capa adicional sobre el rol.

### 2.2 Catálogo inicial de módulos permisibles

| Clave | Nombre | Categoría | Crítico | Notas |
|-------|--------|-----------|---------|-------|
| `bandeja_reportes` | Bandeja de reportes | `operador` | Sí | Todo operador debe tenerlo; anti-lockout para admins |
| `reportes_revision` | Cola de revisión manual | `operador` | Sí | |
| `apelaciones` | Apelaciones (Fase C) | `admin` | No | |
| `centro_control_ia` | Centro de Control IA | `admin` | No | |
| `dataset_entrenamiento` | Dataset de entrenamiento | `admin` | No | |
| `configuracion_sistema` | Configuración del sistema | `admin` | Sí | Anti-lockout: admin owner siempre lo conserva |
| `operadores` | Gestión de operadores | `admin` | Sí | Anti-lockout: admin owner siempre lo conserva |
| `anti_abuso` | Anti-abuso | `admin` | No | |
| `estadisticas` | Estadísticas | `admin` | No | |
| `circulo_confianza` | Círculo de Confianza (vista admin) | `admin` | No | Vista de supervision, no el módulo de usuario |
| `audit_logs` | Logs de auditoría | `admin` | Sí | Anti-lockout |

Módulos **siempre-admin-fijos** (no configurables, siempre accesibles para `ADMIN`/`SCHOOL_ADMIN`):
- Acceso al propio panel `/dashboard/admin`.
- Perfil/cambio de contraseña.
- Cierre de sesión.

## 3. Lógica de negocio

### 3.1 Reglas de acceso

```ts
async function puedeAccederAModulo(usuario: Usuario, moduloClave: string): Promise<boolean> {
  // Super-admins / owner nunca se bloquean
  if (usuario.rol === "ADMIN" && usuario.esOwner) return true;

  // Admins sin módulos explícitos: heredan acceso a módulos no críticos?
  // Decisión: NO. Denegar por defecto. Pero la migración inicial les otorga todos los permisos.
  const modulo = await prisma.moduloPermisible.findUnique({ where: { clave: moduloClave } });
  if (!modulo) return false;

  const permiso = await prisma.permisoModulo.findUnique({
    where: { usuarioId_moduloId: { usuarioId: usuario.id, moduloId: modulo.id } },
  });

  // Sin registro = denegado
  return permiso?.habilitado === true;
}
```

### 3.2 Anti-lockout

- El campo `Usuario.esOwner` (o un email/rol hardcodeado) identifica al admin owner.
- Para módulos críticos, el sistema impide deshabilitar el último admin con acceso.
- La UI deshabilita el toggle de módulos críticos sobre el propio usuario logueado.

### 3.3 Operadores

- Un `OPERADOR` sin permisos configurados no accede a nada del panel interno.
- Por defecto, al crear un operador se le otorgan: `bandeja_reportes`, `reportes_revision`.
- El admin puede quitar/agregar módulos no críticos posteriormente.

## 4. Guard de rutas

### 4.1 Páginas (server-side)

En cada `layout.tsx` o `page.tsx` protegido del panel:

```ts
const user = await verifyAuth();
const puede = await puedeAccederAModulo(user, "centro_control_ia");
if (!puede) redirect("/dashboard/admin");
```

### 4.2 API routes

Helper:

```ts
export async function requireModulo(request: Request, moduloClave: string) {
  const user = await verifyAuth();
  const puede = await puedeAccederAModulo(user, moduloClave);
  if (!puede) throw new AppError("Sin acceso al módulo", ERROR_CODES.FORBIDDEN, 403);
  return user;
}
```

Uso:

```ts
const user = await requireModulo(request, "operadores");
```

### 4.3 Middleware (capa adicional)

El `middleware.ts` existente puede verificar rutas bajo `/dashboard/admin/:slug*` y consultar permisos. Como el middleware corre en edge y no tiene Prisma, la validación principal queda en los layouts/API routes. El middleware se mantiene solo para redirecciones de rol grosseras (operador vs parent), no para permisos finos.

## 5. UI en configuración existente

Sección nueva en `/dashboard/admin/configuracion`:

- Tab "Permisos de módulos".
- Selector de usuario interno (dropdown con `ADMIN`, `SCHOOL_ADMIN`, `OPERADOR`).
- Tabla/grilla de módulos con toggle on/off.
- Módulos críticos marcados con candado; deshabilitados para el propio owner.
- Botón "Guardar" que envía `PATCH /api/admin/permisos`.
- Reutilizar `AdminNav`, `MetricCard`, `Toggle`/`Switch` del design system.

### 5.1 Endpoints

- `GET /api/admin/permisos/usuarios` — usuarios internos + resumen de permisos.
- `GET /api/admin/permisos?usuarioId=...` — permisos detallados de un usuario.
- `PATCH /api/admin/permisos` — actualizar permisos (body `{ usuarioId, permisos: [{ moduloId, habilitado }] }`).
  - Requiere admin.
  - Valida anti-lockout antes de guardar.
  - AuditLog `PERMISOS_MODULO_ACTUALIZADOS`.

## 6. Migración de datos

1. Crear tabla `ModuloPermisible` con el catálogo inicial.
2. Crear tabla `PermisoModulo`.
3. Backfill: para cada `ADMIN`/`SCHOOL_ADMIN` existente, crear permisos `habilitado=true` en todos los módulos no críticos + críticos.
4. Para cada `OPERADOR` existente, crear permisos `habilitado=true` en `bandeja_reportes` y `reportes_revision`.

## 7. AuditLog

- Acción: `PERMISOS_MODULO_ACTUALIZADOS`.
- Valor anterior: JSON con permisos previos.
- Valor nuevo: JSON con permisos nuevos.
- `recursoId`: usuarioId afectado.
- `usuarioId`: admin que hizo el cambio.

## 8. Integración con specs existentes

- **Spec 018 (Operadores)**: al crear un operador, el sistema le asigna los módulos base.
- **Spec 017 (Documentación)**: el módulo `documentacion` se agrega al catálogo cuando se implemente.
- **Auth actual**: `verifyAuth` y roles no cambian; los permisos son una capa extra.

## 9. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Admin se bloquea solo | `esOwner` + validación anti-lockout en backend |
| Bypass por URL directa | Guard en API routes y server layouts |
| Escalación de privilegios | Solo admins editan permisos; audit log |
| Complejidad excesiva | Denegar por defecto; catálogo cerrado; no permisos por acción |
| Datos migrados inconsistentes | Backfill idempotente en migración |

## 10. Fases de implementación (estimación)

1. **Schema + migración + catálogo** (1 día).
2. **Helpers `puedeAccederAModulo` / `requireModulo`** (0.5 día).
3. **Integración en layouts/API routes del panel** (1 día).
4. **UI en configuración** (1 día).
5. **Tests + audit log + anti-lockout** (1 día).

Total estimado: **4–5 días**.

## 11. Preguntas abiertas para el owner

1. ¿Definimos `Usuario.esOwner` como booleano, o usamos un email/rol hardcodeado?
2. ¿Los `SCHOOL_ADMIN` pueden gestionar permisos de usuarios de su tenant, o solo `ADMIN` global?
3. ¿El módulo de documentación (Spec 017) se incluye en el catálogo inicial o se agrega luego?
