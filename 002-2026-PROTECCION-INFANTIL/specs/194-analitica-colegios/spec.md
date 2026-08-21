# Feature Specification: SPEC-194 — Analítica de Colegios + Vista Usuarios PARENT (002-PI-088)

**Feature Branch**: `work/002-pi-088`

**Created**: 2026-08-21

**Status**: IMPLEMENTADO

**Input**: 002-PI-088. Cierra I-37 (admin sin vista de usuarios PARENT registrados) y añade analítica agregada de colegios para evaluación operativa y gerencial. Diseño vinculante en `BRIEF-ANALITICA-COLEGIOS.md`.

**Objetivo**: construir (1) `/dashboard/admin/usuarios` con sub-tab "Padres" como default (cierra I-37), y (2) sub-tab "Colegios" en `/dashboard/admin/estadisticas/operacion` con resumen de todos los colegios + ficha detalle de 7 secciones + hallazgos automáticos configurables.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Vista unificada de usuarios con sub-tab Padres (Priority: P1)

Como admin quiero una ruta única `/dashboard/admin/usuarios` con sub-tabs por rol, empezando por "Padres", para consultar cuentas de usuarios sin depender de rutas dispersas.

**Why this priority**: cierra I-37, que está abierta desde julio 2026. Hoy los padres se ven en `/dashboard/admin/padres`, pero no existe una vista unificada de usuarios por rol.

**Independent Test**: abrir `/dashboard/admin/usuarios`, verificar que el sub-tab "Padres" carga por defecto y muestra cuentas PARENT reales con paginación, búsqueda y filtros.

**Acceptance Scenarios**:

1. **Given** un admin autenticado con rol ADMIN, **When** navega a `/dashboard/admin/usuarios`, **Then** se renderiza el sub-tab "Padres" por defecto.
2. **Given** el sub-tab "Padres", **When** carga, **Then** muestra columnas: email, fecha registro, último acceso, estado, # reportes enviados, colegios asociados.
3. **Given** la tabla de padres, **When** el admin filtra por estado, rango de fechas, con/sin reportes o colegio asociado, **Then** el endpoint `/api/admin/usuarios?rol=PARENT&...` devuelve resultados filtrados y paginados.
4. **Given** una fila de padre, **When** el admin hace clic en "Ver detalle", **Then** navega a `/dashboard/admin/usuarios/[id]` con historial de reportes de ese padre (solo metadatos, sin contenido).

---

### User Story 2 — Tabla resumen de analítica por colegio (Priority: P1)

Como admin quiero ver una tabla resumen de todos los colegios con métricas clave, para identificar de un vistazo cuáles requieren atención.

**Why this priority**: es el corazón de la analítica gerencial pedida por el CEO; permite comparar colegios sin abrir uno por uno.

**Independent Test**: abrir `/dashboard/admin/estadisticas/operacion?tab=colegios` y verificar que la tabla carga con todas las columnas definidas y permite ordenar/buscar.

**Acceptance Scenarios**:

1. **Given** colegios registrados en BD, **When** se carga el sub-tab "Colegios", **Then** cada fila muestra: nombre, ciudad/departamento, fecha inicial en el sistema, estado, # alumnos, # profesores, # reportes últimos 30 días, # reportes total, # alertas escaladas al comité, % casos procesados, semáforo de salud.
2. **Given** la tabla de colegios, **When** el admin ordena por cualquier columna, **Then** el orden se aplica en el backend (no solo en memoria) y se actualiza la UI.
3. **Given** la tabla de colegios, **When** el admin busca por nombre o filtra por ciudad/estado, **Then** se actualiza la lista respetando paginación.
4. **Given** la tabla de colegios, **When** el endpoint responde, **Then** lo hace en < 3 s tras caché caliente (parámetro `analytics.colegios.cache_ttl_min`).

---

### User Story 3 — Ficha detalle de colegio con 7 secciones (Priority: P1)

Como admin quiero hacer clic en un colegio y ver una ficha con 7 secciones analíticas, para entender la operación real de esa institución.

**Why this priority**: sin la ficha, el resumen queda en números aislados; la ficha traduce métricas en información accionable.

**Independent Test**: navegar a `/dashboard/admin/estadisticas/operacion/colegios/[colegioId]` y verificar que las 7 secciones renderizan sin errores y sin exponer PII de reportes.

**Acceptance Scenarios**:

