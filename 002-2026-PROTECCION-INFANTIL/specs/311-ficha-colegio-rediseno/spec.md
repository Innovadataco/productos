# Feature Specification: Ficha colegio admin · Fase 2 · Rediseño 4 bloques A→D (SPEC-311)

**Feature Branch**: `work/pi-SPEC-311-ficha-colegio-rediseno`
**SPEC**: 311 (reasignado desde SPEC-304 tras HALLAZGO candado 17 D-98 · SPEC-304 reservado A-50 Home Padre Proactivo)
**Created**: 2026-08-29
**Status**: PLANEADO
**Input**: INSTRUCTIVO-002-PI-210-FICHA-COLEGIO-ADMIN-FASE-2 · BRIEF-FICHA-COLEGIO-ADMIN §6.2 + §9 · Cierra I-98 · Continuidad Fase 1 SPEC-303 (`7e96e305b` desplegado 2026-08-29 20:49 COT)

Impacto en arquitectura: reorganización estructural del componente `ColegioDetalleSecciones.tsx` (7 secciones planas actuales) en 4 bloques con propósito A→D — orden es la decisión, no se pierde información (SC-006 audita). Se crea el componente nuevo `ColegioLineaTiempo.tsx` para el Bloque C (visualización horizontal SVG puro o CSS flex · sin librería nueva). El payload del endpoint `/api/admin/analytics/colegios/[id]` se AMPLÍA aditivamente con 4 bloques nuevos derivados en `analytics-colegio.ts` invocando `ColegioActividadRepository.actividadDelColegio` (Fase 1) con rangos apropiados: `distribucionRol` (padre/estudiante/profesor/anónimo, derivada de `Usuario.rol` + `esAnonimo`/`origenRol` SPEC-295), `operadoresAsignados` (DISTINCT `AlertaColegio.asignadoA` con nombre + email), `lineaTiempo` (fechaRegistro + primerReporte all-time + picoActividad histórico + hoy), `serieMensual` (año-mes agregado all-time o rango configurado). **Cero cambios** en `src/lib/dal/repositories/colegio-actividad.ts` (repo Fase 1, contrato inmutable), `src/lib/ai/**`, `prisma/schema.prisma` (cero migración destructiva, cero campo nuevo), `scripts/deploy-prod.sh`, `.github/workflows/verificar-base-pr.yml`. Cero librería nueva de charts: reutiliza `BarChart.tsx`, `TendenciaReportes.tsx` (Recharts AreaChart), `RitmoMensual.tsx`, tokens PI `pino`/`ambar`/`rubi` + Instrument + vidrio. Terminología ADMIN libre (§3 brief UX rector NO aplica al ADMIN de plataforma).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Admin abre la ficha y en 2 segundos sabe qué tiene que hacer (Priority: P1)

Un ADMIN de IDC abre `/dashboard/admin/estadisticas/operacion/colegios/[colegioId]`. Hoy la ficha muestra 7 secciones planas que empiezan por "1. Información básica" (referencia burocrática · nombre del rector, dirección, tipo de periodo). El admin tiene que scrollear para encontrar "3. Actividad de reportes" y aún más para encontrar "5. Alertas". Después del rediseño: lo primero visible es el **Bloque A · ¿QUÉ PASA AQUÍ HOY?** con 3 KPIs (casos abiertos, total reportes rango, % procesados), 2 CTAs clicables (`[Ver casos abiertos]` y `[Ver alertas]`), la lista de operadores asignados y el semáforo con motivo si no-verde. El admin en 2 segundos identifica si el colegio requiere acción y hacia dónde ir.

**Why this priority**: Es el corazón del brief §2.1 ("Una pantalla que no dice qué hacer, no sirve") y de I-98 ("ficha genérica sin propósito"). Sin este bloque en primer lugar, el rediseño no cierra la incidencia. Cierra el 70% del valor de Fase 2.

**Independent Test**: Abrir la ficha de un colegio con `casosAbiertos > 0` y `semaforo != verde`. Verificar visualmente: (a) el Bloque A aparece PRIMERO, arriba de todo lo demás; (b) muestra los 3 KPIs con números reales; (c) los 2 CTAs son links clicables con hrefs que contienen `?colegioId=<id>`; (d) la lista de operadores muestra al menos un nombre + email; (e) el motivo bajo el semáforo aparece cuando no es verde.

