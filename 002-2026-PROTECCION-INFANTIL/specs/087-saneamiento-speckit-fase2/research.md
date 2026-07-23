# Research — 087-saneamiento-speckit-fase2

**Fecha**: 2026-07-23 · **Autor**: ODIN

## US1 — De qué se infirió cada Status

| Spec | Antes | Después | Evidencia |
|---|---|---|---|
| 006-paginas-legales | `Implemented` | `IMPLEMENTADO` | Traducción al canónico (índice ya la listaba Implementada) |
| 007-alertas-email | `Implemented` | `IMPLEMENTADO` | Ídem |
| 011-centro-control-ia | sin Status | `CERRADA` | `reporte-cierre.md` presente |
| 012-baja-reportes | sin Status | `CERRADA` | `reporte-cierre.md` presente |
| 013-admin-motor-ia | sin Status | `CERRADA` | `reporte-cierre.md` presente |
| 014-laboratorio-ia | sin Status | `CERRADA` | `reporte-cierre.md` presente |
| 015-anti-abuso | sin Status | `CERRADA` | `reporte-cierre.md` presente |
| 016-circulo-confianza | sin Status | `CERRADA` | `reporte-cierre.md` presente |
| 017-documentacion | `EN DISEÑO` | `PLANEADO` | Sin implementación; índice la lista como backlog |
| 020-reorganizacion-monitoreo | sin Status | `CERRADA` | `reporte-cierre.md` presente |
| 021-reporte-anonimo-interno | sin Status | `CERRADA` | `reporte-cierre.md` presente |
| 074-colegios-fundacion | `PLANEADO` | `CERRADA` | `cierre.md` con Status CERRADA + 9 artefactos (US2) |

Nota de formato: la etiqueta varía (`Status`/`Estado`); el VALOR queda siempre en el catálogo canónico. El chequeo del gate valida el valor, no la etiqueta.

## US2 — Decisiones de backlog

**050b → conservar como spec viva (no retirarla)**, creándole `spec.md`.
Motivo: `registro.md` no es un borrador obsoleto — es un registro ACTIVO con 5 pendientes de afinamiento (A1-A5) con disparador y fuente, referenciado desde `docs/deuda-tecnica.md`. Retirarla perdería el tracking; convertirla en spec `PLANEADO` con el registro como contenido preserva la intención y la saca del limbo (spec sin spec.md).

**Duplicado 050 → la viva se mueve a `088`**.
Motivo: `050-mejora-prompt-clasificador` está CERRADA y tiene más referencias históricas; mover la cerrada rompería más enlaces. La viva (`088-pendientes-afinamiento`) tenía solo 6 referencias, ya actualizadas (053/quickstart, 034/research, 033/research, 047/cierre, docs/deuda-tecnica).

## US4 — Tabla de deuda 001-021 (NO se retrofita: specs cerradas)

Artefactos: ✓ presente / — ausente. Columnas: spec · plan · research · data-model · quickstart · tasks · checklists · contracts.

| Spec | Status | Cierre en carpeta | Artefactos |
|---|---|---|---|
| 001-multi-role-auth-config | CERRADA | — | ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ |
| 02-reportes-comunitarios | CERRADA | — | ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ |
| 003-frontend-publico | CERRADA | — | ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ |
| 004-panel-admin | CERRADA | — | ✓ ✓ ✓ ✓ ✓ ✓ ✓ — |
| 005-password-reset | CERRADA | — | ✓ ✓ — ✓ ✓ ✓ ✓ — |
| 006-paginas-legales | IMPLEMENTADO | — | ✓ ✓ — — — ✓ ✓ — |
| 007-alertas-email | IMPLEMENTADO | — | ✓ ✓ — — — ✓ ✓ ✓ |
| 008-seo | CERRADA | — | ✓ ✓ — — — ✓ ✓ — |
| 009-dashboard-publico | CERRADA | — | ✓ — — — — — — — |
| 010-rediseño-clasificador-ia | CERRADA | ✓ | ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ |
| 011-centro-control-ia | CERRADA | ✓ | ✓ ✓ — — — — — — |
| 012-baja-reportes | CERRADA | ✓ | ✓ ✓ — — — — — — |
| 013-admin-motor-ia | CERRADA | ✓ | ✓ ✓ — — — — — — |
| 014-laboratorio-ia | CERRADA | ✓ | ✓ ✓ — — — — — — |
| 015-anti-abuso | CERRADA | ✓ | ✓ ✓ — — — — — — |
| 016-circulo-confianza | CERRADA | ✓ | ✓ ✓ — — — ✓ — — |
| 017-documentacion | PLANEADO | — | ✓ ✓ — — — — — — |
| 018-operadores-casos | CERRADA | ✓ | ✓ — — — — ✓ — — |
| 019-permisos-modulos | IMPLEMENTADO | ✓ | ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ |
| 020-reorganizacion-monitoreo | CERRADA | ✓ | ✓ ✓ — — — ✓ — — |
| 021-reporte-anonimo-interno | CERRADA | ✓ | ✓ ✓ — — — ✓ — — |

**Nota de deuda registrada**: ninguna spec 001-009/02 tiene `cierre.md` propio; sus cierres constan en los lotes de `docs/` (`cierre-lote-3.md`, `lote-nocturno-cierre.md`, `lote-pre-despliegue-cierre.md`, `lote-tareas-1-2-3-cierre.md`), **sin trazabilidad a spec individual**. Por el principio de la 044 no se retrofitan: queda como deuda documental. Las specs 010+ sí tienen cierre propio (`reporte-cierre.md` o `cierre.md`).

## US5 — Chequeo automático

`src/lib/specs-discipline.test.ts` (corre en `npm run test`, es decir, en el gate). Reglas:

1. Todo `specs/*/spec.md` declara un Status cuyo VALOR está en el catálogo canónico.
2. Specs numeradas > 021 con Status `CERRADA` tienen cierre (`cierre.md`/`reporte-cierre.md` en la carpeta o `docs/cierre-NNN.md`). Las 001-021 están cubiertas por la nota de deuda de US4.
3. Ningún número de carpeta está duplicado.
4. `specs/README.md` contiene una fila por cada carpeta real (índice consistente).
