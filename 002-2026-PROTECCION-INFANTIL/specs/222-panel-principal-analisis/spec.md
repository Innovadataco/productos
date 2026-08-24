# Feature Specification: SPEC-222 — Panel principal Análisis (Dinero vs Valor)

**Feature Branch**: `work/002-PI-mega-cola-restante`

**Created**: 2026-08-24

**Status**: IMPLEMENTADO

**Dependencias bloqueantes**: SPEC-220 (modelos `ScoreCliente` + parámetros `analisis.*` + job de recálculo) y SPEC-221 (`ReglaRecomendacion` + `Recomendacion` + worker de evaluación) del mismo mega-lote. El panel de anomalías consume el modelo `Anomalia` de SPEC-225 (hermana del lote); si aún no está implementada, el bloque renderiza estado vacío.

Impacto en arquitectura: añade la ruta-tab `/dashboard/admin/estadisticas/dinero-vs-valor` (enganchada al `EstadisticasSubNav` existente, D-72), endpoints de solo lectura bajo `src/app/api/admin/analisis/**`, un servicio DAL de agregaciones comerciales y un endpoint de resolución de recomendaciones. Cero migraciones propias; solo consume modelos de SPEC-220/221/225. Sin IA: 100% SQL agregado + heurísticas.

**Input**: El BRIEF-ANALISIS-DINERO-VS-VALOR (§7 granularidades, §10.1 wireframe del panel principal) define el "cerebro comercial" del CEO: una vista donde el admin sabe qué hacer HOY. Ya existen los datos de Pagos (`Suscripcion`, `Pago`, `Plan`, `BonoAplicado`, `CodigoReferidoUso`), `SesionLog` (SPEC-206) y la analítica de widgets de SPEC-218. Falta el panel que cruce dinero (monto pagado) con valor (score de uso) y exponga recomendaciones y anomalías accionables.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Admin ve el Top 5 de decisiones del día (Priority: P1)

Como ADMIN quiero abrir el tab "Dinero vs Valor" y ver arriba las 5 recomendaciones pendientes de mayor prioridad con acciones directas, para saber a quién llamar hoy sin navegar por reportes.

**Why this priority**: la filosofía del módulo es "decisiones, no dashboards" (brief §1); el bloque "Tu top 5 hoy" es el titular del panel y la integración viva con el motor de reglas de SPEC-221.

**Independent Test**: sembrar 7 `Recomendacion` en estado `PENDIENTE` con prioridades variadas, abrir el panel y verificar que se muestran las 5 de mayor prioridad ordenadas descendentemente; marcar una como aplicada y confirmar que desaparece del Top 5 y queda registrada la resolución.

**Acceptance Scenarios**:

1. **Given** existen recomendaciones `PENDIENTE` no expiradas, **When** el admin abre `/dashboard/admin/estadisticas/dinero-vs-valor`, **Then** ve hasta 5 cards ordenadas por `prioridad DESC, generadaEn ASC` con título, descripción, categoría y acciones.
2. **Given** una card de recomendación, **When** el admin pulsa "Marcar como aplicada", **Then** la recomendación pasa a `APLICADA` con `resueltaPorAdminId` y `resueltaEn`, se registra `AuditLog` y la card sale del Top 5.
3. **Given** una card de recomendación, **When** el admin pulsa "Ignorar", **Then** la recomendación pasa a `IGNORADA` con motivo opcional y se registra `AuditLog`.
4. **Given** recomendaciones con `expiraEn` ya vencido, **When** se consulta el Top 5, **Then** no aparecen (se consideran expiradas a efectos de visualización).
5. **Given** que no hay recomendaciones pendientes, **When** el admin abre el panel, **Then** el bloque muestra un estado vacío neutral ("Sin decisiones pendientes hoy"), sin error.
6. **Given** un usuario con rol distinto de `ADMIN`, **When** intenta acceder a la ruta o a los endpoints, **Then** recibe `403`.

---

### User Story 2 — Matriz de dispersión dinero-vs-valor con drill-down (Priority: P1)

