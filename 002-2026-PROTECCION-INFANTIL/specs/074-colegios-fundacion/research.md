# Research: Módulo Colegios — Fase 1: Fundación (Spec 074)

**Date**: 2026-07-21
**Feature**: specs/074-colegios-fundacion/spec.md

---

## Decisions

### D1: Patrón de creación de SCHOOL_ADMIN reutiliza el de operadores

**Decision**: Al crear un colegio se genera un usuario `SCHOOL_ADMIN` usando el mismo patrón que `src/app/api/admin/operadores/route.ts`: contraseña temporal aleatoria, `bcrypt.hash(password, 12)`, `debeCambiarPassword = true`, `estado = activo`, email de bienvenida con la contraseña temporal.

**Rationale**:
- Evita duplicar lógica de seguridad y generación de credenciales.
- El flujo de primer login con cambio obligatorio de contraseña ya existe y funciona.
- El email de bienvenida puede reutilizar `enviarEmailBienvenidaOperador` adaptado al rol, o crear `enviarEmailBienvenidaColegio` si el copy difiere.
- La unicidad de email global se valida con `prisma.usuario.findUnique({ where: { email } })`, igual que operadores.

**Diferencias con operadores**:
- No se crea `PerfilOperador`; el SCHOOL_ADMIN no tiene cupo ni es revisor de apelaciones.
- El rol siempre es `SCHOOL_ADMIN`.
- Se vincula `colegioId` y `tenantId`.

---

### D2: Vínculo Colegio ↔ Tenant ↔ Usuario

**Decision**: Un colegio crea un `Tenant` automáticamente. `Colegio.tenantId` apunta a ese tenant. El `Usuario` SCHOOL_ADMIN tiene `colegioId` (FK a Colegio) y `tenantId` (FK a Tenant), ambos sincronizados al crear el colegio.

**Rationale**:
- La constitución §2.3 define cada colegio como tenant aislado.
- `tenantId` ya existe en `Usuario` y en entidades de negocio; mantenerlo permite extender el aislamiento a futuras entidades del colegio sin reescribir relaciones.
- `colegioId` es específico del usuario de colegio y simplifica queries directas (por ejemplo, "dame el colegio de este SCHOOL_ADMIN").
- Solo se permite un SCHOOL_ADMIN por colegio; se valida con unique constraint en `Usuario.colegioId` restringida a `rol = SCHOOL_ADMIN` (o con unique partial index en PostgreSQL).

**Modelo propuesto**:
```prisma
model Colegio {
  id                          String               @id @default(cuid())
  nombre                      String
  paisId                      String
  departamentoId              String?
  ciudadId                    String
  direccion                   String?
  representanteLegalNombre      String
  representanteLegalIdentificacion String
  representanteLegalEmail     String
  representanteLegalTelefono  String?
  inicioServicio              DateTime
  finServicio                 DateTime?
  tipoPeriodo                 TipoPeriodoServicio
  estado                      String               @default("activo")
  tenantId                    String               @unique
  creadoEn                    DateTime             @default(now())
  actualizadoEn               DateTime             @updatedAt

  pais         Pais          @relation(fields: [paisId], references: [id])
  departamento Departamento? @relation(fields: [departamentoId], references: [id])
  ciudad       Ciudad        @relation(fields: [ciudadId], references: [id])
  tenant       Tenant        @relation(fields: [tenantId], references: [id])
  admin        Usuario?
}

model Usuario {
  ...
  colegioId String?
  ...
  colegio   Colegio? @relation(fields: [colegioId], references: [id])
  ...
}

enum TipoPeriodoServicio {
  MENSUAL
  SEMESTRAL
  ANUAL
}
```

---

### D3: Validación de vigencia

**Decision**: La vigencia se valida en dos lugares: login y proxy/middleware.

**Rationale**:
- En login se evita emitir token si el servicio no está vigente.
- En el proxy/middleware se protegen rutas del módulo colegio contra tokens ya emitidos que podrían quedar inválidos tras un cambio de fechas.
- No se aplica a ADMIN, OPERADOR, COMITE ni PARENT.
- `finServicio` nullable implica servicio permanente/vigente indefinidamente; se documenta como comportamiento opcional.

**Mensaje uniforme**: "Servicio no vigente, contacte al administrador" (tanto para vencido como para no iniciado), sin exponer fechas internas.

---

### D4: Identidad visual verde mediante variante de tokens

**Decision**: Agregar una clase `.theme-colegio` en el layout de `/dashboard/colegio` que sobreescriba las utilidades de acento (`text-accent`, `accent-gradient`, `ring-accent`, `text-gradient`) con verdes. El resto de componentes (botones, inputs, badges) usa `text-accent`, `bg-accent`, etc., y hereda el color automáticamente.

