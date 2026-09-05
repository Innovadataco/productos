# SPEC-495 · El slate que sobrevivió a tres barridos (y el candado que no miraba el chrome)

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-05 · **Dev**: PI-1 (`idc-32`) · **Origen**: el CEO verificando `/reportar` por HTTP contra producción (`0e160be5`). **Cierra I-324.**

## El hueco (tercer nivel de la misma lección)
`/reportar` seguía sirviendo `text-slate-*` **después** de que SPEC-491 la declarara limpia, con CI verde 3 vueltas. Causa de fondo: **la página renderizada ≠ el árbol de imports de la página**. El `layout.tsx` de Next envuelve cada pantalla y su chrome (root layout → `NavHeader` → `ThemeToggle`) no aparece siguiendo los imports del `page.tsx`.

## El arreglo
1. **6 mecánicos del radicado** (chrome/estado, slate→token): `ThemeToggle.tsx:21`, `offline/page.tsx:22-23`, `ConfirmacionReporte.tsx:30/31/36`, `AdminReporteDetalle.tsx:69`, `MisReporteDetalle.tsx:47`, `MisReportesList.tsx:113/161/199`.
2. **`Sparkline.tsx` marcado como data-viz** (comentario de cabecera): sus colores codifican valor → los define Diseño, no se tokenizan a ciegas. Excluido del candado.
3. **Candado extendido al CHROME por BFS transitivo:** escanea desde las páginas **Y los layouts** (root + `reportar/layout`), siguiendo imports `@/`/relativos bajo `src/` con set de visitados. Con eso alcanza el chrome (ThemeToggle) y todo lo que el render monta.

## Ampliación por el BFS (reportada al CEO)
El BFS transitivo cazó **slate real alcanzable en la pantalla de reportar** que los 3 barridos previos no vieron (exactamente la clase de I-324): `ReporteStepConfirmar.tsx:75` (checkbox, montado por ReporteWizard), y los primitivos compartidos `Tooltip.tsx:37` (→ `bg-tinta text-papel`, invierte theme-aware) y `CiudadSearchSelect.tsx:145/162/175/181` (dropdown). Tokenizados: excluirlos habría repetido el hand-list. Son primitivos compartidos → el swap mejora todo el producto.

## Candado — `src/app/recuperar/publicas-auth-sin-crudo.candado.test.ts` (BFS transitivo)
- 0 crudo slate/gray en el render (páginas + chrome del layout + lo que montan), excluyendo Sparkline (data-viz) y tests.
- Guardas anti-falso-verde: el árbol DEBE incluir `ThemeToggle` (chrome) y `ReporteWizard`; si la resolución queda corta, falla ruidoso.
- **Muere por mutación**: reintroducir `text-slate-*` en ThemeToggle (chrome) → rojo (era el defecto que pasaba en verde).

## Impacto en arquitectura:
- El candado de públicas cubre por fin **lo que el usuario ve** (render completo, chrome incluido), no el directorio ni el árbol de imports de la página. Resuelve el nit del BFS transitivo que el CEO había anotado.

## Lo que NO cambia
- `Sparkline` (data-viz, pendiente de Diseño). `ComiteBandeja:298` (deuda pre-existente, otro barrido).

## Referencias
SPEC-491 (render-tree, un nivel) · lección [[dev-candado-escanea-arbol-de-render]]. Rama `work/pi-SPEC-495-residual-slate-chrome` desde `origin/main 23cc11071`.