Como ADMIN quiero una gráfica de dispersión donde X = monto pagado (USD) e Y = score de valor, con cuadrantes etiquetados, para detectar clientes en riesgo (alto pago / bajo valor) y oportunidades de upsell (bajo pago / alto valor).

**Why this priority**: es el cruce que da nombre al módulo (brief §6.3, §10.1) y solo es posible ahora que existe `ScoreCliente` (SPEC-220); sin él el panel es otro dashboard de pagos más.

**Independent Test**: sembrar suscripciones con pagos autorizados y `ScoreCliente` del período actual en los cuatro cuadrantes, abrir el panel y verificar que cada punto cae en su cuadrante y que al hacer click se navega a la vista del cliente.

**Acceptance Scenarios**:

1. **Given** suscripciones con `ScoreCliente` del período seleccionado y pagos autorizados, **When** el admin abre la matriz, **Then** cada punto representa una suscripción con X = monto neto USD acumulado del período e Y = `scoreTotal`.
2. **Given** la matriz, **Then** se dibujan las medianas (o umbrales parametrizables) que dividen los 4 cuadrantes con etiquetas neutras: "Estables", "Riesgo", "Oportunidad", "Atención".
3. **Given** un punto de la dispersión, **When** el admin hace click, **Then** navega a `/dashboard/admin/pagos/cliente/[id]` (vista existente de SPEC-211).
4. **Given** un punto en el cuadrante "Riesgo", **Then** se renderiza en color `rubi`; "Oportunidad" en `ambar`; "Estables" en `pino`; "Atención" en gris/neutral.
5. **Given** suscripciones sin `ScoreCliente` calculado para el período, **Then** se excluyen de la dispersión y su conteo se indica como nota ("N clientes sin score calculado").
6. **Given** el hover sobre un punto, **Then** el tooltip muestra nombre del cliente (colegio o etiqueta del titular), monto USD y score — nunca datos de reportes, menores ni denunciantes.

---

### User Story 3 — Siete granularidades con drill-down navegable (Priority: P1)

Como ADMIN quiero analizar recaudo y score por país, ciudad, colegio, padre, plan, cohorte y canal, con drill-down País → Ciudad → Colegio → Cliente y breadcrumb para volver, para decidir dónde invertir y dónde intervenir.

**Why this priority**: es el cuerpo analítico del panel (brief §7); las 7 granularidades son alcance explícito del instructivo.

**Independent Test**: con datos en 2 países y 3 ciudades, seleccionar cada granularidad y verificar la tabla agregada; hacer click en un país y confirmar que la vista baja a ciudades de ese país con breadcrumb "Todos → Colombia".

**Acceptance Scenarios**:

1. **Given** el panel, **When** el admin selecciona la granularidad "País" (default), **Then** ve una tabla con una fila por país: suscripciones activas, recaudo USD del período, score promedio y semáforo (`pino`/`ambar`/`rubi`) según variación vs período anterior.
2. **Given** una fila de país, **When** el admin hace click, **Then** la vista baja a "Ciudad" filtrada por ese país y el breadcrumb muestra `Todos → <país>`.
3. **Given** una fila de ciudad, **When** el admin hace click, **Then** baja a "Colegio" filtrado por esa ciudad; desde un colegio baja al cliente individual (vista SPEC-211).
4. **Given** la granularidad "Plan", **Then** la tabla compara por duración de plan (`MES_1`…`MES_12`) y tipo de titular: clientes, recaudo, % renovación y score promedio.
5. **Given** la granularidad "Cohorte", **Then** los clientes se agrupan por mes de inicio (`fechaInicio`, mes calendario Bogotá) mostrando tamaño de cohorte, % retenidos y score promedio actual.
6. **Given** la granularidad "Canal", **Then** los clientes se clasifican en `referido` (tiene `codigoReferidoUsado`), `bono` (tiene `BonoAplicado`), `freemium convertido` (`esFreemium` con pago posterior autorizado) o `directo` (resto), con recaudo y score por canal.
7. **Given** la granularidad "Padre", **Then** la tabla agrega clientes tipo `PADRE` con su recaudo y score; el drill-down de padre llega a la vista de cliente individual (no hay nivel ciudad garantizado para padres).
8. **Given** cualquier breadcrumb intermedio, **When** el admin hace click en un nivel anterior, **Then** la vista vuelve a ese nivel conservando los filtros globales.

