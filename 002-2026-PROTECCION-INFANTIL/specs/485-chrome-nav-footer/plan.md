# SPEC-485 · Plan

## Enfoque

Barrido mecánico del chrome compartido (NavHeader + LandingFooter), con el tratamiento especial del logout (neutro) y el triaje del color de rol.

1. **Inventario en fuente** (candado 15 v5): cada crudo con contexto. Clasificar: chrome/estado (mecánico) vs. identidad de rol vs. logout.
2. **Mapa**: slate/gray→neutros, sky→cielo, emerald→pino, amber→ambar/text-estado-ambar. Pares light/dark → token theme-aware.
3. **Logout** (L330/L412): NEUTRO (`.text-muted` + hover velo), no rubi — ruling §7.1. Cero rojo en el chrome.
4. **Color de rol OPERADOR** (`violet`): sin token de diseño ni en el mapeo → dejar y flaguear al CEO.
5. **Candado** (0 crudo de las 7 familias migradas, excluye violet documentado) + mutación logout-rojo.
6. **Alta palanca**: correr los tests de NavHeader/LandingFooter (todos los roles) + preflight completo.

## Riesgos y mitigación

- **Romper el header en algún rol** (chrome transversal) — mitigado corriendo NavHeader.test/LandingFooter.test/nav-logo (23 tests, todos los roles) + arch:check.
- **Hover glass invertido** (white/70 aclara vs tinta/5 oscurece) — se unifica al velo (`bg-tinta/5`) por ruling de Diseño, consistente con el resto del producto migrado.
- **Logout mal tokenizado a rubi** (contradicción del radicado) — se sigue el ruling §7.1 (neutro); documentado en la spec.

## Alcance

`NavHeader.tsx` + `LandingFooter.tsx`. Fuera: color de rol OPERADOR (`violet`, pendiente Diseño). PISO intacto.
