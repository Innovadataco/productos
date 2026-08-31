# PLAN-036 · Login propio de BI

## Fases

### F1 · Extraer `sanitizeReturnTo` a `src/lib/auth/return-to.ts`

`/api/auth/link` se retira; su `sanitizeReturnTo` se necesita en el login. Se mueve a un módulo compartido, agregando `/operacion` a la whitelist (faltaba: se escribió antes de SPEC-033):

```ts
const ALLOW_PREFIXES = ["/dashboard", "/operacion", "/chat", "/api/bi/"];
function biBase(): string {
    return process.env.BI_BASE_URL ?? "http://localhost:3001";
}
export function sanitizeReturnTo(raw: string | null): string {
    if (!raw) return "/dashboard";
    let path = raw;
    try {
        const u = new URL(raw);
        const bi = new URL(biBase());
        if (u.host !== bi.host) return "/dashboard";
        path = u.pathname + u.search;
    } catch { /* relativa */ }
    if (!path.startsWith("/")) return "/dashboard";
    if (!ALLOW_PREFIXES.some((p) => path.startsWith(p))) return "/dashboard";
    return path;
}
```

### F2 · `POST /api/auth/login/route.ts` (nuevo)

```ts
import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { sanitizeReturnTo } from "@/lib/auth/return-to";

const isProd = () => process.env.NODE_ENV === "production";

export async function POST(req: Request): Promise<NextResponse> {
    // Env leídas EN REQUEST TIME (cambiar .env + reiniciar toma efecto sin rebuild).
    const USER = process.env.BI_AUTH_USER;
    const PASS = process.env.BI_AUTH_PASSWORD;
    const secret = process.env.JWT_SECRET;

    // Leer credenciales del body (form-urlencoded o JSON) + returnTo.
    let usuario = "", password = "", returnToRaw: string | null = null;
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
        const b = await req.json().catch(() => ({}));
        usuario = String(b.usuario ?? ""); password = String(b.password ?? "");
        returnToRaw = typeof b.returnTo === "string" ? b.returnTo : null;
    } else {
        const f = await req.formData();
        usuario = String(f.get("usuario") ?? ""); password = String(f.get("password") ?? "");
        const rt = f.get("returnTo"); returnToRaw = typeof rt === "string" ? rt : null;
    }
    const returnTo = sanitizeReturnTo(returnToRaw);

    // Config incompleta o credenciales incorrectas → mismo error, sin decir cuál.
    if (!USER || !PASS || !secret || usuario !== USER || password !== PASS) {
        return NextResponse.redirect(
            new URL(`/login?error=1&returnTo=${encodeURIComponent(returnTo)}`, biBase()),
            302,
        );
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const jwt = await new SignJWT({ sub: USER, role: "ADMIN" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt(nowSec)
        .setExpirationTime(nowSec + 60 * 60 * 24)
        .sign(new TextEncoder().encode(secret));

    const res = NextResponse.redirect(new URL(returnTo, biBase()), 302);
    res.cookies.set({
        name: "session", value: jwt, path: "/",
        httpOnly: true, secure: isProd(), sameSite: "lax", maxAge: 60 * 60 * 24,
    });
    return res;
}
```
Comparación `===` en claro (concesión Jelkin). Error sin distinguir usuario/clave. `biBase()` reusado de `return-to.ts`.

### F3 · `POST /api/auth/logout/route.ts` (nuevo)

```ts
export async function POST(): Promise<NextResponse> {
    const res = NextResponse.redirect(new URL("/login", biBase()), 302);
    res.cookies.set({ name: "session", value: "", path: "/", maxAge: 0 });
    return res;
}
```

### F4 · `src/app/login/page.tsx` (reemplaza el redirect a PI por un form)

Server Component que lee `?returnTo=` y `?error=` de `searchParams` y renderiza un form `<form method="post" action="/api/auth/login">` con `usuario`, `password`, hidden `returnTo`, botón "Entrar". Muestra un mensaje de error genérico si `?error=1`. Línea visual simple de BI (Tailwind del proyecto).

### F5 · `CerrarSesion.tsx` (nuevo · client) + inserción en 3 lugares

```tsx
"use client";
export function CerrarSesion({ className }: { className?: string }) {
    return (
        <form method="post" action="/api/auth/logout">
            <button type="submit" className={className} data-testid="cerrar-sesion">
                Cerrar sesión
            </button>
        </form>
    );
}
```
Insertar en: `BiAppShell` (bajo la sidebar), `BarraOperacion` (en `.bar`), `chat/page.tsx` (en el `<header>`).