---

### User Story 4 — KPIs base del negocio (Priority: P2)

Como ADMIN quiero una fila de tiles con MAU, MRR, churn rate, LTV, % renovaciones, % conversión freemium y % referidos exitosos, para tener el panorama general sin calcular nada a mano.

**Why this priority**: complementa la matriz con la salud global (brief §10.1 "Bloque KPIs"); son métricas derivables de datos ya existentes.

**Independent Test**: con un dataset conocido, abrir el panel y verificar que cada tile muestra el valor esperado y su delta vs período anterior.

**Acceptance Scenarios**:

1. **Given** datos del período seleccionado, **When** se cargan los KPIs, **Then** se muestran: MAU (usuarios con `SesionLog` activo en el período), MRR (suma mensualizada de suscripciones `ACTIVA`), churn rate (canceladas / activas al inicio del período), LTV (promedio de recaudo histórico por cliente), % renovaciones, % conversión freemium y % referidos exitosos.
2. **Given** cada KPI, **Then** muestra su delta porcentual vs el período anterior equivalente con flecha o signo, en lenguaje descriptivo.
3. **Given** un KPI sin datos suficientes (ej. período sin cancelaciones), **Then** muestra `0%` o "—" sin romper el layout.
4. **Given** los cortes de período, **Then** se calculan en día calendario `America/Bogota` (D-69).

---

### User Story 5 — Panel de anomalías detectadas (Priority: P2)

Como ADMIN quiero una lista de anomalías con severidad, descripción y botón "Revisar", para atender primero lo crítico.

**Why this priority**: cierra el wireframe §10.1; las anomalías severidad ALTA son de las pocas cosas que llegan también por email (SPEC-223/225) y deben tener su espejo en el panel.

**Independent Test**: sembrar `Anomalia` de severidades BAJA/MEDIA/ALTA, abrir el panel y verificar orden (ALTA primero), colores de severidad y que "Revisar" navega al sujeto asociado cuando existe.

**Acceptance Scenarios**:

1. **Given** anomalías no resueltas, **When** el admin abre el panel, **Then** las ve ordenadas por `severidad` (ALTA → MEDIA → BAJA) y `detectadaEn DESC`, con badge de color (`rubi`/`ambar`/`pino`).
2. **Given** una anomalía con `sujetoTipo`/`sujetoId`, **When** el admin pulsa "Revisar", **Then** navega a la vista del sujeto (cliente o colegio); sin sujeto, el botón queda oculto o deshabilitado.
3. **Given** el modelo `Anomalia` aún no desplegado (SPEC-225 pendiente), **When** se carga el bloque, **Then** muestra estado vacío ("Sin anomalías detectadas") sin error ni 500.
4. **Given** una anomalía, **Then** su descripción nunca incluye texto de reportes, identificadores de menores ni datos de denunciantes.

---

### User Story 6 — Filtros globales persistentes durante la sesión (Priority: P3)

Como ADMIN quiero filtros de período, estado de suscripción y tipo de titular que se mantengan al cambiar de granularidad o al hacer drill-down, para no reconfigurar la vista en cada click.

**Why this priority**: mejora de flujo (brief §7 "Filtros globales"); no bloquea el valor central del panel.

**Independent Test**: aplicar período "trimestre" + estado "ACTIVA", cambiar de granularidad País → Plan, hacer drill-down y volver; verificar que los filtros siguen aplicados.

**Acceptance Scenarios**:

1. **Given** filtros aplicados, **When** el admin cambia de granularidad o navega el drill-down, **Then** los filtros se conservan (estado en cliente / querystring).
2. **Given** el filtro de período "rango custom", **When** el admin ingresa fechas desde/hasta, **Then** las agregaciones respetan el rango en zona Bogotá.
3. **Given** filtros en querystring, **When** el admin comparte la URL con otro admin, **Then** este ve la misma configuración de vista.

---

## Edge Cases

- **ScoreCliente sin calcular en el período**: suscripciones sin snapshot se excluyen de la dispersión y del score promedio; se muestra el conteo de excluidos como nota, nunca se inventa score 0 silenciosamente.
- **Suscripción PADRE sin ciudad**: los padres no tienen `ciudadId` garantizado (solo `paisCliente` en `Suscripcion`); en granularidad Ciudad se agrupan en un bucket "Sin ciudad" por país.
- **Período futuro o rango invertido**: validación Zod rechaza `desde > hasta` con `400`; período futuro devuelve agregados vacíos sin error.
- **Recomendación resuelta en otra pestaña**: al marcar aplicada/ignorada una recomendación ya resuelta, el endpoint responde `409` y la UI refresca el Top 5.
- **Recomendaciones expiradas**: no se muestran en Top 5; el worker de SPEC-221 las marca `EXPIRADA`, pero el endpoint filtra por `expiraEn > now()` como defensa adicional.
- **Dataset grande**: las agregaciones se ejecutan como queries SQL agregadas en el DAL (sin N+1); las tablas paginan con `page`/`pageSize` (default 25, máx 100) y la dispersión limita puntos (default máx 500, con nota si se trunca).
- **Cruce con SPEC-218**: la analítica de widgets de pagos (`/dashboard/admin/pagos/analitica`) sigue viva; este tab no la reemplaza ni duplica sus 4 widgets — el Top 5 lee `Recomendacion` (motor de reglas), no las listas hardcodeadas de SPEC-218.
- **Cliente eliminado o colegio sin suscripción activa**: los agregados se calculan sobre `Suscripcion` como eje; un colegio sin suscripción no aparece en granularidad Colegio del período.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE añadir la ruta `/dashboard/admin/estadisticas/dinero-vs-valor` como tab "Dinero vs Valor" en `EstadisticasSubNav` (`src/app/dashboard/admin/estadisticas/components/EstadisticasSubNav.tsx`), siguiendo D-72 (módulo dentro de estadísticas, no ruta paralela) y el patrón de hrefs literales parseables por `scripts/arch/lib/nav-fuentes.ts`.
- **FR-002**: La página DEBE ser Server Component con verificación de acceso (`verificarAccesoPagina` + rol `ADMIN`), delegando la interactividad a un `*Client.tsx` con `"use client"`.
- **FR-003**: El sistema DEBE exponer `GET /api/admin/analisis/top-decisiones` que devuelva hasta 5 `Recomendacion` en estado `PENDIENTE` no expiradas ordenadas por `prioridad DESC, generadaEn ASC`.
- **FR-004**: El sistema DEBE exponer `POST /api/admin/analisis/recomendaciones/[id]/resolver` con body Zod `{ accion: "APLICADA" | "IGNORADA", motivo? }`, restringido a `ADMIN`, que actualice estado/`resueltaEn`/`resueltaPorAdminId`/`motivoResolucion`, registre `AuditLog` y responda `409` si ya estaba resuelta.
- **FR-005**: El sistema DEBE exponer `GET /api/admin/analisis/dinero-vs-valor` con query params `granularidad` (enum: `pais|ciudad|colegio|padre|plan|cohorte|canal`), `periodo` (`mes|trimestre|anio|custom`), `desde`/`hasta` (solo custom), `estado`, `tipoTitular`, `paisId`, `ciudadId`, `colegioId`, `page`/`pageSize`, devolviendo `{ items, pagination, totales }` con agregaciones de recaudo USD, conteo de suscripciones y score promedio por fila.
- **FR-006**: El drill-down DEBE implementarse por combinación de `granularidad` + filtros de nivel (`paisId`, `ciudadId`, `colegioId`) sobre el mismo endpoint, con breadcrumb en UI derivado de los filtros activos.
- **FR-007**: El sistema DEBE exponer `GET /api/admin/analisis/dispersion` que devuelva por suscripción del período: `suscripcionId`, etiqueta del cliente, `montoUSD` (pagos autorizados del período), `scoreTotal`, cuadrante calculado y tipo de titular; con límite de puntos parametrizable (default 500).
- **FR-008**: Los umbrales de corte de cuadrantes DEBEN calcularse por mediana del dataset o leerse de parámetros `analisis.panel.umbral_monto_usd` / `analisis.panel.umbral_score` si existen (seed aditivo opcional).
- **FR-009**: El sistema DEBE exponer `GET /api/admin/analisis/kpis` que devuelva MAU, MRR, churn rate, LTV, % renovaciones, % conversión freemium y % referidos exitosos, con deltas vs período anterior, calculados en día calendario `America/Bogota`.
- **FR-010**: El sistema DEBE exponer `GET /api/admin/analisis/anomalias` que devuelva anomalías no resueltas ordenadas por severidad y fecha; si el modelo `Anomalia` no existe aún en el entorno, el servicio DEBE devolver lista vacía controlada (feature flag o guard de tabla) en lugar de error.
- **FR-011**: Todos los endpoints DEBEN autenticar con `verifyAuth`, exigir rol `ADMIN` vía `assertModulo(user, "estadisticas")` + chequeo de rol, aplicar rate limit scope `admin_read` y validar query/body con Zod.
- **FR-012**: Toda la lógica de agregación DEBE vivir en el DAL (`src/lib/dal/services/analisis-panel.ts` + repositorios en `src/lib/dal/repositories/`), con queries agregadas tipadas (`Prisma.*WhereInput`); las rutas no tocan `prisma` directamente.
- **FR-013**: La matriz de dispersión DEBE implementarse con `recharts` (dependencia existente, v3.10.1) en un componente cliente; los cuadrantes usan tokens `pino`/`ambar`/`rubi` del sistema visual heredado.
- **FR-014**: El panel DEBE renderizar el bloque "Top 5 decisiones hoy" como cards grandes con acción destacada (patrón notificación accionable del brief §4), con acciones "Marcar como aplicada" e "Ignorar" funcionales y enlaces `tel:`/`mailto:` cuando la recomendación incluya datos de contacto en `datosContexto`.
- **FR-015**: Ningún endpoint ni componente DEBE exponer texto de reportes, identificadores de menores, datos de denunciantes ni PII de reportes; los agregados son exclusivamente comerciales (suscripciones, pagos, sesiones, scores).
- **FR-016**: La resolución de recomendaciones (aplicada/ignorada) DEBE registrar `AuditLog` con metadatos (recomendacionId, acción, adminId), sin texto sensible.
- **FR-017**: Los filtros globales DEBEN persistir en querystring durante la sesión de navegación del panel y sobrevivir a cambios de granularidad y drill-down.
- **FR-018**: La clasificación de canal DEBE derivarse de datos existentes: `codigoReferidoUsado` → `referido`; `BonoAplicado` → `bono`; `esFreemium` con pago autorizado posterior → `freemium_convertido`; resto → `directo` (precedencia en ese orden documentado).
- **FR-019**: El sistema DEBE incluir tests: unitarios del servicio DAL (cada granularidad, cuadrantes, KPIs, canal), de la ruta de resolución (`200/400/403/409`) y de la ruta de agregación (validación Zod, paginación, rol).
- **FR-020**: Los textos de UI DEBEN usar tono neutral sin voseo y lenguaje descriptivo/estadístico (presunción de inocencia): prohibido presentar scores como veredictos de personas.

