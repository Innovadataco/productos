# SPEC-483 · Barrido residual del ADMIN al Sistema de Diseño (mecánico completo)

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-05 · **Dev**: PI-1 (`idc-32`) · **Origen**: Lote-2 priorizado de Diseño (`LOTE-2-RESIDUAL-PRIORIZADO.md`, commit 22e52e4), radicado por el CEO. Paralelo con SPEC-482 (colegio, Dev 02). **Ampliación (mismo PR):** el CEO plegó la Ola B (ámbar) en esta pasada porque Diseño la resolvió también mecánica (todo el ámbar del admin es atención/advertencia) y toca los mismos archivos — evita un conflicto de mismo-archivo posterior.

## El problema

Tras la Ola 1 quedó color crudo **no-rojo** estructural/semántico en el territorio admin (`src/app/dashboard/admin/**`). Conteo verificado en fuente por el CEO (coincide con Diseño): **slate 78 · sky/cyan 8 · emerald 5 · amber 30**. El crudo no sigue al tema (dark mode a mano, pares `slate-200 dark:slate-800`) ni al color por territorio del Sistema de Diseño.

## El arreglo (mapeo mecánico, sin decisión de diseño)

Swaps de token en `src/app/dashboard/admin/**`:

- **`slate-*` / `gray-*` → neutros por rol**: `border-*` → `border-tinta/10` (`--linea`); `bg-slate-50/900` → `bg-tinta/5` (`--velo`); superficie (`bg-white/60` con par oscuro slate) → `bg-papel/*`; `divide-*` → `divide-tinta/10`. Los pares light/dark colapsan a **un token theme-aware** (tinta/papel voltean con el tema), se elimina el `dark:` redundante.
- **`sky-*` / `cyan-*` → cielo**: `bg-sky-100`→`bg-cielo/10`, `text-sky-*`→`text-cielo`, `border-sky-500`/`border-cyan-400`→`border-cielo` (idioma AA ya usado en padre/profesional: `text-cielo` + `bg-cielo/10`).
- **`emerald-*` → pino**: `text-emerald-600`→`text-pino`, `bg-emerald-100`→`bg-pino/10`.
- **`amber-*` → ámbar (atención/advertencia)**: caja/trazo/fondo (`border-amber-*`, `bg-amber-*`, `border-l-amber-*`) → `ambar` (con alpha: `border-ambar/30`, `bg-ambar/10`); **TODO texto** `text-amber-*` → **`text-estado-ambar`** (`--ambar-ink-rgb`, el único apto AA como texto — el trazo `ambar` no pasa). `<Alerta tono="advertencia">` con override crudo → **se quita el override** (el mueble ya rinde `bg-ambar/10 text-estado-ambar`; no se re-pinta). `DatasetEntrenamiento:141` (stat de pendientes) → `text-estado-ambar`.

**NO se toca `pdf-informe-mensual.tsx`** (colegio, revisión aparte de Diseño). No se tocó `tokens-check.ts` / PISO (regla SPEC-466 `<=`; el PISO lo aprieta el barrido `--tension`, no este PR).

> **Nota de Diseño (no bloquea):** en el territorio admin el accent ES ámbar-ink (SPEC-460), así que un aviso ámbar no «salta» sobre el fondo del rol — tensión preexistente del sistema, no la introduce esta spec.

Orden de palanca (del doc): PadresPageClient → operadores/* → inicio → resto.

## Candado — `src/app/dashboard/admin/admin-residual-barrido.candado.test.ts` (1 test)

- Escanea todo `app/dashboard/admin/**/*.tsx` (excluye `.test.tsx`) y falla si reaparece crudo de las **seis familias** (`slate/gray/sky/cyan/emerald/amber`).
- **Verificado por mutación**: reintroducir `border-slate-300` en `inicio/page.tsx` pone el candado en rojo; revertir lo devuelve a verde.

## Impacto en arquitectura:

- Cierra el crudo del territorio admin: 0 `slate/gray/sky/cyan/emerald/amber` en `src/app/dashboard/admin/**`. La conducta de las pantallas no cambia (solo color).
- No modifica rutas, guardias ni menús → `arch:check` (aserciones A/B/B-bis) inalterado.

## Lo que NO cambia

- No se toca `pdf-informe-mensual.tsx` (colegio, revisión aparte de Diseño).
- No se toca `tokens-check.ts` / PISO.
- No se migra el residual de `src/components/modules/ia/**` (89) ni `monitoreo/LogsTab` (2): NO están en el conteo admin verificado (78/8/5/30 = solo el app-dir). Reportados al CEO como residual aparte (candidato a spec propia).

## Referencias

- **SPEC-460** (accent por territorio — el admin es ámbar-ink; este barrido no lo toca).
- **SPEC-454/458** (Button/Alerta al Sistema de Diseño — Ola 1).
- `LOTE-2-RESIDUAL-PRIORIZADO.md` (Diseño) — Ola A mecánica / Ola B criterio fino.
- Worktree `.worktrees/pi-483` desde `origin/main 4f2690448`.
