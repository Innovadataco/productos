# Research: SPEC-222 — Panel principal Análisis (Dinero vs Valor)

## 1. Contexto del problema

El BRIEF-ANALISIS-DINERO-VS-VALOR (mesa ARQ_12) define el tercer dominio de la triada Pagos/Notificaciones/Análisis: el "cerebro comercial" del CEO, sin IA (D-67 por analogía), 100% reglas SQL + heurísticas parametrizables. El instructivo 002-PI-123 fija el alcance de esta spec: tab "Dinero vs Valor" en `/dashboard/admin/estadisticas`, 7 granularidades con drill-down, gráfica de dispersión score-vs-monto, KPIs base, panel de anomalías e integración con `Recomendacion`.

Esta investigación resuelve las incógnitas de diseño contra el código real del repo.

## 2. Incógnitas resueltas contra el código

### 2.1 ¿Dónde se engancha el tab?

- `src/app/dashboard/admin/estadisticas/page.tsx:5-9` — la ruta índice redirige a `operacion`; las secciones viven como subrutas (`operacion/`, `motor/`, `salud-motor/`, `clasificacion/`).
- `src/app/dashboard/admin/estadisticas/components/EstadisticasSubNav.tsx:14-22` — array `tabs` con hrefs literales; el comentario del propio archivo advierte que `scripts/arch/lib/nav-fuentes.ts` los parsea para la aserción B de `arch:check`. El nuevo tab DEBE ser literal.
- `EstadisticasSubNav.tsx:35` — los tabs se filtran por `esDestinoPermitidoPorRol(user?.rol, href)` de `src/lib/proxy.ts`; hay que garantizar que la nueva ruta esté permitida para `ADMIN`.
- **Decisión**: subruta `dinero-vs-valor/` + entrada literal en `tabs` + regla de proxy.

### 2.2 ¿Qué patrón siguen los endpoints admin de agregación?

- `src/app/api/admin/estadisticas/route.ts:8-38` — `verifyAuth()` → `assertModulo(user, "estadisticas")` → chequeo `String(user.rol) !== "ADMIN"` → `checkRateLimit(req, "admin_read")` → servicio DAL (`EstadisticasService` en `src/lib/dal/services/estadisticas.ts`); comentario en línea 27: "las agregaciones viven en el DAL; la ruta no toca prisma".
- `src/lib/dal/repositories/` ya contiene ~40 repositorios tipados (`analytics-colegio.ts`, `alerta-suscripcion.ts`, etc.) con tests junto al código.
- **Decisión**: 6 rutas que replican ese patrón + servicio `AnalisisPanelService` + repositorios `analisis-*`.

### 2.3 ¿Existe ya algo de "Dinero vs Valor"?

- `specs/218-analitica-dinero-vs-valor-pagos/spec.md` — implementó 4 widgets accionables + KPIs de recaudo en `/dashboard/admin/pagos/analitica` (`src/app/dashboard/admin/pagos/analitica/page.tsx` existe). Su FR-001 contemplaba "tab en estadísticas O ruta propia"; ganó ruta propia.
- **Decisión**: convivencia sin tocar SPEC-218 (§2.2 del plan). El diferencial de esta spec es el cruce con `ScoreCliente` y el motor de `Recomendacion`.

### 2.4 ¿De dónde salen score, recomendaciones y anomalías?

- `grep 'model ScoreCliente\|ReglaRecomendacion\|Recomendacion\|Anomalia' prisma/schema.prisma` → **no existen** en el schema al momento de esta spec. Llegan con SPEC-220 (modelos + score), SPEC-221 (motor de reglas) y SPEC-225 (anomalías), specs hermanas del mismo mega-lote redactadas en paralelo contra el brief §5.2-§5.6.
- **Decisión**: diseñar contra el schema del brief (campos citados en `spec.md` §Key Entities); validar el diff de 220/221 antes del implement. Anomalías con guard de tabla ausente (FR-010).

### 2.5 ¿Qué modelos de pagos/sesiones alimentan los agregados?

- `prisma/schema.prisma:723-757` — `Suscripcion`: `tipoTitular` (enum `COLEGIO|PADRE`, línea 253), `estado` (enum `ACTIVA|EN_GRACIA|SUSPENDIDA|CANCELADA`, línea 258), `colegioId`, `usuarioId`, `fechaInicio`, `fechaFin`, `esFreemium`, `codigoReferidoUsado`, `paisCliente` (default `"CO"`). **Sin `ciudadId`** → bucket "Sin ciudad" para padres (Edge Case).
- `prisma/schema.prisma:759-792` — `Pago`: `montoNetoUSD`, `estado`, `fechaAutorizacion`, índice `(suscripcionId, createdAt)`. Recaudo = solo `AUTORIZADO`.
- `prisma/schema.prisma:677-697` — `Plan`: `duracion` (`DuracionPlan`), `precioBaseUSD`, `tipoTitular` → granularidad Plan y mensualización de MRR.
- `prisma/schema.prisma:640-662` — `SesionLog` (SPEC-206 ya implementada): `usuarioId`, `ultimaActividadEn` → MAU.
- `prisma/schema.prisma:819-854` — `BonoAplicado` y `CodigoReferidoUso` → clasificación de canal.
- `prisma/schema.prisma:873-899` — `Colegio`: `paisId`, `ciudadId`, `departamentoId` → niveles del drill-down.

