# PLAN-029 · Puente sesión PI ↔ BI

## Fases

### F1 · Endpoint `GET /api/auth/link`

Archivo nuevo: `src/app/api/auth/link/route.ts`.

```ts
import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { verifyToken } from "@/lib/auth/jwt";

const ALLOW_PREFIXES = ["/dashboard", "/chat", "/api/bi/"];
const isProd = process.env.NODE_ENV === "production";

function sanitizeReturnTo(raw: string | null): string {
    if (!raw) return "/dashboard";
    let path = raw;
    // Absoluta contra BI_BASE_URL → extraer pathname
    try {
        const u = new URL(raw);
        const bi = new URL(process.env.BI_BASE_URL ?? "http://localhost:3001");
        if (u.host !== bi.host) return "/dashboard";
        path = u.pathname + u.search;
    } catch {
        // no es URL absoluta · tratamos como relativa
    }
    if (!path.startsWith("/")) return "/dashboard";
    if (!ALLOW_PREFIXES.some((p) => path.startsWith(p))) return "/dashboard";
    return path;
}

function errRedirect(reason: string): NextResponse {
    return NextResponse.redirect(
        new URL(`/login-error?reason=${reason}`, process.env.BI_BASE_URL ?? "http://localhost:3001"),
        302,
    );
}

export async function GET(req: Request): Promise<NextResponse> {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const returnTo = sanitizeReturnTo(url.searchParams.get("returnTo"));

    if (!token) return errRedirect("invalid_token");

    const payload = await verifyToken(token);
    if (!payload) return errRedirect("invalid_token");
    if (payload.linkTo !== "bi") return errRedirect("bad_claim");
    // jose ya valida exp; check redundante defensivo
    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
        return errRedirect("expired");
    }
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    const role = typeof payload.role === "string" ? payload.role : null;
    if (!sub || !role) return errRedirect("bad_claim");

    const secret = process.env.JWT_SECRET;
    if (!secret) return errRedirect("invalid_token");

    // Nuevo JWT para la cookie session: mismo sub/role/email, sin linkTo, TTL 24h
    const nowSec = Math.floor(Date.now() / 1000);
    const sessionJwt = await new SignJWT({
        sub,
        role,
        ...(typeof payload.email === "string" ? { email: payload.email } : {}),
    })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt(nowSec)
        .setExpirationTime(nowSec + 60 * 60 * 24)
        .sign(new TextEncoder().encode(secret));

    const res = NextResponse.redirect(
        new URL(returnTo, process.env.BI_BASE_URL ?? "http://localhost:3001"),
        302,
    );
    res.cookies.set({
        name: "session",
        value: sessionJwt,
        path: "/",
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        maxAge: 60 * 60 * 24,
    });
    return res;
}
```

Reutiliza `verifyToken` (candado 22 · SOLO LECTURA). Firma con `SignJWT` de `jose` (misma librería ya presente).

### F2 · Página `/login-error`

Archivo nuevo: `src/app/login-error/page.tsx` (ver shape en spec.md §"Página `/login-error`"). Sin auth guard (debe ser accesible sin sesión), sin datos externos.

### F3 · Modificar guard SPEC-024

`src/app/dashboard/layout.tsx` (heredado del merge de SPEC-024) cambia:

```diff
- if (!sesion) redirect("/login");
+ if (!sesion) {
+   const pi = process.env.PI_BASE_URL ?? "https://pi.innovadataco.com";
+   const bi = process.env.BI_BASE_URL ?? "http://localhost:3001";
+   const current = h.get("x-invoke-path") ?? "/dashboard";
+   const returnTo = `${bi}${current}`;
+   redirect(`${pi}/api/auth/link-bi?returnTo=${encodeURIComponent(returnTo)}`);
+ }
```

Fábrica investiga en implementación si `x-invoke-path` es la fuente adecuada; fallback fijo a `/dashboard` mantiene el comportamiento seguro.

### F4 · `.env.bi.example` documentación

Añadir bloque:

```
# Puente de sesión PI↔BI (SPEC-029 · cierra I-30)
# BI_BASE_URL lo usa PI para redirigir hacia /api/auth/link.
# En prod: https://bi.innovadataco.com · en dev: http://localhost:3001.
BI_BASE_URL=https://bi.innovadataco.com
# JWT_SECRET DEBE coincidir con el de PI (env compartido) para que el
# handoff verifique. Configurar en .env.bi.production; NUNCA en git.
```