**Acceptance Scenarios**:

1. **Given** un colegio con 3 casos abiertos, semáforo amarillo y 2 operadores asignados, **When** el ADMIN abre la ficha, **Then** el Bloque A es lo primero visible sin necesidad de scroll (posición Y = 0 relativo al contenido) y muestra "3 casos abiertos" + los 2 CTAs.
2. **Given** el mismo colegio, **When** el ADMIN hace click en `[Ver casos abiertos]`, **Then** navega a `/dashboard/admin/reportes?colegioId=<id>&estado=REVISION_MANUAL,POSIBLE_SPAM`.
3. **Given** el mismo colegio, **When** el ADMIN hace click en `[Ver alertas]`, **Then** navega a `/dashboard/admin/alertas?colegioId=<id>`.
4. **Given** un colegio verde sin casos abiertos, **When** el ADMIN abre la ficha, **Then** el Bloque A muestra "0 casos abiertos" y el semáforo verde SIN línea de motivo.
5. **Given** un colegio sin operadores asignados a alertas, **When** el ADMIN abre la ficha, **Then** el Bloque A muestra "Sin operadores asignados" (mensaje neutral) en lugar de una lista vacía.

---

### User Story 2 — Admin entiende el comportamiento del colegio con gráficos (Priority: P1)

El ADMIN, después de ver el Bloque A, quiere entender "cómo se comporta" el colegio: la tendencia mensual de reportes, la distribución por estado y quién está reportando (padre/estudiante/profesor/anónimo). El **Bloque B · CÓMO SE COMPORTA** aparece en segundo lugar (después del A) con: (a) un chart temporal reutilizando `TendenciaReportes.tsx` (AreaChart mensual) alimentado con `serieMensual` del payload; (b) un `BarChart` para distribución por estado del reporte (de `porEstado` existente Fase 1); (c) una vista de distribución por rol reportante (`distribucionRol`).

**Why this priority**: Es el análisis fundamental que el brief §6.2 pide en el Bloque B. Sin este bloque el ADMIN no tiene contexto para diagnosticar. Cierra el 20% del valor.

**Independent Test**: Abrir la ficha de un colegio con al menos 6 meses de reportes. Verificar visualmente: (a) el Bloque B aparece SEGUNDO (después del A); (b) el gráfico de tendencia mensual muestra al menos 6 puntos etiquetados por mes; (c) el gráfico de barras por estado tiene al menos 1 estado con valor > 0; (d) la distribución por rol reportante suma el mismo total que `actividadReportesCruzada.total`.

**Acceptance Scenarios**:

1. **Given** un colegio con reportes distribuidos en 6 meses distintos, **When** el ADMIN mira el Bloque B, **Then** el chart mensual muestra 6 puntos con la magnitud correcta por mes.
2. **Given** un colegio con 5 reportes CLASIFICADOS y 2 en REVISION_MANUAL, **When** el ADMIN mira la distribución por estado, **Then** las barras muestran exactamente esos números.
3. **Given** un colegio con 3 reportes de padre, 5 de estudiante, 1 de profesor y 2 anónimos, **When** el ADMIN mira la distribución por rol, **Then** los 4 valores están presentes y suman 11 (el total del rango).
4. **Given** un colegio sin actividad histórica, **When** el ADMIN mira el Bloque B, **Then** los charts muestran EmptyState neutral, NO error ni "Sin datos" (que sería un flashback al bug de Fase 1).

---

### User Story 3 — Admin ve la trayectoria histórica del colegio (Priority: P2)

El ADMIN quiere ubicar temporalmente al colegio: cuándo ingresó, cuándo empezó a reportar, cuándo tuvo el pico. El **Bloque C · LÍNEA DE TIEMPO** aparece en tercer lugar con una visualización horizontal simple mostrando 4 hitos: (1) `fechaRegistro` — cuándo ingresó el colegio · (2) `primerReporte` — MIN(creadoEn) all-time · (3) `picoActividad` — mes con más reportes · (4) `hoy`. Cada hito etiquetado con fecha legible.

