# Diseño — Spec 019: Gestor de permisos de módulos por ROL

> Estado: **RE-ESPECIFICADO — EN REVISIÓN** (🛑 esperando OK de ZEUS).
> Re-diseñado: 2026-07-23 aplicando los 5 cambios obligatorios.

## 1. Principios

- **Por ROL, no por usuario**: una fila por (rol, módulo). Sin overrides individuales (YAGNI).
- **Denegar por defecto**: sin fila o `activo=false` → acceso denegado.
- **Jerarquía AND**: submódulo accesible solo si el padre y el submódulo están activos para el rol.
- **Cero hardcodeo**: roles protegidos por parámetro; roles gestionados desde datos.
- **Absorber, no generalizar**: `rol` como String y catálogo como datos — un rol futuro entra con filas nuevas; no hay CRUD de roles ni motor de entidades.

## 2. Modelo de datos (migración aditiva)

```prisma
model ModuloPermisible {
  id            String   @id @default(cuid())
  clave         String   @unique
  nombre        String
  descripcion   String?
  padreId       String?             // null = módulo raíz
  categoria     String              // "admin" | "operador" | "comite" | "colegio"
  esCritico     Boolean  @default(false)
  orden         Int      @default(0)
  creadoEn      DateTime @default(now())
  actualizadoEn DateTime @updatedAt

  padre      ModuloPermisible?  @relation("JerarquiaModulos", fields: [padreId], references: [id], onDelete: Restrict)
  submodulos ModuloPermisible[] @relation("JerarquiaModulos")
  permisos   PermisoModulo[]

  @@index([padreId])
}

model PermisoModulo {
  id               String   @id @default(cuid())
  rol              String   // String, NO enum: absorbe roles futuros sin migración
  moduloId         String
  activo           Boolean  @default(false)
  actualizadoPorId String?
  creadoEn         DateTime @default(now())
  actualizadoEn    DateTime @updatedAt

  modulo        ModuloPermisible @relation(fields: [moduloId], references: [id], onDelete: Cascade)
  actualizadoPor Usuario?        @relation(fields: [actualizadoPorId], references: [id])

  @@unique([rol, moduloId])
  @@index([rol])
}
```

Notas:
- `onDelete: Restrict` en el padre: no se borra un módulo con submódulos (el catálogo se gestiona por seed/migración, no por UI).
- Se descarta `PermisoModulo.usuarioId` (diseño anterior) — la capa por usuario no se construye.

## 3. Lógica de acceso

```ts
async function puedeAccederAModulo(rol: string, clave: string): Promise<boolean> {
  const modulo = await prisma.moduloPermisible.findUnique({ where: { clave }, include: { padre: true } });
  if (!modulo) return false; // clave desconocida → denegar

  const propio = await prisma.permisoModulo.findUnique({
    where: { rol_moduloId: { rol, moduloId: modulo.id } },
  });
  if (propio?.activo !== true) return false;

  // AND jerárquico (un nivel): el padre también debe estar activo
  if (modulo.padreId) {
    const padre = await prisma.permisoModulo.findUnique({
      where: { rol_moduloId: { rol, moduloId: modulo.padreId } },
    });
    return padre?.activo === true;
  }
  return true;
}

// API routes
async function requireModulo(request: Request, clave: string) {
  const user = await verifyAuth();
  if (!(await puedeAccederAModulo(user.rol, clave))) {
    throw new AppError("Sin acceso al módulo", ERROR_CODES.FORBIDDEN, 403);
  }
  return user;
}
```

- Páginas: mismo chequeo en `layout.tsx`/`page.tsx` server-side → redirect a `/dashboard` con aviso "sin acceso".
- Edge middleware: fuera (sin Prisma); solo redirecciones gruesas existentes.

## 4. Anti-lockout (configurable, cambio 4)

