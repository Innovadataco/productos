# Quickstart — Spec 086: Navegación y páginas gobernadas por permisos

**Propósito**: la prueba que rechazó la spec 019, más el aterrizaje y spam. App en `:5005` (tras `./scripts/dev-restart.sh`).

## A. La prueba del CEO (la que falló)

1. Login ADMIN (`soporte@innovadataco.com` / `Admin123!Test`) → `/dashboard/admin/configuracion` → tab "Permisos por rol" → rol `OPERADOR` → **desactivar "Bandeja de reportes"** → Guardar.
2. Cerrar sesión. Entrar como operador.
3. **El ítem "Bandeja de reportes" NO aparece en el menú.**
4. Entrar por URL directa a `/dashboard/admin` → **redirige al primer módulo permitido** (o "Sin módulos asignados" si no tiene ninguno) — nunca "No pudimos cargar…".
5. Entrar por URL directa a `/dashboard/admin/spam` (si tampoco tiene `revision_spam`) → pantalla **"Sin acceso a este módulo"** con botón Volver.
6. ADMIN reactiva "Bandeja de reportes" → el operador re-ingresa → el ítem vuelve sin pasos extra.

## B. Revisión de spam (módulo propio, D-3)

1. ADMIN → Permisos por rol → `OPERADOR` → activar **"Revisión de spam"** → Guardar.
2. El operador ve "Revisión de spam" en el menú y `/dashboard/admin/spam` **funciona** (antes fallaba siempre).
3. Desactivarla → el ítem desaparece y la URL directa da "Sin acceso".

## C. Tabs del Centro de Control IA (corrección 3)

1. ADMIN → Permisos por rol → `ADMIN` → desactivar el submódulo **"Evaluación del clasificador"** (ia_eval).
2. Abrir `/dashboard/admin/ia` → la tab "Eval" **no aparece**; `?tab=eval` directo cae en el primer tab permitido.
3. Reactivar.

## D. Fusión bandeja (D-4)

- Un solo interruptor **"Bandeja de reportes"** apaga la lista Y las acciones sobre reportes (`/api/admin/reportes-revision`, `/api/admin/reportes/[id]/*`, `/api/admin/correcciones`).
- La clave `reportes_revision` ya no existe (fusionada con semántica AND; nadie ganó permisos).

## E. Verificación estructural

```bash
npx vitest run src/lib/nav-items.test.ts    # menú ↔ catálogo
grep -rn "roles:" src/components/ src/app/dashboard/ --include="*.tsx" | grep -v test
# → solo PermisosRolPanel.tsx (interfaz de la API de gestión, no filtro de navegación)
```

## F. Gate

```bash
npm run lint && npm run test && npm run build && npx tsc --noEmit
./scripts/dev-restart.sh
```