**Why this priority**: Da contexto temporal sin ocupar mucho espacio. P2 porque no bloquea la acción inmediata del admin, pero cierra la sección §6.2 Bloque C del brief.

**Independent Test**: Abrir la ficha de un colegio con al menos 3 meses de historia. Verificar: (a) el Bloque C aparece TERCERO; (b) los 4 hitos son visibles en orden temporal izquierda-a-derecha; (c) cada hito tiene una etiqueta con fecha o mes; (d) `hoy` está siempre al extremo derecho; (e) los hitos NO se apilan si están cerca en el tiempo (siguen distinguibles).

**Acceptance Scenarios**:

1. **Given** un colegio que ingresó hace 8 meses con reportes desde el mes 3, **When** el ADMIN mira el Bloque C, **Then** ve 4 marcadores en la línea: "ingreso" en la izquierda, "primer reporte" a ~3/8 del recorrido, "pico" en algún punto intermedio, "hoy" en la derecha.
2. **Given** un colegio sin ningún reporte histórico, **When** el ADMIN mira el Bloque C, **Then** ve solo 2 hitos: "ingreso" y "hoy", con etiqueta neutral entre ellos ("Sin reportes registrados aún") en lugar de intentar mostrar hitos vacíos.
3. **Given** el mismo colegio de (1), **When** se mide la altura vertical del Bloque C, **Then** es < 100 px (visualización compacta, no ocupa media pantalla).

---

### User Story 4 — Nada se pierde del contenido anterior (Priority: P1 · regresión)

El ADMIN que ya conocía la ficha antigua puede encontrar TODO lo que había: información básica (rector, dirección, tipo de periodo), métricas de tamaño (alumnos, profesores, cursos, materias), comité de convivencia, hallazgos, comparación con la media. Todo eso vive en el **Bloque D · FICHA Y CONTEXTO** (referencia) al final. Sección 5 (alertas) queda representada en el Bloque A vía `casosAbiertos` + CTA `[Ver alertas]`.

**Why this priority**: Regresión crítica. Si el rediseño pierde información, es HALLAZGO. SC-006 audita exhaustivamente. Cierra la garantía del brief §6.2 "nada se pierde".

**Independent Test**: Abrir la ficha ANTES del rediseño (referencia) y anotar los N campos visibles. Abrir la ficha DESPUÉS del rediseño y verificar que los mismos N campos siguen presentes, agrupados en los 4 bloques nuevos. Ningún campo del antes debe faltar en el después.

**Acceptance Scenarios**:

1. **Given** las 7 secciones actuales de `ColegioDetalleSecciones` (información básica, métricas tamaño, actividad reportes, comité, alertas, hallazgos, comparación media), **When** se comparan campo a campo con la ficha rediseñada, **Then** los 100% de los campos originales están presentes (en los 4 bloques nuevos).
2. **Given** un test automatizado que enumera los campos por su texto/label, **When** corre contra el componente rediseñado, **Then** los datos de las 7 secciones aparecen en el DOM del render.

---

### Edge Cases

