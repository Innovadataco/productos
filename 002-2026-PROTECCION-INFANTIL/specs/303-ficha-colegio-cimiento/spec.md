# Feature Specification: Ficha colegio admin · Fase 1 · Cimiento de datos + semáforo declarado (SPEC-303)

**Feature Branch**: `work/pi-SPEC-303-ficha-colegio-cimiento`
**SPEC**: 303
**Created**: 2026-08-29
**Status**: PLANEADO
**Input**: INSTRUCTIVO-002-PI-209-FICHA-COLEGIO-ADMIN-FASE-1 · BRIEF-FICHA-COLEGIO-ADMIN §11 · Cierra I-104 · Prepara I-98 (Fase 2 SPEC-304)

Impacto en arquitectura: crea `ColegioActividadRepository` en la capa DAL (Q-3) — nuevo archivo `src/lib/dal/repositories/colegio-actividad.ts` siguiendo la convención existente (clase con `constructor(tx?: Prisma.TransactionClient)`, `this.db = tx ?? prisma`). Este repo es la única fuente de verdad para "reportes que pertenecen al colegio" (elimina la inconsistencia actual que causa "Sin datos" con 45 alertas). NO se toca `analytics-colegio.ts` existente: el endpoint `/api/admin/analytics/colegios/[id]` compone su respuesta añadiendo `actividadReportes` obtenido del nuevo repo, más el bloque `umbralesSemaforo` con los valores vigentes de `ParametroSistema`. Idéntico pattern en el endpoint listado `/api/admin/analytics/colegios`. Umbrales: se REUTILIZA el namespace `analytics.colegios.*` YA sembrado en `prisma/seed.ts:1969-1985` (evita fragmentación con las 5 keys existentes `cache_ttl_min`, `inactividad_alerta_dias`, `spam_alerta_pct`, `resolucion_comite_ok_pct`, `periodo_default_dias`); se AÑADEN 3 keys nuevas: `analytics.colegios.casos_abiertos_alto` (default 5), `analytics.colegios.casos_sin_movimiento_dias` (default 14), `analytics.colegios.porcentaje_procesado_min` (default 0.7); upsert `{create,update:{}}` (anti-I-100). UI: cambios acotados en `ColegiosAnalyticsTable.tsx` (leyenda inline + columna "Reportes" + línea motivo bajo estado no-verde) y en la sección "3. Actividad de reportes" de `ColegioDetalleSecciones.tsx` (EmptyState → números reales). Cero migración destructiva · cero librería nueva · cero cambio a `src/lib/ai/**`, `deploy-prod.sh`, `verificar-base-pr.yml` · cero rediseño ficha 4 bloques (eso es Fase 2 SPEC-304 · cierra I-98).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Admin abre la ficha de un colegio con historial y ve la actividad real (Priority: P1)

Un ADMIN de IDC abre `/dashboard/admin/estadisticas/operacion/colegios/[colegioId]` para un colegio que tiene 45 alertas históricas. Hoy la sección "3. Actividad de reportes" muestra `EmptyState "Sin datos"` porque la consulta actual no cruza los reportes con el colegio por las 3 rutas de pertenencia. Después del fix: esa sección muestra el número real de reportes de los últimos 30 días (o el rango configurado en `analytics.colegios.periodo_default_dias`) obtenido del método único `actividadDelColegio(colegioId, rango)`. La confianza del ADMIN en la ficha se restaura.

**Why this priority**: Este es el defecto de fondo (brief §4). Sin este cierre, cualquier rediseño futuro (Fase 2) se apoya en datos falsos. Cierra el requisito operativo de que el caso testigo de I-98 (colegio con 45 alertas) deje de decir "Sin datos".

**Independent Test**: Sembrar tres colegios en BD de prueba: (a) Colegio A con AlertaColegio > 0; (b) Colegio B sin alertas pero con usuario del comité con reportes de identificadores enrolados en A (para probar cross-contamination cero); (c) Colegio C aislado. Correr `actividadDelColegio(A.id, últimos 30 días)` → devuelve `total > 0` y una lista de reportes verificable contra las 3 rutas. Correr sobre B y C → devuelve solo los que legítimamente pertenecen a cada uno.

**Acceptance Scenarios**:

