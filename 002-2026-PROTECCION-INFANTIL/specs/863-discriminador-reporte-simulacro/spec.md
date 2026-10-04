# SPEC-863 · Discriminador de reportes de simulacro (I-400)

> Estado: IMPLEMENTADO (pendiente CI verde + revisión del CEO). Rama `work/pi-SPEC-863-discriminador-reporte-simulacro`.
> Radicado: CEO → Datos, 03-10-2026. Carril **Datos** + D-121 + toca BI (hermano parqueado).

**Impacto en arquitectura:** NO toca el schema (reusa los modelos vivos `DemoMarcado` /
`SimulacionReporte`; sin columna publicada ni migración). Añade un predicado canónico en el DAL
(`demo-exclusion.ts`, espejo de BI 006 e `inicio-admin`) y un guard/merge por consumidor; introduce
el wrapper `recalcularYGuardarScoreSiReporteReal` como chokepoint del write-side del agregado público.
Respeta la frontera DAL (Q-3) y el único punto de escritura de Reporte (`crearReporteConTexto`,
arch:check (g)). Sin rutas paralelas (D-72).

## Problema (I-400)

`Reporte` no tenía forma de distinguir un reporte de PRUEBA de uno real **a nivel de columna**, así que un
reporte del **simulador de abusos** (`POST /api/reportes` con `x-simulacion-secret`, que SOLO saltaba el
anti-abuso, SPEC-192) entraba al corpus como abuso real: se clasificaba, podía **alertar a un colegio**,
**agregar patrones**, **contar** en métricas admin/rector, **mover el score/visibilidad pública** de un
identificador real, y **viajar a BI**. Esto bloqueaba ejercitar en producción cualquier mecanismo que
dependa de crear un reporte (el aviso al padre/colegio — la promesa central).

## Decisión del CEO (veredicto 03-10, opción B)

**NO una columna nueva.** Reusar el mecanismo de FILA ya vivo y ya honrado por BI (D-72):

- **`demo_marcado(entidad="Reporte", entidadId)`** ∪ **`simulacion_reportes(reporteId)`** = predicado
  canónico **«reporte NO real»**. Es la MISMA unión que usa BI (`006/.../05-mv-fact.sql`) y
  `inicio-admin.ts` S3/S4. `demo_marcado.metadata.origen = "simulador-abuso"` desambigua la procedencia.
- **Sin columna publicada nueva, sin migración de schema** (los modelos `DemoMarcado`/`SimulacionReporte`
  ya existen; la purga ya cubre `entidad="Reporte"`).
- Alcance: **todo lo que toca a un usuario REAL**, con la **ESCRITURA primero (no negociable)**.
- El **padre dueño** y el **operador** que ejercita el flujo ven sus propios demo (exentos).
- Honor **por consumidor** (anti-join/guard, forma de `inicio-admin`), **sin** refactor del predicado base puro.

## Mecanismo (fuente única: `src/lib/dal/demo-exclusion.ts`)

- `marcarReporteSimulacro(db, reporteId, origen)` — escribe la marca; se llama DENTRO de
  `crearReporteConTexto` (la única vía de escritura de Reporte), en la MISMA tx → un reporte de simulador
  **nunca existe sin su marca** (atómico).
- `esReporteNoReal(db, reporteId)` — guard de entrada (dos lookups puntuales).
- `whereExcluirReportesNoReales(db)` → `{ id: { notIn } }` para MERGEAR donde el where NO fija `id`.
- `idsReportesNoReales(db)` — para componer a mano un `id` que YA trae `not`/`in` (consulta hermana).
- Expuesto a servicios por `ReporteRepository.{esNoReal,whereExcluirNoReales,idsNoReales}` (frontera DAL Q-3).

## WRITE-SIDE (lo primero, no negociable)

Un simulacro **no mueve el agregado público de un identificador REAL**:

- `reporte-creation.ts` — **NO** llama `upsertIncrementoReporte` para un simulacro (no sube
  `IdentificadorReportado.totalReportes` ni des-oculta).
- `scoring.ts` — `calcularScore` **excluye** simulacro del cómputo (un simulacro que comparta identificador
  con reportes reales no infla el score del id real); `recalcularYGuardarScoreSiReporteReal(reporteId,…)`
  es el wrapper que **no recalcula** cuando el reporte disparador es simulacro (ni score, ni
  `reportesAprobados`, ni `esVisiblePublicamente`, ni crea fila huérfana). Cableado en sus **8 llamadores**
  (finalización pipeline, lifecycle ×2, confirmar/clasificar/deshacer, correcciones, comité).
- `visibility.actualizarVisibilidadPublica` no necesita filtro: lee el agregado (ya limpio) y es no-op si no
  hay fila.

## Consumidores — qué se tocó

**Avisos (guard de entrada):** `notificarHijosSiCorresponde`, `notificarColegioSiCorresponde`,
`circulo-confianza/notificarCambioCirculoSiCorresponde`. `corroboracion-padre` queda cubierta por el guard
de `detectarYRegistrarMatch` (su único disparador).

