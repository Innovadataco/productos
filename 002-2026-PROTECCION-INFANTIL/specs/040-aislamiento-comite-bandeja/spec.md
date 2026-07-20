# Feature Specification: Aislamiento del comité a su Bandeja

**Feature Branch**: `[040-aislamiento-comite-bandeja]`

**Created**: 2026-07-19

**Status**: CERRADA

**Input**: El rol `COMITE_VALIDACION` actualmente ve en el módulo Comité las 3 pestañas (Bandeja, Gestión, Auditoría) de `ComiteSubNav`, aunque Gestión y Auditoría son funciones exclusivas de `ADMIN`/`SCHOOL_ADMIN`. Además, `/dashboard/admin/comite/gestion` no tiene protección server-side y `/dashboard/admin/comite/auditoria` muestra la UI de auditoría aunque sus datos están restringidos. El objetivo es aislar al comité a su Bandeja, de modo que solo vea y pueda acceder a la pestaña y funciones de trabajo de casos escalados.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Aislar al comité a su Bandeja (Priority: P1)

El usuario `COMITE_VALIDACION` debe ver únicamente la pestaña "Bandeja" dentro del módulo Comité. Las pestañas "Gestión" (creación de cuenta e integrantes del comité) y "Auditoría" (registro de acciones sobre el comité) son responsabilidad de `ADMIN`/`SCHOOL_ADMIN` y deben estar ocultas para el comité. Las rutas `/dashboard/admin/comite/gestion` y `/dashboard/admin/comite/auditoria` deben ser protegidas a nivel perimetral para que un comité no pueda siquiera renderizar esas páginas.

**Why this priority**: Hoy el comité accede a funciones que no le corresponden. Aunque el backend rechaza algunas operaciones, la exposición de UI genera confusión y riesgo de seguridad. Además, el diseño del comité (spec 024) lo define como el "último eslabón" que solo finaliza casos escalados; no gestiona la cuenta ni ve auditoría.

**Independent Test**: Como `COMITE_VALIDACION`, al navegar a `/dashboard/admin/comite` se ve una sola pestaña: "Bandeja". Al intentar acceder directamente a `/dashboard/admin/comite/gestion` o `/dashboard/admin/comite/auditoria`, el proxy perimetral redirige a `/dashboard/admin/comite`. Como `ADMIN` o `SCHOOL_ADMIN`, se ven las 3 pestañas y se accede a Gestión y Auditoría sin redirección.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado con rol `COMITE_VALIDACION`, **When** accede a `/dashboard/admin/comite`, **Then** `ComiteSubNav` muestra únicamente la pestaña "Bandeja".
2. **Given** un usuario autenticado con rol `ADMIN` o `SCHOOL_ADMIN`, **When** accede a `/dashboard/admin/comite`, **Then** `ComiteSubNav` muestra las pestañas "Bandeja", "Gestión" y "Auditoría".
3. **Given** un usuario autenticado con rol `COMITE_VALIDACION`, **When** accede directamente a `/dashboard/admin/comite/gestion` o `/dashboard/admin/comite/auditoria`, **Then** el proxy perimetral lo redirige a `/dashboard/admin/comite` antes de renderizar la página.
4. **Given** un usuario autenticado con rol `ADMIN` o `SCHOOL_ADMIN`, **When** accede a `/dashboard/admin/comite/gestion` o `/dashboard/admin/comite/auditoria`, **Then** el proxy lo deja pasar y el layout admin lo permite.
5. **Given** un usuario sin sesión, **When** accede a `/dashboard/admin/comite`, **Then** el proxy lo redirige a `/login`.
6. **Given** `ComiteSubNav` filtrado por rol, **When** se consulta `/api/me`, **Then** el componente recibe el rol correctamente (por prop server-side o por fetch), sin parpadear las pestañas prohibidas.

### User Story 2 — Verificar flujo del comité (diseño A, sin rediseñar) (Priority: P2)

El comité debe poder ejecutar el flujo diseñado en el spec 024: un operador escala un caso → el caso aparece en la Bandeja del comité en estado "Pendientes" → el comité lo toma → pasa a "Míos" → el comité lo revisa y lo finaliza con estado `CORREGIDO`. No se rediseña la bandeja; solo se verifica que el flujo sigue funcionando y se documenta cualquier bug como deuda técnica si no se puede corregir de forma acotada.

**Why this priority**: El foco de este spec es el aislamiento de UI/protección. El flujo de negocio es un sanity check para asegurar que el aislamiento no rompe la única función que el comité debe tener.

**Independent Test**: Como operador, escalar un caso a comité. Como comité, verlo en Pendientes, tomarlo, finalizarlo como `CORREGIDO`. Validar que el caso desaparece de la Bandeja de pendientes.

**Acceptance Scenarios**:

