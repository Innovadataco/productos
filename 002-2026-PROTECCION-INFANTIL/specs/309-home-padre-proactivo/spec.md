# Feature Specification: Home dashboard proactivo del área padre

**Feature Branch**: `work/pi-SPEC-309-home-padre-proactivo`

**Created**: 2026-08-29

**Status**: IMPLEMENTADO

**Impacto en arquitectura:** Añade endpoint `GET /api/padre/home`, componentes en `src/components/modules/padre/`, servicios en `src/lib/padre/` y consultas centralizadas en `src/lib/dal/services/padre-home.ts`. Reutiliza el DAL del círculo de confianza sin modificar schema ni el motor de IA.

**Input**: User description: "Home dashboard proactivo (reemplaza PlaceholderPadre.tsx con resumen inteligente del día)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cabecera proactiva y resumen del círculo (Priority: P1)

Como padre autenticado, quiero ver en `/dashboard/padre` un saludo personalizado con la fecha actual y un resumen de mi círculo de confianza, para tener contexto inmediato de mi día.

**Why this priority**: Es la primera impresión del home; reduce la carga cognitiva y ancla el resto de widgets.

**Independent Test**: Renderizar `HomePadreDashboard` con datos de usuario y resumen; debe mostrar saludo, fecha formateada y conteos del círculo.

**Acceptance Scenarios**:

1. **Given** un padre autenticado con nombre, **When** carga el home, **Then** ve "Buenos días, {nombre}" y la fecha de hoy en español (CO).
2. **Given** un padre sin contactos, **When** carga el home, **Then** el resumen indica 0 contactos y un mensaje para empezar.
3. **Given** un padre con contactos activos, **When** carga el home, **Then** el resumen muestra total de contactos y cuántos están sin reportes, en revisión y con reportes clasificados.

### User Story 2 - Semáforo y timeline del círculo (Priority: P1)

Como padre, quiero ver de un vistazo el semáforo de riesgo de mi círculo y una línea de tiempo con los últimos eventos relevantes, para priorizar a quién prestar atención.

**Why this priority**: Convierte datos dispersos en una narrativa visual priorizada.

**Independent Test**: `GET /api/padre/home` debe incluir `semaforo` y `timeline`; los componentes deben renderizarlos sin importar los bloques 305/306.

**Acceptance Scenarios**:

1. **Given** contactos con diferentes niveles de riesgo, **When** se renderiza el home, **Then** el semáforo muestra el color derivado por cada contacto (verde/ámbar/rojo) según regla de negocio.
2. **Given** un contacto sin reportes visibles, **When** se calcula el semáforo, **Then** muestra verde.
3. **Given** expedientes con eventos recientes vinculados a identificadores del círculo, **When** se renderiza el timeline, **Then** muestra los 5 más recientes con fecha y categoría.
4. **Given** sin eventos recientes, **When** se renderiza el timeline, **Then** muestra estado vacío amigable.

### User Story 3 - Sugerencia proactiva y accesos rápidos (Priority: P2)

Como padre, quiero recibir una sugerencia del día basada en mis datos y accesos rápidos a las acciones más frecuentes, para actuar sin navegar profundamente.

**Why this priority**: Acelera el siguiente paso más probable y cumple el requisito de canales oficiales.

**Independent Test**: `HomePadreDashboard` renderiza la sugerencia según estado del círculo/suscripción y los accesos rápidos con hrefs correctos.

**Acceptance Scenarios**:

1. **Given** un contacto en semáforo rojo, **When** se calcula la sugerencia, **Then** se recomienda revisar ese expediente.
2. **Given** suscripción en período de gracia, **When** se calcula la sugerencia, **Then** se sugiere renovar el plan.
3. **Given** cualquier estado, **When** se renderizan accesos rápidos, **Then** se muestran enlaces a Reportar, Círculo, Expedientes y canales oficiales (Línea 141, CAI Virtual, Te Protejo).

### User Story 4 - Exponer datos del home vía API interna (Priority: P2)

