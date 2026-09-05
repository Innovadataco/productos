# SPEC-479 · PadreSideNav al Sistema de Diseño: sky→cielo — gemelo de SPEC-462

**Status**: IMPLEMENTADO (pendiente certificación de Diseño)
**Fecha**: 2026-09-05 · **Dev**: Dev 02 (`idc-63`) · **Origen**: certificación visual de Diseño sobre el territorio del padre. Autoridad de forma: **Diseño** (certifica; post-merge).

## Para qué

`PadreSideNav` usaba **sky crudo** (marco, activo `bg-sky-600`, inactivo `text-sky-900/70`) — gemelo del defecto que SPEC-462 corrigió en el colegio. Territorio del padre = **cielo** (marca). Se migra con el MISMO patrón que el colegio (que usa pino), pero en cielo.

## Cambios (`src/components/modules/padre/PadreSideNav.tsx`)

- **Marco/borde** (`:20-21`): `border-sky-200/40 bg-sky-50/50 … dark:border-sky-900/30 dark:bg-sky-950/20` → `border-cielo/20 bg-cielo/5` (tokens; se sueltan los `dark:` — el token invierte solo).
- **Ítem activo** (`:35`): `bg-sky-600 text-white shadow-lg shadow-sky-500/25` → `bg-cielo text-white shadow-lg shadow-cielo/25`.
- **Ítem inactivo** (`:36`): `text-sky-900/70 hover:bg-sky-100 … dark:…` → `text-muted hover:bg-cielo/10 hover:text-cielo` (acento cielo reservado al activo; inactivo neutro secundario, mismo patrón ratificado por Diseño en el nav de colegio, [[dev-nav-3-estados-y-texto-2]]).
- Conducta intacta: los 7 enlaces del área del padre sin cambio.
- **Fuera de alcance**: el subtítulo «Área del padre» (`:23`) sigue en `text-subtle` — SPEC-479 es el gemelo de 462 (color), no del 478 (contraste del subtítulo). Flagueado a Diseño por si quiere el fix gemelo.

## Candado

- **`src/lib/rediseno/padre-sidenav-cielo.candado.test.ts`** (fuente, sin BD): 0 sky · activo en `bg-cielo` (no sky) · inactivo en `text-muted`. **Verificado por mutación**: activo→`bg-sky-600` (rojo), inactivo→`text-sky-*` (rojo).

## Impacto en arquitectura: no

Migración de color de un nav de territorio a token. No toca `tokens-check.ts` (baja crudos, SPEC-466 `<=`). Sin schema, sin API, sin runtime, sin cambio de enlaces.

## Certificación (la da Diseño)

Contra prod, post-merge. Verde en CI no cierra un rediseño.

## Referencias
- SPEC-462 (ColegioSideNav, gemelo en pino) · [[dev-nav-3-estados-y-texto-2]].
