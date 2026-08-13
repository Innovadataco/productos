# Feature Specification: SPEC-167 — Rediseño 3→2: Inicio + Estadísticas, eliminar Tablero

**Feature Branch**: `work/002-pi-167`

**Created**: 2026-08-12

**Status**: IMPLEMENTADO

**Input**: [BRIEF-MODULO-COLEGIO](../../../../Gestion-de-proyectos/01-PROYECTOS/001-2026-PROTECCION_INFANTIL/05-ENTREGABLES/BRIEF-MODULO-COLEGIO.md) §6 (rediseño de 3 → 2 pantallas). Fuentes vinculantes: SPEC-143 (home operativa del rector), SPEC-158 (tablero de control), SPEC-142 (patrones institucionales), SPEC-153 (comparativa entre cursos), SPEC-162 (materia configurable), SPEC-129 (rediseño UX colegio), SPEC-078 (estadísticas e informe PDF). Patrones: SPEC-134 (tenant-first / DAL E-1), SPEC-157 (sistema de diseño, tokens).

**Resumen ejecutivo**: consolidar las tres pantallas del módulo Colegio en dos. `/dashboard/colegio` pasa a ser el **radar operativo** del rector: semáforo héroe, "te esperan a ti (N)" prominente, KPIs, anillos de protección, cursos que merecen mirada y acciones rápidas. `/dashboard/colegio/estadisticas` pasa a ser la **inteligencia del colegio**: tendencia, desglose por curso, patrones institucionales, comparativa, reloj 24 h y conteo de profesores. `/dashboard/colegio/tablero` se elimina, sus componentes se reubican y su URL redirige a Inicio.

## Impacto en arquitectura:

- **UI/Navegación**: se consolidan tres pantallas en dos (`/dashboard/colegio` y `/dashboard/colegio/estadisticas`); se actualiza `nav-items.ts` y se redirige `/tablero`.
- **Datos**: reutiliza agregados existentes (`colegio-resumen`, `alerta-colegio-tablero`) sin cambios de schema; se eliminan componentes huérfanos del Tablero.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Inicio como radar operativo (Priority: P1)

Como rector (`SCHOOL_ADMIN`), al abrir `/dashboard/colegio` quiero ver en 3 segundos el estado de protección de mi colegio y qué tiene que hacer hoy, de modo que el semáforo héroe, el número de alertas que me esperan, los KPIs, los anillos de protección, los cursos que merecen mirada y las acciones rápidas me guíen sin distracciones.

**Why this priority**: Es la decisión central del brief §6: Inicio absorbe el valor del Tablero y se convierte en la única pantalla de aterrizaje operativo.

**Independent Test**: con un colegio que tiene estudiantes, cursos, profesores y alertas en distintos estados, la home renderiza el semáforo, el embudo con "te esperan a ti (N)", los cuatro KPIs, los anillos, el top 3 de cursos con actividad y las acciones rápidas; todo con datos del colegio de la sesión y sin cruzar tenants.

**Acceptance Scenarios**:

1. **Given** un rector autenticado, **When** abre `/dashboard/colegio`, **Then** el héroe muestra el semáforo del colegio (pino/ámbar/rubí según SPEC-143 D1), el punto late solo cuando hay novedad y el copy respeta la condición de ámbar de SPEC-143.
2. **Given** alertas en estado `nueva`, **When** se renderiza la home, **Then** aparece el bloque "Te esperan a ti" con el número grande, destacado en rubí, y un botón que enlaza a `/dashboard/colegio/alertas`.
3. **Given** cero alertas nuevas, **When** se renderiza la home, **Then** el bloque muestra "Nada te espera — la vigilancia sigue activa" en pino, sin CTA de alertas.
4. **Given** los KPIs del colegio, **When** se cuentan, **Then** muestran estudiantes activos, cursos activos, profesores activos y reportes del mes (métrica D2 de SPEC-143), cada uno con su subetiqueta.
5. **Given** los datos de la home, **When** se cargan, **Then** salen de UNA llamada a `ColegioResumenRepository.homeRector(colegioId)` (ampliada con embudo) o de una llamada adicional mínima que no genere N+1.
6. **Given** un colegio sin cursos, **When** abre la home, **Then** se muestra el `EmptyStateColegio` existente (SPEC-143) sin KPIs rotos.

---

### User Story 2 — Estadísticas como inteligencia del colegio (Priority: P1)