Como frontend del área del padre, quiero consumir el dashboard desde `GET /api/padre/home`, para desacoplar la obtención de datos del renderizado y facilitar tests.

**Why this priority**: Permite testear la orquestación de datos de forma aislada y deja la puerta abierta a futuras vistas.

**Independent Test**: `GET /api/padre/home` con sesión PARENT retorna el payload completo; sin rol PARENT retorna 403.

**Acceptance Scenarios**:

1. **Given** una sesión de rol PARENT, **When** llama al endpoint, **Then** recibe saludo, fecha, resumen, semáforo, timeline, sugerencia y accesos.
2. **Given** una sesión sin rol PARENT, **When** llama al endpoint, **Then** recibe 403.
3. **Given** errores en una sub-query, **When** el endpoint falla, **Then** retorna error canónico 500 sin exponer stack trace.

## Edge Cases

- ¿Qué pasa si el padre no tiene contactos? → Resumen 0, semáforo vacío, sugerencia invita a agregar primer contacto.
- ¿Qué pasa si no hay reportes visibles? → Semáforo todo verde, timeline vacío, sugerencia genérica de tranquilidad.
- ¿Qué pasa si hay más de 20 contactos? → Se respeta el tope configurado; se muestra advertencia si se excede.
- ¿Qué pasa si la vigencia está en gracia? → Sugerencia prioriza renovación; el banner existente también se muestra.
- ¿Qué pasa si una sub-query falla? → Server Component muestra estado degradado; endpoint retorna error canónico.
- ¿Qué pasa si se accede sin rol PARENT? → Middleware/endpoint devuelven 403.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El archivo `src/app/dashboard/padre/page.tsx` DEBE ser un Server Component que orqueste servicios en `src/lib/padre/` y reemplace el uso de `PlaceholderPadre`.
- **FR-002**: El dashboard DEBE mostrar saludo personalizado con el nombre del padre y la fecha actual en zona `America/Bogota`.
- **FR-003**: El dashboard DEBE mostrar un resumen del círculo: total de contactos activos, contactos sin reportes, en revisión y con reportes clasificados.
- **FR-004**: El dashboard DEBE mostrar un semáforo de riesgo por contacto del círculo (verde/ámbar/rojo) calculado con queries propias; PROHIBIDO importar directamente los componentes o servicios de SPEC-305.
- **FR-005**: El dashboard DEBE mostrar un timeline con los últimos 5 eventos relevantes del círculo, calculado con queries propias; PROHIBIDO importar directamente los componentes o servicios de SPEC-306.
- **FR-006**: El dashboard DEBE mostrar una sugerencia proactiva del día derivada de datos (sin LLM), calculada con reglas propias; PROHIBIDO importar directamente los servicios de SPEC-307.
- **FR-007**: El dashboard DEBE mostrar accesos rápidos a Reportar, Círculo de confianza, Expedientes y canales oficiales (Línea 141 ICBF, CAI Virtual, Te Protejo); PROHIBIDO importar directamente los componentes de SPEC-308.
- **FR-008**: El sistema DEBE exponer `GET /api/padre/home` que retorne el mismo payload agregado que usa el dashboard.
- **FR-009**: Tanto la página como el endpoint DEBEN restringirse a usuarios con rol `PARENT`.
- **FR-010**: No se DEBE usar LLM ni modificar `src/lib/ai/**` ni `src/lib/notificaciones/motor.ts`.

### Key Entities

