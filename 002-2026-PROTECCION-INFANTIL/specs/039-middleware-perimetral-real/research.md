# Research — Spec 039: Middleware perimetral real

## Hallazgos

### Causa raíz verificada: el guard perimetral nunca corrió como middleware de Next.js

- **No existe `src/middleware.ts`**. Next.js App Router solo ejecuta automáticamente un archivo llamado `middleware.ts` (o `src/middleware.ts`) que exporte una función `middleware` (o export default). Ver documentación oficial de Next.js: Middleware file convention.
- **La lógica vive en `src/lib/proxy.ts`**, que exporta una función llamada `proxy` (`export async function proxy(...)`). Ese nombre de export no es reconocido por Next.js como middleware.
- **Hay un shim `src/proxy.ts`** que importa y re-exporta `proxy` desde `src/lib/proxy.ts`, junto con `config`. El archivo está correctamente ubicado, pero el export es `{ proxy }` en lugar de `middleware`, por lo que Next.js no lo ejecuta.
- **Prueba de no-ejecución**: al acceder sin sesión a `/dashboard/admin`, la redirección a `/login` proviene del layout `src/app/dashboard/admin/layout.tsx` (render del servidor), no del middleware. Esto se puede verificar porque una petición directa a una ruta que no tenga layout (por ejemplo, una ruta protegida sin layout admin) no sería interceptada.
- **No es una limitación de Next.js 16**: el runtime edge soporta `src/middleware.ts` con export `middleware` o `default`. El código actual es edge-safe (usa `jose` y solo `Headers`/`Cookies`/`NextResponse`), así que no hay impedimento técnico.

### Inventario de archivos duplicados/divergentes

1. **`src/lib/proxy.ts`** (lógica principal)
   - Exporta `proxy(request: NextRequest)`.
   - Contiene `PUBLIC_ROUTES`, `USER_FINAL_ROUTES`, `verifyToken`, `redirectToLogin`, `esRolInterno`, `homeForRole`.
   - Incluye `COMITE_VALIDACION` como rol interno.
   - Define `proxyConfig` (no usado por Next.js).
   - Ruta pública de apelaciones: `/api/apelaciones` (después del rename del spec 036).

2. **`src/proxy.ts`** (shim/intento de entrypoint)
   - Re-exporta `proxy` desde `src/lib/proxy.ts`.
   - Exporta `config` con matcher correcto.
   - Problema: exporta `{ proxy }` en lugar de `middleware` o `default`.

### Estado de las protecciones actuales

- **Protección real hoy**: los layouts de admin (`src/app/dashboard/admin/layout.tsx`) y los `verifyAuth` en endpoints hacen la validación, pero solo después de que la petición llega al handler/layout. No hay interceptor perimetral.
- **Riesgo**: una ruta protegida sin layout o un asset dinámico no sería interceptado. Además, el comportamiento depende de que cada página/layout tenga su propia guardia.

## Referencias

- `src/proxy.ts`
- `src/lib/proxy.ts`
- `src/app/dashboard/admin/layout.tsx`
- `src/lib/auth.ts`
- Documentación de Next.js: Middleware file convention (`src/middleware.ts` o `middleware.ts` con export `middleware`).