### F6 · Guard: `guard-bi-sesion.ts`

Reemplazar el redirect a PI link-bi por:
```ts
if (!sesion) {
    redirect(`/login?returnTo=${encodeURIComponent(rutaBi)}`);
}
```
Ruta relativa · se quitan `pi`/`bi`/link-bi. El helper sigue siendo el único lugar con la lógica de guard.

### F7 · Retirar `/api/auth/link`

`git rm src/app/api/auth/link/route.ts`. Y borrar el test `tests/unit/bi-auth-link-endpoint.test.ts` (prueba el endpoint retirado). El `/login-error` puede quedar (ya no se usa desde link, pero es inocuo) — se documenta; si el ratchet se queja de ruta muerta, se retira también.

### F8 · `.env.bi.example`

Documentar (placeholders, sin valores):
```
# SPEC-036 · login propio de BI (una sola puerta)
BI_AUTH_USER=REEMPLAZAR_CON_USUARIO_ADMIN_BI
BI_AUTH_PASSWORD=REEMPLAZAR_CON_PASSWORD_EN_CLARO_BI
```

### F9 · Tests

`tests/unit/bi-login.test.ts`:
- login ok (user+pass correctos) → 302 + Set-Cookie `session` + Location `returnTo`.
- login mal (pass incorrecta) → 302 a `/login?error=1` SIN cookie.
- config faltante (env vacías) → mismo error, sin cookie.
- returnTo fuera de whitelist → `/dashboard`.
- returnTo `/operacion` → respeta `/operacion`.
- logout → cookie `session` maxAge 0 + Location `/login`.

`tests/unit/bi-operacion-guard.test.tsx` (ajustar): el guard sin sesión ahora redirige a `/login?returnTo=...` (no a PI). El anti-drift genérico ("hay redirect") sigue vigente sin cambios (no está atado al destino · por eso sobrevive). Se ajusta el test informativo de destino a `/login`.

`sanitizeReturnTo`: tests en `bi-return-to.test.ts` (whitelist incluye /operacion, evil host → /dashboard, etc.).

### F10 · Gate local (ESCALONADO con Dev BI-1 · aviso antes del build)

`rm -rf .next && npm run build && npm run typecheck && npm run test:unit && bash scripts/ratchets/run-all.sh`. Antes de `next build`, aviso a Fábrica para coordinar el turno con BI-1. Si el build hace swapear a Ollama en serio → PARO (prioridad PI prod).

### F11 · Evidencia §6 (las 6 de Jelkin · TODAS obligatorias)

`next build && next start` + `OPERACION_JSON_PATH` al fixture + `BI_AUTH_USER`/`BI_AUTH_PASSWORD` de prueba en env:
1. anónimo `/operacion` Y `/dashboard` → ambos 307 a `/login` de BI (no a PI, no 200).
2. anónimo → HTML sin "Fábrica"/"Calidad"/"Jelkin" (grep vacío).
3. login correcto con `returnTo=/operacion` → aterriza en `/operacion` (no siempre `/dashboard`).
4. cambiar `BI_AUTH_PASSWORD` en el env + reiniciar el server → la nueva sirve, la vieja no (SIN deploy · probado local).
5. logout → vuelve a `/login`, `/operacion` deja de abrirse.
6. recargar autenticado → NO re-pide la clave.

### F12 · Push + PR

```
git add src/app/login src/app/api/auth src/lib/auth src/components tests/ .specify/specs/036-* .env.bi.example
git rm src/app/api/auth/link/route.ts
git commit -m "feat(bi): SPEC-036 login propio de BI · retira SSO puente · una sola puerta"
git push origin work/bi-SPEC-036-login-propio && gh pr create --base main
```

---

## Dependencias

- `guard-bi-sesion.ts` (SPEC-035 · se cambia su interior).
- `sesion.ts`/`jwt.ts` (SOLO LECTURA · la cookie que firma el login la lee `sesionDeRequest`/`verifyToken`).
- `jose` (SignJWT · ya presente).
- `sanitizeReturnTo` de `/api/auth/link` (se extrae antes de retirar el endpoint).

**Bloqueado por:** REVISO de Fábrica antes de PASO 4.

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-30 19:1x COT |
| **Autor** | Dev BI-2 |
