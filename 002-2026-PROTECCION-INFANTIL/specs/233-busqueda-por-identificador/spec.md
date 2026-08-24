# Feature Specification: SPEC-233 — Vista búsqueda por identificador (padre + admin)

> Feature Branch: `work/002-PI-mega-cola-restante`
> Created: 2026-08-24
> **Status**: PLANEADO
> PI: 002-PI-133
> Responsable: ODIN
> Base: `feature/001-scaffolding`

Impacto en arquitectura: añade las vistas `/dashboard/padre/identificador/[nick]` y `/dashboard/admin/identificador/[nick]` con 2 métodos DAL aditivos (agregado anonimizado Ley 1581 por `select` explícito de Prisma); sin cambios de modelo ni endpoints nuevos (Server Components + DAL, patrón SPEC-232).

## Contexto

Tercera etapa de la cadena UI Padre v2 (231 → 232 → 233). Implementa la vista de búsqueda por identificador en dos ámbitos, según brief `BRIEF-MODULO-PADRE-v2-EXPEDIENTE.md` §11.2 y §11.3:

- **Padre** — `/dashboard/padre/identificador/[nick]`: lista de TODOS los expedientes propios del padre autenticado sobre ese identificador (histórico completo, cronología nuevo → anterior), cada uno con su estado y link al detalle.
- **Admin/Comité** — `/dashboard/admin/identificador/[nick]`: vista privilegiada v1 **sin constelación** (N7 queda para v2). Lista simple de los expedientes de TODOS los padres que apuntan al mismo identificador, con datos **anonimizados** (Ley 1581: cero textos, cero identidad del padre) más el agregado anónimo de señal comunitaria.

Depende de SPEC-230 (modelos `Expediente`/`EventoExpediente`, en prod), SPEC-232 (vistas expedientes padre, mergeada) y SPEC-234 (señal comunitaria `obtenerSenalComunitaria`, en prod).

## User Stories

| ID | User Story | Priority |
|---|---|---|
| US-001 | Como padre, quiero buscar un identificador y ver todos mis expedientes sobre él, para entender el historial completo de esa situación. | Must |
| US-002 | Como padre, quiero navegar desde un expediente de la lista por identificador a su detalle, para profundizar en la cronología de eventos. | Must |
| US-003 | Como padre, quiero ver un estado vacío claro cuando no tengo expedientes sobre un identificador, con una salida hacia "Reportar". | Must |
| US-004 | Como admin/comité, quiero buscar un identificador y ver cuántos expedientes de toda la plataforma apuntan a él, para dimensionar la señal comunitaria sin exponer a los padres. | Must |
| US-005 | Como admin/comité, quiero ver el agregado anónimo del identificador (conteos por estado, categorías, plataformas, ciudades/países, rango de fechas), para analizar el caso sin acceder a textos ni identidades. | Must |
| US-006 | Como sistema, quiero que la vista admin nunca exponga `padreUsuarioId`, textos de eventos ni datos de contacto, para cumplir Ley 1581. | Must |

## Acceptance Scenarios

### AS-001 · Padre busca identificador con expedientes propios
**Given** un padre autenticado con 2 expedientes sobre el identificador `@nick_ejemplo`
**When** entra a `/dashboard/padre/identificador/@nick_ejemplo`
**Then** ve una cabecera con el identificador y 2 cards ordenadas por `fechaApertura` descendente (nuevo → anterior), cada una con estado, score de gravedad, fecha de apertura, número de eventos y link a `/dashboard/padre/expedientes/[id]`.

### AS-002 · Padre busca identificador sin expedientes propios
**Given** un padre autenticado sin expedientes sobre `+573001234567`
**When** entra a `/dashboard/padre/identificador/+573001234567`
**Then** ve un estado vacío: "No tienes expedientes sobre este identificador" con un botón hacia `/dashboard/padre/reportar`.

### AS-003 · Padre no ve expedientes de otros padres
**Given** un padre A autenticado y un padre B con 3 expedientes sobre `@otro_nick`
**When** el padre A entra a `/dashboard/padre/identificador/@otro_nick`
**Then** ve el estado vacío (cero resultados); los expedientes del padre B nunca aparecen.

