# Plan — Spec 117: Gestión de credenciales de padres desde admin (I-37)

## Decisiones de diseño (todas reutilizan patrones existentes)

1. **Rutas API bajo `src/app/api/admin/padres/`** (nuevo subárbol, paralelo a
   `operadores/` y `colegios/`):
   - `route.ts` → `GET` listado paginado + búsqueda (patrón `admin/audit-logs/route.ts`:
     query Zod, `{ items, pagination: { page, pageSize, total, totalPages } }`).
   - `[id]/restablecer-password/route.ts` → `POST` (patrón
     `admin/operadores/[id]/regenerar-password/route.ts`: temp `randomBytes(6).hex`,
     se devuelve una vez, `debeCambiarPassword=true`, AuditLog).
   - `[id]/route.ts` → `DELETE` desactivar idempotente (patrón operadores `[id]/route.ts`).
   - `[id]/reactivar/route.ts` → `POST` reactivar idempotente (patrón operadores).
   - Solo `PARENT` es gestionable: `findFirst({ id, rol: "PARENT" })`; otro rol → 404
     (no se gestionan admins/operadores/colegios desde aquí).

2. **Módulo de permisos `padres`** (nueva clave en `src/lib/permisos-catalogo.ts`:
   `{ clave: "padres", nombre: "Gestión de padres", categoria: "admin", esCritico: true, orden: 25 }`).
   Justificación de tocar el catálogo: cada ítem de menú admin = un módulo del catálogo
   (spec 086, test estructural `nav-items.test.ts`); gestión de credenciales de padres es
   un permiso crítico independiente de `operadores` (otro rol gestionado, otro riesgo).
   NO requiere migración: `ModuloPermisible`/`PermisoModulo` se siembran por upsert desde
   el catálogo (`prisma/seed.ts` backfill `ADMIN: todas las claves`; tests usan
   `otorgarTodosLosPermisos` de `src/lib/test-utils.ts`).

3. **Auditoría SIN migración de enum**: se reutiliza la acción existente `USER_UPDATE`
   (`AccionAudit`) con `tipoRecurso: "Usuario"`, `recursoId` = cuenta del padre,
   `usuarioId` = admin, y diffs estructurados en `valorAnterior`/`valorNuevo`
   (`{ estado }` o `{ debeCambiarPassword }`). Justificación: añadir valores `PADRE_*`
   al enum exigiría `ALTER TYPE` sobre la BD de test COMPARTIDA en una cola con agentes
   en paralelo; la trazabilidad queda intacta con el diff (la acción + el diff identifican
   la operación sin ambigüedad). Verificado: el bloque NO necesita migración (SC-004).

4. **Login rechaza `inactivo`** (`src/app/api/auth/login/route.ts`): tras
   `verifyPassword` OK y ANTES del update que hoy pone `estado:"activo"`, si
   `user.estado === "inactivo"` → 401 "Cuenta desactivada". Hoy un inactivo con la
   contraseña correcta entra y se auto-reactiva (el update de lockout-reset pisa el
   estado): sin este cambio AS-3.3 es imposible. Se verifica DESPUÉS de la contraseña
   para no filtrar existencia/estado de la cuenta a llamantes sin credenciales. El flujo
   `bloqueado` (lockout temporal) queda intacto.

5. **Schemas**: query `padresQuerySchema` en `src/lib/validators.ts` (patrón
   `auditLogsQuerySchema`); params `padreIdParamsSchema` en `src/lib/schemas/index.ts`
   (patrón `operadorIdParamsSchema`, cuid).

6. **UI**: `src/app/dashboard/admin/padres/page.tsx` (server: `verificarAccesoPagina("padres")`
   → `SinAccesoModulo`; patrón `admin/colegios/page.tsx`) + `PadresPageClient.tsx` en la
   misma carpeta (patrón visual de `admin/operadores/gestion/page.tsx`: GlassCard, tabla,
   Badge, banner de contraseña temporal de un solo uso). Ítem en `ADMIN_NAV_ITEMS`
   (`src/lib/nav-items.ts`) e icono en `AdminNav.tsx`. Textos en español neutro.

7. **Privacidad (FR-006)**: el listado devuelve solo campos de cuenta + conteo de
   reportes (`prisma.reporte.groupBy` por `usuarioId` de la página, `eliminado: false`).
   Nunca textos, identificadores ni alumnos.

## Archivos

Nuevos:
- `src/app/api/admin/padres/route.ts` + `route.test.ts`
- `src/app/api/admin/padres/[id]/route.ts` (DELETE) + `route.test.ts`
- `src/app/api/admin/padres/[id]/restablecer-password/route.ts` + `route.test.ts`
- `src/app/api/admin/padres/[id]/reactivar/route.ts` + `route.test.ts`
- `src/app/dashboard/admin/padres/page.tsx` + `PadresPageClient.tsx`
- `specs/117-gestion-padres-admin/{spec,plan,tasks,cierre}.md`

Tocados:
- `src/lib/permisos-catalogo.ts` (clave `padres`)
- `src/lib/nav-items.ts` (ítem "Padres")
- `src/components/modules/AdminNav.tsx` (icono del ítem)
- `src/lib/validators.ts` (`padresQuerySchema`)
- `src/lib/schemas/index.ts` (`padreIdParamsSchema`)
- `src/app/api/auth/login/route.ts` (rechazo `inactivo`)

## Riesgos

- `specs/README.md` lo gestiona el coordinador: `specs-discipline.test.ts` fallará en
  "índice cubre todas las carpetas" hasta que indexe `117-gestion-padres-admin`
  (anotado, esperado por la cola).
- El cambio de login es deliberadamente mínimo: solo añade la guarda `inactivo`; los
  flujos `bloqueado` y lockout-reset quedan byte a byte.
