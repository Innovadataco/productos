# PLAN-024 · Layout + Sidebar navegación

## Fases

### F1 · Componentes base (sidebar + shell)

Archivos nuevos, ninguno reescribe código existente:

1. `src/components/bi/layout/BiSideNav.tsx` (Client Component · usa `usePathname()` de `next/navigation` para el estado activo).
   - Recibe `sections: { label, href, emoji }[]` como constante local (cerrada · no importa nada de `/lib/bi`).
   - Renderiza `<nav aria-label="Navegación BI">` con `<ul>` de 4 `<li>` · cada uno con `<Link>` + emoji + label.
   - Estado activo: `pathname === href` → clase `bg-primary/10 text-primary font-semibold` + `aria-current="page"`.

2. `src/components/bi/layout/BiAppShell.tsx` (Server Component · sin `"use client"`).
   - `<div className="grid grid-cols-[240px_1fr] min-h-screen">`.
   - `<aside className="border-r border-slate-200 bg-white/80">` con `<BiSideNav />` fijo en top.
   - `<main className="p-6">{children}</main>`.
   - Mobile (< md): sidebar colapsa a header con `<details>` — implementación mínima con Tailwind, sin librería nueva.

### F2 · Segment `/dashboard` con guardia JWT

3. `src/app/dashboard/layout.tsx` (Server Component).
   ```ts
   import { redirect } from "next/navigation";
   import { headers } from "next/headers";
   import { sesionDeRequest } from "@/lib/auth/sesion";
   import { BiAppShell } from "@/components/bi/layout/BiAppShell";

   export default async function DashboardLayout({ children }) {
     const h = await headers();
     // Fabricamos un Request-like para sesionDeRequest sin duplicar lógica.
     const req = new Request("http://internal/", {
       headers: { authorization: h.get("authorization") ?? "", cookie: h.get("cookie") ?? "" },
     });
     const sesion = await sesionDeRequest(req);
     if (!sesion) redirect("/login");
     return <BiAppShell>{children}</BiAppShell>;
   }
   ```
   Reutiliza `sesionDeRequest` sin modificarlo (candado 22 · SOLO LECTURA).

4. `src/app/dashboard/page.tsx` (Server Component simple).
   - `<section className="space-y-6"><h1>Home BI</h1><p className="text-muted">KPIs y estado se muestran en SPEC-025 y SPEC-027.</p></section>`.
   - Sin lógica; solo esqueleto para que Jelkin vea el layout funcionando.

### F3 · Reemplazar landing por redirect

5. `src/app/page.tsx` reemplazado por:
   ```ts
   import { redirect } from "next/navigation";
   export default function RootPage() {
     redirect("/dashboard");
   }
   ```

### F4 · Tests unitarios

6. `tests/unit/bi-layout-sidebar.test.tsx` (Vitest + Testing Library, ya configurado en el repo · ver `bi-chat-componentes.test.tsx` como referencia).
   - Test 1: `BiSideNav` renderiza las 4 secciones con sus emojis y labels correctos.
   - Test 2: `BiSideNav` marca `aria-current="page"` en la entrada cuyo `href === pathname`.
   - Test 3: mock de `next/navigation` para simular pathname `/chat` → entrada "Chat NL→SQL" activa.
   - Test 4: `BiAppShell` renderiza sidebar + main con los children.

7. `tests/unit/bi-dashboard-page.test.tsx`.
   - Test 1: `DashboardHomePage` renderiza el título "Home BI" y el mensaje placeholder.

Nota: no se agrega test de `DashboardLayout` porque es Server Component con `redirect()` y `headers()` de Next.js; su comportamiento se cubre en el gate local (Fase F5) inspeccionando el HTTP.

### F5 · Gate local

- `rm -rf .next && npm run build` (must pass).
- `npm run typecheck`.
- `npm run test:unit` (los 5 tests nuevos + 100% de los existentes verdes).
- `bash scripts/ratchets/run-all.sh` (los ratchets que sí corren en Dev BI-2 · mv-schema-check puede SKIP como en SPECs anteriores).
- Prueba HTTP manual local: `npm run dev` → `curl -I http://localhost:3001/` responde 307 a `/dashboard`; `curl -I http://localhost:3001/dashboard/` sin cookie responde 307 a `/login`.

### F6 · Push único (PASO 6 del INSTRUCTIVO)

- `git add src/app/dashboard src/app/page.tsx src/components/bi/layout tests/unit/bi-layout-sidebar.test.tsx tests/unit/bi-dashboard-page.test.tsx .specify/specs/024-layout-sidebar/`
- `git commit -m "feat(bi): SPEC-024 layout + sidebar navegación"`
- `git push origin work/bi-SPEC-024-layout-sidebar`

---

## Dependencias

- `src/lib/auth/sesion.ts` (SOLO LECTURA · usado por `DashboardLayout`).
- `src/app/login/page.tsx` (SOLO LECTURA · destino del redirect).
- `src/app/globals.css` (SOLO LECTURA · tokens Tailwind existentes).

**Bloquea:** ninguno directo. **Bloqueado por:** REVISO de Fábrica antes de PASO 4.

---

## Artefactos producidos

- `src/components/bi/layout/BiSideNav.tsx`
- `src/components/bi/layout/BiAppShell.tsx`
- `src/app/dashboard/layout.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/page.tsx` (reemplazado)
- `tests/unit/bi-layout-sidebar.test.tsx`
- `tests/unit/bi-dashboard-page.test.tsx`

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-29 20:4x COT |
| **Autor** | Dev BI-2 |
