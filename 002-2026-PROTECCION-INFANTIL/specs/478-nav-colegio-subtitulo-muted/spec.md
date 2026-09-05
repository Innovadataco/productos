# SPEC-478 · Subtítulo del nav de colegio a text-muted (contraste AA) — fallo de forma de Diseño

**Status**: IMPLEMENTADO (pendiente certificación de Diseño)
**Fecha**: 2026-09-05 · **Dev**: Dev 02 (`idc-63`) · **Origen**: certificación visual de Diseño sobre la portada/colegio en prod. Autoridad de forma: **Diseño** (certifica; post-merge).

## Para qué

El subtítulo «Panel institucional» del `ColegioSideNav` usaba `text-subtle` (`--tinta-subtle`), que sobre el fondo del nav con glow del gradiente mide **4.53:1** — al filo de AA (4.5:1). Diseño ruló subirlo a `text-muted` (`--tinta-muted`), que mide **6.30:1**, holgado.

## Cambio

- **`src/components/modules/colegio/ColegioSideNav.tsx`** (1 línea): el `<p>` del subtítulo pasa de `text-subtle` a `text-muted`. Sin cambio de conducta, layout ni texto.

## Candado

- **`src/lib/rediseno/nav-colegio-subtitulo-muted.candado.test.ts`** (fuente, sin BD): la línea del subtítulo «Panel institucional» usa `text-muted` y **no** `text-subtle`. Verificado por mutación: volver a `text-subtle` → rojo en ambos tests.

## Impacto en arquitectura: no

Un cambio de token de texto por contraste. No toca `tokens-check.ts` (ni sube ni baja crudos: `text-subtle`/`text-muted` son utilities semánticas, no crudos Tailwind). Sin schema, sin API, sin runtime.

## Certificación (la da Diseño)

Diseño certifica el contraste contra prod. Hasta su ✅ no cierra en el inventario. Verde en CI no cierra un rediseño.

## Referencias

- Sistema de Diseño §3 (color/contraste AA) · utilities `.text-muted`/`.text-subtle` en `globals.css`.
- [[dev-nav-3-estados-y-texto-2]] — el nav de colegio y su mapeo de neutros.