1. **Given** un colegio con 5 `AlertaColegio` (todas ligadas a reportes existentes) y ningún reporte por otras rutas, **When** se invoca `actividadDelColegio(colegioId, últimos 30 días)`, **Then** el resultado incluye al menos los 5 reportes referenciados por esas alertas.
2. **Given** un colegio con un rector cuyo tenantId coincide con `Colegio.tenantId` y ese rector generó 3 reportes en los últimos 30 días, **When** se invoca el método, **Then** los 3 reportes aparecen en el resultado (ruta A: autor asociado por tenantId).
3. **Given** un colegio con un estudiante enrolado cuyo identificador (número telefónico) aparece como `identificadorObjetivo` en 2 reportes en el rango, **When** se invoca el método, **Then** los 2 reportes aparecen en el resultado (ruta B: identificador enrolado).
4. **Given** un colegio que cumple simultáneamente A, B y C con solapes (el mismo reporte alcanzable por 2+ rutas), **When** se invoca el método, **Then** el resultado NO tiene duplicados por `Reporte.id`.
5. **Given** la sección "3. Actividad de reportes" del `ColegioDetalleClient` cargada para un colegio con `total > 0`, **When** el componente renderiza, **Then** ya NO muestra `EmptyState "Sin datos"` sino números reales (total y distribución mínima por estado).

---

### User Story 2 — Admin abre el listado y entiende por qué cada colegio está en rojo/amarillo/verde (Priority: P1)

Un ADMIN abre `/dashboard/admin/estadisticas/operacion?tab=colegios`. Hoy: 6 de 7 colegios pintan rojo, sin leyenda, sin motivo, sin explicación (I-104 · "pésima interfaz"). Después del fix: (a) aparece una leyenda inline arriba de la tabla, siempre visible, con 3 estados y el umbral real vigente leído de `ParametroSistema`; (b) cada fila incluye una columna nueva "Reportes" con el conteo real proveniente de `actividadDelColegio`; (c) las filas no-verdes muestran bajo el estado una línea corta que cita el hallazgo con mayor peso ("7 casos sin movimiento hace más de 14 días"); (d) los estados usan tokens PI ámbar/pino/rubi con ícono + texto (nunca solo color, contraste AA).

**Why this priority**: Es el cierre directo de I-104. Sin leyenda ni motivo, el semáforo destruye confianza. Con leyenda + motivo, el ADMIN sabe qué acción tomar (o al menos qué preguntar). Es la mitad "visible" del cimiento — sin esto, la Fase 1 no completa el brief §5.

**Independent Test**: Cargar la vista listado con 3 colegios sembrados (uno verde, uno amarillo, uno rojo por razón distinta cada uno). Verificar: (a) la leyenda con los 3 estados y sus umbrales vigentes aparece encima de la tabla sin necesidad de hover; (b) la columna "Reportes" muestra el conteo esperado por colegio; (c) los 2 colegios no-verdes muestran línea de motivo; (d) inspección de contraste (`scripts/contrast_check.js` sobre los tokens del semáforo) reporta AA.

**Acceptance Scenarios**:

1. **Given** el listado cargado, **When** el ADMIN mira la parte superior de la tabla, **Then** ve una leyenda inline con exactamente 3 líneas: `🟢 Al día · sin casos pendientes`, `🟡 Requiere mirada · casos en espera`, `🔴 Requiere acción · casos detenidos o sin procesar`, cada una acompañada del umbral vigente citado del payload (formato: "🔴 = más de N casos abiertos o M días sin movimiento").
2. **Given** un colegio con 12 casos abiertos (superior a `analytics.colegios.casos_abiertos_alto=5`), **When** aparece en el listado, **Then** su fila muestra estado rojo con ícono + texto y bajo el estado la línea "12 casos abiertos" (o el hallazgo con mayor peso si aplica).
3. **Given** un colegio verde, **When** aparece en el listado, **Then** su fila muestra estado verde sin línea de motivo (el motivo solo aplica a no-verdes).
4. **Given** la columna "Reportes" en la tabla, **When** el ADMIN mira la fila de un colegio, **Then** el número corresponde al total devuelto por `actividadDelColegio(colegioId, últimos 30 días)`.
5. **Given** los tokens PI del semáforo (pino/ámbar/rubi), **When** se ejecuta `scripts/contrast_check.js` sobre el listado renderizado, **Then** todos los estados cumplen AA (4.5:1 mínimo).

---

### User Story 3 — Los umbrales del semáforo se ajustan sin deploy (Priority: P2)