### Key Entities

- **ScoreCliente** (SPEC-220): snapshot mensual del score de valor por suscripción. Atributos consumidos: `suscripcionId`, `periodo` (`"YYYY-MM"`), `scoreTotal`, `componente*`, `percentilEnCohorte`. Solo lectura.
- **Recomendacion** (SPEC-221): instancia generada por una regla. Atributos: `id`, `titulo`, `descripcion`, `categoria`, `prioridad`, `estado`, `sujetoTipo`/`sujetoId`, `datosContexto`, `accionSugerida`, `expiraEn`, `generadaEn`, `resueltaEn`, `resueltaPorAdminId`, `motivoResolucion`. Lectura + transición de estado (aplicada/ignorada).
- **Anomalia** (SPEC-225): `id`, `tipo`, `severidad`, `descripcion`, `sujetoTipo`/`sujetoId`, `detectadaEn`, `resueltaEn`. Solo lectura.
- **Suscripcion** (SPEC-210): eje de los agregados: `tipoTitular`, `estado`, `colegioId`, `usuarioId`, `fechaInicio`, `fechaFin`, `esFreemium`, `codigoReferidoUsado`, `paisCliente`.
- **Pago** (SPEC-210): `suscripcionId`, `montoNetoUSD`, `estado`, `fechaAutorizacion`, `createdAt` — fuente del recaudo (solo pagos `AUTORIZADO`).
- **Plan** (SPEC-210): `duracion`, `tipoTitular`, `precioBaseUSD` — granularidad Plan y mensualización del MRR.
- **Colegio**: `id`, `nombre`, `paisId`, `ciudadId` — niveles País/Ciudad/Colegio del drill-down.
- **SesionLog** (SPEC-206): fuente de MAU y del componente sesiones.
- **BonoAplicado / CodigoReferidoUso** (SPEC-210/215): clasificación de canal.
- **ParametroSistema**: parámetros `analisis.*` (SPEC-220) y umbrales opcionales `analisis.panel.*` de esta spec.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El tab "Dinero vs Valor" carga con sus 5 bloques (Top 5, dispersión, granularidad, KPIs, anomalías) en menos de 3 s (p95 local) con 1 000 suscripciones y 12 meses de datos.
- **SC-002**: Cada endpoint de agregación responde en menos de 800 ms (p95 local) con una sola query agregada por bloque (sin N+1 verificable en logs/tests).
- **SC-003**: Las 7 granularidades devuelven agregados correctos validados contra dataset semilla conocido (diferencia de recaudo = 0 vs cálculo manual del fixture).
- **SC-004**: El drill-down País → Ciudad → Colegio → Cliente funciona con breadcrumb y conserva filtros globales en el 100% de las transiciones.
- **SC-005**: Marcar aplicada/ignorada una recomendación la excluye del Top 5 en la siguiente carga y deja `AuditLog`; doble resolución concurrente responde `409`.
- **SC-006**: Ningún response de los endpoints contiene campos de texto de reportes ni PII de menores/denunciantes (assert en tests de contrato).
- **SC-007**: Con `Anomalia` no desplegado o vacío, el bloque renderiza estado vacío sin errores en consola ni 500.
- **SC-008**: El gate local completo (`npx tsc --noEmit`, `npm run lint --no-cache`, `npm run test:unit`, `npm run build`) queda verde y `npm run arch:check` no se degrada (nuevo href literal del subnav parseable).