- Parámetro `seguridad.permisos_roles_protegidos` (STRING_ARRAY, default `["ADMIN"]`), editable desde Configuración.
- Regla en el PATCH: para cualquier módulo `esCritico`, el resultado final debe dejar **al menos un rol protegido con `activo=true`**; si no → 409 `PERMISOS_LOCKOUT`.
- `esCritico` es dato del catálogo (seed), no código. Sin `esOwner`, sin emails.

## 5. Endpoints (todos ADMIN)

- `GET /api/admin/permisos-modulos` → `{ roles: string[], modulos: árbol, permisos: [{rol, moduloId, activo}] }`. `roles` se deriva de `SELECT DISTINCT rol FROM PermisoModulo` (aparecen roles futuros solos).
- `PATCH /api/admin/permisos-modulos` → body `{ cambios: [{ rol, moduloId, activo }] }` (máx 100). Valida anti-lockout simulando el estado final; aplica en transacción; `AuditLog` `PERMISOS_MODULO_ACTUALIZADOS` con antes/después; `actualizadoPorId` = admin.

Nota: la acción `PERMISOS_MODULO_ACTUALIZADOS` requiere `ALTER TYPE "AccionAudit" ADD VALUE` en la misma migración aditiva.

## 6. UI (`/dashboard/admin/configuracion`, tab "Permisos por rol")

- Selector de rol (lista derivada del backend).
- Árbol módulo → submódulos con toggles; al apagar un padre se muestran los hijos como inaccesibles (UI los marca, el backend los deniega igual).
- Candado en críticos; intento de violar anti-lockout muestra el 409 del backend.
- Reutiliza componentes del design system (GlassCard, Button, Badge); sin librerías nuevas.

## 7. Migración de datos (idempotente)

1. Crear tablas + enum value.
2. Seed del catálogo (raíces + submódulos, ver spec §Catálogo).
3. Backfill por rol (reproduce acceso implícito actual):
   - `ADMIN`: todo activo.
   - `SCHOOL_ADMIN`: `colegios` + `colegios_gestion` + `colegios_auditoria` activos.
   - `OPERADOR`: `bandeja_reportes` + `reportes_revision` activos (módulos nuevos del catálogo).
   - `COMITE_VALIDACION`: `comite` + `comite_bandeja` + `comite_auditoria` activos.
4. Los guards se activan módulo a módulo (cada API/layout adopta `requireModulo` en su propia tarea), evitando big-bang.

## 8. Integración con guards existentes

- Los guards actuales por rol (`verifyAuth(ROL)`) NO se eliminan en esta entrega: el permiso de módulo es una capa ADICIONAL (`verifyAuth` primero, `requireModulo` después). Así un rol sin filas queda denegado por defecto y no hay regresión.
- Adopción incremental: PR de esta spec cubre el centro de control IA, operadores, comité y colegios (los del catálogo inicial).

## 9. Tests clave

- `puedeAccederAModulo`: denegar sin fila; AND jerárquico (padre off + hijo on → denegado; padre on + hijo off → hijo denegado, padre accesible).
- PATCH: anti-lockout 409 al dejar roles protegidos sin módulo crítico; parámetro con 2 roles protegidos exige que al menos uno conserve.
- Absorción: crear filas para rol `FISCALIA` (string libre) y verificar acceso/denegación sin tocar código.
- Endpoint colegio/auditoria con `SCHOOL_ADMIN` y `colegios_auditoria` inactivo → 403.

## 10. Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Lockout de admins | Anti-lockout configurable + backfill fiel al acceso actual |
| Big-bang al activar guards | Adopción incremental por módulo; capa adicional, no reemplazo |
| Rol futuro inconsistente | `rol` String + roles derivados de datos; sin listas en código |
| Sobrediseño | Sin usuarios individuales, sin CRUD de roles, jerarquía de 1 solo nivel |

## 11. Estimación

Schema+migración+catálogo (0.5d) · helpers (0.5d) · endpoints+UI (1d) · adopción guards en módulos del catálogo (1d) · tests (0.5d) ≈ **3.5 días**.
