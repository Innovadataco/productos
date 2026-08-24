# Plan de implementación: SPEC-222 — Panel principal Análisis (Dinero vs Valor)

## 1. Resumen ejecutivo

Esta spec construye el tab "Dinero vs Valor" dentro de `/dashboard/admin/estadisticas`: el panel de inteligencia comercial del CEO. No implementa modelos (vienen de SPEC-220/221/225), no implementa motor de reglas ni workers, y no toca la analítica de widgets de SPEC-218. La implementación se divide en cuatro pilares:

1. **API de solo lectura + resolución** (`src/app/api/admin/analisis/**`): 5 endpoints GET agregados + 1 POST de resolución de recomendaciones.
2. **DAL de agregaciones** (`src/lib/dal/services/analisis-panel.ts` + repositorios): SQL agregado por granularidad, dispersión, KPIs, top decisiones y anomalías.
3. **UI** (`src/app/dashboard/admin/estadisticas/dinero-vs-valor/`): página Server Component + cliente interactivo con granularidades, drill-down, dispersión recharts, KPI tiles, cards de recomendaciones y lista de anomalías.
4. **Navegación**: nueva entrada literal en `EstadisticasSubNav` (D-72).

## 2. Decisiones de arquitectura

### 2.1 Tab dentro de estadísticas, no ruta paralela

- **Ubicación**: `src/app/dashboard/admin/estadisticas/dinero-vs-valor/page.tsx` + `DineroVsValorClient.tsx`, siguiendo el patrón de `operacion/` (SPEC-171: page server + client con tabs).
- **Subnav**: entrada literal `{ href: "/dashboard/admin/estadisticas/dinero-vs-valor", label: "Dinero vs Valor" }` en `src/app/dashboard/admin/estadisticas/components/EstadisticasSubNav.tsx:14-22`. Los hrefs literales son parseados por `scripts/arch/lib/nav-fuentes.ts` (aserción B de `arch:check`), así que el href debe ser string literal.
- **Proxy**: `esDestinoPermitidoPorRol` (`src/lib/proxy.ts`) filtra el tab por rol; hay que verificar/añadir la regla de la nueva ruta para `ADMIN` en el mapa de acceso del proxy.
- **Alternativa considerada**: ruta paralela `/admin/analisis` (como sugieren §10.3/§10.4 del brief para reglas e historial). Descartada para este panel por D-72; las rutas `/admin/analisis/reglas` y `/admin/analisis/recomendaciones` son de SPEC-224/227 y decisión de esas specs.

### 2.2 Convivencia con SPEC-218 (analítica de pagos)

- SPEC-218 implementó `/dashboard/admin/pagos/analitica` con 4 widgets hardcodeados (vencimientos, mora, padres de colegios no renovados, crecimiento anómalo) + KPIs de recaudo.
- Esta spec no la reemplaza ni migra: el Top 5 de SPEC-222 lee `Recomendacion` del motor de reglas (SPEC-221), que es la evolución configurable de aquellos widgets. Ambas vistas pueden coexistir; la consolidación es decisión posterior del CEO.
- **Alternativa considerada**: migrar los widgets de SPEC-218 a reglas semilla en esta spec. Descartada: fuera de alcance del instructivo y rompe "cambios mínimos".

### 2.3 Endpoints: 5 GET + 1 POST, todo tras el DAL

| Endpoint | Propósito |
|---|---|
| `GET /api/admin/analisis/top-decisiones` | Hasta 5 `Recomendacion` PENDIENTE no expiradas, `prioridad DESC, generadaEn ASC`. |
| `POST /api/admin/analisis/recomendaciones/[id]/resolver` | `APLICADA`/`IGNORADA` + `AuditLog`; `409` si ya resuelta. |
| `GET /api/admin/analisis/dinero-vs-valor` | Agregación por granularidad + filtros + paginación estándar `{ items, pagination }` + `totales`. |
| `GET /api/admin/analisis/dispersion` | Puntos score-vs-monto con cuadrante; límite 500 default. |
| `GET /api/admin/analisis/kpis` | MAU, MRR, churn, LTV, renovaciones, conversión freemium, referidos + deltas. |
| `GET /api/admin/analisis/anomalias` | No resueltas, severidad → fecha; lista vacía controlada si el modelo no existe. |

- **Patrón de ruta**: copiado de `src/app/api/admin/estadisticas/route.ts` — `verifyAuth()` → `assertModulo(user, "estadisticas")` → chequeo `rol === "ADMIN"` → `checkRateLimit(req, "admin_read")` → Zod → servicio DAL → `AppError` con códigos canónicos.
- **Alternativa considerada**: un único endpoint agregado que devuelva todo el panel. Descartada: los bloques tienen cadencias y tamaños distintos (la dispersión puede truncar a 500 puntos); endpoints separados permiten carga paralela y estados de error independientes por bloque.

### 2.4 Agregaciones en el DAL

- Servicio `src/lib/dal/services/analisis-panel.ts` que orquesta repositorios nuevos en `src/lib/dal/repositories/analisis-*.ts`.
- Queries agregadas con `groupBy`/`aggregate` de Prisma cuando el plano lo permite y `$queryRaw` tipado para cohortes y canal (clasificación condicional con precedencia), siempre con parámetros bound (nunca interpolación de strings).
- **Score promedio por fila**: join a `ScoreCliente` del período (`periodo = "YYYY-MM"` en Bogotá) sobre `suscripcionId`; filas sin score aportan `null` y no se promedian como 0.
- **Recaudo**: solo `Pago.estado = AUTORIZADO`, `montoNetoUSD`, dentro del rango del período.
- **MRR**: para cada suscripción `ACTIVA`, `precioBaseUSD / mesesDeDuracion(plan.duracion)` sumado; conversión con `TasaCambio` no aplica (todo normalizado a USD por SPEC-214).
- **MAU**: `COUNT(DISTINCT usuarioId)` de `SesionLog` con actividad en el período.
- **Churn**: `canceladasEnPeriodo / activasAlInicioDelPeriodo`.
- **Cohorte**: `date_trunc('month', fechaInicio AT TIME ZONE 'America/Bogota')`.
- **Canal**: precedencia `referido` (`codigoReferidoUsado IS NOT NULL`) → `bono` (existe `BonoAplicado`) → `freemium_convertido` (`esFreemium` + pago autorizado) → `directo`.

