# Cierre — Spec 040: Aislamiento del comité a su Bandeja

## Resumen

Se implementó el aislamiento del rol `COMITE_VALIDACION` a la Bandeja del comité. El usuario de comité ya no ve las pestañas "Gestión" ni "Auditoría", ni puede acceder a esas sub-rutas. Los roles `ADMIN`/`SCHOOL_ADMIN` conservan el acceso completo. El flujo de negocio del comité (escalar → tomar → finalizar) fue verificado sin rediseñar.

## User Stories implementadas

### US1 — Aislar al comité a su Bandeja (P1)

- `ComiteSubNav` recibe `rol` como prop y filtra las pestañas.
- `COMITE_VALIDACION` ve solo "Bandeja".
- `ADMIN`/`SCHOOL_ADMIN` ven "Bandeja", "Gestión" y "Auditoría".
- El proxy (`src/lib/proxy.ts`) redirige a `COMITE_VALIDACION` desde `/dashboard/admin/comite/gestion` y `/dashboard/admin/comite/auditoria` a `/dashboard/admin/comite`.
- El proxy redirige a `OPERADOR` desde esas rutas admin-only a `/dashboard/admin`.

### US2 — Verificar flujo del comité (P2)

- Operador escala un caso en estado `REVISION_MANUAL` → se crea `SolicitudComite` con estado `PENDIENTE`.
- Comité ve la solicitud en "Pendientes".
- Comité toma la solicitud → estado `ASIGNADA`.
- Comité resuelve con `accion: CORREGIR` → estado `RESUELTA`, reporte pasa a `CORREGIDO`.
- La solicitud resuelta desaparece de la bandeja activa.
- No se encontraron bugs que requieran documentación como deuda.

## Archivos afectados

- `src/app/dashboard/admin/comite/components/ComiteSubNav.tsx`
- `src/app/dashboard/admin/comite/page.tsx`
- `src/app/dashboard/admin/comite/auditoria/page.tsx`
- `src/app/dashboard/admin/comite/gestion/page.tsx`
- `src/app/dashboard/admin/comite/gestion/GestionPageClient.tsx` (contenido cliente extraído de `page.tsx`)
- `src/lib/proxy.ts`
- Artefactos Spec-Kit: `specs/040-aislamiento-comite-bandeja/spec.md`, `checklists/requirements.md`
- `docs/cierre-040.md` (este archivo)

## Validación

### Build y tests

- `npx tsc --noEmit`: OK.
- `npm run lint`: OK (1 warning heredado de `react-hooks/exhaustive-deps` en `GestionPageClient.tsx`).
- `npm run test`: 79 test files, 419 tests, todos pasan.
- `rm -rf .next && npm run build`: OK.
- `./scripts/dev-restart.sh`: OK, healthcheck del worker OK, un solo worker en `:5005`.

### Pruebas de roles (curl)

- `ADMIN` / `SCHOOL_ADMIN`: acceden a `/dashboard/admin/comite/gestion` y `/auditoria` (HTTP 200).
- `COMITE_VALIDACION`: accede a `/dashboard/admin/comite` (HTTP 200); redirigido desde `/gestion` y `/auditoria` (HTTP 307 → `/dashboard/admin/comite`).
- `OPERADOR`: redirigido desde `/gestion` (HTTP 307 → `/dashboard/admin`).
- `PARENT`: redirigido desde `/dashboard/admin/comite` (HTTP 307 → `/`).
- Sin sesión: redirigido a `/login`.

### Prueba del SubNav (HTML renderizado)

- `ADMIN` en `/dashboard/admin/comite`: links a `/dashboard/admin/comite`, `/dashboard/admin/comite/gestion`, `/dashboard/admin/comite/auditoria`.
- `COMITE_VALIDACION` en `/dashboard/admin/comite`: solo link a `/dashboard/admin/comite`.

### Prueba del flujo de comité (curl)

```text
1. Operador escala reporte cmrqplsmy000yzxw9vr5gcrmm
   -> {"solicitudId":"cmrshcxhu0002n6eengesdwv9","numero":"SOL-E620FF09","estado":"PENDIENTE"} HTTP 201
2. Comité GET /api/admin/comite/pendientes
   -> 1 solicitud PENDIENTE
3. Comité POST /api/admin/comite/cmrshcxhu0002n6eengesdwv9/asignar
   -> {"estado":"ASIGNADA"} HTTP 200
4. Comité POST /api/admin/comite/.../resolver {accion:"CORREGIR",categoria:"CONTACTO_INSISTENTE"}
   -> {"estado":"RESUELTA","reporte":{"estado":"CORREGIDO"}} HTTP 200
5. Comité GET /api/admin/comite/mias
   -> 0 solicitudes
```

## Ciclo de deuda

- **Ronda 1**: se detectó un warning de `react-hooks/exhaustive-deps` en `GestionPageClient.tsx` por el `useEffect` de carga inicial. Se intentó corregir añadiendo `cargarCuenta` a las dependencias, pero el linter generó un nuevo warning porque la función no estaba memoizada. Se revirtió al estado original (igual que en el archivo `page.tsx` antes del refactor). El warning es heredado y no afecta el comportamiento; se documenta como observación, no como deuda técnica.
- **Ronda 2**: se verificó que el flujo de comité no tenía bugs de bajo riesgo. No se requieren correcciones.
- No quedó deuda técnica documentada.

## Commits y push

- `feat(040): filtra ComiteSubNav por rol y convierte páginas a server components`.
- `feat(040): protege rutas admin-only del comité en el proxy`.
- `docs(040): cierre e implementación en spec.md`.
- Push a `feature/001-scaffolding`.

## Estado del deploy

- App corriendo en `:5005` con `-H 0.0.0.0`.
- Un solo worker activo.
- Healthcheck OK.
- No hay roles bloqueados ni lockout.
