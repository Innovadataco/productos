# Plan · SPEC-413 · Índice de specs generado

**Status**: DESARROLLO
**Fecha**: 2026-09-03 · **Dev**: Infra (idc-c0)

## Decisiones

**Generador propio en `scripts/specs/`, no reusar `scripts/arch/`.** El script `generar-roles-capacidades.ts` ya trae un patrón similar (fuente única, artefacto autogenerado, check en CI), pero acopla el generador a la infraestructura de `docs/architecture/`. La spec vive en `specs/`, es una fuente distinta con su propio ciclo. Mejor una carpeta paralela.

**Plantilla con marcadores, no pisado completo.** El README tiene 3 secciones narrativas que ningún generador puede reponer: prólogo (contexto histórico), "Incidencias de calidad de datos" (registro vivo) y "Convención de archivos por spec". Pisar el archivo entero perdería esa memoria. Los marcadores HTML son invisibles al lector y permiten intercambiar solo la zona autogenerada.

**Dos bloques marcados, no uno solo.** Resumen y tabla se generan por separado porque el humano puede querer ordenar/mirar solo uno. Además el resumen tiene interés inmediato (contadores) mientras que la tabla es referencia. Marcadores separados dan flexibilidad futura.

**Status canónico + sinónimos, con degradado suave para "fuera de catálogo".** Muchas specs históricas tienen headers como `"FINALIZADO (pendiente ACTA)"` — no coinciden 1:1 con el catálogo, pero coincide su primera palabra (`FINALIZADO`). El regex de `specs-discipline.test.ts` corta antes del paréntesis, así que los mapeamos limpio. Los pocos casos raros se listan con `⚠️` y siguen — se limpian aparte por el test de `specs-discipline`, no bloqueando el generador.

**`--check` con exit-code + mensaje accionable.** Un check silencioso "no coinciden" es ruido. Un check que dice "corré `npx tsx scripts/specs/generar-readme.ts` y commitea" es un fix de una línea para el autor del PR.

**El check va DENTRO de `verificaciones`, no como job nuevo.** Requisito explícito del CEO. Un job más es más contención de recursos GHA y más carga de gate; un step al final de `verificaciones` es marginal.

**No cambio `specs-discipline.test.ts`.** El test "el índice cubre todas las carpetas reales" seguía siendo válido — ahora se cumple por construcción porque el generador lista todas. La disciplina de Status canónico también sigue en ese test. No hay conflicto entre ambos: `specs-discipline` verifica el contenido de cada `spec.md`; SPEC-413 verifica que el índice esté al día.

**Comentarios `//` en el script, no JSDoc `/** */`.** esbuild (que usa tsx) tuvo un bug de parsing con `-->` dentro de JSDoc en Node 22, tratando el `-->` como cierre HTML. Comentarios `//` evitan el problema por completo. Zero deps nuevas.

## Archivos

- **NUEVO** `scripts/specs/generar-readme.ts` — el generador.
- **EDIT** `specs/README.md` — reemplazo de la tabla manual por los marcadores + primer generado.
- **EDIT** `.github/workflows/ci.yml` — step nuevo al final de `verificaciones` con `--check`.
- **NUEVO** `specs/413-readme-specs-generado/{spec,plan,tasks}.md` (con `Status: DESARROLLO`).

## Riesgos

- **Un dev edita el README a mano y lo commitea sin regenerar**: el CI ve el drift y falla con el mensaje del comando. Un ciclo, sin escalada.
- **Un `spec.md` tiene título raro con `|` embebido**: el generador escapa `|` → `\|` en la celda.
- **Race condition entre generador y editor visual del PR**: el marcador es HTML comment; los renders de GitHub y editores lo respetan y no lo tocan. Verificado en el preview del propio PR.
- **Regen genera diff enorme cuando alguien reordena carpetas o cambia un Status masivamente**: ese diff ES la señal — no se colapsa.
