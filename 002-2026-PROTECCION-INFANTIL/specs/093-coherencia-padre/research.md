# Research — 093-coherencia-padre

**Fecha**: 2026-07-24 · **Autor**: ODIN

## R1 — El círculo necesita DOS conjuntos, no uno

Aplicar `whereReporteAprobado` directamente borró el estado "En proceso": la primera versión de este cambio hacía que un reporte en REVISION_MANUAL dejara de contar y el contacto saltara a "Sin reportes" (test rojo). La regla correcta: el círculo cuenta (a) **aprobados** (predicado único: CLASIFICADO/CORREGIDO sin SPAM/OTRO) y (b) **en revisión humana** (REVISION_MANUAL, REQUIERE_ANONIMIZACION). POSIBLE_SPAM y DUPLICADO no cuentan — un spam nunca cambia el estado de un contacto (regla del CEO: SPAM no cuenta/no muestra). Helper `whereReportesCirculo` con OR explícito.

## R2 — Residuos de score: tipos muertos, no renders

`ranking: { score, nivelRiesgo }` existía como campo de tipo en `mis-reportes/page.tsx` y `DashboardUsuarioClient.tsx` pero ningún render lo usaba (verificado con grep de `ranking.` en JSX): tipos muertos borrados sin cambio de runtime. La lista (`MisReportesList`) ya mostraba solo "N reportes registrados" desde el fix de la 091.

## R3 — RPT en URL: consistencia del área del padre

La 091 resolvió el home; la lista del padre (`MisReportesList`) seguía navegando `/seguimiento?numero=RPT-XXX`. Se unifica: todo el área del padre transporta el RPT por sessionStorage. La guarda estructural distingue área del padre vs admin (la admin puede tener `?tab=` — falsos positivos corregidos excluyendo `/admin/`).
