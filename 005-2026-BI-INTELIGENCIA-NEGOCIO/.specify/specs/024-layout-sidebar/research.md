# RESEARCH-024 · Layout + Sidebar navegación

## Estado actual del frontend (verificado 2026-08-29 20:4x COT)

### `src/app/page.tsx` (10 líneas · SPEC-001)
Landing "Plataforma en construcción". Server Component, sin auth, sin navegación. Este SPEC lo reemplaza por un `redirect('/dashboard')`.

### `src/app/layout.tsx` (root)
Aplica `<ThemeProvider>` + fuentes Inter/DM_Mono + `<body>` con clases `bg-page text-body`. **NO se toca** (candado 22 no lo lista, pero cualquier cambio ahí afecta a `/login` y `/chat` fuera de alcance).

### `src/app/login/page.tsx`
```ts
export default function LoginPage() {
  const piBaseUrl = process.env.PI_BASE_URL ?? "https://pi.innovadataco.com";
  redirect(`${piBaseUrl}/login`);
}
```
Redirect a PI. **NO se toca**. El segment `/dashboard/**` redirige a `/login` cuando falta sesión → 2 saltos deterministas → PI.

### `src/app/chat/page.tsx` (SPEC-013 · 96 líneas)
Client Component con `useState`, `fetch('/api/bi/preguntar', …)`, componentes `MensajeMotor` y `MensajeUsuario` de `@/components/bi/chat/`. **NO se reescribe** ni se envuelve en `BiAppShell` desde este SPEC. La integración a la sidebar la hace SPEC-026 marcando la entrada activa cuando `pathname === '/chat'`.

### `src/lib/auth/sesion.ts`
Función `sesionDeRequest(req: Request): Promise<Sesion | null>` que:
- Extrae token de `Authorization: Bearer …` o cookie `session=…`.
- Verifica JWT con `verifyToken` de `./jwt`.
- Devuelve `{id, rol}` o `null`.
**SOLO LECTURA.** El nuevo `DashboardLayout` importa y usa esta función sin modificarla.

### `src/components/ui/`
Ya existen: Badge, Button, Card, EmptyState, ErrorState, GlassCard, Input, Modal, Select, Slider. La sidebar usa Link de Next.js + clases Tailwind directas · no requiere componente UI nuevo.

### `tests/unit/`
Vitest + Testing Library ya configurados. Referencia: `bi-chat-componentes.test.tsx` para tests de componentes React.

---

## Constitución (§3 candados aplicables a este SPEC)

- **Candado 9** · sin datos → "sin datos". El home vacío muestra placeholders explícitos ("KPIs se muestran en SPEC-025"), nunca datos simulados.
- **Candado 14** · verde CI ≠ funciona. Gate local incluye prueba HTTP manual con `curl` para confirmar los redirects.
- **Candado 17** · spec+plan commiteado antes de implementar. Este SPEC lo aplica (compuerta §4 SECA).
- **Candado 22** · rutas SOLO LECTURA respetadas. Verificado en cada archivo tocado.

---

## Decisiones de diseño

### D-024.1 · Sidebar fijo, sin drawer complejo
240px de ancho fijo en desktop, colapsa a header `<details>` en < md. Cero librerías nuevas. Basta para Fase 1.5 admin/analista (Jelkin es el único usuario hasta módulo colegio Fase 2).

### D-024.2 · Segment `/dashboard/**` con layout guard, no middleware
Usar `src/app/dashboard/layout.tsx` (Server Component) en vez de `middleware.ts` porque:
- El resto de las rutas ya autenticadas (`/chat`) manejan auth internamente sin middleware.
- Un middleware nuevo aplicaría a todas las rutas y podría interferir con `/login` y `/chat`; el layout guard solo cubre `/dashboard/**`.
- No requiere tocar `next.config.ts` ni introducir nuevas convenciones.

### D-024.3 · Redirect en dos saltos `/ → /dashboard → /login → PI`
Cada salto es determinista y verificable con `curl -I`. Dos saltos es aceptable; alternativa (`/` redirige directamente a `/login`) rompería la UX cuando el usuario ya está autenticado.

### D-024.4 · La entrada "Chat NL→SQL" apunta a `/chat`, no a `/dashboard/chat`
`/chat` ya existe (SPEC-013) y funciona standalone. Moverlo bajo `/dashboard/chat` obligaría a envolverlo en `BiAppShell`, lo que Fábrica marcó explícitamente como fuera de alcance ("no reescribir el chat"). Trade-off: la sidebar desaparece dentro de `/chat` porque el shell no envuelve esa ruta. SPEC-026 puede decidir si quiere shell dentro de `/chat` o si prefiere botón "Volver al dashboard" arriba del chat.

---

## Fuentes consultadas

- `productos/005-2026-BI-INTELIGENCIA-NEGOCIO/src/app/page.tsx` (líneas 1-14)
- `productos/005-2026-BI-INTELIGENCIA-NEGOCIO/src/app/layout.tsx` (líneas 1-48)
- `productos/005-2026-BI-INTELIGENCIA-NEGOCIO/src/app/login/page.tsx`
- `productos/005-2026-BI-INTELIGENCIA-NEGOCIO/src/app/chat/page.tsx` (SOLO LECTURA · integración en SPEC-026)
- `productos/005-2026-BI-INTELIGENCIA-NEGOCIO/src/lib/auth/sesion.ts`
- `productos/005-2026-BI-INTELIGENCIA-NEGOCIO/.specify/memory/constitution.md` §3 candados
- BRIEF-A-51 §3-A (alcance del bloque A)

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-29 20:4x COT |
| **Autor** | Dev BI-2 |