### AS-004 · Admin/comité ve agregado anónimo
**Given** un usuario con rol `ADMIN` o `COMITE_VALIDACION` y 5 expedientes de 3 padres distintos sobre `@nick_ejemplo`
**When** entra a `/dashboard/admin/identificador/@nick_ejemplo`
**Then** ve el agregado anónimo (totales por estado, categorías frecuentes, plataformas, países/ciudades, primera y última aparición) y una lista de 5 filas anonimizadas (estado, score, fecha de apertura, plataforma, número de eventos) **sin** `padreUsuarioId`, sin textos y sin datos de contacto.

### AS-005 · Operador no accede a la vista admin
**Given** un usuario con rol `OPERADOR`
**When** intenta entrar a `/dashboard/admin/identificador/[nick]`
**Then** es redirigido a `/dashboard/admin` (la vista es exclusiva de `ADMIN` y `COMITE_VALIDACION`).

### AS-006 · Identificador inválido
**Given** cualquier usuario autenticado
**When** entra a la vista con un identificador vacío o de más de 100 caracteres
**Then** ve un mensaje de entrada inválida (no un error 500).

### AS-007 · Navegación de entrada (padre)
**Given** un padre en el detalle de un expediente
**When** hace clic en "Ver todos tus expedientes sobre este identificador"
**Then** llega a `/dashboard/padre/identificador/[nick]` con la lista filtrada.

## Edge Cases

- **Identificador con caracteres especiales** (nicks con espacios, `/`, `#`): la URL se genera con `encodeURIComponent` y la página decodifica `params`; nunca se ejecuta búsqueda con el valor crudo sin decodificar.
- **Identificador con expedientes en todos los estados**: la lista muestra los 7 estados con su etiqueta en criollo (`LABELS_ESTADO`), incluidos `CERRADO` y `ESCALADO`.
- **Campos nulos**: `plataformaId` nulo → "—"; `ultimoEventoEn` nulo → "Sin eventos aún"; nunca se renderiza un `null` crudo.
- **Caché de señal comunitaria ausente o invalidada**: `obtenerSenalComunitaria` recalcula al vuelo; la vista admin no falla ni muestra datos vacíos crudos (muestra "—" por dimensión sin datos).
- **Identificador sin ningún expediente en la plataforma (vista admin)**: agregado en ceros con mensaje "Sin expedientes registrados sobre este identificador" y lista vacía; sin filtrar por umbral de visibilidad pública (vista interna).
- **Doble clic / navegación repetida al mismo identificador**: la vista es de solo lectura; no hay mutaciones que proteger.

## Functional Requirements

