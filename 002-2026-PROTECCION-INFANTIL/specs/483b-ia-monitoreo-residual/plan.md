# SPEC-483b · Plan

## Enfoque

Barrido mecánico de color crudo del panel de IA + monitoreo, con **triaje data-viz** por la regla de oro de Diseño.

1. **Inventario en fuente** (candado 15 v5): enumerar crudo por archivo con contexto. Clasificar cada uso: chrome/estado (mecánico) vs. color-que-codifica-valor (data-viz → marcar).
2. **Mapa mecánico**: sky/cyan→cielo, emerald/green(éxito)→pino/text-estado-pino, slate/gray→neutros, red(error)→rubi/text-estado-rubi, amber→text-estado-ambar. Pares light/dark → token theme-aware.
3. **Data-viz**: el medidor de confianza de `IaDocsPanel` → envolver en región `data-viz:inicio/fin` y dejar crudo para Diseño. Migrar solo su chrome (tabs, skeleton).
4. **Candado** con exención de región data-viz + aserción de que el marcador sigue presente. Muere por mutación fuera del gauge.
5. **Preflight** completo antes del push.

## Riesgos y mitigación

- **Tokenizar a ciegas un color que codifica valor** — mitigado por el triaje explícito + la región marcada + el candado. Los colores de delta (tri-estado) se mapean a tokens de estado (no rompen la lectura); el gauge continuo se excluye.
- **Contraste AA** — se usan los tokens `text-estado-*` (pino/rubi/ambar), los únicos aptos como texto (el trazo pleno no pasa AA).
- **Conflicto de merge** — disjunto de #400/#399; los archivos union (README/includes) pueden chocar con otro PR: se resuelve por rebase local (union) como en #399.

## Alcance

`ia/**` (11 archivos con crudo) + `monitoreo/LogsTab.tsx`. Excluido: medidor de confianza de `IaDocsPanel` (data-viz, Diseño). PISO intacto.
