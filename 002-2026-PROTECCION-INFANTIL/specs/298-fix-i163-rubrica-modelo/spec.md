# SPEC 298 — Fix I-163: rúbrica respeta `modeloClasificacion` (002-PI-201)

**Status**: `IMPLEMENTADO`
**Radicado gestión**: 002-PI-201 · INSTRUCTIVO-002-PI-201 · BRIEF-A-48
**Rama**: `work/pi-SPEC-298-fix-i163-rubrica-modelo`
**Worktree**: `.worktrees/pi-SPEC-298`
**Base**: `main` (candados A-47).

---

## 1. Problema (I-163)

Las simulaciones de PI muestran siempre `accuracy = 72.13 %` sin importar qué modelo se elija en el sandbox. La razón:

- El executor propaga `modeloClasificacion` al queue (`sendReporte(reporteId, { modeloClasificacion })` en [`executor.ts:78`](../../src/lib/simulacion/executor.ts)).
- El worker recibe el override, lo parsea en [`seguridad.ts:21`](../../src/lib/dal/services/reporte-processing/seguridad.ts) y lo mete en `parametros.modeloClasificacion` vía [`cargarParametrosClasificacion({ modeloClasificacion })`](../../src/lib/dal/services/reporte-processing/parametros.ts).
- Pero en [`clasificacion.ts:70`](../../src/lib/dal/services/reporte-processing/clasificacion.ts) la llamada al motor es `clasificarConMotorActivo(texto, {})` — el override se descarta.
- [`clasificarConRubrica`](../../src/lib/ai/rubrica.ts) itera sobre `cfg.modelos` completo (comité multi-modelo) → siempre el mismo comité → siempre la misma accuracy.

> **Nota al instructivo:** el brief menciona que `clasificacion.ts:70` "lee `modeloClasificacion` del Reporte (ya en `metadatos`)". En el código actual el override viaja por `parametros.modeloClasificacion` (procedente del body del job), no por `Reporte.metadatos`. Esta spec usa esa fuente real; el efecto observable es idéntico.

## 2. Alcance

Corrección quirúrgica: propagar `modeloClasificacion` desde el executor → `clasificarConMotorActivo` → `clasificarConRubrica` y, cuando venga, sustituir el comité por `[override.modeloClasificacion]`.

| Superficie | Cambio |
|---|---|
| `src/lib/ai/rubrica.ts` | `clasificarConRubrica(texto, config?, override?)` gana 3er parámetro. Si `override?.modeloClasificacion` está presente, la lista de votantes de este llamado pasa a `[override.modeloClasificacion]` **y `metrics.modelo` se arma con esa misma lista efectiva** (ver RF-6). |
| `src/lib/ai/motor.ts` | `OpcionesMotor` gana `modeloClasificacion?: string`; se propaga al llamar a `clasificarConRubrica`. |
| `src/lib/dal/services/reporte-processing/clasificacion.ts` | Línea 70: `clasificarConMotorActivo(texto, { configRubrica: {}, modeloClasificacion: parametros.modeloClasificacion })`. |
| `src/lib/ai/rubrica.test.ts` | 3 tests nuevos: RF-A con override → 1 llamada Ollama al modelo indicado. RF-B sin override → comité completo (N llamadas). RF-6 `metrics.modelo === "rubrica:<override>"` con override, `"rubrica:m1+m2+m3"` sin override. |

Fuera de alcance: keywords/decisor/umbral de la rúbrica, Prisma schema, contrato de `/api/reportes/procesar`, cualquier archivo no listado.

## 3. Requerimientos funcionales

- **RF-1** — Con `override.modeloClasificacion = "ornith:9b"`, `clasificarConRubrica` invoca `llamarOllamaStructured` **una sola vez** con `modelo === "ornith:9b"` para el paso de votación (el embudo se mantiene con `cfg.modeloEmbudo` sin cambio). `votosModelos` tiene longitud 1.
- **RF-2** — Sin override, `clasificarConRubrica` mantiene el comportamiento actual: itera sobre `cfg.modelos` completo. `votosModelos.length === cfg.modelos.length`.
- **RF-3** — En `clasificarConMotorActivo`, el nuevo campo `opciones.modeloClasificacion` se propaga como 3er argumento (`override`) de `clasificarConRubrica`; sin ese campo el comportamiento es idéntico al actual.
- **RF-4** — En `clasificarReporte`, la llamada al motor recibe `{ modeloClasificacion: parametros.modeloClasificacion }`. `parametros.modeloClasificacion` siempre es una cadena no vacía (fallback en [`parametros.ts:68`](../../src/lib/dal/services/reporte-processing/parametros.ts)), por lo tanto **cada llamada** al motor pasa a ser mono-modelo (una única voz) — comportamiento nuevo, deliberado, alineado al brief.
- **RF-5** — Si el `override.modeloClasificacion` es un modelo no listado en `cfg.modelos`, se emite `logger.warn("[RUBRICA] modelo override no listado en cfg.modelos: <nombre>")` y se continúa la ejecución (Ollama decide si el modelo existe en su registro). No se lanza excepción.
- **RF-6** — `ResultadoRubrica.metrics.modelo` refleja los votantes reales de esta llamada: sin override queda `"rubrica:m1+m2+m3"` (comité); con override queda `"rubrica:<override>"`. Cierra el compromiso del brief: `ClasificacionIA.modeloUsado` (persistido con este mismo valor en `clasificacion.ts:99`) no puede seguir mintiendo cuando el sandbox/simulación cambia el modelo — era la señal que hacía a la simulación indistinguible entre corridas.