- **Colegio sin actividad** (`actividadReportesCruzada.total = 0`): Bloque A muestra "0 casos abiertos" con semáforo verde y "Sin operadores asignados". Bloque B EmptyState neutral en cada chart. Bloque C solo hitos `ingreso` y `hoy`. Bloque D intacto con datos de referencia.
- **Colegio con 1000+ reportes**: `serieMensual` puede tener 50+ puntos; el gráfico debe hacer scroll horizontal o agrupar en trimestres si se satura. Rendimiento < 800 ms medido (SC-009).
- **`AlertaColegio.asignadoAId` NULL para todas las alertas**: `operadoresAsignados` devuelve array vacío; Bloque A muestra "Sin operadores asignados".
- **Un mismo usuario asignado a múltiples alertas**: aparece 1 sola vez en `operadoresAsignados` (DISTINCT por `Usuario.id`).
- **Rutas `/dashboard/admin/reportes?colegioId=X` y `/dashboard/admin/alertas?colegioId=X` NO soportan el query param**: HALLAZGO estructural → PARA + actualiza spec + reabre §4 (candado 17 D-98). Verificable en `/speckit-implement`.
- **`picoActividad` empatado entre dos meses**: se toma el más reciente (por convención de "actividad viva").
- **`Usuario.rol` NULL para un autor de reporte** (situación anómala): cuenta como "anónimo" para `distribucionRol`.
- **Reporte con `origenRol = "PARENT"` pero `usuarioId = null`**: cuenta como "padre" (respeta SPEC-295 sin depender de usuarioId).
- **Rendimiento**: el rediseño NO debe empeorar el TTFB de la ficha. Si `analytics-colegio.ts` hace 2+ queries adicionales para `distribucionRol` + `operadoresAsignados` + `lineaTiempo` + `serieMensual`, todas deben ir en `Promise.all` con las queries existentes (SC-009).
- **Colegio recién creado (`fechaRegistro = hoy`)**: Bloque C muestra los 2 hitos `ingreso` y `hoy` colapsados en el mismo punto con etiqueta única.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El componente que renderiza la ficha del colegio DEBE presentar 4 bloques con títulos legibles: `A. ¿Qué pasa aquí hoy?`, `B. Cómo se comporta`, `C. Línea de tiempo`, `D. Ficha y contexto`. El orden A→D es obligatorio y verificable en el DOM.
- **FR-002**: El Bloque A DEBE mostrar los 3 KPIs (casos abiertos, total reportes rango, % procesados) con etiquetas legibles y números destacados visualmente.
- **FR-003**: El Bloque A DEBE incluir 2 CTAs clicables con los hrefs `/dashboard/admin/reportes?colegioId=<id>&estado=REVISION_MANUAL,POSIBLE_SPAM` y `/dashboard/admin/alertas?colegioId=<id>`. Los hrefs se validan durante `/speckit-implement`.
- **FR-004**: El Bloque A DEBE listar los operadores asignados al colegio con nombre + email por cada uno. Si no hay operadores, muestra un mensaje neutral ("Sin operadores asignados").
- **FR-005**: El Bloque A DEBE mostrar el semáforo del colegio con ícono + texto (nunca solo color) y una línea de motivo bajo el semáforo cuando no está verde.
- **FR-006**: El Bloque B DEBE incluir un gráfico de tendencia mensual (reutiliza `TendenciaReportes`), un gráfico de distribución por estado (reutiliza `BarChart`), y una visualización de distribución por rol reportante (padre/estudiante/profesor/anónimo).
- **FR-007**: El Bloque C DEBE mostrar una línea de tiempo horizontal con 4 hitos (o menos si aplica edge case): fecha de registro del colegio, primer reporte all-time, mes de pico de actividad, hoy. Altura vertical del bloque < 100 px.
- **FR-008**: El Bloque D DEBE contener las 5 secciones de referencia del componente actual: información básica, métricas de tamaño, comité, hallazgos, comparación con media. Ninguna información se pierde (SC-006).
- **FR-009**: El endpoint `/api/admin/analytics/colegios/[id]` DEBE ampliar su payload aditivamente con los 4 bloques nuevos: `distribucionRol`, `operadoresAsignados`, `lineaTiempo`, `serieMensual`. Los campos existentes (`infoBasica`, `metricasTamaño`, `actividadReportes`, `actividadReportesCruzada`, `comite`, `alertas`, `hallazgos`, `comparacionMedia`, `umbralesSemaforo`) se conservan sin cambios.
- **FR-010**: Los 4 bloques nuevos del payload DEBEN generarse en `analytics-colegio.ts` invocando `ColegioActividadRepository.actividadDelColegio` (Fase 1) con los rangos apropiados. `colegio-actividad.ts` NO se modifica.
- **FR-011**: `distribucionRol` DEBE clasificar cada reporte del colegio según: si `usuarioId` presente y `Usuario.rol` conocido → `PARENT` mapea a `padre`, `OPERADOR` a `profesor` (default) o categoría equivalente; si `esAnonimo=true` o `usuarioId=null` sin `origenRol` → `anonimo`; si `origenRol='PARENT'` → `padre` (respeta SPEC-295 sin depender de usuarioId). Los 4 valores del objeto deben sumar exactamente `actividadReportesCruzada.total`.
- **FR-012**: `operadoresAsignados` DEBE devolver un array DISTINCT por `Usuario.id` de todos los usuarios presentes en `AlertaColegio.asignadoA` para las alertas del colegio, con campos `{ id, nombre, email }`.
- **FR-013**: `lineaTiempo.primerReporte` DEBE ser MIN(`Reporte.creadoEn`) sobre los reportes del colegio all-time. Devuelve `null` si el colegio no tiene reportes.
- **FR-014**: `lineaTiempo.picoActividad` DEBE ser el mes (año-mes) con más reportes del colegio all-time. Devuelve `null` si el colegio no tiene reportes. En caso de empate, se toma el mes más reciente.
- **FR-015**: `serieMensual` DEBE ser un array `{ anioMes: 'YYYY-MM'; total: number }` ordenado ascendente por `anioMes`, cubriendo desde `lineaTiempo.primerReporte` (o los últimos 12 meses si no hay actividad histórica más antigua) hasta `hoy`. Los meses sin reportes aparecen con `total: 0` para no romper la continuidad visual del chart.
- **FR-016**: El desarrollo NO DEBE tocar `src/lib/dal/repositories/colegio-actividad.ts`, `src/lib/ai/**`, `prisma/schema.prisma`, `scripts/deploy-prod.sh`, `.github/workflows/verificar-base-pr.yml`.
- **FR-017**: El desarrollo NO DEBE introducir librería nueva de charts. Reutiliza `BarChart`, `TendenciaReportes`, `RitmoMensual`, `recharts` ya instalado.
- **FR-018**: El desarrollo NO DEBE añadir mapa, exportar PDF o alertas automáticas (fuera de alcance v1 · brief §10).
- **FR-019**: El componente rediseñado DEBE usar tokens PI (`pino`, `ambar`, `rubi`, `papel`, etc.) sin color crudo, cumplir contraste AA (4.5:1) verificable con `scripts/contrast_check.js`, e incluir ícono + texto para cada estado del semáforo (nunca solo color).
- **FR-020**: Si durante `/speckit-implement` aparece un HALLAZGO estructural (payload no cubre una métrica requerida, ruta admin no soporta `?colegioId=`, componente reutilizable no admite un modo, etc.), el desarrollo DEBE parar, actualizar `spec.md` con la nueva información y reabrir la compuerta §4 antes de continuar código (candado 17 D-98).

