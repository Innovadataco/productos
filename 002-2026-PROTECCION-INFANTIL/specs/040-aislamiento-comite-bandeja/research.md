# Research — Spec 040: Aislamiento del comité a su Bandeja

## Hallazgos

### Causa raíz verificada: el comité ve pestañas que no le corresponden

- **`ComiteSubNav` hardcodea las 3 pestañas**. En `src/app/dashboard/admin/comite/components/ComiteSubNav.tsx` (líneas 6-10) las rutas `Bandeja`, `Gestión` y `Auditoría` están en un array constante sin filtrar por rol. El componente renderiza las 3 pestañas para cualquier usuario que llegue al módulo Comité.
- **Gestión es funcionalidad de ADMIN/SCHOOL_ADMIN**. La página `src/app/dashboard/admin/comite/gestion/page.tsx` permite crear la cuenta del comité, regenerar contraseñas, reenviar email y gestionar integrantes. No tiene guard server-side: el componente carga directamente y ejecuta fetches a `/api/admin/operadores` y `/api/admin/comite/integrantes`. El backend sí rechaza a `COMITE_VALIDACION` con "Permisos insuficientes", pero la UI se muestra.
- **Auditoría muestra UI aunque sus datos están protegidos**. La página `src/app/dashboard/admin/comite/auditoria/page.tsx` monta `AuditLogViewer` con `COMITE_AUDIT_ACTIONS`. El endpoint subyacente `/api/admin/audit-logs` es admin-only (`verifyAuth` con `ADMIN`), pero la pestaña y el contenedor se renderizan para el comité, generando una experiencia rota (pantalla con título y componente que probablemente no carga datos).
- **El rol del comité es "último eslabón"**. El spec 024 definió al comité como un empleado que solo trabaja casos escalados: revisa y finaliza. No administra la cuenta del comité, no gestiona integrantes y no audita.
- **El proxy perimetral puede proteger estas sub-rutas**. `src/lib/proxy.ts` ya distingue roles internos (`ADMIN`, `SCHOOL_ADMIN`, `OPERADOR`, `COMITE_VALIDACION`) y rutas internas. Para restringir `/dashboard/admin/comite/gestion` y `/auditoria` a solo `ADMIN`/`SCHOOL_ADMIN`, basta con agregar una lógica adicional en el proxy (o en un helper) que redirija a `COMITE_VALIDACION` a su home de comité. El matcher de `src/proxy.ts` ya cubre `/dashboard/admin/*`, así que no requiere cambiar el matcher.

### Inventario de archivos y protecciones actuales

1. **`src/app/dashboard/admin/comite/components/ComiteSubNav.tsx`**
   - Componente cliente ("use client").
   - Array `tabs` hardcodeado: Bandeja, Gestión, Auditoría.
   - No recibe prop de rol ni consulta sesión.
   - Usa `usePathname` para resaltar la pestaña activa.

2. **`src/app/dashboard/admin/comite/page.tsx`**
   - Renderiza `ComiteBandeja` + `ComiteSubNav`.
   - No hay guard server-side propio; el layout admin (`src/app/dashboard/admin/layout.tsx`) ya verifica `ADMIN_ROLES`.

3. **`src/app/dashboard/admin/comite/gestion/page.tsx`**
   - Cliente.
   - Carga cuenta del comité e integrantes vía fetch.
   - Sin guard server-side; depende del backend para rechazar.
   - Debe volverse admin-only a nivel de proxy.

4. **`src/app/dashboard/admin/comite/auditoria/page.tsx`**
   - Renderiza `AuditLogViewer` con `COMITE_AUDIT_ACTIONS`.
   - Sin guard server-side; el endpoint de datos es admin-only.
   - Debe volverse admin-only a nivel de proxy.

5. **`src/lib/proxy.ts`**
   - Define `INTERNAL_ROLES` (`ADMIN`, `SCHOOL_ADMIN`, `OPERADOR`, `COMITE_VALIDACION`).
   - Función `homeForRole(rol)` devuelve `/dashboard/admin/comite` para `COMITE_VALIDACION`.
   - `isInternalRoute` es cualquier ruta que empiece con `/dashboard/admin` o `/api/admin`.
   - No tiene concepto de sub-rutas admin-only dentro de `/dashboard/admin`.

6. **`src/app/dashboard/admin/layout.tsx`**
   - Verifica cookie, verifica token y revisa `ADMIN_ROLES`.
   - Pasa `rol` a `AdminNav`.
   - Podría pasar el rol a `children` mediante contexto, pero lo más simple es que `ComiteSubNav` obtenga el rol por prop desde una página server o por `/api/me`.

### Opciones para pasar el rol a `ComiteSubNav`

- **Opción A (recomendada en plan)**: Convertir `ComiteSubNav` en un componente que recibe `rol` como prop. Las páginas (`page.tsx`) de `comite`, `comite/gestion` y `comite/auditoria` son server components; pueden leer el rol del layout (o re-verificar el token) y pasarlo como prop. Mantiene la lógica de control de acceso en el server.
- **Opción B**: Usar `/api/me` desde el cliente. Más sencillo pero introduce un fetch adicional y posible parpadeo de pestañas. Menos recomendable para control de UI.
- **Opción C**: Usar un contexto de autenticación. Requiere envolver el layout admin; es más invasivo. No se propone para este spec acotado.

### Estado de las protecciones actuales

- **Layout admin**: protege `/dashboard/admin/*` contra roles no internos.
- **Proxy**: protege `/dashboard/admin/*` y `/api/admin/*` contra roles no internos.
- **Backend**: `/api/admin/audit-logs` y `/api/admin/operadores` requieren `ADMIN`/`SCHOOL_ADMIN`.
- **Gap**: no hay filtro de UI por rol dentro de `ComiteSubNav`, ni protección perimetral de sub-rutas específicas del comité contra el propio rol comité.

## Referencias

- `src/app/dashboard/admin/comite/components/ComiteSubNav.tsx`
- `src/app/dashboard/admin/comite/page.tsx`
- `src/app/dashboard/admin/comite/gestion/page.tsx`
- `src/app/dashboard/admin/comite/auditoria/page.tsx`
- `src/app/dashboard/admin/layout.tsx`
- `src/lib/proxy.ts`
- `src/lib/auth.ts`
- `src/lib/audit-actions.ts`
- Spec 024 (Comité de Validación)
- Spec 039 (Middleware perimetral real)