**Rationale** (del skill /ui-ux-pro-max):
- No se duplica el sistema de diseño; solo cambia el color de acento.
- El glassmorphism, la tipografía y el layout se mantienen idénticos.
- Es reversible y no afecta otras partes de la app.

**Ejemplo de CSS a agregar en `src/app/globals.css`**:
```css
.theme-colegio .text-accent {
  @apply text-emerald-700 dark:text-emerald-400;
}
.theme-colegio .text-gradient {
  @apply bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-300;
}
.theme-colegio .accent-gradient {
  @apply bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-400 dark:to-teal-400;
}
.theme-colegio .ring-accent {
  @apply focus-visible:ring-emerald-400 dark:focus-visible:ring-emerald-400;
}
.theme-colegio .ring-accent-input {
  @apply focus:border-emerald-400 dark:focus:border-emerald-400 focus:ring-emerald-200/50 dark:focus:ring-emerald-400/30;
}
```

**Nota**: El skill sugirió un acento dorado/cobre para institucional (#A16207), pero el requisito de negocio es **verde**. Se usa la familia esmeralda/teal para mantener contraste y legibilidad.

---

### D5: Restricción de reporte para SCHOOL_ADMIN

**Decision**: El SCHOOL_ADMIN no puede acceder a `/reportar` ni hacer POST a `/api/reportes` con su sesión.

**Rationale**:
- La cuenta institucional es de gestión, no de denuncia ciudadana.
- Se protege tanto a nivel de proxy (rutas de página) como a nivel de endpoint (`verifyAuth` sin SCHOOL_ADMIN en POST /api/reportes).
- Los usuarios anónimos y PARENT siguen sin cambios.

**Implementación en proxy**:
- Agregar `/reportar` a rutas bloqueadas para roles internos (`INTERNAL_ROLES`), similar a `USER_FINAL_ROUTES` pero redirigiendo a `homeForRole(rol)`.
- Alternativa: lista `REPORTAR_EXCLUDED_ROLES` y verificar antes de permitir el acceso público si hay token interno.

**Implementación en endpoint**:
- `POST /api/reportes` actualmente permite anónimos. Se debe verificar que si hay token, el rol no sea SCHOOL_ADMIN. PARENT/ADMIN/OPERADOR/COMITE? Actualmente el flujo de reportes autenticados es para PARENT. Se recomienda restrictivo: `verifyAuth(["PARENT"])` o permitir anónimo. Se deja documentado en tasks.md para decisión fina, pero el requisito es rechazar SCHOOL_ADMIN.

---

### D6: Facturación futura

**Decision**: En esta fase se usan campos de fecha simples (`inicioServicio`, `finServicio`, `tipoPeriodo`) en `Colegio`. No se conecta con `Plan`/`Subscription`/`BillingCycle`.

**Rationale**:
- El pago y la pasarela están fuera del alcance.
- Los modelos `Plan`/`Subscription`/`BillingCycle` ya existen como tablas base vacías; en una fase posterior se puede vincular `Colegio.subscriptionId` o similar sin migraciones destructivas.
- Documentar esta decisión permite que el diseño de la fase 1 deje la puerta abierta.

---

## Inventory of SCHOOL_ADMIN Accesses (Security Audit)

### Current state (before fix)

`SCHOOL_ADMIN` appears in multiple places that grant access beyond the institutional module:

#### 1. Authorization helpers (`src/lib/auth.ts`)
- `requireAdmin()` → `verifyAuth(["ADMIN", "SCHOOL_ADMIN"])`
- `requireOperadorOAdmin()` → `verifyAuth(["ADMIN", "SCHOOL_ADMIN", "OPERADOR"])`
- `requireComiteOAdmin()` → `verifyAuth(["ADMIN", "SCHOOL_ADMIN", "COMITE_VALIDACION"])`
- `requireAdminOComiteOOperador()` → `verifyAuth(["ADMIN", "SCHOOL_ADMIN", "OPERADOR", "COMITE_VALIDACION"])`

#### 2. Middleware / proxy (`src/lib/proxy.ts`)
- `INTERNAL_ROLES` includes `SCHOOL_ADMIN` → allows access to `/dashboard/admin/*` and `/api/admin/*`.
- `ADMIN_ROLES` includes `SCHOOL_ADMIN` → allows access to `/dashboard/admin/comite/gestion` and `/dashboard/admin/comite/auditoria`.
- `homeForRole` redirects `SCHOOL_ADMIN` to `/dashboard/admin`.

#### 3. Permission helpers (`src/lib/operadores/permisos.ts`)
- `esAdminRol()` returns `true` for `ADMIN` or `SCHOOL_ADMIN`.
- Tenant-scoped checks allow SCHOOL_ADMIN to manage resources of its tenant.

#### 4. Reporte transitions (`src/lib/reporte-transiciones.ts`)
- Maps `ADMIN` or `SCHOOL_ADMIN` to responsable `ADMIN`.

#### 5. Navigation components (`src/components/modules/`)
- `AdminNav.tsx`: SCHOOL_ADMIN sees admin/operator/committee/IA/dataset/config sections.
- `ComiteSubNav.tsx`: SCHOOL_ADMIN sees all 3 tabs (Bandeja, Gestión, Auditoría).
- `NavHeader.tsx`: SCHOOL_ADMIN is treated as employee, sees admin dashboard link, admin header styles, admin menu items.
- `ReporteWizard.tsx`: already blocks SCHOOL_ADMIN (correct).

#### 6. Pages (`src/app/`)
- `login/page.tsx`: redirects `ADMIN` or `SCHOOL_ADMIN` to `/dashboard/admin`.
- `cambiar-password/page.tsx`: redirects `ADMIN` or `SCHOOL_ADMIN` to `/dashboard/admin`.
- `mis-reportes/page.tsx`: redirects internal roles including `SCHOOL_ADMIN`.
- `dashboard/circulo-confianza/page.tsx`: redirects internal roles including `SCHOOL_ADMIN`.
- `dashboard/admin/layout.tsx`: allows `ADMIN`, `SCHOOL_ADMIN`, `OPERADOR`, `COMITE_VALIDACION`.

#### 7. Admin API endpoints (`src/app/api/admin/**`)
Multiple endpoints accept `SCHOOL_ADMIN`:
- `/api/admin/operadores/*` (GET, POST, PATCH, regenerar-password, reenviar-email, reactivar, asignación, modelo)
- `/api/admin/comite/*` (resolver, asignar, reasignar, solicitudes, integrantes)
- `/api/admin/spam/*` (pendientes, resolver)
- `/api/admin/apelaciones`
- `/api/admin/reportes-revision/*` (GET, reasignar)
- `/api/admin/estadisticas/*` (indirectly, if SCHOOL_ADMIN passes `verifyAuth`)
- `/api/admin/ia/modelos`

#### 8. Tests (`src/lib/role-visibility.test.tsx`)
- Tests assume `SCHOOL_ADMIN` sees admin nav tabs and committee tabs. These must be updated.

### Desired state (after fix)

- `SCHOOL_ADMIN` is **only** allowed in:
  - `verifyAuth(["SCHOOL_ADMIN"])` for its own endpoints (`/api/me/colegio`, `/api/admin/colegios` is ADMIN only).
  - `src/app/dashboard/colegio/**` pages.
  - `src/app/api/auth/login` (validates service and redirects to `/dashboard/colegio`).
  - `src/app/api/auth/cambiar-password` (redirects to `/dashboard/colegio`).
  - `src/lib/proxy.ts` in a dedicated allowed set for colegio routes.
- `SCHOOL_ADMIN` is **removed** from:
  - `requireAdmin`, `requireOperadorOAdmin`, `requireComiteOAdmin`, `requireAdminOComiteOOperador`.
  - `ADMIN_ROLES` in proxy.
  - `INTERNAL_ROLES` in proxy (or treated separately, not allowed in `/dashboard/admin/*` / `/api/admin/*`).
  - All `/api/admin/*` endpoints.
  - `AdminNav.tsx`, `ComiteSubNav.tsx`, `NavHeader.tsx` admin sections.
  - `reporte-transiciones.ts` responsibility mapping.
  - `login/page.tsx` and `cambiar-password/page.tsx` redirect paths.
- `SCHOOL_ADMIN` redirect home becomes `/dashboard/colegio`.
- Existing tests that assume SCHOOL_ADMIN sees admin/operator/committee UI must be updated to expect 403/redirect.

### Impact on other roles

- ADMIN, OPERADOR, COMITE_VALIDACION, PARENT keep their current access.
- No regression in existing admin/operator/committee flows.

---

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| Hacer que Colegio **sea** el Tenant (sin tabla Colegio) | Pierde datos específicos del colegio (representante, ubicación, vigencia) y no permite extensión futura |
| Usar `Usuario.tenantId` como único vínculo al colegio | No hay campo `colegioId` explícito; dificulta queries directas y la restricción de un solo admin por colegio |
| Validar vigencia solo en login | Un token emitido antes de un cambio de fechas seguiría vigente; defensa en profundidad requiere proxy |
| Crear un tema verde duplicado en CSS | Viola el principio de reutilización y aumenta deuda de mantenimiento |
| Permitir SCHOOL_ADMIN en `/reportar` con advertencia | Contradice el requisito de separación institucional |
| Usar campos `Plan`/`Subscription` en esta fase | Aumenta complejidad sin valor inmediato; fuera de alcance |

---

## Open Questions (0 remaining)

All NEEDS CLARIFICATION resolved. El modelo, el patrón de creación, la vigencia, el tema verde, la restricción de reportes y el aislamiento de SCHOOL_ADMIN están definidos.
