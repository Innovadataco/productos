# Cierre — Spec 091: UX y privacidad de la consulta + seguimiento

**Fecha**: 2026-07-24
**Rama**: `feature/001-scaffolding`
**Spec**: `specs/091-ux-privacidad-consulta-seguimiento/`
**Estado**: FINALIZADO — pendiente ACTA-VALIDACION de ZEUS

## Resumen por US

| US | Resultado |
|---|---|
| US1 Privacidad | `POST /api/consulta` (handler compartido `resolverConsulta`); clientes web (home y `/consulta`) usan POST — el identificador nunca viaja en la URL del navegador. GET conservado para compat de API. |
| US2 RPT en home | Campo "Consultar el estado de mi reporte" en el home → `sessionStorage["seguimiento.rpt"]` → `/seguimiento` limpio; `SeguimientoClient` lo consume y lo elimina tras leerlo (fallback `?numero=` conservado). |
| US3 Animación | `EstadoTransicion`: spinner (En proceso) / 3 flechas encendiéndose izq→der + check verde con rebote (Procesado). `animation-iteration-count: 1` — una sola corrida, nunca en bucle. |

## Validación

- Tests nuevos: POST sin identificador en URL + 400 sin cuerpo (2), campo RPT en home + sessionStorage + URL limpia (3), animación una corrida (2).
- Regresión: suite completa **836/836** (consulta 12/12, seguimiento OK, disciplina Spec-Kit tras indexar la 091).
- Gate: lint 0 errores (1 warning heredado) · tsc OK · build limpio · `dev-restart.sh` healthcheck OK.

## Commit

- `feat(consulta): privacidad POST sin identificador en URL + campo RPT en home + animación de estado (spec 091)`

## Fix posterior — fuga de URL por navegación (2026-07-24)

La API ya era POST, pero el identificador seguía yendo a la URL por NAVEGACIÓN. Correcciones verificadas en vivo:

1. **Página `/consulta` eliminada** (`src/app/consulta/page.tsx` + `ConsultaPublicaClient` y su test, código viejo): `/consulta` y `/consulta?identificador=x` devuelven **404** (verificado en `:5005`).
2. **LandingHero**: eliminado el link "Ver vista completa" (`href="/consulta?identificador=X"`) — la vista completa se muestra INLINE en el home; también se eliminó la línea muerta de `nivelRiesgo` (reemplazada por la señal de actividad).
3. **MisReportesList**: los dos `router.push("/consulta?identificador=X")` se reemplazaron por expansión INLINE del ítem vía `POST /api/consulta` (actividad, plataformas, categorías). Además se eliminó el bloque `ranking.score` + `nivelRiesgo` del ítem (residuo de la 089: ahora solo "N reportes registrados", hechos sin juicio).
4. **Guard estructural** (`src/lib/url-privacy.test.ts`, corre en el gate): `/consulta` no existe; `grep` de `identificador=` en hrefs y `router.push` = **0 violaciones**.

Suite tras el fix: **827/827**. Build limpio (`rm -rf .next`), healthcheck OK.

- `fix(consulta): elimina página /consulta y fuga del identificador por navegación (spec 091)` — commit `eb9feb92`