Como rector, quiero que `/dashboard/colegio/estadisticas` sea la pantalla de análisis de mi colegio: tendencia de reportes, desglose por curso, patrones institucionales, comparativa por grado/año, reloj de actividad 24 h y conteo de profesores, de modo que pueda pasar de reactivo a preventivo sin ver datos personales.

**Why this priority**: El brief §6 define esta pantalla como "inteligencia"; reúne visualizaciones hoy dispersas y elimina la redundancia con Inicio/Tablero.

**Independent Test**: un rector puede navegar por las secciones de estadísticas, ver tendencia, desglose por curso, patrones del trimestre, comparativa agrupada y reloj 24 h; otro rector no ve datos ajenos; la página no expone PII.

**Acceptance Scenarios**:

1. **Given** la página de estadísticas, **When** se carga, **Then** muestra una sección de tendencia (gráfica de área con toggle semanal/mensual/anual, reutilizando `TendenciaReportes` de SPEC-143).
2. **Given** el desglose por curso, **When** se renderiza, **Then** muestra la tabla de cursos con estudiantes, identificadores, alertas y profesores asignados, ordenada por alertas de forma predeterminada.
3. **Given** la sección de patrones, **When** hay datos del trimestre actual, **Then** muestra conteos agregados por grado, conducta y plataforma con k-anonimato k=3 (SPEC-142); si no hay datos suficientes, muestra el estado vacío honesto.
4. **Given** la sección de comparativa, **When** el rector elige agrupar por grado o por año lectivo, **Then** se repinta la tabla con los grupos y totales (reutilizando SPEC-153).
5. **Given** el reloj de actividad 24 h, **When** se renderiza, **Then** muestra los 24 sectores con picos en hora de Colombia (reubicado desde SPEC-158) y resumen textual accesible.
6. **Given** el dashboard público global, **When** está en la página de estadísticas, **Then** ya no ocupa la cabecera: se rotula aparte como "Mapa de reportes a nivel país" al final de la página o se accede desde un enlace separado, sin confundir con las estadísticas del colegio.
7. **Given** un rol distinto a `SCHOOL_ADMIN` o sin acceso al módulo, **When** intenta entrar, **Then** recibe 403/`SinAccesoModulo`.

---

### User Story 3 — Eliminar Tablero sin pérdida de valor (Priority: P2)

Como rector, cuando navegue a `/dashboard/colegio/tablero` quiero ser redirigido a `/dashboard/colegio`, porque el Tablero ya no existe y su valor vive ahora en Inicio y Estadísticas.

**Why this priority**: Cierra el rediseño 3→2 del brief §6 y reduce la carga cognitiva del menú.

**Independent Test**: la ruta `/dashboard/colegio/tablero` devuelve redirect 308/307 a `/dashboard/colegio`; el ítem "Tablero" desaparece del menú lateral; los componentes del tablero se reubican o eliminan sin romper tests ajenos.

**Acceptance Scenarios**:

1. **Given** la URL `/dashboard/colegio/tablero`, **When** un rector autenticado la visita, **Then** es redirigido a `/dashboard/colegio` (redirect permanente o temporal, según decida implementación).
2. **Given** la navegación lateral del colegio, **When** se renderiza, **Then** no aparece el ítem "Tablero" y el orden es: Inicio, Cursos, Profesores, Materias, Subir lista, Alertas, Estadísticas, Configuración, Auditoría.
3. **Given** los componentes del tablero, **When** se reubican, **Then** `EmbudoEstado` pasa a `src/components/modules/colegio/home/EmbudoEstado.tsx`, `RelojActividad` pasa a `src/components/modules/colegio/estadisticas/RelojActividad.tsx` y `RitmoMensual`/`BarrasPorCurso` se reutilizan o fusionan con los componentes de estadísticas/inteligencia.
4. **Given** un enlace guardado o referencia externa a `/dashboard/colegio/tablero`, **When** se accede, **Then** termina en Inicio sin error 404.

---

### Edge Cases