1. **Given** un operador con un caso en estado escalable, **When** escala el caso al comité, **Then** el caso aparece en la bandeja del comité en la sección "Pendientes".
2. **Given** un caso en "Pendientes" de la bandeja del comité, **When** el comité lo toma, **Then** pasa a la sección "Míos".
3. **Given** un caso en "Míos" del comité, **When** el comité lo finaliza con decisión `CORREGIDO`, **Then** el caso cambia de estado y desaparece de la bandeja activa.
4. **Given** un fallo en el flujo de negocio, **When** no se puede corregir con un cambio acotado, **Then** se documenta como deuda técnica en el cierre, sin rediseñar la bandeja.

---

## Edge Cases

- **US1**: ¿Qué pasa si el rol no se puede determinar (request a `/api/me` falla o el token expira)? El componente debe asumir el rol más restrictivo (comité) y mostrar solo "Bandeja", evitando filtrar controles de admin.
- **US1**: ¿Qué pasa si un OPERADOR accede a `/dashboard/admin/comite`? El proxy ya redirige a operadores desde rutas de admin, pero si llegara, el layout admin lo rechaza. `ComiteSubNav` no necesita considerar OPERADOR.
- **US1**: ¿Qué pasa si el matcher del proxy no cubre `/dashboard/admin/comite/gestion` o `/auditoria` específicamente? El matcher actual es amplio (`/dashboard/admin/*`), por lo que solo se requiere agregar una regla interna adicional para rutas admin-only, no cambiar el matcher.
- **US2**: ¿Qué pasa si no hay casos escalados? La bandeja muestra el estado vacío correspondiente; esto no es un bug.
- **US2**: ¿Qué pasa si el comité intenta finalizar un caso que no ha tomado? El backend debe rechazar la operación; el proxy no interviene en lógica de negocio.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `ComiteSubNav` DEBE recibir el rol del usuario (vía prop server-side o consulta a `/api/me`) y filtrar las pestañas: `COMITE_VALIDACION` ve solo "Bandeja"; `ADMIN`/`SCHOOL_ADMIN` ven "Bandeja", "Gestión" y "Auditoría".
- **FR-002**: `ComiteSubNav` DEBE seguir siendo un componente cliente ("use client") si usa `usePathname`, pero DEBE recibir el rol como prop de un componente server o de un contexto autorizado; no debe depender de un valor fácilmente manipulable.
- **FR-003**: El proxy perimetral (`src/lib/proxy.ts`) DEBE reconocer `/dashboard/admin/comite/gestion` y `/dashboard/admin/comite/auditoria` como rutas admin-only (`ADMIN` o `SCHOOL_ADMIN`) y redirigir a un usuario `COMITE_VALIDACION` a `/dashboard/admin/comite`.
- **FR-004**: El proxy DEBE mantener `verifyAuth` en endpoints y layouts como defensa en profundidad; no se remueven esas protecciones.
- **FR-005**: Las páginas `/dashboard/admin/comite/gestion` y `/dashboard/admin/comite/auditoria` DEBEN seguir siendo accesibles para `ADMIN`/`SCHOOL_ADMIN` sin cambios funcionales.
- **FR-006**: La página `/dashboard/admin/comite` DEBE permanecer accesible para `COMITE_VALIDACION`.
- **FR-007**: El flujo de negocio de la bandeja del comité (escalar → tomar → finalizar) DEBE seguir funcionando como en el spec 024; si hay bug, se documenta como deuda y no se rediseña.
- **FR-008**: No DEBE haber cambios en el modelo de datos de Prisma para este spec.

### Key Entities

- **Usuario**: rol `COMITE_VALIDACION`, `ADMIN`, `SCHOOL_ADMIN`.
- **ComiteSubNav**: componente de navegación del módulo Comité en `src/app/dashboard/admin/comite/components/ComiteSubNav.tsx`.
- **Proxy perimetral**: `src/lib/proxy.ts` (helper) y `src/proxy.ts` (entrypoint Next.js 16).
- **Rutas protegidas**: `/dashboard/admin/comite/gestion`, `/dashboard/admin/comite/auditoria`.
- **Ruta compartida**: `/dashboard/admin/comite`.
- **Endpoints**: `/api/me` (para obtener rol), `/api/admin/comite/**` (datos de bandeja), `/api/admin/audit-logs` (auditoría, admin-only).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `ComiteSubNav` muestra solo "Bandeja" para un usuario `COMITE_VALIDACION`; muestra 3 pestañas para `ADMIN`/`SCHOOL_ADMIN`.
- **SC-002**: Un usuario `COMITE_VALIDACION` que accede a `/dashboard/admin/comite/gestion` o `/dashboard/admin/comite/auditoria` es redirigido a `/dashboard/admin/comite` (HTTP 307).
- **SC-003**: Un usuario `ADMIN`/`SCHOOL_ADMIN` accede a `/dashboard/admin/comite/gestion` y `/dashboard/admin/comite/auditoria` sin redirección (HTTP 200).
- **SC-004**: El flujo escalar → tomar → finalizar del comité se puede reproducir con usuarios de prueba; si falla, queda registrado como deuda técnica con causa y pasos.
- **SC-005**: `npm run test`, `npx tsc --noEmit` y `npm run lint` continúan pasando sin errores introducidos por este spec.