## 3-bis. Impacto en arquitectura

Impacto en arquitectura: sin impacto estructural. El fix es aditivo y quirúrgico dentro de la capa **Servicios** (`src/lib/ai/rubrica.ts` + `src/lib/ai/motor.ts`) y la capa **Datos-orquestada** (`src/lib/dal/services/reporte-processing/clasificacion.ts`). No hay cambios en modelos Prisma ni en migraciones, no toca `src/lib/dal/repositories/**` ni el proxy, no altera el contrato HTTP de `/api/reportes/procesar` (body, headers, respuesta) ni la navegación. La única superficie observable nueva es el 3er parámetro OPCIONAL de `clasificarConRubrica(texto, config?, override?)` y el campo OPCIONAL `OpcionesMotor.modeloClasificacion` — todos los callsites existentes siguen compilando sin cambio. Como el impacto es interno a servicios y no toca schema, proxy, navegación ni stack, **no requiere regenerar `docs/architecture/**` ni `arch:check` cambia** frente a `main` (verificado con `docs/architecture/00-INDICE.md` actual). Efecto observable posterior al deploy: el override propagado desde el sandbox/simulación deja de ser inerte, y `ClasificacionIA.modeloUsado` refleja el modelo real (fin del "accuracy siempre 72,13 %").

## 4. No funcionales

- **NF-1** — Sin migraciones Prisma. Sin cambios en `schema.prisma`.
- **NF-2** — Sin cambio en el contrato HTTP de `/api/reportes/procesar` (body, headers, respuesta).
- **NF-3** — Tres parámetros públicos existentes de la rúbrica intactos: keywords, decisor, umbral (`umbralPresencia`). El fix sólo toca el conjunto de votantes.
- **NF-4** — El nuevo argumento de `clasificarConRubrica` es opcional; todos los call-sites que hoy pasan sólo `(texto, config?)` siguen compilando sin cambio.

## 5. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Al pasar de comité multi-modelo a mono-modelo en producción, las clasificaciones "reales" (no de simulación) pierden robustez de voto mayoritario. | El override viene poblado desde `parametros.modeloClasificacion`, que **hoy ya vale el default o el valor del ParametroSistema** — es decir, en producción no hay comité "efectivo": el pipeline ya emitía un solo modelo desde el parámetro. Este fix **alinea el comportamiento observable** con la config vigente. Si en el futuro se quiere comité multi-modelo en producción, se elimina el pase de `parametros.modeloClasificacion` y se deja el `override` sólo desde simulación/sandbox. |
| El nuevo argumento rompe algún otro call-site interno. | El grep del repo muestra que `clasificarConRubrica` sólo se llama desde `motor.ts:53`; el argumento es opcional para el resto. |
| El modelo del override no existe en Ollama. | Warning + reintento en la iteración (comportamiento actual del `try/catch` en la votación). Si el modelo no existe, el voto pasa a `fallback: true` y el pipeline sigue. |

## 6. Criterios de aceptación

1. `src/lib/ai/rubrica.test.ts` verde con los 2 tests nuevos (RF-1, RF-2).
2. `npm run test` completo sin regresiones frente a `main` en las suites afectadas (`rubrica`, `motor`, `reporte-processing`, `simulacion`).
3. `npx tsc --noEmit` verde.
4. En una simulación de sandbox contra dos modelos distintos, la métrica `accuracy` **cambia** entre corridas (verificable manualmente post-deploy).
5. `gh pr checks` en `13/13` verde antes de la señal REALIZADO.

## 7. Referencias

- Instructivo completo: `Gestion-de-proyectos/01-PROYECTOS/001-2026-PROTECCION_INFANTIL/03-EJECUCION/02-RADICACIONES/INSTRUCTIVO-002-PI-201-FIX-I163-RUBRICA-MODELO.md`.
- BRIEF-A-48 (origen del pedido).
- PM2: I-163 · A-47 (candados de rama y worktree).
- Constitution: [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) v1.1.0.