- **Colegio sin alertas jamás**: el embudo muestra ceros, "te esperan a ti" = 0 con copy positivo; el reloj 24 h muestra el círculo vacío honesto.
- **Colegio sin profesores**: KPI y sección de profesores muestran 0 sin romper; los cursos muestran "sin titular asignado".
- **Reporte con alertas en varios cursos**: en el embudo cuenta UNA vez en su bucket más pendiente (reusa `embudoPorReporte`); en el desglose por curso se atribuye a cada curso afectado.
- **Timezone faltante en BD**: el reloj 24 h cae al fallback UTC-5 documentado (SPEC-158), nunca a la hora del servidor.
- **Celda de patrón con conteo < k=3**: se suprime del desglose, se indica que hay grados/conductas/plataformas no desglosables y el total sigue visible.
- **Página de estadísticas sin datos suficientes**: cada sección muestra su estado vacío propio (tendencia con serie de ceros, patrones con mensaje honesto, comparativa con tabla vacía).
- **Cross-tenant**: todos los agregados llevan `colegioId`; un rector de otro colegio ve ceros y sus propios patrones.
- **Redirección con query string**: `/dashboard/colegio/tablero?foo=bar` redirige a `/dashboard/colegio?foo=bar` si es técnicamente viable; si no, a `/dashboard/colegio`.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La página `/dashboard/colegio` DEBE mostrar el radar operativo completo: héroe de semáforo, bloque "Te esperan a ti (N)" prominente, KPIs (estudiantes, cursos, profesores, reportes del mes), anillos de protección, cursos que merecen mirada, acciones rápidas y canales oficiales.
- **FR-002**: El bloque "Te esperan a ti" DEBE reutilizar la lógica del embudo de SPEC-158 (`embudoPorReporte`), mostrar el número de reportes distintos con al menos una alerta `nueva`, destacar visualmente cuando es > 0 y enlazar a `/dashboard/colegio/alertas`.
- **FR-003**: Todos los datos del radar operativo DEBEN salir de UNA llamada al DAL (`ColegioResumenRepository.homeRector(colegioId)` ampliada o un nuevo método equivalente) con consultas paralelas y cero N+1.
- **FR-004**: La página `/dashboard/colegio/estadisticas` DEBE transformarse en inteligencia del colegio: tendencia (toggle semanal/mensual/anual), desglose por curso, patrones institucionales (SPEC-142), comparativa por grado/año lectivo (SPEC-153), reloj de actividad 24 h y conteo/tabla de profesores.
- **FR-005**: La sección de patrones DEBE consumir `GET /api/colegio/patrones` (ya existente) y aplicar la misma regla de k-anonimato k=3 sin reimplementarla.
- **FR-006**: La sección de comparativa DEBE consumir `GET /api/colegio/analisis/comparativa` (ya existente) con selector de criterio grado/año lectivo.
- **FR-007**: El reloj de actividad 24 h DEBE reubicarse desde el Tablero a Estadísticas, mantener la agregación por hora de Colombia y el SVG propio (sin librería radial).
- **FR-008**: El dashboard público global (`PublicDashboard`) DEBE salir de la cabecera de estadísticas y rotularse aparte como "Mapa de reportes a nivel país" al final de la página o como enlace separado; nunca confundirse con las estadísticas del propio colegio.
- **FR-009**: La página `/dashboard/colegio/tablero` DEBE eliminarse como pantalla funcional y redirigir a `/dashboard/colegio`.
- **FR-010**: El ítem "Tablero" DEBE eliminarse de `COLEGIO_NAV_ITEMS` en `src/lib/nav-items.ts` y de cualquier referencia de navegación (tests incluidos).
- **FR-011**: Los componentes `EmbudoEstado`, `RelojActividad`, `RitmoMensual` y `BarrasPorCurso` DEBEN reubicarse a las carpetas `home/` o `estadisticas/` según corresponda; los archivos de `tablero/` DEBEN eliminarse.
- **FR-012**: Los datos de estadísticas DEBEN ser colegio-scoped (`colegioId` en cada query), sin exponer PII (nunca texto de reporte, nombres de estudiantes, valores de identificadores ni quién reportó).
- **FR-013**: No se DEBE modificar el modelo `Curso` ni `Estudiante.cursoId`; las queries reutilizan los repositorios existentes.
- **FR-014**: No se DEBE tocar `src/lib/ai/**`; la inteligencia es agregación determinista de datos existentes.
- **FR-015**: La experiencia visual DEBE respetar tokens de SPEC-157, `prefers-reduced-motion`, tap targets ≥ 44 px y terminología §3 del brief (estudiantes, profesores, cursos, subir lista).
- **FR-016**: Cada mutación o descarga relevante DEBE seguir registrándose en `AuditLog` con las acciones existentes (p. ej. `COLEGIO_ESTADISTICAS_PDF_DESCARGADO`, `COLEGIO_COMPARATIVA_EXCEL_DESCARGADO`).

### Key Entities