- **FR-001**: El sistema DEBE crear la ruta `/dashboard/padre/identificador/[nick]/page.tsx` como Server Component, con el mismo patrón de autenticación de `src/app/dashboard/padre/expedientes/page.tsx` (cookie `__Host-token`/`token` + `verifyToken` + rol `PARENT`, redirect a `/login` en caso contrario).
- **FR-002**: La vista padre DEBE listar únicamente los expedientes del `padreUsuarioId` autenticado cuyo `identificadorReportado` coincida exactamente con el parámetro `[nick]` decodificado, ordenados por `fechaApertura` descendente.
- **FR-003**: El sistema DEBE agregar a `ExpedienteRepository` el método `listarExpedientesDePadrePorIdentificador(padreUsuarioId, identificadorReportado)` (aditivo; no modifica métodos existentes).
- **FR-004**: Cada card de la lista padre DEBE mostrar estado, score de gravedad, fecha de apertura, número de eventos y link al detalle `/dashboard/padre/expedientes/[id]`, reutilizando `LABELS_ESTADO`, `LABELS_SCORE` y `COLORES_SCORE` de `src/lib/padre/expediente-ui.ts`.
- **FR-005**: La vista padre DEBE incluir una caja de búsqueda ("Buscar por identificador") que navegue a la misma ruta con el nuevo valor (`encodeURIComponent`), y un estado vacío con CTA a `/dashboard/padre/reportar`.
- **FR-006**: El detalle de expediente padre (`ExpedienteDetalleClient`) DEBE incluir un link "Ver todos tus expedientes sobre este identificador" hacia la vista de búsqueda.
- **FR-007**: El sistema DEBE crear la ruta `/dashboard/admin/identificador/[nick]/page.tsx` como Server Component bajo el layout admin existente, restringida a roles `ADMIN` y `COMITE_VALIDACION` (otros roles internos → redirect a `/dashboard/admin`).
- **FR-008**: La vista admin DEBE mostrar el agregado anónimo del identificador usando `obtenerSenalComunitaria` (`src/lib/expediente/compilacion/queries/senal-comunitaria.ts`): totales por estado, categorías con frecuencia, plataformas, países/ciudades, primera y última aparición. Cero textos, cero identidades.
- **FR-009**: El sistema DEBE agregar a `ExpedienteRepository` el método `listarExpedientesPorIdentificadorAnonimo(identificadorReportado)` que retorne SOLO campos anonimizados (`estado`, `scoreGravedadActual`, `fechaApertura`, `fechaCierre`, `numEventos`, `plataformaId`); DEBE excluir `padreUsuarioId`, eventos y cualquier texto vía `select` explícito de Prisma.
- **FR-010**: La vista admin DEBE renderizar la lista anonimizada en lenguaje descriptivo/estadístico ("5 expedientes registrados sobre este identificador"), nunca veredictos ni etiquetas de riesgo sobre personas (presunción de inocencia).
- **FR-011**: La vista admin DEBE incluir una caja de búsqueda para consultar otro identificador y un estado vacío ("Sin expedientes registrados sobre este identificador") cuando el agregado es cero.
- **FR-012**: El sistema DEBE validar el parámetro `[nick]`: no vacío, máx 100 caracteres tras decodificar; entrada inválida muestra mensaje de error controlado (sin 500).
- **FR-013**: Todo campo nulo DEBE renderizarse como "—" o con motivo explícito (candado I del instructivo); prohibido renderizar `null`/`undefined` crudos.
- **FR-014**: El sistema DEBE usar timezone `America/Bogota` (`date-fns-tz`) para las fechas mostradas, siguiendo D-69 y el patrón de `src/lib/padre/expediente-ui.ts`.
- **FR-015**: La vista padre DEBE usar el tema `cielo` y la vista admin el tema `ambar`, con componentes vidrio heredados (`GlassCard`); radios 16/12/22.
- **FR-016**: El sistema NO DEBE modificar `src/lib/ai/**`, el schema Prisma, el rate-limit del reporte público, ni crear migraciones.
- **FR-017**: Todo acceso a datos DEBE pasar por la DAL (`ExpedienteRepository`, `obtenerSenalComunitaria`); prohibido importar `@/lib/prisma` en páginas ni componentes.
- **FR-018**: La vista admin DEBE incluir de forma visible los canales oficiales (Línea 141 ICBF, CAI Virtual, Te Protejo) solo si la vista invita a actuar sobre un caso; la vista padre los mantiene heredados del flujo de reporte. No se agregan bloques nuevos de canales en estas vistas de solo lectura.

## Non-Functional Requirements

- **NFR-001**: Gate local completo: `npx tsc --noEmit`, `npm run lint -- --no-cache`, `npm run arch:check`, `npm run test`, `npm run build`.
- **NFR-002**: Tests de integración/unitarios de los dos métodos nuevos del repository (filtro por padre + identificador; select anonimizado sin `padreUsuarioId`).
- **NFR-003**: Tests de componente para la lista padre (estado vacío, orden, links) y la lista admin (ausencia de campos sensibles en el render).
- **NFR-004**: Responsive: 1 columna en mobile, 2 en desktop, dentro de los layouts existentes.
- **NFR-005**: Regenerar artefactos de arquitectura (`docs/architecture/03-pantallas.md` y los que aplique) y dejar `npm run arch:check` en verde.

