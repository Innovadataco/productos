# PLAN-030 · Endurecer resolución de BI_BASE_URL

## Fases

### F1 · Helper `src/lib/bi/base-url.ts`

```ts
// SPEC-030 · resolución endurecida del host base de BI.
// En producción NUNCA devuelve una URL localhost en silencio.

type HeaderSource = { get(name: string): string | null };

function stripTrailingSlash(u: string): string {
    return u.endsWith("/") ? u.slice(0, -1) : u;
}

export function resolveBiBaseUrl(h: HeaderSource): string {
    // Nivel 1 · proxy real (Cloudflare Tunnel en prod).
    // x-forwarded-host y x-forwarded-proto SÍ llegan al Server Component
    // (evidencia empírica D-029.6 · next build && next start + curl).
    const fwdHost = h.get("x-forwarded-host");
    const fwdProto = h.get("x-forwarded-proto");
    if (fwdHost && fwdProto) {
        // x-forwarded-proto puede venir como lista "https,http" tras varios
        // proxies; tomamos el primero.
        const proto = fwdProto.split(",")[0]?.trim() || "https";
        const host = fwdHost.split(",")[0]?.trim();
        if (host) return stripTrailingSlash(`${proto}://${host}`);
    }

    // Nivel 2 · configuración explícita.
    const env = process.env.BI_BASE_URL;
    if (env && env.trim().length > 0) return stripTrailingSlash(env.trim());

    // Nivel 3 · fallo visible en producción · localhost solo en dev.
    if (process.env.NODE_ENV === "production") {
        throw new Error(
            "[SPEC-030] BI_BASE_URL no resuelto: falta x-forwarded-host/proto y BI_BASE_URL en producción",
        );
    }
    return "http://localhost:3001";
}
```

### F2 · Aplicar en `src/app/dashboard/layout.tsx`

- `const h = await headers()` ya existe.
- Reemplazar `const bi = process.env.BI_BASE_URL ?? "http://localhost:3001";` por
  `const bi = resolveBiBaseUrl(h);`.
- Import `import { resolveBiBaseUrl } from "@/lib/bi/base-url";`.
- El comentario D-029.6 sobre sub-rutas se conserva (returnTo sigue `${bi}/dashboard`).
- `PI_BASE_URL` NO cambia (fuera de alcance · es host de PI, no de BI · y SPEC-313 ya lo endureció del lado emisor).

### F3 · Aplicar en `src/app/api/auth/link/route.ts`

- Eliminar el helper local `const biBase = () => ...`.
- Al inicio de `GET(req)`: `const biBase = resolveBiBaseUrl(req.headers);` (una vez, valor string).
- `sanitizeReturnTo` y `errRedirect` reciben `biBase` como parámetro en vez de llamar la función local:
  ```ts
  function sanitizeReturnTo(raw: string | null, biBase: string): string { ... }
  function errRedirect(reason: string, biBase: string): NextResponse { ... }
  ```
- `isProd()` se mantiene (es el `secure` de la cookie, no relacionado con base-url).
- Nota: si `resolveBiBaseUrl(req.headers)` lanza en prod (mala config), el handler responde 500 — aceptable (mala infra, no input de usuario).

### F4 · Tests unitarios · `tests/unit/bi-base-url.test.ts`

`// @vitest-environment node` (no necesita jsdom).

Helper de test para fabricar un HeaderSource:
```ts
function hdrs(map: Record<string, string>): { get(n: string): string | null } {
    return { get: (n) => map[n.toLowerCase()] ?? null };
}
```

- Test 1: con `x-forwarded-host` + `x-forwarded-proto` → usa `${proto}://${host}` (Nivel 1 gana aunque haya env).
- Test 2: `x-forwarded-proto` como lista `"https,http"` → toma `https`.
- Test 3: sin forwarded headers, con `BI_BASE_URL` env → usa el env (Nivel 2).
- Test 4: sin forwarded, sin env, `NODE_ENV=production` → **throw** con mensaje `[SPEC-030]`.
- Test 5: sin forwarded, sin env, `NODE_ENV=development` → `http://localhost:3001` (dev OK).
- Test 6: trailing slash en env `https://bi.x/` → normalizado sin slash.
- Test 7 (regresión clave): `NODE_ENV=production` + solo `x-forwarded-host/proto` de un host público → el resultado NO matchea `/localhost|127\.0\.0\.1|0\.0\.0\.0/`.
- Test 8 (regresión): `NODE_ENV=production` sin nada → el throw evita devolver localhost (verificar que NO retorna string localhost, sí lanza).

Ampliar `tests/unit/bi-auth-link-endpoint.test.ts` (ya existe · 9 tests) si es necesario, pero como el endpoint usa `req.headers` sin forwarded en los tests actuales, se apoya en el env `BI_BASE_URL=http://localhost:3001` que ya setean — sigue verde. Se agrega 1 test: con `x-forwarded-host` en el request, el redirect usa ese host.

### F5 · Gate local

- `rm -rf .next && npm run build` verde.
- `npm run typecheck` verde.
- `npx vitest run` verde (nuevos + existentes · 128+ tests).
- `bash scripts/ratchets/{cero-sql-raw,cero-secretos,imports-llm-solo-motor,no-additional-properties-true}.sh` verdes.
- Prueba con curl `next build && next start`:
  - `NODE_ENV=production` sin `BI_BASE_URL`, request con `X-Forwarded-Host: bi.innovadataco.com` + `X-Forwarded-Proto: https` → redirect usa `https://bi.innovadataco.com`, NO localhost.
  - Confirmar que un `/dashboard` sin cookie ni forwarded headers en prod da 500 (no un redirect a localhost).

### F6 · Push

- `git add src/lib/bi/base-url.ts src/app/dashboard/layout.tsx src/app/api/auth/link/route.ts tests/unit/bi-base-url.test.ts tests/unit/bi-auth-link-endpoint.test.ts .specify/specs/030-endurecer-base-url/`
- `git commit -m "fix(bi): SPEC-030 endurece resolución de BI_BASE_URL · sin fallback silencioso a localhost"`
- `git push origin work/bi-SPEC-030-endurecer-base-url`

---

## Dependencias

- `src/app/dashboard/layout.tsx` (SPEC-029 · se modifica solo la línea de `bi`).
- `src/app/api/auth/link/route.ts` (SPEC-029 · se modifica `biBase`).
- Ninguna otra. `sesionDeRequest`, `jwt.ts` NO se tocan (candado 22).

**Bloqueado por:** REVISO de Fábrica antes de PASO 4.

---

## Artefactos producidos

- `src/lib/bi/base-url.ts` (nuevo)
- `src/app/dashboard/layout.tsx` (modificado)
- `src/app/api/auth/link/route.ts` (modificado)
- `tests/unit/bi-base-url.test.ts` (nuevo)
- `tests/unit/bi-auth-link-endpoint.test.ts` (+1 test)

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-29 23:5x COT |
| **Autor** | Dev BI-2 |
