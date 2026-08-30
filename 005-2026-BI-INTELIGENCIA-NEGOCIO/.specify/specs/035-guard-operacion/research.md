# RESEARCH-035 · Guard de sesión en `/operacion`

## El hueco (verificado en fuente · I-33)

`src/app/operacion/` contiene solo `page.tsx` + `operacion.css` — **sin `layout.tsx`, sin `sesionDeRequest`, sin `redirect`**. Es una ruta top-level hermana de `/dashboard`, no un hijo de ese segmento, así que NO hereda `src/app/dashboard/layout.tsx` (el guard de SPEC-029). Resultado: `curl` anónimo a `/operacion` → 200 + tablero completo (PII operativa: equipos, personas, defectos).

Confirmado que `sesion.ts` exporta `Sesion` y `sesionDeRequest(req): Promise<Sesion | null>` — reutilizables.

## Guard actual de `/dashboard` (main · SPEC-029)

`dashboard/layout.tsx` hace: `headers()` → Request sintético con `authorization`+`cookie` → `sesionDeRequest` → si null, `redirect(\`${PI_BASE_URL}/api/auth/link-bi?returnTo=${enc(bi + "/dashboard")}\`)` con `bi = process.env.BI_BASE_URL ?? "http://localhost:3001"`. Este es el patrón que se mirrorea.

**SPEC-030 (endurecer BI_BASE_URL con `resolveBiBaseUrl`) está en PR #168, CONGELADO — NO mergeado a main.** Por eso este SPEC usa el patrón `?? "http://localhost:3001"` que está HOY en main, no `resolveBiBaseUrl`. Cuando #168 se descongele y se rebase, el endurecimiento se aplicará en el helper compartido (un solo lugar).

## Decisiones de diseño

### D-035.1 · Helper compartido `exigirSesionBi(rutaBi)` (anti-recurrencia)
La causa de I-33 fue que el guard vivía inline en un layout y una ruta hermana nació sin él. Extraer el guard a `src/lib/auth/guard-bi-sesion.ts` y usarlo desde `dashboard/layout.tsx` Y `operacion/layout.tsx` centraliza la lógica: proteger una ruta nueva es `await exigirSesionBi("/x")`, no un copy-paste olvidable. El instructivo permite tocar `dashboard/layout.tsx` sólo si se extrae el helper — se hace.

### D-035.2 · `operacion/layout.tsx` NO usa `BiAppShell`
`/operacion` es full-page standalone (su `page.tsx` trae su propio `.op .wrap`). El layout SOLO aplica el guard y devuelve `children`. Envolverlo en `BiAppShell` (sidebar + shell) cambiaría el diseño aprobado del tablero — prohibido. Diferencia intencional con `dashboard/layout.tsx` (que sí envuelve en `BiAppShell`).

### D-035.3 · `returnTo = ${bi}/operacion` hardcodeado
El layout conoce su propia ruta, así que el `returnTo` es `/operacion` fijo. NO se depende de `x-invoke-path` (limitación D-029.6): esa limitación afectaba a `/dashboard` cuando quería preservar sub-rutas dinámicas; acá la ruta es conocida y única.

### D-035.4 · Test anti-recurrencia GENÉRICO (ajuste de Fábrica)
El test de regresión NO se ata al destino del redirect (returnTo/host). Afirma que **toda ruta top-level protegida responde con un redirect (no 200) sin sesión**. Razón:
- Sobrevive al cambio de guard: cuando SPEC-036 reemplace el SSO por login propio, el destino del redirect cambiará; el test debe seguir vigilando "hay guard", no "apunta a link-bi".
- Caza rutas nuevas sin guard y guards removidos, sin depender de detalles del destino.

Implementación: lista `["dashboard","operacion"]` de layouts protegidos; para cada uno, invocar su `default` con `sesionDeRequest`→null y afirmar que lanzó (redirect). Cero aserción sobre la URL.

### D-035.5 · SPEC-036 (login propio) cambia UNA línea
Cuando entre el login propio de BI, lo único que cambia en `operacion/layout.tsx` (y `dashboard/layout.tsx`) es a qué guard llaman — o el interior de `exigirSesionBi`. La estructura (layout con guard) se queda. Por eso este SPEC se hace "bien", no como algo temporal.

## Fuentes consultadas

- `src/app/operacion/` (solo page.tsx + css · sin layout · el hueco)
- `src/app/dashboard/layout.tsx` (guard de referencia · main)
- `src/lib/auth/sesion.ts` (sesionDeRequest · Sesion · SOLO LECTURA)
- INSTRUCTIVO-020 · I-33 + ajuste del test genérico

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-30 17:2x COT |
| **Autor** | Dev BI-2 |