### Key Entities

- **`ColegioDetalleFichaV2`** (componente nuevo o renombrado de `ColegioDetalleSecciones`): renderiza los 4 bloques A→D. Consume el payload extendido del endpoint.
- **`ColegioLineaTiempo`** (componente nuevo): visualización horizontal simple para el Bloque C. Sin librería nueva. Puede ser SVG puro o CSS flex.
- **Payload extendido** (aditivo sobre `ColegioDetalleResponse` de Fase 1):
  - `distribucionRol: { padre: number; estudiante: number; profesor: number; anonimo: number }`
  - `operadoresAsignados: Array<{ id: string; nombre: string; email: string }>` (DISTINCT)
  - `lineaTiempo: { fechaRegistro: string; primerReporte: string | null; picoActividad: { anioMes: string; total: number } | null; hoy: string }`
  - `serieMensual: Array<{ anioMes: string; total: number }>` (ordenada ASC)
- **CTAs con query params**: `?colegioId=<id>` y opcionalmente `&estado=REVISION_MANUAL,POSIBLE_SPAM`. Deben ser interpretados por las rutas destino (`/dashboard/admin/reportes` y `/dashboard/admin/alertas`).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001** (brief §9 · redirigido): Un ADMIN abre la ficha de un colegio real y en menos de 5 segundos puede señalar (a) si el colegio requiere acción, (b) cuántos casos abiertos tiene, (c) qué CTA usar para revisar. Verificable con test de usabilidad interno o por autoevaluación del rediseño.
- **SC-006** (brief §9): Los 4 bloques presentan las 7 secciones actuales sin pérdida de información. Test automatizado enumera campos originales y verifica su presencia en el render nuevo.
- **SC-007** (brief §9): El Bloque A muestra 3 KPIs (casos abiertos, total, % procesados), lista de operadores asignados y al menos 1 CTA clicable con href correcto (test DOM assert `href*="colegioId="`).
- **SC-008** (brief §9): Contraste AA (4.5:1) verificado con `scripts/contrast_check.js` para los 4 bloques y los estados del semáforo. Sin regresión respecto a Fase 1.
- **SC-009** (brief §9): La ficha responde en menos de 800 ms para el colegio con más volumen de reportes en producción, medido en el reporte pre-REALIZADO (`performance.now()` alrededor del fetch del payload + primer render). Cero N+1 en el backend.
- **SC-010** (brief §9): Test A/B multi-tenant: los datos de un colegio nunca aparecen en la ficha de otro. Ya validado en Fase 1; se mantiene como test de regresión en Fase 2.
- **SC-011**: El Bloque A aparece PRIMERO en el DOM del componente rediseñado, antes de cualquier chart, tabla histórica o dato de referencia. Verificable con test de orden en el árbol de renderizado.
- **SC-012**: El rediseño NO añade dependencia nueva a `package.json`. Verificable con `git diff package.json` = 0 líneas de dependencies.
- **SC-013**: Los CTAs del Bloque A al hacer click navegan a rutas admin existentes que renderean sin error (verificado en vivo por `/speckit-implement`).

