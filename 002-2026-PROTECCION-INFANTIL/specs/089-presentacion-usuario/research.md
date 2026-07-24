# Research — 089-presentacion-usuario

**Fecha**: 2026-07-23 · **Autor**: ODIN

## R1 — El ganador por gravedad es seguro por construcción

Ordenar el ranking por severidad (parámetros) podría temerse como "sesgo a lo grave", pero la confianza del líder queda = votos_del_líder/n: una categoría grave minoritaria (2/5 = 0.4) queda por debajo de `umbral_revision` (1.0) → `REVISION_MANUAL` → un humano decide. El FIX no auto-publica más graves; evita que un leve mayoritario OCULTE un grave minoritario auto-publicándose. Antes: 3×CONTACTO_INSISTENTE(30) + 2×SOLICITUD_ENCUENTRO(90) → CLASIFICADO como leve. Ahora: líder ENCUENTRO con confianza 0.4 → revisión humana.

## R2 — OTRO siempre a revisión

`OTRO` es "no se identifica conducta de riesgo específica" — una no-respuesta, no una categoría. Auto-publicarla como "Procesado" mentía al usuario ("Procesado" = categoría real). Con US2a, todo OTRO pasa por humano que reclasifica o descarta; con US3, SPAM/OTRO nunca cuentan en superficie pública de todos modos. La guarda se aplica después de la cascada de desempate (cubre también el caso "cascada confirma OTRO").

## R3 — Predicado único: por qué una función Y un where Prisma

`esReporteAprobado(reporte, categoria)` para lógica en memoria y `whereReporteAprobado()` para filtros SQL: misma semántica (estado ∈ {CLASIFICADO,CORREGIDO} ∧ categoría ∉ {SPAM,OTRO} ∧ eliminado=false), dos formas porque Prisma no ejecuta funciones TS en queries. Consumidores: consulta pública, scoring (`calcularScore`), estadísticas públicas (dashboard). Hueco cerrado: la consulta no filtraba categorías → un SPAM inflaba el conteo (verificación antes/después en cierre.md).

## R4 — Sin nivelRiesgo en superficie pública (constitución §1.3/§1.5)

`nivelRiesgo` BAJO/MEDIO/ALTO + score del identificador = etiqueta de riesgo y score sobre una persona — prohibidos. Se eliminaron de: `/api/consulta`, `/api/estadisticas-publicas` (distribución `porNivelRiesgo`), `/api/reportes/seguimiento/[numero]` (sección "Nivel de riesgo del identificador" con score 0-100) y de las 3 UIs cliente. Reemplazo: señal descriptiva "Actividad baja/alta de reportes" (umbral `visibility.actividad_alta_min`, default 5, seed) — describe los DATOS, no el riesgo. El cálculo interno (`calcularRanking`) queda para priorización operativa interna.

## R5 — Divulgación progresiva

Anónimo = resumen (totales, señal, plataformas resumen, categorías, ubicación por PAÍS). Autenticado = además departamento/ciudad, timeline, fechas, informe. Detección de sesión leyendo el token del header cookie de la Request (sin `next/headers`: funciona fuera de request scope, p. ej. tests). La consulta directa muestra detalle siempre que haya reportes aprobados (CEO: nada de "sin información suficiente"); el umbral `visibility.report_threshold` solo gobierna el LISTADO del dashboard.

## R6 — Decisiones de UI

- Bug "(undefined)": `ConsultaResultado.tsx` esperaba `p.totalReportes` y la API da `p.total` (alineado + test).
- Seguimiento (reporte propio): muestra todas las conductas identificadas ordenadas por gravedad (principal + `categoriasSecundarias`), SPAM/OTRO → "No se identifica riesgo", "Gracias por reportar." — registro por valor, no por miedo (US7).
- AdminNav: la raíz `/dashboard/admin` con `startsWith` marcaba todo → match exacto para la raíz (un solo activo).
- ComiteSubNav: altura estable (`min-h`) para que el layout no salte entre tabs.

## R7 — Componentes huérfanos detectados (deuda, no tocados)

`ConsultaResultado.tsx` y `ScoreDisplay.tsx` no tienen consumidores tras los cambios (candidatos a borrado en una spec de limpieza).
