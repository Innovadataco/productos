# PLAN-035 · Guard de sesión en `/operacion`

## Fases

### F1 · Helper compartido `src/lib/auth/guard-bi-sesion.ts`

```ts
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { sesionDeRequest, type Sesion } from "@/lib/auth/sesion";

// SPEC-035 · guard de sesión BI reutilizable. Extraído para NO duplicar la
// lógica entre /dashboard y /operacion (la duplicación fue la causa de I-33:
// /operacion nació sin guard). Agregar una ruta protegida = una línea.
//
// `rutaBi` es la ruta propia de BI a la que volver tras autenticarse (p.ej.
// "/dashboard" o "/operacion"). Como el llamador conoce su ruta, se hardcodea
// y NO se depende de x-invoke-path (limitación D-029.6).
export async function exigirSesionBi(rutaBi: string): Promise<Sesion> {
    const h = await headers();
    // Request sintético para reutilizar sesionDeRequest sin duplicar la
    // extracción de token (candado 22 · SOLO LECTURA de src/lib/auth).
    const req = new Request("http://internal/", {
        headers: {
            authorization: h.get("authorization") ?? "",
            cookie: h.get("cookie") ?? "",
        },
    });
    const sesion = await sesionDeRequest(req);
    if (!sesion) {
        // SPEC-029 · cierra I-30 · redirect al puente de sesión en PI.
        const pi = process.env.PI_BASE_URL ?? "https://pi.innovadataco.com";
        const bi = process.env.BI_BASE_URL ?? "http://localhost:3001";
        const returnTo = `${bi}${rutaBi}`;
        redirect(
            `${pi}/api/auth/link-bi?returnTo=${encodeURIComponent(returnTo)}`,
        );
    }
    return sesion;
}
```

Nota: `redirect()` es `never`, así que TypeScript estrecha `sesion` a no-null tras el `if`.

### F2 · `src/app/operacion/layout.tsx` (nuevo)

```ts
import { ReactNode } from "react";
import { exigirSesionBi } from "@/lib/auth/guard-bi-sesion";

// SPEC-035 · guard de sesión de /operacion (antes público · I-33).
// Full-page standalone: NO envuelve en BiAppShell · el diseño del tablero
// no cambia. Solo aplica el guard.
export default async function OperacionLayout({
    children,
}: {
    children: ReactNode;
}) {
    await exigirSesionBi("/operacion");
    return <>{children}</>;
}
```

### F3 · `src/app/dashboard/layout.tsx` (refactor a helper)

```ts
import { ReactNode } from "react";
import { exigirSesionBi } from "@/lib/auth/guard-bi-sesion";
import { BiAppShell } from "@/components/bi/layout/BiAppShell";

export default async function DashboardLayout({
    children,
}: {
    children: ReactNode;
}) {
    await exigirSesionBi("/dashboard");
    return <BiAppShell>{children}</BiAppShell>;
}
```

Comportamiento idéntico al de main (returnTo=/dashboard, BiAppShell). El comentario D-029.6 se conserva en el helper.

### F4 · Tests · `tests/unit/bi-operacion-guard.test.tsx`

Patrón: mock de `next/navigation.redirect` (que en runtime lanza; en test lo hacemos lanzar un error identificable) + mock de `next/headers.headers` + mock de `@/lib/auth/sesion.sesionDeRequest`.

- Test 1: `OperacionLayout` sin sesión (`sesionDeRequest`→null) → **redirige** (redirect lanzado). Para el detalle de destino, el returnTo contiene `/operacion` — pero esa aserción de destino es informativa, NO la que protege contra el bug (ver Test 4).
- Test 2: `OperacionLayout` con sesión → NO redirige · devuelve los children.
- Test 3: helper `exigirSesionBi("/x")` sin sesión → redirect; con sesión → devuelve la sesión.
- **Test 4 · REGRESIÓN anti-recurrencia (genérico · ajuste de Fábrica):** para CADA layout de ruta top-level protegida (hoy `dashboard/layout.tsx` y `operacion/layout.tsx`, descubiertos por convención), sin sesión debe **existir un redirect** (redirect lanzado / respuesta 3xx), **NO un 200**. La aserción se ata a "hay redirect", NO al destino ni al `returnTo` ni al host. Así:
  - sobrevive al cambio de guard (SSO → login propio · el destino cambia, el test sigue vigilando lo mismo).
  - si mañana alguien agrega otra ruta top-level protegida sin guard, o quita el guard de una, el test la caza.
  - Implementación: lista de layouts protegidos `["dashboard","operacion"]`; para cada uno, importar su `default`, invocarlo con `sesionDeRequest`→null, y afirmar que lanzó (redirect). Ninguna aserción sobre la URL del redirect.

Para simular `redirect` (que corta el flujo lanzando en runtime): `vi.mock("next/navigation", () => ({ redirect: (u) => { throw new Error("NEXT_REDIRECT:" + u); } }))`. Test 4 solo verifica que se lanzó; Test 1 (informativo) inspecciona el mensaje.

### F5 · Gate local

- `rm -rf .next && npm run build` · `npm run typecheck` · `npx vitest run` · ratchets 4/5.

### F6 · Evidencia §6 (candado 25 · seguridad)

`next build && next start` (NO `next dev`), con `OPERACION_JSON_PATH` al fixture real:

1. `curl -s -o /dev/null -w "%{http_code}" http://localhost:3011/operacion` SIN cookie → **307** (no 200). Pegar salida.
2. `curl -s http://localhost:3011/operacion` SIN cookie `| grep -E "Fábrica|Calidad|Jelkin"` → **cero coincidencias** (el body es el redirect, no el tablero). Pegar salida vacía.
3. CON cookie válida (JWT sub+role) → el tablero igual que ahora, sin regresión. Captura.
4. `curl -sI http://localhost:3011/operacion` SIN cookie → `Location:` con `returnTo=...%2Foperacion` (no `/dashboard`). Pegar el Location.

Las 4 se pegan en el PR / README de evidencia. Sin las 4 no hay CUMPLE.

### F7 · Push + PR

- `git add src/app/operacion/layout.tsx src/lib/auth/guard-bi-sesion.ts src/app/dashboard/layout.tsx tests/unit/bi-operacion-guard.test.tsx .specify/specs/035-guard-operacion/`
- `git commit -m "fix(bi): SPEC-035 guard de sesión en /operacion (estaba público · seguridad)"`
- `git push origin work/bi-SPEC-035-guard-operacion && gh pr create --base main`

---

## Dependencias

- `src/lib/auth/sesion.ts` (`sesionDeRequest`, `Sesion` · SOLO LECTURA).
- `src/app/operacion/page.tsx` (existe · no se toca).
- Mirrorea el patrón `BI_BASE_URL ?? "http://localhost:3001"` de `dashboard/layout.tsx` hoy en main (SPEC-030 congelado, no se usa).

**Bloqueado por:** REVISO de Fábrica antes de PASO 4.

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-30 17:2x COT |
| **Autor** | Dev BI-2 |