---

## Assumptions

- El worktree parte de `origin/main @ 7e96e305b` (SPEC-303 Fase 1 mergeada y desplegada). El payload `ColegioDetalleResponse` de Fase 1 con `actividadReportesCruzada` + `umbralesSemaforo` está disponible.
- El repo `ColegioActividadRepository` es la fuente única de "reportes del colegio" (Fase 1). El método `actividadDelColegio(colegioId, rango)` acepta cualquier rango — se le llama con `{desde: colegio.fechaRegistro, hasta: now}` para `lineaTiempo`/`serieMensual` all-time.
- `Usuario.rol` mapea del enum `RolUsuario` a categorías: `PARENT` → `padre`, `OPERADOR`/`SCHOOL_ADMIN`/`COMITE_*` → `profesor` (personal del colegio). Si aparece ambigüedad durante implementación, se resuelve con default `anonimo` y se documenta.
- `AlertaColegio.asignadoAId` referencia a `Usuario`. Un colegio típico tendrá 1-3 operadores asignados. Query DISTINCT es barata (< 50 ms).
- Las rutas `/dashboard/admin/reportes` y `/dashboard/admin/alertas` existen y admiten filtros por query param — si NO, HALLAZGO durante `/speckit-implement` (candado 17). El test SC-013 lo valida antes de REALIZADO.
- `TendenciaReportes.tsx` acepta como prop una serie temporal con shape `Array<PuntoTendencia>`. Si el shape esperado difiere de `serieMensual`, se adapta con un transformador simple en el componente que llama.
- `BarChart.tsx` acepta `data: {label, value}[]`. `porEstado` de Fase 1 se transforma a este shape trivialmente.
- El contraste AA de tokens PI se conserva de Fase 1 (SC-008 ya verificado allí).
- Fábrica corre la verificación en vivo post-deploy con inspección visual de los 4 bloques.
- **NO se cierra I-98 en gestión** — lo hace Fábrica post-CUMPLE con evidencia dura.
- **NO se toca el repo Fase 1** — cualquier extensión de payload va en `analytics-colegio.ts` (composición).
- Coordinación con otros Devs: SPEC-305/306/307/308/pi-SPEC-309 y SPEC-310 (Dev PI-2) tienen worktrees vivos pero rutas ortogonales (círculo confianza, timeline eventos, sugerencia proactiva padre, notificación enriquecida, home padre proactivo, puente sesión). Cero solape previsible con `src/components/modules/admin/**` ni `analytics-colegio*.ts` — verificable en el gate pre-push antes del PR.
- El README línea 449 declara SPEC-304 apuntando a `304-home-padre-proactivo/spec.md` (carpeta inexistente en main) — divergencia editorial de Kimi que Fábrica notificará a CEO IDC. NO es responsabilidad de esta spec resolverlo. Por eso SPEC-311 se usa aquí.