## Success Criteria

- **SC-001**: `/dashboard/padre/identificador/[nick]` muestra solo expedientes propios sobre ese identificador (0 fuga cruzada entre padres, verificado en test).
- **SC-002**: La lista padre ordena nuevo → anterior y cada card navega al detalle correcto.
- **SC-003**: `/dashboard/admin/identificador/[nick]` muestra agregado anónimo + lista anonimizada de todos los expedientes de la plataforma sobre ese identificador.
- **SC-004**: El HTML renderizado de la vista admin no contiene `padreUsuarioId`, textos de eventos ni emails/teléfonos de padres (verificado en test de componente).
- **SC-005**: Un `OPERADOR` no puede renderizar la vista admin de búsqueda.
- **SC-006**: Campos nulos se muestran como "—" o motivo explícito en ambas vistas.
- **SC-007**: CI verde con gate completo (types, lint, arch:check, tests, build).

## Assumptions

- SPEC-230 dejó en prod `Expediente`, `EventoExpediente` y `ExpedienteRepository`; SPEC-234 dejó `obtenerSenalComunitaria` con fallback de recálculo al vuelo.
- SPEC-232 dejó el detalle de expediente padre (`ExpedienteDetalleClient`) donde se ancla el link de entrada.
- El layout admin (`src/app/dashboard/admin/layout.tsx`) ya autentica roles internos; la restricción fina a `ADMIN`/`COMITE_VALIDACION` se hace en la página.
- La constelación N7 (mapa, timeline, co-menciones) queda fuera de alcance v1 (§16 del brief).
- No se requieren endpoints API nuevos: ambas vistas son Server Components que leen vía DAL (patrón de SPEC-232).
- No se requieren cambios en `src/lib/proxy.ts`: `/dashboard/padre/**` ya es ruta de usuario final y `/dashboard/admin/**` ya es ruta interna.

## Decisiones propuestas / Deuda

1. **Admin sin botón "Ver detalle de expediente" en v1**: el brief §11.3 lo menciona, pero no existe vista admin de detalle de expediente y el candado del instructivo fija "solo agregado anónimo". La lista admin muestra filas anonimizadas sin navegación; el detalle admin/comité llega con SPEC-237 (bandeja comité consolidación). ZEUS audita esta desviación acotada.
2. **Vista admin restringida a `ADMIN` + `COMITE_VALIDACION`**: el brief §11.3 titula "Admin/Comité"; el `OPERADOR` queda fuera en v1 (su trabajo es por reportes asignados, no por identificador agregado).
3. **Entrada admin por URL + caja de búsqueda en la propia vista**: no se toca `AdminNav` ni la home admin para minimizar colisiones con permisos granulares de módulos; la vista es alcanzable por URL directa y permite re-buscar.
4. **Agregado admin vía `obtenerSenalComunitaria`** (caché con recálculo al vuelo) en vez de queries ad-hoc: reutiliza la fuente única de SPEC-234 y evita divergencias de criterio.
5. **Deuda**: constelación N7 (v2); notificación proactiva N6 (v2); AuditLog de lecturas admin (no exigido por §13 del brief, que solo audita descargas PDF).

## Impacto en arquitectura

- Agrega `src/app/dashboard/padre/identificador/[nick]/page.tsx` (nueva ruta padre).
- Agrega `src/app/dashboard/admin/identificador/[nick]/page.tsx` (nueva ruta admin).
- Agrega 2 métodos a `src/lib/dal/repositories/expediente-repository.ts` (aditivos).
- Agrega componentes en `src/components/modules/padre/` (búsqueda/lista por identificador) y `src/components/modules/admin/` (agregado + lista anonimizada).
- Toca `src/components/modules/padre/ExpedienteDetalleClient.tsx` (link de entrada).
- Regenera artefactos de arquitectura (`docs/architecture/`, SPEC-126) y deja `arch:check` verde.
- Cero cambios en `src/lib/ai/**`, cero cambios de schema Prisma, cero migraciones, cero endpoints API nuevos.
