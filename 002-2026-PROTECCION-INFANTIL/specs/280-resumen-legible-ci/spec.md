# Feature Specification: SPEC-280 — Resumen legible al final de cada corrida de CI (SC-007)

**Feature Branch**: `work/002-PI-velocidad-ci`

**Created**: 2026-08-26

**Status**: `PLANEADO`

Impacto en arquitectura: sin cambio en el código de producto. Se añade un job agregador de reporte al final de `.github/workflows/ci.yml` y una plantilla de `GITHUB_STEP_SUMMARY` que consolida los 7 inspectores (verificaciones, test-unit, test-integration ×4, journeys, build). El resumen se pinta en la pestaña "Summary" del run de GitHub Actions y también en el gate final.

**Input** (BRIEF-VELOCIDAD-DEL-CI §5.4 y §6/SC-007): hoy el CI es una caja negra de 19–33 minutos. Al abrir el run hay que navegar 7 jobs para saber qué pasó. Jelkin lo dijo textualmente: *"nunca sé qué está haciendo"*. El resumen tiene que responder en una pantalla: cuánto tardó, cuántas pruebas se corrieron, cuál es la cobertura, y —si falló— qué falló exactamente.

**Dependencias**: ninguna. Es el primer entregable del lote porque es barato, sin riesgo y le da visibilidad inmediata a Jelkin desde la primera corrida.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Jelkin abre el run del CI y sabe qué pasó sin abrir un solo log (Priority: P1)

Como Jelkin quiero ver, al terminar cada corrida, un resumen de una pantalla con inspectores, duración, cobertura y —si falló— qué falló exactamente.

**Independent Test**: abrir cualquier run de este PR en GitHub Actions → la pestaña "Summary" muestra el bloque completo sin scroll horizontal, sin abrir logs individuales.

**Acceptance Scenarios**:
1. **Given** un run del CI completa en verde, **When** Jelkin abre la pestaña "Summary" del run, **Then** ve una línea con formato `✅ 7 inspectores · <T> min · cobertura <X>% (piso 36%) · <N> pruebas` y el desglose de cada inspector con su duración.
2. **Given** un run del CI falla en `test-integration` shard 3, **When** Jelkin abre la pestaña "Summary" del run, **Then** ve `❌ Falló: pruebas de conjunto parte 3 → <nombre del test que rompió>` sin necesidad de abrir el log del shard.
3. **Given** un run del CI falla en `verificaciones` (TypeScript), **When** Jelkin abre la pestaña "Summary" del run, **Then** ve `❌ Falló: verificaciones → <primer error de TS>` con el archivo:línea.

### Edge Cases

- ¿Y si el shard fue cancelado o quedó pendiente por timeout de GitHub? — se pinta como `⏸️ <inspector> → cancelado` para que sea distinguible de `❌`.
- ¿Y si el gate agregador no consigue leer artifacts (blobs)? — degrada a `⚠️ resumen parcial: <razón>` en vez de fallar la publicación del summary.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: DEBE existir un job nuevo `resumen` en `.github/workflows/ci.yml` que corra `needs: [verificaciones, test-unit, test-integration, test-integration-coverage, journeys, build]` con `if: always()` (para que también se pinte en runs rojos).
- **FR-002**: El job DEBE escribir a `$GITHUB_STEP_SUMMARY` un bloque Markdown con el formato del brief §5.4: primera línea `✅|❌ <N> inspectores · <T> min · cobertura <X>% (piso 36%) · <N> pruebas` y, si hay fallos, una segunda línea `❌ Falló: <inspector> → <detalle>`.
- **FR-003**: El desglose por inspector se toma de la duración de cada job (`needs.<job>.result` para el estado y una tabla propia calculada con `jobs[*].completed_at - jobs[*].started_at` vía `gh api` en el mismo job).
- **FR-004**: El número total de pruebas y la cobertura se toman del blob mergeado que produce `test-integration-coverage` (ya existe en el workflow: paso `npx vitest run --mergeReports blobs`). Se parsea la salida estándar y se extraen `Tests <N> passed` y `All files <X>% <X>% <X>% <X>%`.
- **FR-005**: NO se cambia la lógica de ningún inspector existente. Solo se agrega un job de reporte y —si es necesario para el resumen— un `--reporter=json --outputFile=<path>` en el paso que corre `vitest --mergeReports`.
- **FR-006**: Si un artifact de blob falta (shard cancelado o rojo antes de subirlo), el resumen indica `⚠️ blobs incompletos (<N>/4)` en vez de crashar.

### Key Entities

- `.github/workflows/ci.yml` → nuevo job `resumen`.
- `$GITHUB_STEP_SUMMARY` (variable de entorno estándar de GitHub Actions).

## Success Criteria *(mandatory)*

- **SC-007 (brief)**: al terminar cada corrida existe un resumen legible con inspectores, duración, cobertura y —si falla— qué falló exactamente.
- **SC-280-A**: el bloque cabe en una pantalla estándar de 1080p sin scroll horizontal.
- **SC-280-B**: el bloque se pinta tanto en runs verdes como en runs rojos (`if: always()`).

## Assumptions

- El repo ya usa `actions/upload-artifact@v4` para publicar los 4 blobs de shard; el resumen los descarga con `actions/download-artifact@v4`.
- El `gh` CLI está disponible en los runners `ubuntu-latest` de GitHub (viene pre-instalado).
- Jelkin abre los runs desde la pestaña de PR o desde el enlace directo — ambos exponen "Summary" en la barra lateral.