### F5 · Tests unitarios

`tests/unit/bi-auth-link-endpoint.test.ts`:
- Test 1: sin `token` → 302 a `/login-error?reason=invalid_token`.
- Test 2: token con firma inválida → invalid_token.
- Test 3: token válido pero `linkTo !== "bi"` → bad_claim.
- Test 4: token válido sin `sub` o sin `role` → bad_claim.
- Test 5: token válido completo → 302 a `/dashboard` (default `returnTo`) + cookie `session` seteada con atributos correctos.
- Test 6: `returnTo=/dashboard/foo` → 302 a `/dashboard/foo`.
- Test 7: `returnTo=https://evil.com/x` → ignorado, 302 a `/dashboard`.
- Test 8: `returnTo=/etc/passwd` (fuera whitelist) → ignorado, 302 a `/dashboard`.

Cada test firma un JWT local con `SignJWT` + `JWT_SECRET=test-secret-solo-para-vitest` (fixture) para probar el flujo real de verificación.

`tests/unit/bi-login-error-page.test.tsx`:
- Test 1: sin `?reason` → mensaje genérico.
- Test 2: `?reason=expired` → mensaje mapeado "caducó".

### F6 · Gate local

- `rm -rf .next && npm run build` verde.
- `npm run typecheck` verde.
- `npx vitest run` verde (incluye los 10 tests nuevos).
- `bash scripts/ratchets/{cero-sql-raw,cero-secretos,imports-llm-solo-motor,no-additional-properties-true}.sh` verdes.
- Prueba manual con curl:
  ```bash
  # Firmar un JWT ephemeral local
  TOKEN=$(node -e "const {SignJWT}=require('jose');(async()=>{
    const s=new TextEncoder().encode(process.env.JWT_SECRET);
    const t=await new SignJWT({sub:'u1',role:'ADMIN',linkTo:'bi'})
      .setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('60s').sign(s);
    console.log(t);
  })()")
  curl -sI "http://localhost:3011/api/auth/link?token=$TOKEN&returnTo=/dashboard"
  # → 302 + Set-Cookie: session=<jwt-24h>; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400
  ```

### F7 · Push (único · PR nuevo)

- `git add src/app/api/auth/link src/app/login-error src/app/dashboard/layout.tsx .env.bi.example tests/unit/bi-auth-link-endpoint.test.ts tests/unit/bi-login-error-page.test.tsx .specify/specs/029-puente-sesion-link/`
- `git commit -m "feat(bi): SPEC-029 endpoint /api/auth/link + guard redirige a PI link-bi (fix I-30)"`
- `git push origin work/bi-SPEC-029-puente-sesion`

---

## Dependencias

- **`src/lib/auth/jwt.ts`** (SOLO LECTURA · `verifyToken` reutilizado).
- **`src/lib/auth/sesion.ts`** (SOLO LECTURA · lee cookie `session` · lo que este SPEC setea calza).
- **`src/app/dashboard/layout.tsx`** (SPEC-024 · se modifica el guard). Requiere que SPEC-024 esté mergeado a `main` o hacer merge de esa rama al worktree antes de implementar (SPEC-024 CUMPLE al momento de radicar este spec · a la espera de que llegue a `main`).
- **SPEC-PI paralelo** (Brief A-52 §3-PI · `/api/auth/link-bi` en PI). No bloquea escritura de spec/plan/tests aquí; sí bloquea la verificación E2E hasta que ambos estén desplegados. Deploy ordenado (Brief §4): PI primero, BI segundo.

**Bloqueado por:** REVISO de Fábrica antes de PASO 4 (compuerta real esta vez).

---

## Artefactos producidos

- `src/app/api/auth/link/route.ts`
- `src/app/login-error/page.tsx`
- `src/app/dashboard/layout.tsx` (modificado)
- `.env.bi.example` (modificado)
- `tests/unit/bi-auth-link-endpoint.test.ts`
- `tests/unit/bi-login-error-page.test.tsx`

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-29 21:3x COT |
| **Autor** | Dev BI-2 |