---

## Assumptions

- SPEC-220 entrega `ScoreCliente`, los parámetros `analisis.*` y el job diario de recálculo en la misma rama antes de la implementación de esta spec; esta documentación asume su schema del brief §5.2.
- SPEC-221 entrega `Recomendacion`/`ReglaRecomendacion` y el worker de evaluación; esta spec solo lee recomendaciones y transiciona su estado (aplicada/ignorada), no genera ni evalúa reglas.
- El modelo `Anomalia` llega con SPEC-225 (hermana del lote, también depende de SPEC-221). El panel se diseña con degradación elegante (FR-010) para no bloquearse si SPEC-225 cierra después.
- La resolución de recomendaciones se implementa aquí (no en SPEC-227) porque el Top 5 del panel la requiere; SPEC-227 la reutiliza para su historial.
- La vista de cliente individual `/dashboard/admin/pagos/cliente/[id]` (SPEC-211) existe y es el destino final de todo drill-down; esta spec no la modifica (la extensión "Score de valor este mes" es de SPEC-220).
- Los pagos cuentan como recaudo solo en estado `AUTORIZADO`, usando `montoNetoUSD` (multi-moneda normalizado por SPEC-214).
- Los clientes PADRE no tienen ciudad confiable; el nivel Ciudad para padres usa bucket "Sin ciudad".
- CAC queda fuera (brief §10.1 lo marca "si aplica"; no hay datos de campañas).
- El mapa por país del brief §7 queda como mejora visual posterior; v1 usa tabla + semáforos (Leaflet disponible si ZEUS lo exige en la compuerta).
- Sin IA: todo el panel es SQL agregado + heurísticas; el motor `src/lib/ai/**` no se toca.

