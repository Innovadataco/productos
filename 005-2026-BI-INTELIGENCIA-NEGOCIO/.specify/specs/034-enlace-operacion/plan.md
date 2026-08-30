# PLAN-034 · Enlace a `/operacion` en la sidebar

## Fases

### F1 · Insertar la entrada en `BiSideNav.tsx`

En el array `SECTIONS`, insertar como primer elemento:
```ts
const SECTIONS: Section[] = [
    { label: "Operación", href: "/operacion", emoji: "🧭" },   // SPEC-034 · nueva · primera
    { label: "Home", href: "/dashboard", emoji: "🏠" },
    { label: "Dashboards", href: "/dashboard/dashboards", emoji: "📊" },
    { label: "Chat NL→SQL", href: "/chat", emoji: "💬" },
    { label: "Configuración", href: "/dashboard/configuracion", emoji: "⚙️" },
];
```
Nada más del archivo cambia (el `.map`, el estado activo, todo se mantiene).

### F2 · Test

`tests/unit/bi-sidenav-operacion.test.tsx`:
- Mock de `next/navigation` (`usePathname` → `/operacion`) como en `bi-layout-sidebar.test.tsx`.
- Test 1: render de `BiSideNav` → existe un link con `href="/operacion"` y texto "Operación", y está **primero** (antes de "Home").
- Test 2: cuando `pathname==="/operacion"`, esa entrada tiene `aria-current="page"`.
- Test 3 (destino real): `existsSync(".../src/app/operacion/page.tsx") === true` (comprobación de FS · el enlace no lleva a un 404).
- **No** se agrega la aserción "todos los ítems resuelven" (defecto congelado · fuera de alcance).

### F3 · Gate local

- `rm -rf .next && npm run build` · `npm run typecheck` · `npx vitest run` · ratchets 4/5.

### F4 · Evidencia §6 (candado 25)

`next build && next start` (NO `next dev`), autenticado (cookie `session` de prueba con el mismo `JWT_SECRET`, como en SPEC-029/033):
- **(a)** captura de la sidebar con "Operación" visible y **primera** de la lista.
- **(b)** click en la entrada → captura de que aterriza en `/operacion` con el tablero renderizado (fixture real vía `OPERACION_JSON_PATH`).

Playwright + Chromium local para las capturas. Para ver la sidebar hace falta estar en `/dashboard` autenticado; genero un JWT de sesión local (mismo patrón que la evidencia de SPEC-029) y navego `/dashboard` → click en Operación → `/operacion`.

### F5 · Push + PR

- `git add src/components/bi/layout/BiSideNav.tsx tests/unit/bi-sidenav-operacion.test.tsx .specify/specs/034-enlace-operacion/`
- `git commit -m "feat(bi): SPEC-034 enlace a /operacion en la sidebar"`
- `git push origin work/bi-SPEC-034-enlace-operacion && gh pr create --base main`

---

## Dependencias

- `/operacion` en `main` (vía #173) · verificado.
- Nada más. Solo `BiSideNav.tsx` + test + spec.

**Bloqueado por:** REVISO de Fábrica antes de PASO 4.

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-30 17:1x COT |
| **Autor** | Dev BI-2 |