1. **Given** un colegio con datos, **When** se abre la ficha, **Then** la sección "Información básica" muestra nombre, tipo, ubicación, fecha registro y contacto del rector.
2. **Given** un colegio con estudiantes/profesores/cursos, **When** se abre la ficha, **Then** "Métricas de tamaño" muestra cantidades agregadas.
3. **Given** un colegio con reportes históricos, **When** se abre la ficha, **Then** "Actividad de reportes" muestra serie temporal (30/90/365 días), barras por clasificación y top 5 identificadores más reportados (sin texto ni denunciante).
4. **Given** un colegio con comité, **When** se abre la ficha, **Then** "Comité de Convivencia" muestra integrantes activos, casos escalados, resueltos, tiempo promedio de resolución y últimos 5 casos con estado.
5. **Given** un colegio con alertas, **When** se abre la ficha, **Then** "Alertas" muestra total, resueltas y últimas 5 alertas con estado.
6. **Given** un colegio con datos, **When** se abre la ficha, **Then** "Analítica cualitativa" genera bullets "Qué está bien" / "Qué está mal" según reglas configurables.
7. **Given** un colegio con datos, **When** se abre la ficha, **Then** "Comparación con la media" muestra el colegio vs. la mediana de todos los colegios activos en métricas clave.

---

### User Story 4 — Configuración de umbrales de hallazgos (Priority: P2)

Como admin quiero poder ajustar los umbrales que generan los hallazgos automáticos, para que la analítica se adapte a la realidad del negocio.

**Why this priority**: los hallazgos son reglas simples; sin configuración, los umbrales se vuelven ruidosos con el tiempo.

**Independent Test**: cambiar un umbral en `/dashboard/admin/configuracion` (sección "Analítica → Colegios") y verificar que la ficha de un colegio recalcula los bullets.

**Acceptance Scenarios**:

1. **Given** la sección "Analítica → Colegios" en configuración, **When** el admin cambia `analytics.colegios.inactividad_alerta_dias`, **Then** el cambio persiste en `ParametroSistema`.
2. **Given** un colegio que no reporta hace N días (donde N > umbral nuevo), **When** se recarga su ficha, **Then** aparece el hallazgo "no hay reportes hace X días".
3. **Given** un colegio con > 50% de reportes SPAM, **When** el umbral `analytics.colegios.spam_alerta_pct` está en 0.5, **Then** aparece el hallazgo negativo correspondiente.

---

### User Story 5 — Exportar resumen y detalle a CSV (Priority: P3)

Como admin quiero exportar el resumen de colegios y el detalle de un colegio a CSV, para generar informes gerenciales offline.

**Why this priority**: útil para reportes al CEO/Comité, pero no bloquea el valor principal. Se implementa solo si cabe en la ventana; si no, se deja explícitamente para una iteración posterior.

**Independent Test**: hacer clic en "Exportar CSV" y descargar un archivo con las mismas columnas visibles (sin PII).

**Acceptance Scenarios**:

1. **Given** el sub-tab "Colegios", **When** el admin hace clic en "Exportar CSV", **Then** descarga un CSV con las filas del resumen actual.
2. **Given** la ficha de un colegio, **When** el admin hace clic en "Exportar CSV", **Then** descarga un CSV con las métricas de las 7 secciones.

---

### Edge Cases