---

## Implementación *(por completar al cerrar)*

### Resumen de cambios

Implementado 2026-08-24 en `work/002-PI-mega-cola-restante`. Archivos:

**Creados — lógica y DAL**
- `src/lib/analisis/panel-calculos.ts` (+ `.test.ts`): helpers puros (cuadrante, mediana, semáforo, canal FR-018, delta, rangos Bogotá, cohorte, mensualización MRR).
- `src/lib/schemas/analisis-panel.ts` (+ `.test.ts`): Zod de los 4 query contracts + `parseQuery`.
- `src/lib/dal/repositories/analisis-panel-repository.ts`: frontera Q-3 del dominio (Top 5, base de suscripciones con includes en UNA query, groupBy de variación, anomalías con guard P2021/P2022, KPIs).
- `src/lib/dal/services/analisis-panel.ts` + `analisis-panel-tipos.ts` (split por techo E-8) + `analisis-panel.test.ts` (integración).

**Creados — endpoints** (`verifyAuth` → `assertModulo("estadisticas")` → rol ADMIN → rate limit `admin_read` → Zod → servicio DAL):
- `src/app/api/admin/analisis/top-decisiones/route.ts` (+ test), `dinero-vs-valor/route.ts` (+ test), `dispersion/route.ts` (+ test), `kpis/route.ts` (+ test), `anomalias/route.ts` (+ test).

**Creados — UI** (`src/app/dashboard/admin/estadisticas/dinero-vs-valor/`):
- `DineroVsValorPanelClient.tsx` (orquestador; filtros + drill en querystring, FR-017).
- `components/`: `tipos.ts`, `TopDecisiones.tsx` (+ test unitario), `KpiTiles.tsx`, `MatrizDispersion.tsx` (recharts, 4 series por cuadrante, ReferenceLine en cortes, click → vista cliente), `TablaGranularidad.tsx`, `BreadcrumbDrill.tsx`, `FiltrosGlobales.tsx`, `PanelAnomalias.tsx`.

**Modificados**
- `src/app/dashboard/admin/estadisticas/dinero-vs-valor/page.tsx`: mantiene intacto el contenido de SPEC-218 (KPIs + 4 widgets, sección "Analítica de pagos") y monta encima el panel SPEC-222.
- `src/app/api/admin/analisis/recomendaciones/[id]/resolver/route.ts` (SPEC-221): body acepta `accion` como alias de `estado` (exactamente uno), comportamiento 200/400/403/404/409 intacto (+ test añadido en su `route.test.ts`).
- `prisma/seed.ts`: `seedParametrosPanelAnalisis()` (ancla `// ── SPEC-222:`) — `analisis.panel.umbral_monto_usd`, `analisis.panel.umbral_score` (vacío = mediana), `analisis.panel.dispersion_max_puntos` (500); upsert `update: {}`, invocado desde `main()` y exportado.
- `vitest.unit.includes.ts`: 3 tests unitarios nuevos (ancla `// SPEC-222:`).
- `specs/222-panel-principal-analisis/`: `tasks.md` (generado), `checklists/requirements.md` (validado), este `spec.md`.

### Decisiones ejecutadas