**Patrón/match (guard):** `agregarPatronPorReporte`, `detectarYRegistrarMatch`. Al no crearse EventoMatch /
AlertaColegio / PatronInstitucional para un simulacro, **todas las lecturas de esas tablas derivadas quedan
limpias automáticamente** (incl. `contarIdentificadoresConMatch` del público).

**Lecturas públicas (merge de exclusión):** `ConsultaPublicaService.resumen`/`detalle` (`/api/consulta`),
`EstadisticasService.publicas` (`/api/estadisticas-publicas`), `ReporteQueryService.otrosReportesDe`
(seguimiento público — compone `id: { not, notIn }` para no pisar el filtro hermano),
`apelaciones.contarReportesAsociados` (lo ve el titular que apela). El ranking del seguimiento usa
`calcularScore`, ya excluido.

**Conteos admin (merge):** `EstadisticasService.admin` (totales/tendencia/por-categoría/plataforma/ciudad +
correcciones por categoría).

## EXENTOS (a propósito)

- **Listados scoped al padre dueño** (sus reportes, su expediente, su círculo) — un padre demo ve sus demo
  (consistente con `demo-exclusion.ts`). El daño es hacia agregados/usuarios REALES, no la vista del propio demo.
- **Bandejas del operador/admin y las tarjetas operativas de `EstadisticasService.clasificacion`
  (REVISION_MANUAL sin asignar / en gestión / escalados)** — el operador DEBE ver y procesar los simulacro
  para caminar el flujo (propósito de I-400); la tarjeta operativa debe coincidir con la bandeja que trabaja.

## NATURALMENTE LIMPIO (verificado, no asumido)

- **Métricas de rector/colegio** (`metricasReportesColegio`, series, PDF mensual, actividad, resumen): están
  **scopeadas por `tenantId`**, y los reportes del simulador de abusos son **anónimos sin tenant** (tenantId
  NULL) → no aparecen. Además `notificarColegioSiCorresponde` está guardado → cero alertas de simulacro a un
  colegio real. (Un poblador demo usa colegios demo, no tenants reales.)

## DIFERIDO a hermana (cola interna de bajo daño — para que el CEO decida)

Ninguna es pública/scoring/aviso/alerta ni conteo de dashboard; todas son monitoreo INTERNO del admin y
varias **deberían** mostrar el simulacro (es anti-abuso):

- Tablero anti-abuso: `topIdentificadoresEnVentana`, `topFingerprintsRepetidores` (`/api/admin/monitoreo`).
- `MonitoreoRepository.conteoAtascados` (reportes atascados, operativo transitorio).
- `AnomaliaRepository.contarReportesPorTenant` (detector de anomalías).
- Analítica de correcciones RAW: `casosPorDia` (sobre AuditLog), `clasificacionesPorCategoriaCorregidas`
  (sobre ClasificacionIA) — leen AuditLog/ClasificacionIA, no `Reporte`.

## HERMANO a 006 · PARQUEADO (dependencia anotada, NO implementar ahora)

«Invisible a BI» completo exige cambiar 006, **no 002**: las 5 MV de hechos (`05-mv-fact.sql`) hoy **cuentan
el simulacro en los totales** y lo exponen aparte como `total_demo` (eso ES «visible-pero-marcado»). El cambio
es **mecánico**: pasar el predicado demo∪simulacro de `FILTER` a `WHERE NOT EXISTS` en las 5 MV (ya está
escrito). **BI no tiene dueño técnico y NO entra un Dev de PI.** Interino aceptable (veredicto CEO): BI sigue
segregando como `total_demo`; el daño real (cara-a-usuario-real) queda cerrado del lado 002.

## D-121 (firma de Datos)

- **Sin migración de schema**: `DemoMarcado` (`@@unique([entidad,entidadId])` + índices) y
  `SimulacionReporte` (`reporteId @unique`) ya existen; la marca es aditiva (un INSERT por reporte de
  simulador, en su tx). La purga ya borra `entidad="Reporte"`.
- **Predicado espejo**: la definición «no real» = demo_marcado∪simulacion es idéntica a BI (006) y a
  `inicio-admin.ts`. Si cambia, cambia en los tres.
- **Contrato de consulta hermana**: donde el `where` ya fija `id` se COMPONE (`not` + `notIn`), nunca se pisa
  con un spread ciego (`otrosReportesDe`).
- **LÍMITE**: `notIn` gasta un bind por id de prueba (los de prueba son POCOS por diseño; Postgres corta en
  32.767). Para una superficie de VOLUMEN futura, pasar a anti-join raw (patrón `inicio-admin`).

## Candado (muere con el defecto, control positivo)

`src/lib/dal/services/simulacro-exclusion.candado.test.ts`:
- A · el factory escribe `demo_marcado` en la MISMA tx con `marcaSimulacro` — y NO sin la bandera.
- B · el predicado distingue simulacro (demo_marcado Y simulacion_reportes) de real; el WHERE excluye.
- C · **«un simulacro NO mueve el agregado público de un id real»** (reportesAprobados=1 antes y después de
  un simulacro sobre el mismo id; el wrapper devuelve null y no toca la fila).
- D · `detectarYRegistrarMatch` ignora el simulacro (sin EventoMatch) y SÍ registra el real (control positivo).