El CEO decide que el umbral `casos_abiertos_alto` de 5 es demasiado permisivo para colegios pequeños y quiere cambiarlo a 3. Después del fix: puede actualizarlo directamente en `ParametroSistema` (fila `analytics.colegios.casos_abiertos_alto`) sin necesidad de deploy. Al siguiente request al endpoint, tanto el listado como la ficha reflejan el nuevo umbral: la leyenda muestra "3" y las filas se recalculan. El seed sigue sembrando el default `5` solo cuando la clave no existe (upsert `{create,update:{}}`), respetando el custom del CEO (candado anti-I-100).

**Why this priority**: Complementa US2 haciendo el semáforo verdaderamente parametrizable. Sin esto, cualquier afine post-deploy requiere ciclo de release, lo cual traicionaría la promesa "editable sin deploy". Es P2 porque US2 ya cierra I-104 funcionalmente aunque el valor esté fijo; esta US es lo que hace que el afine (candado SC-005) sea operativo.

**Independent Test**: (a) Verificar que la primera corrida del seed inserta `analytics.colegios.casos_abiertos_alto=5`; (b) actualizar manualmente el valor a 3 en la BD; (c) correr el seed una segunda vez → el valor 3 se conserva (no lo pisa); (d) request al endpoint listado → payload trae `umbralesSemaforo.casos_abiertos_alto=3` y la leyenda del frontend muestra 3.

**Acceptance Scenarios**:

1. **Given** BD limpia sin la clave `analytics.colegios.casos_abiertos_alto`, **When** corre el seed, **Then** la clave se crea con valor 5.
2. **Given** la clave existe con valor 3 (custom CEO), **When** el seed corre de nuevo (post-deploy), **Then** el valor sigue en 3 (upsert `{update:{}}` no lo pisa).
3. **Given** un endpoint que devuelve `umbralesSemaforo`, **When** el CEO cambia el valor de la clave en BD y refresca el listado, **Then** la leyenda muestra el nuevo valor sin restart de servicio.

---

### Edge Cases

