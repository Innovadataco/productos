# Research — Spec 039: Middleware perimetral real

## Hallazgos

### Causa raíz verificada: el guard perimetral nunca corrió como middleware de Next.js

- **El archivo `src/middleware.ts` no es la convención correcta en este proyecto**. Next.js 16.2.10 (versión instalada en el repo) deprecó el archivo `middleware.ts` y la función `middleware`. El build lo confirmó con el error:
  - `middleware file convention deprecated; please use proxy instead`
  - `Next.js can't recognize the exported 'config' field`
- **La convención válida en Next.js 16 es `src/proxy.ts`** que exporte una función llamada `proxy` junto con un objeto `config` (matcher). El build solo reconoce el middleware cuando se usa `src/proxy.ts` con `export { proxy }` y `export const config`.
- **La lógica vive en `src/lib/proxy.ts`**, que exporta `proxy(request: NextRequest)`. Contiene `PUBLIC_ROUTES`, `USER_FINAL_ROUTES`, `verifyToken`, `redirectToLogin`, `esRolInterno`, `homeForRole` e incluye `COMITE_VALIDACION` en `INTERNAL_ROLES`. El código es edge-safe (usa `jose` y solo APIs de runtime edge).
- **`src/proxy.ts` actúa como entrypoint**. Importa `proxy` de `src/lib/proxy.ts` y exporta `{ proxy }` más `config` con el matcher. Con esta convención, Next.js 16 ejecuta el guard perimetral y se observa `"ƒ Proxy (Middleware)"` en el arranque.
- **No hay duplicación funcional**: `src/lib/proxy.ts` es la fuente de verdad de la lógica; `src/proxy.ts` es el adaptador de convención requerido por Next.js 16.
- **Prueba de ejecución**: una petición sin sesión a `/api/admin/nonexistent-route` devuelve `401 { "error": { "message": "No autenticado" } }`, respuesta que solo puede provenir del proxy. Una petición sin sesión a `/dashboard/admin` devuelve `307` a `/login`. Los 5 roles acceden a sus rutas permitidas y son redirigidos en las rutas prohibidas.

### Inventario de archivos

1. **`src/lib/proxy.ts`** (lógica principal)
   - Exporta `proxy(request: NextRequest)`.
   - Contiene `PUBLIC_ROUTES`, `USER_FINAL_ROUTES`, `verifyToken`, `redirectToLogin`, `esRolInterno`, `homeForRole`.
   - Incluye `COMITE_VALIDACION` como rol interno.
   - Define `proxyConfig` (respaldo, no requerido si `src/proxy.ts` exporta su propio `config`).
   - Ruta pública de apelaciones: `/api/apelaciones` (después del rename del spec 036).

2. **`src/proxy.ts`** (entrypoint de convención Next.js 16)
   - Re-exporta `proxy` desde `src/lib/proxy.ts`.
   - Exporta `config` con matcher correcto.
   - El export debe ser `{ proxy }` para que Next.js 16 lo reconozca como middleware perimetral.

### Estado de las protecciones actuales

- **Protección perimetral real**: `src/proxy.ts` intercepta peticiones antes de que lleguen a handlers o layouts, verifica la sesión por cookie y redirige/responde según la ruta y el rol.
- **Defensa en profundidad**: los layouts de admin (`src/app/dashboard/admin/layout.tsx`) y los `verifyAuth` en endpoints siguen validando, pero ahora cuentan con un interceptor previo.
- **Riesgo residual**: un matcher demasiado amplio podría bloquear rutas públicas o estáticas. El matcher actual excluye `/_next/static`, `/_next/image`, `favicon.ico` y archivos con extensión.

## Referencias

- `src/proxy.ts`
- `src/lib/proxy.ts`
- `src/app/dashboard/admin/layout.tsx`
- `src/lib/auth.ts`
- Next.js 16 output de build: `middleware file convention deprecated; please use proxy instead`