---

## Assumptions

- El proxy perimetral ya corre como `src/proxy.ts` en Next.js 16.2.10 (spec 039).
- `COMITE_VALIDACION` es un rol interno y puede acceder a `/dashboard/admin/*`; el cambio solo refina qué sub-rutas del comité son accesibles.
- `ADMIN`/`SCHOOL_ADMIN` son los roles responsables de gestionar la cuenta e integrantes del comité y de auditar sus acciones.
- El diseño de la Bandeja del comité (spec 024) no se modifica; solo se restringe lo que el comité puede ver.
- El flujo de negocio de la bandeja está implementado y funcional salvo bugs a documentar.

---

## Implementación

### Objetivo alcanzado

El rol `COMITE_VALIDACION` está aislado a la Bandeja del comité. No ve ni puede acceder a Gestión ni Auditoría. Los roles `ADMIN`/`SCHOOL_ADMIN` conservan el acceso a las 3 pestañas y a las sub-rutas correspondientes. El proxy perimetral redirige a los roles no autorizados antes de que rendericen la página.

### Decisiones de diseño

- `ComiteSubNav` recibe `rol` como prop. Las pestañas "Gestión" y "Auditoría" se filtran para `COMITE_VALIDACION`; `ADMIN`/`SCHOOL_ADMIN` ven las 3 pestañas.
- Las páginas `comite/page.tsx` y `auditoria/page.tsx` se convirtieron en server components para leer el rol del token y pasarlo al SubNav sin fetch adicional ni parpadeo.
- La página `gestion/page.tsx` se convirtió en server component que renderiza `ComiteSubNav` (con rol) y delega el contenido en `GestionPageClient.tsx` (el componente cliente anterior).
- En `src/lib/proxy.ts` se agregó `ADMIN_ONLY_ROUTES` con `/dashboard/admin/comite/gestion` y `/dashboard/admin/comite/auditoria`. La verificación se hace antes del chequeo genérico de rutas internas, de modo que `COMITE_VALIDACION` sea redirigido a `/dashboard/admin/comite` y `OPERADOR` a `/dashboard/admin`.
- Se mantuvieron `verifyAuth` en endpoints y layouts como defensa en profundidad.

### Componentes y archivos afectados

- `src/app/dashboard/admin/comite/components/ComiteSubNav.tsx` — recibe prop `rol` y filtra pestañas.
- `src/app/dashboard/admin/comite/page.tsx` — server component, lee rol y pasa a SubNav.
- `src/app/dashboard/admin/comite/auditoria/page.tsx` — server component, lee rol y pasa a SubNav.
- `src/app/dashboard/admin/comite/gestion/page.tsx` — server component, lee rol y pasa a SubNav.
- `src/app/dashboard/admin/comite/gestion/GestionPageClient.tsx` — componente cliente con el contenido de gestión (antes en `page.tsx`).
- `src/lib/proxy.ts` — agrega `ADMIN_ONLY_ROUTES` y redirección por rol.
- `src/proxy.ts` — entrypoint sin cambios.

### Tests y validación

- `npx tsc --noEmit`: OK.
- `npm run lint`: OK (1 warning heredado en `GestionPageClient.tsx` por `useEffect` sin dependencias, preexistente en el archivo original).
- `npm run test`: 79 archivos, 419 tests, todos pasan.
- `rm -rf .next && npm run build`: OK; proxy activo.
- `./scripts/dev-restart.sh`: OK, healthcheck OK, un solo worker.
- Pruebas manuales con curl: `COMITE_VALIDACION` redirigido desde `/gestion` y `/auditoria`; `ADMIN`/`SCHOOL_ADMIN` acceden; SubNav HTML muestra solo "Bandeja" para el comité y 3 pestañas para admin.
- Prueba del flujo de negocio: operador escala un caso → aparece en Pendientes → comité lo toma (ASIGNADA) → comité lo finaliza con `CORREGIR` → solicitud RESUELTA, reporte `CORREGIDO`, desaparece de Mías.

### Migraciones

No requirió migraciones de Prisma.

### Deuda técnica

- Ninguna nueva. El warning de `react-hooks/exhaustive-deps` en `GestionPageClient.tsx` es heredado del archivo original; no se introdujo lógica nueva. No se rediseñó la Bandeja ni el flujo de negocio.