- **Colegio sin ninguna de las 3 rutas activas** (sin AlertaColegio, sin usuario asociado por tenantId con reportes, sin identificadores enrolados con reportes): `actividadDelColegio` devuelve `total=0`. La sección "3. Actividad de reportes" muestra un EmptyState CORRECTO ("Aún no hay actividad registrada"), diferenciable del anterior "Sin datos" que era bug. El semáforo del listado ese colegio depende de si tiene actividad reciente o no según los umbrales.
- **Reporte alcanzable por múltiples rutas** (mismo reporte cumple A y B, o A y C): devuelve una sola vez. Deduplicación por `Reporte.id`.
- **Tenant compartido entre dos colegios** (situación no esperada en prod pero posible en tests): la ruta A por tenantId devolvería reportes cross-colegio. Se protege con el filtro explícito por `colegioId` en las rutas B y C. Documentar en test A/B (SC-010) que la deduplicación combinada con el filtro cross-referencia evita cross-leak.
- **`Colegio.tenantId` NULL o inconsistente**: `actividadDelColegio` NO falla; la ruta A devuelve vacío para ese caso y B+C aún pueden aportar. El repo loguea WARN en tal caso para trazabilidad.
- **Rango temporal con `desde > hasta`**: método rechaza con error `AppError` de código 400 antes de tocar la BD. Test unitario cubre.
- **Rango temporal muy amplio (> 5 años)**: acepta pero puede degradar performance. El default es 30 días; el endpoint no expone el rango como query param en Fase 1 (solo lo lee del ParametroSistema). Ampliación de rango vía UI queda para Fase 2 o brief separado.
- **Identificador enrolado en dos colegios simultáneamente** (situación anómala pero posible por movilidad estudiantil): ambos colegios ven el reporte en su actividad. Correcto: el reporte pertenece a ambos por la definición del brief §3.
- **Umbral con valor 0 o negativo en BD** (CEO edita mal): el frontend renderiza el umbral tal cual (no valida); el backend ya usa comparadores directos, por lo que un `casos_abiertos_alto=0` haría que TODOS los colegios estuvieran rojo. Documentado en test unitario como caso hostil que el sistema tolera y muestra al ADMIN (no oculta el mal valor).
- **Más de 50% de colegios en rojo tras el fix**: candado SC-005 · Fábrica detecta post-deploy y bloquea el cierre de I-104. NO se inventan valores para "que se vea bonito"; se abre iteración de afine.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE exponer un método único `actividadDelColegio(colegioId, rango)` en la capa DAL que devuelva `{ reportes, total, porEstado, casosAbiertos, ultimaActividad }` para un colegio dado y un rango temporal cerrado `{ desde, hasta }`. El método DEBE ser la fuente única para "reportes que pertenecen al colegio" — ninguna otra capa del sistema puede armar este criterio por su cuenta.
- **FR-002**: El método `actividadDelColegio` DEBE cruzar las 3 rutas de pertenencia definidas en el brief §4: (A) reportes cuyo `tenantId` coincide con el `tenantId` del colegio (autor asociado); (B) reportes cuyo `identificadorObjetivo` matchea un identificador enrolado en el colegio (estudiante/profesor/acudiente vía las 3 tablas puente respectivas); (C) reportes referenciados por una `AlertaColegio` con `colegioId` igual al parámetro.
- **FR-003**: El resultado DEBE ser una UNIÓN sin duplicados por `Reporte.id`. Un reporte alcanzable por 2 o 3 rutas cuenta una sola vez.
- **FR-004**: El método DEBE respetar multi-tenant estricto: cada rama de la consulta filtra explícito por `colegioId` (o por `tenantId` derivado del `colegioId`), sin traer todo y filtrar en memoria. Un test A/B (SC-010) DEBE demostrar que los datos de un colegio nunca aparecen en el resultado de otro.
- **FR-005**: Antes de emitir REALIZADO, el desarrollador DEBE ejecutar en la BD de producción una consulta equivalente para el caso testigo I-98 (colegio con `AlertaColegio > 0`) y verificar que devuelve `COUNT(*) > 0`. Si devuelve 0, es HALLAZGO: el diseño está mal y se para.
- **FR-006**: El sistema DEBE sembrar 3 nuevas claves en `ParametroSistema` bajo el prefijo existente `analytics.colegios.*` con `upsert({create, update:{}})` (anti-I-100): `analytics.colegios.casos_abiertos_alto` (default 5, entero positivo), `analytics.colegios.casos_sin_movimiento_dias` (default 14, entero positivo), `analytics.colegios.porcentaje_procesado_min` (default 0.7, decimal entre 0 y 1). El seed NO DEBE pisar valores custom preexistentes.
- **FR-007**: Los endpoints `/api/admin/analytics/colegios` (listado) y `/api/admin/analytics/colegios/[id]` (ficha) DEBEN incluir en su respuesta un bloque `umbralesSemaforo` con las 3 claves nuevas + las 5 preexistentes de `analytics.colegios.*`, leídas de `ParametroSistema`. El frontend usa estos valores para renderizar la leyenda y el motivo.
- **FR-008**: El endpoint de la ficha `/api/admin/analytics/colegios/[id]` DEBE incluir además el bloque `actividadReportes` con `{ total, porEstado, casosAbiertos, ultimaActividad }` obtenido de `actividadDelColegio(colegioId, últimos N días)` donde N proviene de `analytics.colegios.periodo_default_dias` (30 por default).
- **FR-009**: El componente `ColegiosAnalyticsTable.tsx` DEBE mostrar una leyenda inline arriba de la tabla, siempre visible (sin hover), con 3 estados y los umbrales vigentes citados del payload.
- **FR-010**: El componente `ColegiosAnalyticsTable.tsx` DEBE incluir una columna nueva "Reportes" con el conteo real devuelto por `actividadDelColegio` (o el equivalente disponible en el payload del listado).
- **FR-011**: El componente `ColegiosAnalyticsTable.tsx` DEBE mostrar bajo el estado no-verde una línea corta de motivo citando el hallazgo con mayor peso (ejemplo: "12 casos abiertos" o "7 casos sin movimiento hace más de 14 días"). Filas verdes NO llevan línea de motivo.
- **FR-012**: Los estados del semáforo DEBEN renderizarse con tokens PI `pino` (verde), `ambar` (amarillo), `rubi` (rojo) — nunca color crudo — y acompañados de ícono + texto (nunca solo color). El contraste DEBE cumplir AA (4.5:1) verificable con `scripts/contrast_check.js`.
- **FR-013**: La sección "3. Actividad de reportes" de `ColegioDetalleSecciones.tsx` (invocada desde `ColegioDetalleClient.tsx`) DEBE dejar de renderizar `EmptyState "Sin datos"` cuando el colegio tiene actividad real. En su lugar muestra al menos `total` y una distribución mínima por estado del reporte. Cuando `total=0` legítimo, muestra un EmptyState nuevo con texto neutral ("Aún no hay actividad registrada").
- **FR-014**: Las otras 6 secciones de `ColegioDetalleSecciones.tsx` (1, 2, 4, 5, 6, 7) DEBEN permanecer intactas en Fase 1. El rediseño en 4 bloques A→D es Fase 2 (SPEC-304).
- **FR-015**: Después del deploy, si más del 50% de los colegios reales en producción quedan en rojo con los nuevos umbrales, Fábrica DEBE marcarlo como HALLAZGO y NO cerrar I-104. El fix propone iteración de afine, no ajusta a ciegas.
- **FR-016**: El desarrollo NO DEBE tocar `src/lib/ai/**`, `scripts/deploy-prod.sh`, `.github/workflows/verificar-base-pr.yml`, ni introducir migración destructiva de Prisma. Aditivo solo si estrictamente necesario (esta Fase 1 NO lo requiere).
- **FR-017**: El desarrollo NO DEBE añadir librería de charts nueva (recharts + `BarChart` + `TendenciaReportes` + `RitmoMensual` son suficientes; su uso masivo es Fase 2).
- **FR-018**: El desarrollo NO DEBE cerrar I-98 en gestión (Fase 2 la cierra). Sí prepara terreno: el caso testigo de I-98 debe devolver > 0 con `actividadDelColegio` como precondición para radicar Fase 2.

