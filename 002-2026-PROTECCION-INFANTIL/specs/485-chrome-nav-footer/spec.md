# SPEC-485 · El chrome compartido (NavHeader + LandingFooter) al Sistema de Diseño

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-05 · **Dev**: PI-1 (`idc-32`) · **Origen**: visto visual de Diseño en la portada (prod `1b506d5a`): el contenido cierra, pero quedaba crudo en el **chrome compartido** (NavHeader + LandingFooter), presente en TODAS las páginas. Alta palanca. Radicado por el CEO.

## El problema

`NavHeader.tsx` (43 crudos: slate/amber/emerald/red/sky) y `LandingFooter.tsx` (2 slate) viven en cada página. El único rojo crudo del chrome era el link **«Cerrar sesión»**.

## El arreglo (mecánico)

- `slate`/`gray` → **neutros** (`border-tinta/10`, `bg-papel`, `.text-muted`/body por jerarquía; hovers glass `hover:bg-white/70 dark:hover:bg-slate-800/70` → `hover:bg-tinta/5` = velo).
- `sky` → **cielo** (spinner `border-t-cielo`, hover `bg-cielo/10`) · `emerald` → **pino**.
- `amber` (indicador de entorno + badge/borde/avatar de rol ADMIN) → **`ambar`** (caja/trazo) / **`text-estado-ambar`** (texto/badge, AA).
- **`red` del logout (L330 desktop, L412 móvil) → NEUTRO** — `.text-muted`, hover `bg-tinta/5`. **Ruling de Diseño §7.1**: el logout NO es criticidad (rutinario, reversible, no destruye datos); `rubi` se reserva a destructivo real. Pintarlo rojo mentiría con el color y metería alarma en el marco de todas las pantallas. **Consecuencia: chrome sin ni un rojo → cero rojo total.**

> **Corrección al radicado**: la «Nota de precisión» del radicado decía «el logout usa `rubi` (token)». El ruling real (§7.1 + orden del CEO) es **NEUTRO, no rubi**. Se implementó NEUTRO.

## Fuera de alcance — flagueado al CEO

El color de **identidad de rol OPERADOR** usa `violet-*` (borde inferior, avatar, badge — L123/131/139). NO está en el mapeo del radicado (que lista slate/amber/emerald/sky/red) ni existe token `violet` en el Sistema de Diseño. Queda **sin tocar**, pendiente de un ruling de Diseño (¿token propio? ¿neutro? ¿accent?). Por eso el candado NO vigila `violet`.

## Candado — `src/components/modules/chrome-nav-footer.candado.test.ts` (1 test)

- 0 crudo `slate/gray/sky/cyan/emerald/red/amber` en NavHeader + LandingFooter (incluye `red`: el logout ya no es rojo).
- **Verificado por mutación**: reintroducir `text-red-600` en el logout → rojo; revertir → verde.

## Impacto en arquitectura:

- Cierra el crudo del chrome compartido → el marco de TODO el producto sigue el Sistema de Diseño, con cero rojo. Conducta intacta (enlaces navegan, toggle de tema anda, header no se rompe en ningún rol — 23 tests de NavHeader/LandingFooter/nav-logo verdes).
- `arch:check` inalterado (sin cambios de rutas/guardias/menús).

## Lo que NO cambia

- El color de rol OPERADOR (`violet`) → pendiente de Diseño.
- `tokens-check.ts` / PISO.

## Referencias

- **SPEC-483/483b/482** (barridos de territorio + ia) — misma técnica; esta cierra el chrome transversal.
- Ruling de logout: Sistema de Diseño §7.1 (commit 974fc5c).
- Rama `work/pi-SPEC-485-chrome-nav-footer` desde `origin/main a36888313`.