- **Colegio sin reportes**: las secciones de actividad muestran "Sin datos" en vez de errores o gráficas vacías.
- **Colegio sin comité configurado**: la sección de Comité muestra "Sin integrantes activos" y un hallazgo negativo.
- **Colegio inactivo**: aparece en gris en el resumen; sus métricas se siguen mostrando pero con indicador de estado.
- **Usuario PARENT eliminado/bloqueado**: el conteo de reportes se mantiene (agregado histórico), pero el estado se muestra correctamente.
- **Reporte SPAM**: se contabiliza en "Actividad de reportes" y en el % de SPAM; nunca se muestra su texto.
- **Sin permisos**: un usuario no ADMIN que intente acceder a las rutas recibe 403 (`SinAccesoModulo`).
- **Cache frío**: la primera carga puede tardar más; el endpoint debe devolver datos en < 10 s incluso con cache frío.
- **Parámetro de cache faltante**: si `analytics.colegios.cache_ttl_min` no existe, se usa default 5 min y se registra en logs.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE crear la ruta `/dashboard/admin/usuarios` con sub-tabs: Padres (default), Rectores/Colegio Admin, Operadores, Comité, Admins.
- **FR-002**: El sub-tab "Padres" DEBE listar usuarios `rol=PARENT` con columnas: email, fecha registro, último acceso, estado, # reportes enviados, colegios asociados.
- **FR-003**: El listado de padres DEBE soportar búsqueda por email, filtros por estado, rango de fechas de registro, con/sin reportes y colegio asociado.
- **FR-004**: El endpoint `GET /api/admin/usuarios?rol=PARENT` DEBE ser paginado y devolver solo metadatos de cuenta y conteos agregados (nunca textos de reportes).
- **FR-005**: La acción "Ver detalle" de un padre DEBE navegar a `/dashboard/admin/usuarios/[id]` con historial de reportes de ese usuario (metadatos únicamente).
- **FR-006**: El sub-tab "Colegios" DEBE añadirse a `/dashboard/admin/estadisticas/operacion` (`EstadisticasSubNav`).
- **FR-007**: El endpoint `GET /api/admin/analytics/colegios` DEBE devolver el resumen de todos los colegios con las métricas definidas en el BRIEF.
- **FR-008**: El endpoint `GET /api/admin/analytics/colegios/[id]` DEBE devolver el detalle completo de un colegio con las 7 secciones.
- **FR-009**: Los endpoints de analytics DEBEN usar caché con TTL configurable (`analytics.colegios.cache_ttl_min`, default 5 min).
- **FR-010**: Los hallazgos automáticos DEBEN leer umbrales desde `ParametroSistema` (`inactividad_alerta_dias`, `spam_alerta_pct`, `resolucion_comite_ok_pct`, `periodo_default_dias`).
- **FR-011**: La sección "Hallazgos" DEBE generar bullets positivos y negativos con reglas if/else basadas en umbrales; sin IA.
- **FR-012**: El semáforo de salud en el resumen DEBE usar las mismas reglas de hallazgos: rojo si hay N reglas negativas críticas, amarillo si mixto, verde si predominan positivas.
- **FR-013**: La ficha de colegio DEBE comparar métricas del colegio contra la mediana de todos los colegios activos.
- **FR-014**: Los endpoints DEBEN validar rol ADMIN (`verifyAuth`) y módulo correspondiente (`assertModulo`).
- **FR-015**: Ningún endpoint DEBE exponer contenido de reportes, identificadores de menores ni datos del denunciante.
- **FR-016**: Los nuevos parámetros de analytics DEBEN sembrarse en `prisma/seed.ts` (sección `monitoreoNuevos` como excepción documentada).
- **FR-017**: No se DEBE agregar campos nuevos a `Colegio` ni `Usuario`; solo agregaciones SQL sobre lo existente.
- **FR-018**: No se DEBE tocar `src/lib/ai/**`.
- **FR-019**: Los exportables CSV (US5) DEBEN incluir solo datos agregados y visibles; si no se alcanza, se documenta como deuda técnica.

### Key Entities

- `Usuario`: campos `rol`, `estado`, `creadoEn`, `ultimaSesion`, `tenantId`, `colegioId`; relaciones con `Reporte` y `Tenant`/`Colegio`.
- `Colegio`: campos `nombre`, `paisId`, `departamentoId`, `ciudadId`, `estado`, `creadoEn`, `representanteLegalNombre`, `representanteLegalEmail`; relaciones con `Tenant`, `Curso`, `Estudiante`, `Profesor`, `AlertaColegio`, `SolicitudComite`, `IntegranteComite`.
- `Reporte`: campos `tenantId`, `usuarioId`, `estado`, `creadoEn`, `eliminado`; relación con `Tenant` y `ClasificacionIA`.
- `AlertaColegio`: campos `colegioId`, `estado`, `tipoSujeto`, `creadoEn`; relación con `Colegio` y `Reporte`.
- `SolicitudComite`: campos `colegioId`, `estado`, `creadoEn`, `resueltoEn`; relación con `Colegio`.
- `IntegranteComite`: campos `colegioId`, `estado`; relación con `Colegio`.
- `ParametroSistema`: nuevos parámetros de configuración de analytics.

## Success Criteria *(mandatory)*

- **SC-001**: `/dashboard/admin/usuarios` responde 200 para ADMIN y el sub-tab "Padres" muestra padres reales de BD.
- **SC-002**: `GET /api/admin/analytics/colegios` responde en < 3 s tras caché caliente y < 10 s con caché frío.
- **SC-003**: El sub-tab "Colegios" es visible en `EstadisticasSubNav` y renderiza la tabla resumen.
- **SC-004**: La ficha por colegio renderiza las 7 secciones sin errores y sin exponer PII.
- **SC-005**: Los hallazgos se recalculan al cambiar los parámetros de configuración.
- **SC-006**: Gate local completo verde: `tsc`, `lint --no-cache`, `arch:check`, `test`, `build`.
- **SC-007**: CI 6/6 verde en el PR a `feature/001-scaffolding`.