### 2.5 UI y sistema visual

- Tokens heredados: `ambar` para acentos admin, `pino`/`ambar`/`rubi` para semáforos y severidades, vidrio Apple en cards (patrón de los paneles admin existentes).
- Dispersión con `recharts` (3.10.1, ya en `package.json`; usado en `src/components/modules/colegio/home/TendenciaReportes.tsx`): `ScatterChart` con 4 `ReferenceArea`/medianas y tooltip custom; click en punto → `router.push("/dashboard/admin/pagos/cliente/[id]")`.
- Drill-down por estado en querystring (`granularidad`, `paisId`, `ciudadId`, `colegioId`, filtros), breadcrumb derivado; filtros persistentes (FR-017) gratis via querystring.
- Estados vacíos neutros por bloque; sin voseo; lenguaje estadístico (constitución: presunción de inocencia — los scores describen uso comercial del cliente, nunca califican personas).

### 2.6 Degradación elegante de Anomalia

SPEC-225 (hermana) crea el modelo `Anomalia`. Para no acoplar el cierre:
- El repositorio de anomalías envuelve la consulta en un guard: si la tabla no existe (error Prisma `P2021`/tabla ausente) o no hay registros, devuelve `[]` y log `[AnalisisPanel] Anomalias no disponibles — SPEC-225 pendiente o sin datos`.
- **Alternativa considerada**: exigir SPEC-225 como dependencia bloqueante. Descartada: el instructivo fija dependencias solo en 220+221; el bloque de anomalías es P2.

### 2.7 Timezone

Cortes de período, cohortes y expiración de recomendaciones con helpers de `src/lib/fechas/` (SPEC-200/208, `formato-bogota.ts`) y `America/Bogota` en los `date_trunc` SQL.

## 3. Estructura de archivos propuesta

```text
src/app/dashboard/admin/estadisticas/
  components/EstadisticasSubNav.tsx        # +1 tab literal
  dinero-vs-valor/
    page.tsx                               # server: verificarAccesoPagina + rol ADMIN
    DineroVsValorClient.tsx                # orquestador cliente: filtros, granularidad, drill
    components/
      TopDecisiones.tsx                    # cards grandes + resolver
      MatrizDispersion.tsx                 # recharts ScatterChart + cuadrantes
      TablaGranularidad.tsx                # tabla + semáforo + click drill
      BreadcrumbDrill.tsx
      KpiTiles.tsx
      PanelAnomalias.tsx
      FiltrosGlobales.tsx

src/app/api/admin/analisis/
  top-decisiones/route.ts + route.test.ts
  recomendaciones/[id]/resolver/route.ts + route.test.ts
  dinero-vs-valor/route.ts + route.test.ts
  dispersion/route.ts + route.test.ts
  kpis/route.ts + route.test.ts
  anomalias/route.ts + route.test.ts

src/lib/dal/services/analisis-panel.ts + analisis-panel.test.ts
src/lib/dal/repositories/
  analisis-agregaciones.ts + test         # granularidades + totales
  analisis-dispersion.ts + test
  analisis-kpis.ts + test
  analisis-recomendaciones.ts + test      # top 5 + resolver (TX + AuditLog)
  analisis-anomalias.ts + test            # con guard de tabla ausente

src/lib/schemas/analisis-panel.ts         # Zod de query/body
prisma/seed.ts                            # (opcional) analisis.panel.umbral_* aditivos
```

## 4. Contratos

Ver `contracts/222-panel-analisis.md` (shapes de request/response de los 6 endpoints).

## 5. Fases de implementación

1. **Fase 1 — Schemas Zod + repositorios DAL** (agregaciones, dispersión, KPIs, recomendaciones, anomalías) con tests unitarios sobre PostgreSQL de test.
2. **Fase 2 — Endpoints** (6 rutas) con tests de ruta (rol, validación, paginación, 409).
3. **Fase 3 — UI**: subnav + página + componentes por bloque.
4. **Fase 4 — Drill-down + filtros persistentes + dispersión interactiva**.
5. **Fase 5 — Gate local** (`tsc` + `lint` + `test:unit` + `build`) + `arch:check` verde.

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| SPEC-220/221 aún no mergeadas al codificar | Escribir contra el schema del brief §5.2/§5.4 (mismo lote); validar diff de esas specs antes del implement; si difieren, ajustar campos en repositorios. |
| SPEC-225 (Anomalia) cierra después | Guard de tabla ausente + estado vacío (FR-010). |
| Queries lentas con histórico grande | `groupBy` agregado en BD, índices existentes (`Suscripcion(estado, fechaFin)`, `Pago(suscripcionId, createdAt)`), límite de puntos en dispersión. |
| `arch:check` rompe por nuevo href | href literal en el array `tabs` del subnav (patrón documentado en el propio componente). |
| Confusión con SPEC-218 | No tocar `/dashboard/admin/pagos/analitica`; documentar convivencia en cierre. |
| PII en tooltips/etiquetas | Solo nombre comercial del cliente (colegio/titular) + métricas; test de contrato SC-006. |