- **H-1 (hallazgo)**: SPEC-218 ya ocupaba la ruta `/dashboard/admin/estadisticas/dinero-vs-valor` y el tab del subnav (el research asumía que vivía solo en `/dashboard/admin/pagos/analitica`). Decisión: convivencia en el mismo tab — el panel SPEC-222 (5 bloques) arriba y la analítica de pagos de SPEC-218 abajo, sin tocar sus widgets (§2.2 del plan). FR-001 quedó satisfecho sin añadir href nuevo (el tab ya existía); `src/lib/proxy.ts` no se tocó (el área `/dashboard/admin/**` ya está abierta a roles internos y el ADMIN-only se fuerza en página/rutas, patrón existente).
- **H-2 (hallazgo)**: el endpoint de resolución de FR-004 ya existía (SPEC-221, con TX + `AuditLog RECOMENDACION_RESUELTA` + 409). Se reutilizó y se extendió de forma aditiva con `accion` (alias del contrato). Cero migraciones: el valor de enum ya existía. Nota: el resolver de SPEC-221 no aplica rate limit `admin_read` ni `assertModulo("estadisticas")` (usa `verifyAuth("ADMIN")`); se mantuvo intacto por minimalidad — desviación parcial de FR-011 documentada.
- **H-3**: `Anomalia` ya estaba en el schema (SPEC-225 integrada); el guard de tabla ausente se implementó igual (FR-010) como defensa.
- Agregación en dos pasos: UNA query base `findMany` con includes tipados (sin N+1) + UN `groupBy` para la variación vs período anterior; agrupación por granularidad en el servicio. Cohorte y canal se calculan con helpers puros (no hizo falta `$queryRaw`).
- Score promedio y dispersión excluyen suscripciones sin snapshot del período (conteo `sinScore` visible); nunca score 0 silencioso.
- Cortes de cuadrantes: parámetros si AMBOS umbrales existen; si no, mediana del dataset (`cortes.fuente` lo indica).
- Deltas de KPIs: `conversionFreemiumPct` es stock histórico sin equivalente de período → `deltaPct: null` (contrato lo permite). MRR anterior = aproximación documentada (activas actuales que ya existían al cierre del período anterior; no hay snapshots de estado).
- Drill geográfico de padres: sin relación Pais/Ciudad; se contrasta `paisCliente` con el código del país del nivel y se agrupan en bucket "Sin ciudad" (Edge Case). El bucket de padres por país no tiene drill (etiqueta = código de país).

### Gate local

- `npx tsc --noEmit`: VERDE (0 errores).
- ESLint sobre todos los archivos de la spec (código + tests): VERDE (tras `--fix` de indentación y split del servicio por techo de 500 líneas).
- Tests unitarios (`vitest.unit.config.ts`, `--coverage.enabled=false`): 38/38 VERDES — `panel-calculos.test.ts` (23), `analisis-panel.test.ts` de schemas (9), `TopDecisiones.test.tsx` (6).
- `npm run tokens:check`: VERDE global (1090 ≤ piso 1094); 0 ocurrencias de color crudo en los archivos de la spec (regex del script).
- Tests de integración (rutas + servicio): escritos bajo `src/**`; NO corridos localmente (BD compartida, los corre el coordinador).
- `arch:check`: no corrido localmente (lo corre el coordinador); no se añadió href nuevo al subnav (el tab ya existía de SPEC-218).
- `./scripts/dev-restart.sh`: a cargo del coordinador (regla del mega-lote).

### Deuda técnica / notas

- El resolver de SPEC-221 queda sin rate limit `admin_read` (ver H-2); si ZEUS lo exige, se añade en una pasada posterior.
- Etiqueta del bucket de padres en granularidad País = código de país (`"CO"`); mapear al nombre del país sería una mejora cosmética.
- MRR "anterior" y deltas de métricas stock son aproximaciones documentadas (no hay snapshots históricos de estado de suscripción).
- SPEC-227 reutilizará el endpoint de resolución (Assumption confirmado).