## Assumptions

- El admin con rol ADMIN es el único usuario de estas vistas; SCHOOL_ADMIN/OPERADOR/COMITE no tienen acceso.
- El módulo Colegio A-G ya está en producción (`689d46ac`), por lo que las tablas `Colegio`, `Curso`, `Estudiante`, `Profesor`, `AcudienteEstudiante`, `AlertaColegio`, `SolicitudComite`, `IntegranteComite` existen y tienen datos.
- La vista `/dashboard/admin/padres` existe (SPEC-117) y su endpoint `/api/admin/padres` puede reutilizarse o extenderse para el sub-tab "Padres".
- Los componentes de tabla (`Tabla`), tarjetas (`GlassCard`), badges y charts existen en el design system; si no hay chart library, se usan barras HTML+CSS minimalistas.
- La caché se implementa en memoria (Map) con TTL por request/instancia, sin Redis adicional. Si el proyecto ya tiene una infraestructura de caché (p. ej. `src/lib/cache.ts`), se reutiliza.
- Las agregaciones se ejecutan con SQL directo vía `$queryRaw` o repositorios; no se itera en ORM.

## Decisiones propuestas para compuerta §4

1. **Ruta de usuarios**: nueva `/dashboard/admin/usuarios` con sub-tabs; la ruta `/dashboard/admin/padres` existente se mantiene como redirect o como vista legacy hasta decisión posterior del CEO.
2. **Reuso de endpoint padres**: extender `/api/admin/padres` (o crear `/api/admin/usuarios?rol=PARENT`) añadiendo filtros de colegio y con/sin reportes. Se propone crear `/api/admin/usuarios` genérico para no acoplar el futuro sub-tab de otros roles.
3. **Caché**: implementar un `AnalyticsCacheService` simple en memoria con TTL, clave por endpoint + query params hash. Invalidación manual: cambiar un parámetro en config no invalida cache automáticamente; el TTL lo hace. Se documenta este trade-off.
4. **Hallazgos**: reglas hardcoded en un servicio `hallazgos-colegio.ts` que lee parámetros. Positivos/negativos acumulan puntos; el semáforo usa umbrales de puntos (ej. >2 negativos = rojo).
5. **Comparación con la media**: usar mediana (no promedio) para no distorsionar por outliers. Si hay < 3 colegios activos, se muestra "insuficientes datos".
6. **Charts**: reutilizar componentes existentes si los hay; de lo contrario, barras HTML+CSS. No agregar librerías pesadas.
7. **Export CSV**: US5 se implementa si el esfuerzo es menor a 1 día; de lo contrario se deja como deuda técnica documentada.

## Implementación

- **Rama**: `work/002-pi-088`
- **Migración aditiva**: `prisma/migrations/20260821110000_spec_194_analytics_indexes/migration.sql` (índices en `Reporte(tenantId, creadoEn, estado)`, `AlertaColegio(colegioId, estado, creadoEn)`, `SolicitudComite(colegioId, estado, creadoEn)`)
- **Parámetros**: 5 params sembrados en `prisma/seed.ts` (`analytics.colegios.cache_ttl_min`, `analytics.colegios.inactividad_alerta_dias`, `analytics.colegios.spam_alerta_pct`, `analytics.colegios.resolucion_comite_ok_pct`, `analytics.colegios.periodo_default_dias`)
- **Servicios**: `src/lib/analytics/cache.ts`, `src/lib/analytics/parametros.ts`, `src/lib/analytics/hallazgos-colegio.ts`, `src/lib/analytics/usuarios-query.ts`
- **Endpoints**: `GET /api/admin/usuarios`, `GET /api/admin/usuarios/[id]`, `GET /api/admin/analytics/colegios`, `GET /api/admin/analytics/colegios/[id]`
- **UI**: `/dashboard/admin/usuarios`, `/dashboard/admin/usuarios/[id]`, sub-tab "Colegios" en `/dashboard/admin/estadisticas/operacion`, ficha `/dashboard/admin/estadisticas/operacion/colegios/[colegioId]`, sección "Analítica → Colegios" en `ConfigPanel`
- **Tests**: endpoints de usuarios y analytics (4 archivos, 15 tests integración)
- **Deuda técnica**: export CSV (US5) queda como P3 documentada en `cierre.md`
- **Gate local**: `tsc --noEmit`, `lint --no-cache`, `arch:check`, `test`, `build` verdes