### 2.6 ¿Librería de gráficas?

- `package.json:51` — `"recharts": "3.10.1"` ya instalada; en uso en `src/components/modules/colegio/home/TendenciaReportes.tsx` y `RitmoMensual.tsx`.
- `package.json:42,50` — `leaflet` + `react-leaflet` disponibles para el mapa por país del brief §7.
- **Decisión**: dispersión con `ScatterChart` de recharts; mapa diferido a mejora visual (Assumption).

### 2.7 ¿Timezone y formato?

- `src/lib/fechas/` existe con `formato-bogota.ts` (SPEC-200/208). Cortes Bogotá (D-69) en cohortes, períodos y expiración de recomendaciones.

## 3. Opciones consideradas

### 3.1 Un endpoint agregado vs endpoints por bloque

| Opción | Pros | Contras | Decisión |
|--------|------|---------|----------|
| Un solo endpoint "panel" | 1 request | Acopla cadencias, respuestas gigantes, un error tira todo el panel | No |
| Endpoint por bloque (6) | Carga paralela, estados de error independientes, tests aislados | Más archivos | Sí |

### 3.2 Dispersión: server-render vs cliente

- La interacción (hover, click, cuadrantes) exige cliente. recharts ya es dependencia cliente en el repo. **Decisión**: `MatrizDispersion.tsx` con `"use client"` alimentado por `GET /api/admin/analisis/dispersion`.

### 3.3 Cuadrantes: mediana dinámica vs umbrales fijos

| Opción | Pros | Contras | Decisión |
|--------|------|---------|----------|
| Mediana del dataset | Siempre divide, auto-adaptable | Cuadrantes se mueven entre períodos | Default |
| Parámetros `analisis.panel.umbral_*` | Estables, comparables en el tiempo | Requieren tuning | Override opcional vía seed |

### 3.4 ¿Dónde vive la resolución de recomendaciones?

- El brief la asocia al panel (§8.1) y al historial (§10.4 = SPEC-227).
- **Decisión**: se implementa aquí porque el Top 5 la necesita; SPEC-227 la reutiliza. Documentado en Assumptions para auditoría de ZEUS.

## 4. Referencias y dependencias

- **SPEC-220** (002-PI-121): `ScoreCliente`, parámetros `analisis.*`, job de recálculo. Bloqueante.
- **SPEC-221** (002-PI-122): `ReglaRecomendacion`, `Recomendacion`, worker de evaluación. Bloqueante.
- **SPEC-225** (002-PI-126): modelo `Anomalia`. Hermana; degradación elegante si cierra después.
- **SPEC-218** (002-PI-118): analítica de widgets de pagos; convive, no se toca.
- **SPEC-211** (002-PI-111): vista cliente `/dashboard/admin/pagos/cliente/[id]`, destino del drill-down.
- **SPEC-206** (002-PI-120): `SesionLog` para MAU.
- **SPEC-210/214/215**: `Suscripcion`/`Pago`/`Plan`, multi-moneda (USD normalizado), referidos.
- **BRIEF-ANALISIS-DINERO-VS-VALOR.md** §7, §10.1: fuente primaria de diseño.
- **AGENTS.md** + `.specify/memory/constitution.md`: convenciones y candados.

## 5. Lecciones de specs anteriores

- SPEC-171 demostró el patrón page-server + client + subnav literal parseable por `arch:check`.
- SPEC-053 fijó "agregaciones en el DAL, la ruta no toca prisma".
- SPEC-210 fijó enums y campos USD normalizados que hacen los agregados multi-moneda triviales.

## 6. Preguntas abiertas (para clarify con ZEUS si es necesario)

1. ¿El mapa por país del brief §7 (Leaflet) entra en v1 de esta spec o queda como mejora visual posterior? Esta documentación lo asume diferido.
2. ¿Los umbrales de cuadrantes arrancan como mediana dinámica o como parámetros fijos sembrados? Propuesto: mediana con override por parámetro.
3. ¿La analítica de SPEC-218 se consolida en este tab en una spec futura o convive indefinidamente?
