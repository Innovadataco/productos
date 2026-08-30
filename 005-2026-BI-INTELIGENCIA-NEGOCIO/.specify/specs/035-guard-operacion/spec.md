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

## Ampliación de alcance (v2 · seguridad · agujero ACTIVO)

El CEO probó en prod un `POST` anónimo a `/api/bi/preguntar` → 202, disparó el jurado de 3 modelos y ~76s de Ollama en el Mac Studio: **DoS trivial** contra el mismo motor que usa PI en prod (10 requests en bucle dejan a PI sin cerebro). El guard de UI NO protege la API. Este SPEC cierra la UI Y la API. Además, durante la implementación se halló que el guard **solo en el layout NO cierra el leak de `/operacion`** (ver §"Hallazgo").

## Problema (verificado en fuente)

`/operacion` (SPEC-033) quedó **público sin credencial**: un `curl` anónimo devuelve `200` y sirve el tablero completo (nombres de equipos, defectos abiertos, quién está en qué). Debe quedar detrás del **mismo guard** que `/dashboard`.

## Hallazgo durante la implementación · el guard en el layout NO basta para `/operacion`

`redirect()` en un layout async NO impide que el `page.tsx` hermano renderice en paralelo; su RSC flight se **streamea al body del 307**. Medido: `curl` anónimo daba 307 pero con 52KB de body conteniendo TODA la PII del tablero ("Fábrica PI-1", "Dev BI-2", "Reembolsos", "congelada"...). `/dashboard` NO tiene el problema porque sus datos son client-fetch; `/operacion` los renderiza server-side (lee el archivo), así que filtra.

**Fix:** guard también al TOPE de `operacion/page.tsx` (antes de `leerOperacion()`), llamando al MISMO helper `exigirSesionBi("/operacion")`. Así `redirect()` corta antes de leer datos → body 0 PII (52KB→7.8KB). Verificado. `/operacion` es la ÚNICA protección de esa PII (no hay un 401 de API detrás, lee del archivo).

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

### Ampliación v2 · más rutas a cerrar

- **`/chat`** (page) → nuevo `chat/layout.tsx` con `exigirSesionBi("/chat")`. Es Client Component (datos por API), NO server-renderiza PII → el layout guard basta (no necesita guard en page, a diferencia de `/operacion`).
- **`/api/bi/preguntar`** → 401 sin sesión como PRIMERA línea del POST, ANTES de `req.json()` y del motor (`sesionDeRequest` + `{error:"no_autorizado"}` 401). Cierra el DoS.
- **`/api/bi/estado-sistema`** → mismo 401 (hoy filtra salud vanna/superset/pi + último reporte). Firma pasa de `GET()` a `GET(req)`.

**NO se tocan** (públicas por diseño): `/api/health` (healthcheck Docker), `/api/auth/link` (se retira en 036), `/login`, `/login-error`, `/` (redirect). **Ya guardadas:** aprobar, rechazar, kpis, dashboard.

**Enumeración (encargo CEO):** revisadas TODAS las rutas · no queda ninguna con datos sin guard (detalle en evidencia/README).

### Tests

`tests/unit/bi-operacion-guard.test.tsx` (+ ajustes a tests existentes de preguntar y estado-sistema para mockear sesión válida):
- `/operacion` **page** sin sesión → redirect **Y `leerOperacion` NO se llama** (equivalente unit del grep-vacío-del-body §6.2: si no lee datos, no los renderiza ni streamea).
- `/operacion` page con sesión → `leerOperacion` sí se llama.
- layouts operacion/chat sin sesión → redirect; con sesión → children.
- `preguntar` POST sin sesión → 401 **Y el motor NO se invoca** (cero LLM).
- `estado-sistema` GET sin sesión → 401.
- **REGRESIÓN anti-recurrencia (genérica · ajuste de Fábrica):** para CADA ruta top-level protegida (`/dashboard`, `/operacion`, `/chat`) sin sesión → **existe redirect (no 200)** — atado a "hay redirect", NO al destino. Sobrevive al cambio de guard de SPEC-036 y caza rutas guardadas que se desincronicen. (Nota honesta: prueba "las guardadas siguen guardadas", NO "todas las rutas tienen guard".)

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
