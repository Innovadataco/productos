# Cierre — Spec 089: Presentación al usuario

**Fecha**: 2026-07-23
**Rama**: `feature/001-scaffolding`
**Spec**: `specs/089-presentacion-usuario/`
**Estado**: FINALIZADO — pendiente validación funcional del CEO + ACTA-VALIDACION de ZEUS

## Resumen por US

| US | Resultado |
|---|---|
| US1 Estados | Solo "En proceso" / "Procesado" (antes "Verificado") en seguimiento y consulta |
| US2 Clasificador | OTRO → siempre REVISION_MANUAL (incl. cascada); líder = MAYOR GRAVEDAD (parámetros) |
| US3 Predicado | `esReporteAprobado` única fuente: consulta = scoring = dashboard |
| US4 Categorías | Multi-conducta por gravedad; SPAM/OTRO nunca visibles ("No se identifica riesgo") |
| US5 Consulta | Fix "(undefined)", cuadre total, rollup país/depto-ciudad, señal actividad, detalle siempre, divulgación progresiva |
| US6 nivelRiesgo | Eliminado de `/api/consulta`, `/api/estadisticas-publicas` y seguimiento (route + 3 clientes) |
| US7 Registro | "Gracias por reportar." + sin ocultamiento propio; gate solo en consulta de terceros |
| US8 Bugs UI | AdminNav un solo activo; ComiteSubNav altura estable |

## Antes/después (pedido por ZEUS)

**Mapeo de estados**: antes "En proceso" / "Verificado" (engañoso) → ahora "En proceso" / "Procesado".

**Conteo de un identificador con spam** (2 SPAM + 1 OTRO + 1 EXTORSION):
- Antes: consulta `totalReportes = 4` (no excluía SPAM/OTRO); scoring 4; dashboard 4.
- Ahora: **1 en los tres** (predicado único). Un identificador solo-spam responde "Sin reportes registrados".

**Ranking del clasificador**: antes 3×CONTACTO_INSISTENTE(30) ganaba sobre 2×SOLICITUD_ENCUENTRO(90) y se auto-publicaba leve → ahora lidera ENCUENTRO con confianza 0.4 → REVISION_MANUAL (humano decide).

## Validación

- Tests nuevos: esReporteAprobado (6), classifier-votos OTRO/gravedad (3), consulta contrato nuevo (10, incl. spam no cuenta y solo-spam), AdminNav (3), ConsultaResultado fix (2), seguimiento multi-conducta/actividad.
- Tests actualizados al contrato nuevo: consulta (8→10), estadisticas-publicas (porNivelRiesgo eliminado), scoring (OTRO no cuenta), SeguimientoClient, role-visibility.
- Gate: lint 0 errores (1 warning heredado) · tsc OK · suite **799/799** · build limpio · `dev-restart.sh` healthcheck OK.

## Deuda registrada

- `ConsultaResultado.tsx` y `ScoreDisplay.tsx` quedaron huérfanos (sin consumidores) tras los cambios → candidatos a borrado en una spec de limpieza.
- `calcularRanking`/`riesgo-consulta.ts` siguen en código para priorización operativa interna (no se exponen).

## Commit

- `feat(presentacion): estados claros, clasificador por gravedad y consulta pública sin juicio (spec 089)`
