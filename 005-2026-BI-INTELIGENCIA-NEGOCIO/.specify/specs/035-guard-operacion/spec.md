# SPEC-035 · Guard de sesión en `/operacion` (fix de seguridad · I-33)

## Metadatos

| Campo | Valor |
|---|---|
| **SPEC** | 035 |
| **Nombre** | guard-operacion |
| **Origen** | BI · INSTRUCTIVO-020 · I-33 · F3C 2026-08-30 17:2x COT |
| **Prioridad** | 🔴 Seguridad · prioridad sobre todo |
| **Estado** | ⏳ spec+plan LISTO · pendiente REVISO |

---

## Problema (verificado en fuente)

`/operacion` (SPEC-033) quedó **público sin credencial**: un `curl` anónimo devuelve `200` y sirve el tablero completo (nombres de equipos, defectos abiertos, quién está en qué). Debe quedar detrás del **mismo guard** que `/dashboard`.

### Causa raíz

`/operacion` es una ruta de nivel superior (`src/app/operacion/page.tsx`), **fuera** del segmento `/dashboard`, y **no tiene layout propio** → nunca heredó el guard de `src/app/dashboard/layout.tsx` (SPEC-029). El guard vive en el layout del segmento `/dashboard/**`; una ruta hermana no lo hereda. No es un defecto de la implementación de SPEC-033: el requisito de auth no estaba en su lista de verificación.

Confirmado: `src/app/operacion/` tiene solo `page.tsx` + `operacion.css`, sin `layout.tsx`, sin `sesionDeRequest`, sin `redirect`.

---

## Alcance

### Nuevo `src/app/operacion/layout.tsx`

Layout del segmento `/operacion` que aplica el **mismo guard** que `dashboard/layout.tsx`:
- Obtiene la sesión con `sesionDeRequest` (Request sintético con `authorization` + `cookie` de `headers()` · SOLO LECTURA de `src/lib/auth`).
- Sin sesión → `redirect(\`${PI_BASE_URL}/api/auth/link-bi?returnTo=${encodeURIComponent(bi + "/operacion")}\`)` con `bi = process.env.BI_BASE_URL ?? "http://localhost:3001"` (mismo patrón que `dashboard/layout.tsx` **hoy en main** · SPEC-030/PR#168 está congelado, no se usa acá).
- `returnTo = ${bi}/operacion` (NO `/dashboard`): el layout conoce su propia ruta, así que se hardcodea `/operacion` (no aplica la limitación `x-invoke-path` de D-029.6 porque no se depende del header).
- Con sesión → `return <>{children}</>` **SIN `BiAppShell`**: `/operacion` es full-page standalone, su diseño NO cambia (sin sidebar, sin shell).

### Helper compartido `src/lib/auth/guard-bi-sesion.ts` (anti-recurrencia)

Para no duplicar la lógica (lo que trajo de vuelta este bug), se extrae `exigirSesionBi(rutaBi: string)`:
- Hace `headers()` → Request sintético → `sesionDeRequest`.
- Sin sesión → redirect a PI link-bi con `returnTo = ${bi}${rutaBi}`.
- Con sesión → la devuelve.

Usado por **AMBOS** `operacion/layout.tsx` (`exigirSesionBi("/operacion")`) y `dashboard/layout.tsx` (`exigirSesionBi("/dashboard")`). Así el guard vive en un solo lugar; agregar una ruta protegida es una línea, no un copy-paste que se puede olvidar.

### Modificación de `src/app/dashboard/layout.tsx`

Se refactoriza para usar `exigirSesionBi("/dashboard")` en vez de la lógica inline. El comportamiento no cambia (mismo `returnTo=/dashboard`, misma `BiAppShell`). Se conserva el aprendizaje D-029.6 como comentario en el helper. (El instructivo permite tocar `dashboard/layout.tsx` SOLO si se extrae el helper — que es lo que se hace.)

### Tests

`tests/unit/bi-operacion-guard.test.tsx` + ampliación:
- `/operacion` sin sesión → redirect (a PI link-bi).
- `/operacion` con sesión → renderiza los children.
- `returnTo` contiene `/operacion` (encodeado).
- **REGRESIÓN anti-recurrencia (genérica · ajuste de Fábrica):** afirmar que TODA ruta top-level protegida (hoy `/dashboard` y `/operacion`) responde con un **redirect (no 200)** sin sesión — atado a "hay redirect", NO al destino/returnTo/host. Así sobrevive al cambio de guard (SSO → login propio en SPEC-036) y caza cualquier ruta nueva sin guard.

---

## Fuera de alcance

- El diseño del tablero `/operacion` (NO cambia · sigue full-page sin sidebar).
- SPEC-030/PR #168 (congelado · no se usa `resolveBiBaseUrl`; se mirroreó el patrón de `dashboard` hoy en main).
- Los 404 congelados, el chat, y toda ruta que no sea `operacion/layout.tsx`, `src/lib/auth/guard-bi-sesion.ts`, `dashboard/layout.tsx` y `tests/`.

---

## Candados aplicables

| # | Candado | Aplicación |
|---|---|---|
| 22 | `sesionDeRequest`/`jwt.ts` SOLO LECTURA | Reutilizados en el helper · no se modifican |
| 25 | Evidencia (seguridad) pesa más | PASO 5 · 4 evidencias (307 anónimo · grep vacío de PII · tablero con cookie · Location con returnTo=/operacion) |
| 14 | Verificación en vivo | `curl` real con `next build && next start` |
| 17 | spec+plan commiteado antes de implementar | Aplicado |

---

## Riesgos

- **Refactor de `dashboard/layout.tsx` con regresión:** mitigado con el test anti-drift que verifica que `/dashboard` sigue redirigiendo sin sesión. El comportamiento (returnTo, BiAppShell) es idéntico.
- **`/operacion` sin `BiAppShell`:** intencional. El layout solo hace el guard y devuelve `children`. El `page.tsx` ya trae su propio `.op .wrap` full-page.
- **Colisión futura con SPEC-030 (PR #168):** cuando BI se descongele y #168 se rebase, `resolveBiBaseUrl` se aplicará en el helper compartido (un solo lugar), lo que de hecho facilita esa mejora. No es un conflicto ahora.

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-30 17:2x COT |
| **Autor** | Dev BI-2 |
| **Aprobado por** | pendiente REVISO Fábrica BI-2 |
