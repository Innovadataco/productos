# Evidencia §6 · SPEC-034 · enlace /operacion en la sidebar

`next build && next start` (NO `next dev`) + Playwright/Chromium, autenticado con cookie `session` (JWT sub+role · mismo `JWT_SECRET`). F3C 2026-08-30 16:2x COT.

| Ítem | Archivo | Qué prueba | Resultado |
|---|---|---|---|
| (a) sidebar | `a-sidebar-operacion-primera.png` | la entrada "Operación" existe y es la **primera** de la lista | ✅ orden confirmado: `/operacion` · `/dashboard` · `/dashboard/dashboards` · `/chat` · `/dashboard/configuracion` |
| (b) click | `b-click-aterriza-operacion.png` | al hacer click aterriza en `/operacion` con el tablero renderizado | ✅ `.op .wrap` + `.crew` presentes · reloj vivo 16:21:00 · 3 bloques |

## Verificación programática

- Orden del menú leído del DOM: `['/operacion', '/dashboard', '/dashboard/dashboards', '/chat', '/dashboard/configuracion']` → Operación primera.
- Tras `click()` en la entrada: `.op .wrap == presente`, `.crew == presente`, reloj corriendo. El tablero `/operacion` (mergeado por #173) renderiza — el enlace NO lleva a un 404.

## Alcance respetado

Las otras 4 entradas del menú (Home, Dashboards, Chat NL→SQL, Configuración) quedaron **intactas** — visibles en la captura (a) con sus emojis y orden original detrás de Operación. Los 404 congelados de `/dashboard/dashboards` y `/dashboard/configuracion` no se tocaron.