### Key Entities

- **`ColegioActividadRepository`** (nuevo · `src/lib/dal/repositories/colegio-actividad.ts`): clase que expone `actividadDelColegio(colegioId, rango)` como método público. Convención existente `constructor(tx?: Prisma.TransactionClient)`, `this.db = tx ?? prisma`.
- **Rango temporal**: objeto `{ desde: Date, hasta: Date }` con `desde ≤ hasta`. Default en la ficha: últimos 30 días (leído de `analytics.colegios.periodo_default_dias`).
- **Resultado `ActividadDelColegio`**: `{ reportes: ReporteSummary[], total: number, porEstado: Record<EstadoReporte, number>, casosAbiertos: number, ultimaActividad: Date | null }`. Deduplicado por `Reporte.id`. `casosAbiertos` = alertas del colegio con estado in `('nueva','vista','escalada')` + expedientes activos del colegio (definición operativa cerrada de "casos abiertos").
- **`umbralesSemaforo`** (bloque en payload de endpoints): `{ casos_abiertos_alto, casos_sin_movimiento_dias, porcentaje_procesado_min, inactividad_alerta_dias, spam_alerta_pct, resolucion_comite_ok_pct, periodo_default_dias }` — 3 keys nuevas + 4 preexistentes (excluye `cache_ttl_min` que es infra).
- **Rutas de pertenencia**:
  - **A** (autor por tenantId): `Reporte.tenantId == Colegio.tenantId`.
  - **B** (identificador enrolado): `Reporte.identificador + plataformaId` matchea `IdentificadorEstudiante` (con `estudiante.colegioId == C`) O `IdentificadorProfesor.colegioId == C` O `IdentificadorAcudiente.colegioId == C`.
  - **C** (referenciado por alerta): `Reporte.id IN (SELECT reporteId FROM AlertaColegio WHERE colegioId == C)`.