- **HomeRector (DTO ampliado)**: salida de `ColegioResumenRepository.homeRector` — incluye los campos actuales de SPEC-143 más `embudo: { recibidos, cerrados, enRevision, teEsperan }`.
- **EstadisticasInteligenciaColegio (DTO)**: salida de `GET /api/colegio/estadisticas` ampliada — `{ colegioId, colegioNombre, totales, porCurso, profesores, tendencia: { semanal, mensual, anual }, reloj24h, patrones, comparativa }`.
- **PatronesColegioDto**: ya definido en `src/lib/colegio/patrones.ts`; se consume tal cual.
- **ComparativaCursos**: ya definido en `src/lib/colegio/comparativa.ts`; se consume tal cual.
- **TableroColegio (DTO)**: queda deprecado; sus campos se redistribuyen en `HomeRector` y `EstadisticasInteligenciaColegio`.

---

## Success Criteria *(mandatory)*

- **SC-001**: El rector ve el radar operativo completo en `/dashboard/colegio` con el embudo correcto (sin solapes), KPIs exactos y datos propios del colegio (test A/B).
- **SC-002**: `/dashboard/colegio/estadisticas` muestra tendencia, desglose por curso, patrones, comparativa, reloj 24 h y conteo de profesores sin exponer PII.
- **SC-003**: `/dashboard/colegio/tablero` redirige a `/dashboard/colegio` y el ítem "Tablero" ya no aparece en el menú lateral.
- **SC-004**: Todos los datos de ambas pantallas salen de UNA llamada al DAL por carga (o llamadas paralelas concretas sin N+1) y respetan el aislamiento por `colegioId`.
- **SC-005**: `tokens:check`, `arch:check`, `tsc --noEmit`, `npm run lint` y `npm run test` quedan verdes.
- **SC-006**: No se modifica `prisma/schema.prisma` ni se altera `Curso` / `Estudiante.cursoId`.
- **SC-007**: No se toca `src/lib/ai/**`.

---

## Assumptions

- SPEC-143 (home operativa) y SPEC-158 (tablero) están implementados; sus componentes y repositorios se reutilizan y reubican.
- SPEC-142 (patrones) y SPEC-153 (comparativa) están implementados; sus endpoints y servicios se consumen sin reimplementar la lógica de negocio.
- El dashboard público global (`PublicDashboard`) sigue siendo útil como contexto nacional; por eso se rotula aparte en vez de eliminarse.
- La métrica D2 (`COUNT(DISTINCT reporteId)`) sigue siendo la fuente de verdad para reportes del colegio.
- El semáforo heredado de SPEC-143 (rubí/ámbar/pino con regla de 72 h) no cambia; solo se reafirma en el radar operativo.
- No se requiere migración de base de datos: el rediseño es reorganización de UI y DTOs.
- El término "Estudiante" ya es el único usado en la UI del colegio (terminología §3).

---

## Impacto en arquitectura

- **UI/App Router**: se modifica `src/app/dashboard/colegio/page.tsx` (radar operativo), `src/app/dashboard/colegio/estadisticas/page.tsx` y su cliente (inteligencia), y `src/app/dashboard/colegio/tablero/page.tsx` (redirect). Se eliminan `TableroClient.tsx` y la carpeta `src/app/dashboard/colegio/tablero/`.
- **Componentes**: reubicación de `EmbudoEstado` a `src/components/modules/colegio/home/EmbudoEstado.tsx`, `RelojActividad` a `src/components/modules/colegio/estadisticas/RelojActividad.tsx`; `RitmoMensual` y `BarrasPorCurso` se fusionan o reubican en `estadisticas/`.
- **DAL**: `ColegioResumenRepository.homeRector(colegioId)` se amplía con `embudo` (reusa `AlertaColegioRepository.embudoPorReporte`). `src/lib/colegio/estadisticas.ts` se amplía para devolver `EstadisticasInteligenciaColegio` con tendencia, reloj 24 h y conteo de profesores; reusa patrones y comparativa.
- **API**: `GET /api/colegio/estadisticas` devuelve el DTO ampliado; `GET /api/colegio/estadisticas/pdf` puede requerir ajustes mínimos si el PDF incluye nuevas secciones (alcance opcional).
- **Navegación**: `src/lib/nav-items.ts` pierde el ítem "Tablero"; se actualiza `nav-items.test.ts` si lo verifica.
- **Arquitectura**: se regeneran artefactos de `docs/architecture/` (`03-pantallas.md`, `04-rutas-api.md`, etc.) y se deja `npm run arch:check` verde.
- **Modelo de datos**: sin cambios; no hay migración.