- **Usuario**: padre autenticado (`id`, `nombre`, `rol`).
- **ContactoConfianza**: contactos del círculo (`id`, `usuarioId`, `etiqueta`, `activo`).
- **IdentificadorContacto**: valores asociados a contactos (`contactoId`, `valor`, `activo`).
- **Reporte**: reportes visibles filtrados por `whereReportesCirculo`.
- **EventoExpediente**: eventos recientes de expedientes del padre vinculados a identificadores del círculo.
- **Expediente**: expedientes del padre con `scoreGravedadActual`.
- **ParametroSistema**: umbrales y textos de sugerencia/accesos (`padre.home.*`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El Server Component renderiza en < 200 ms p95 para un círculo de hasta 20 contactos.
- **SC-002**: `GET /api/padre/home` responde en < 150 ms p95.
- **SC-003**: Cada componente de widget y el endpoint tienen tests unitarios con cobertura > 80%.
- **SC-004**: El dashboard no importa directamente archivos de SPEC-305 a SPEC-308; la verificación se hace con `grep`/`dependency-cruiser` o revisión de PR.
- **SC-005**: El lenguaje de la UI respeta presunción de inocencia: "N reportes registrados", "nivel de atención", etc.

## Assumptions

- El middleware ya limita `/dashboard/padre` a usuarios con rol `PARENT`.
- SPEC-135 provee el modelo y queries base del círculo de confianza.
- SPEC-230/234 proveen expedientes y eventos.
- Los canales oficiales son enlaces/parámetros configurables.
- La fecha se presenta en zona `America/Bogota`.

## Implementation

### Resumen

Se implementó el home dashboard proactivo del área padre reemplazando `PlaceholderPadre.tsx` por `HomePadreDashboard` y servicios propios en `src/lib/padre/`. Las consultas a Prisma fueron centralizadas en `src/lib/dal/services/padre-home.ts` para cumplir la regla Q-3 de no acceder directamente a `@/lib/prisma` fuera del DAL.

### Archivos creados

- `src/lib/padre/home.ts` — orquestador del payload del home (saludo, resumen, semáforo, timeline, sugerencia, accesos).
- `src/lib/padre/home-semaforo.ts` — cálculo de color verde/ámbar/rojo por contacto con reglas propias.
- `src/lib/padre/home-timeline.ts` — consulta de últimos eventos del círculo.
- `src/lib/padre/home-sugerencia.ts` — reglas simples (sin LLM) para la sugerencia del día.
- `src/lib/dal/services/padre-home.ts` — capa DAL con las queries Prisma para el home del padre.
- `src/components/modules/padre/HomePadreDashboard.tsx` — contenedor del dashboard.
- `src/components/modules/padre/ResumenCirculo.tsx` — resumen del círculo.
- `src/components/modules/padre/SemaforoResumen.tsx` — semáforo por contacto.
- `src/components/modules/padre/TimelineResumen.tsx` — timeline de eventos.
- `src/components/modules/padre/SugerenciaProactiva.tsx` — banner de sugerencia.
- `src/components/modules/padre/AccesosRapidos.tsx` — enlaces rápidos y canales oficiales.
- `src/app/api/padre/home/route.ts` — endpoint `GET /api/padre/home`.

### Archivos modificados

- `src/app/dashboard/padre/page.tsx` — reemplaza `PlaceholderPadre` por `HomePadreDashboard` y orquesta `obtenerHomePadre`.

### Tests

- `src/lib/padre/home.test.ts`
- `src/lib/padre/home-semaforo.test.ts`
- `src/lib/padre/home-sugerencia.test.ts`
- `src/components/modules/padre/ResumenCirculo.test.tsx`
- `src/components/modules/padre/SemaforoResumen.test.tsx`
- `src/components/modules/padre/TimelineResumen.test.tsx`
- `src/components/modules/padre/SugerenciaProactiva.test.tsx`
- `src/components/modules/padre/AccesosRapidos.test.tsx`
- `src/components/modules/padre/HomePadreDashboard.test.tsx`
- `src/app/api/padre/home/route.test.ts`

### Gate de calidad

- `npx tsc --noEmit`: ✅ sin errores.
- `npm run lint`: ✅ sin errores nuevos (warnings preexistentes ajenos a SPEC-309).
- Tests de SPEC-309: ✅ 31 tests pasan.
- Build local: no se ejecutó por variables de entorno faltantes; se delega a CI.

### Deuda técnica / notas

- El build local requiere variables de entorno completas; CI ejecutará `npm run build`.
- `scripts/dev-restart.sh` y validación en vivo con padre real quedan pendientes post-merge.
- No se importan servicios/componentes de SPEC-305 a SPEC-308; cada bloque tiene implementación propia.