- **Casos abiertos**: unión de `AlertaColegio` del colegio con estado in `('nueva','vista','escalada')` y expedientes activos del colegio (`Expediente` con estado no-cerrado).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un colegio con historial de alertas históricas (caso testigo de I-98 · colegio con `AlertaColegio > 0`) muestra su actividad real en la sección "3. Actividad de reportes" de la ficha con un total > 0, verificado empíricamente en BD de producción antes de REALIZADO.
- **SC-002**: El listado muestra una leyenda del semáforo visible sin hover con los 3 estados y los umbrales vigentes leídos de `ParametroSistema` (no strings hardcodeados). Verificable inspeccionando el DOM del listado renderizado.
- **SC-003**: Cada colegio en estado no-verde muestra bajo el estado una línea de motivo legible en máximo 60 caracteres, correspondiente al hallazgo con mayor peso.
- **SC-004**: El listado incluye una columna "Reportes" con el conteo real correspondiente al mismo criterio de `actividadDelColegio(colegioId, últimos 30 días)`. El número coincide con el mostrado en la ficha del mismo colegio (verificable comparando).
- **SC-005**: Tras el deploy, la distribución de colores sobre los colegios reales de producción se reporta al CEO. Si más del 50% siguen en rojo, es HALLAZGO y Fábrica NO cierra I-104.
- **SC-006**: Los 3 defaults del semáforo (`casos_abiertos_alto=5`, `casos_sin_movimiento_dias=14`, `porcentaje_procesado_min=0.7`) se crean con upsert idempotente: correr el seed dos veces con un valor custom entre corridas conserva el custom (test unitario).
- **SC-007**: Los umbrales cambian sin restart: un update SQL directo al `ParametroSistema` cambia el valor devuelto por el endpoint en el siguiente request (sin cache backend en Fase 1, o con TTL respetable menor a `analytics.colegios.cache_ttl_min`).
- **SC-008**: Contraste AA (4.5:1) verificado con `scripts/contrast_check.js` para las 3 celdas de estado del semáforo sobre fondos claro y oscuro del tema PI.
- **SC-009**: El método `actividadDelColegio` responde en menos de 800 ms para el colegio con más volumen de reportes en producción, medido en el reporte a CEO. Sin regresiones N+1 (verificado con `EXPLAIN ANALYZE` en el reporte).
- **SC-010**: Test A/B multi-tenant: sembrados dos colegios con datos solapados (mismo identificador enrolado en ambos, o tenantId erróneamente compartido), la ficha de cada uno muestra únicamente sus datos. Cero cross-leak.

---

## Assumptions

- El worktree parte de `origin/main @ cc391ff32` (contiene el merge de PR #139 SPEC-300 y PRs intermedios). Base OK para trabajo aditivo.
- `Reporte` NO tiene `colegioId` directo; el cruce se hace por `tenantId` (autor) o joins a las tablas puente de identificadores. Verificado en `prisma/schema.prisma` durante el mapeo pre-spec.
- `AlertaColegio` sí tiene `colegioId` FK directo. Ruta C es la más simple y la que "prueba" que los 45 casos del testigo existen.
- `Usuario.tenantId` está denormalizado en `Reporte.tenantId` (patrón multi-tenant existente); asumido para la ruta A. Si en la implementación aparece un caso donde `Reporte.tenantId` no está poblado, se documenta y se propone fix aditivo en un PR de sequía separado (fuera de alcance de esta spec).
- `IdentificadorEstudiante` requiere join adicional a `Estudiante` para obtener `colegioId` (según el schema mapeado); `IdentificadorProfesor` e `IdentificadorAcudiente` ya tienen `colegioId` denormalizado. La consulta acepta esta asimetría con un LEFT JOIN o subconsulta según lo que mejor perfile.
- El seed `prisma/seed.ts:1969-1985` ya sigue el patrón `upsert({create, update:{}})` para params. Se replicará idéntico para las 3 keys nuevas.
- El script `scripts/contrast_check.js` existe (referenciado por el instructivo). Si en la implementación resulta que no cubre los tokens específicos del semáforo, se documenta y se ejecuta contraste manual con los mismos ratios (SC-008 se cumple igual).
- La ficha carga hoy vía `useEffect` en `ColegioDetalleClient.tsx` haciendo `fetch("/api/admin/analytics/colegios/${colegioId}")` (patrón existente). Se conserva; solo se amplía el payload del endpoint.
- Fábrica corre el test acid post-deploy con la distribución de colores; el desarrollo solo entrega el fix + tests locales + verificación BD prod del caso testigo.
- El estado "abierto" de `Expediente` (usado en `casosAbiertos`) se resuelve por convención existente: cualquier estado que no sea `cerrado` o análogo terminal. Verificado con el modelo `Expediente` durante la implementación; si la convención no está documentada, se toma `estado != 'cerrado'` como default con nota en `plan.md`.
- El instructivo dice `colegios.semaforo.*` pero el seed ya usa `analytics.colegios.*` — se REUTILIZA el namespace existente (decisión arquitectónica: evitar fragmentación). Delta comunicado a Fábrica en la señal `spec+plan LISTO`.
- Coordinación con Dev PI-2 en `pi-SPEC-302-deuda-motor-notif` (SPEC-302 motor notificaciones): rutas ortogonales verificadas — Dev PI-2 en `src/lib/notificaciones/**`, `src/lib/monitor/**`, workflows CI; esta SPEC-303 en `src/lib/dal/repositories/colegio-actividad.ts`, `src/app/api/admin/analytics/colegios/**`, `src/components/modules/admin/**`, `prisma/seed.ts`. Cero solape previsto.
