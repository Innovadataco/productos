# SPEC-231 · Sidebar padre + rutas base (002-PI-131)

> Status: `PLANEADO`
> PI: 002-PI-131
> Responsable: ODIN
> Rama: `work/002-PI-131`
> Base: `feature/001-scaffolding`

## Contexto

Primer paso de la cadena UI Padre v2 (231 → 232 → 233). Crea la navegación lateral del área del padre (`/dashboard/padre/*`) con color `cielo` y 7 items de menú que apuntan a rutas placeholder con mensaje "Próximamente". Coordina con SPEC-211 (Pagos): el sidebar lo crea esta SPEC con todos los items; SPEC-211 solo implementa el contenido de `/dashboard/padre/suscripcion` sin tocar el sidebar. Depende de SPEC-210 (Pagos) y SPEC-230 (Padre v2 modelos), ambos ya en `feature/001-scaffolding`.

## User Stories

| ID | User Story | Priority |
|---|---|---|
| US-001 | Como padre, quiero una navegación lateral clara en mi área, para moverme entre secciones sin perderme. | Must |
| US-002 | Como padre, quiero ver las secciones disponibles aunque aún estén en construcción, para entender la estructura del módulo. | Must |
| US-003 | Como sistema, quiero que el área del padre tenga identidad visual propia (color cielo), para diferenciarla de colegio y admin. | Must |
| US-004 | Como desarrollador, quiero que el sidebar siga el patrón de ColegioSideNav/AdminNav, para mantener consistencia de código. | Must |
| US-005 | Como ZEUS, quiero que SPEC-211 solo toque su página de suscripción, para evitar conflictos de merge en el sidebar. | Must |

## Acceptance Scenarios

### AS-001 · Sidebar visible con 7 items
**Given** un usuario autenticado con rol `PARENT`  
**When** entra a `/dashboard/padre`  
**Then** ve un sidebar a la izquierda con título "Mi protección" y 7 items: Inicio · Mis expedientes · Reportar · Suscripción · Círculo confianza · Notificaciones · Mi perfil.

### AS-002 · Estado activo en navegación
**Given** un padre navegando en `/dashboard/padre/expedientes`  
**When** mira el sidebar  
**Then** el item "Mis expedientes" aparece resaltado con fondo `cielo-600` y texto blanco.

### AS-003 · Placeholder de página
**Given** un padre que hace clic en cualquier item del sidebar excepto Inicio  
**When** la ruta carga  
**Then** ve una página con el título de la sección y un mensaje "Próximamente" en una card vidrio centrada.

### AS-004 · Color por rol
**Given** un padre autenticado  
**When** abre cualquier página de `/dashboard/padre/*`  
**Then** el área usa la paleta `cielo` (fondos claros azulados, acento `cielo-600` en activos y botones primarios).

### AS-005 · Guarda de sesión y vigencia
**Given** un usuario sin token o con token inválido  
**When** intenta entrar a `/dashboard/padre`  
**Then** es redirigido a `/login`.  
**Given** un padre con suscripción vencida  
**When** entra a `/dashboard/padre`  
**Then** ve `ServicioVencidoScreen` (heredado del layout raíz `/dashboard`).

### AS-006 · No conflicto con otras rutas
**Given** rutas existentes `/dashboard/mis-reportes`, `/dashboard/circulo-confianza`, `/dashboard/apelaciones`  
**When** se crea `/dashboard/padre/*`  
**Then** las rutas antiguas siguen funcionando y no son interceptadas por el nuevo layout.

## Functional Requirements

- **FR-001**: El sistema DEBE crear `src/components/modules/padre/PadreSideNav.tsx` siguiendo el patrón de `ColegioSideNav` (sidebar vertical, estado activo por ruta, íconos SVG por item, responsive oculto en mobile).
- **FR-002**: El sidebar DEBE tener exactamente 7 items con las etiquetas en criollo: "Inicio", "Mis expedientes", "Reportar", "Suscripción", "Círculo confianza", "Notificaciones", "Mi perfil".
- **FR-003**: El sistema DEBE crear `src/app/dashboard/padre/layout.tsx` que use `PadreSideNav`, mantenga la guarda de sesión PARENT y herede la guarda de vigencia del layout raíz `/dashboard`.
- **FR-004**: El layout DEBE aplicar una clase de tema padre (ej. `theme-padre`) que mapee a la familia de tokens `cielo` en `globals.css`.
- **FR-005**: El sistema DEBE crear las rutas placeholder:
  - `/dashboard/padre/page.tsx` (Inicio)
  - `/dashboard/padre/expedientes/page.tsx` (Mis expedientes)
  - `/dashboard/padre/reportar/page.tsx` (Reportar)
  - `/dashboard/padre/suscripcion/page.tsx` (Suscripción)
  - `/dashboard/padre/circulo-confianza/page.tsx` (Círculo confianza)
  - `/dashboard/padre/notificaciones/page.tsx` (Notificaciones)
  - `/dashboard/padre/perfil/page.tsx` (Mi perfil)
- **FR-006**: Cada página placeholder DEBE renderizar una card vidrio centrada con el nombre de la sección y el texto "Próximamente". Nunca `null` crudo ni campos vacíos sin etiqueta.
- **FR-007**: El sistema DEBE agregar `PADRE_NAV_ITEMS` en `src/lib/nav-items.ts` con los 7 items y sus íconos correspondientes.
- **FR-008**: El sistema DEBE usar los tokens de color `cielo` ya definidos en `tailwind.config.ts` para el estado activo y acentos del sidebar.
- **FR-009**: El sistema NO DEBE modificar el schema de Prisma ni crear migraciones destructivas. No se agregan módulos de permisos granulares para padre en v1; el sidebar muestra todos los items y el proxy sigue protegiendo rutas.
- **FR-010**: El sistema NO DEBE tocar `src/lib/ai/**`, el motor de IA, ni rate-limit del reporte público.
- **FR-011**: El sistema DEBE registrar `AuditLog` en eventos críticos de UI solo si aplica (no aplica para placeholders estáticos; se documenta como no requerido).
- **FR-012**: El sistema DEBE ser responsive: sidebar oculto en mobile (`sm:flex`), contenido full-width en mobile.

## Non-Functional Requirements

- **NFR-001**: Gate local completo: `tsc --noEmit`, `lint --no-cache`, `arch:check`, `test`, `build`.
- **NFR-002**: Tests de componente para `PadreSideNav` (renderizado de items, estado activo, clases de color).
- **NFR-003**: Contraste WCAG AA en el sidebar (texto vs fondo).
- **NFR-004**: Sin `Math.random()` en render; íconos deterministas.

## Success Criteria

- **SC-001**: `/dashboard/padre` responde 200 con sesión PARENT válida.
- **SC-002**: Sidebar muestra 7 items con labels exactos en criollo.
- **SC-003**: El item activo cambia al navegar entre subrutas (ej. expedientes → suscripción).
- **SC-004**: Las 7 rutas placeholder renderizan sin error y muestran "Próximamente".
- **SC-005**: Cero imports de `@/lib/prisma` en `src/app/dashboard/padre/**` y `src/components/modules/padre/**`.
- **SC-006**: `git diff --name-status origin/feature/001-scaffolding..HEAD` lista solo archivos de SPEC-231.
- **SC-007**: CI 6/6 verde.

## Assumptions

- SPEC-230 dejó los modelos `Expediente` y `EventoExpediente` en BD (no se usan en esta SPEC, pero la ruta `/dashboard/padre/expedientes` es su placeholder).
- SPEC-210 dejó el modelo de suscripciones; SPEC-211 implementará el contenido de `/dashboard/padre/suscripcion`.
- El proxy ya permite a `PARENT` acceder a `/dashboard/*`; no se requieren cambios en `src/lib/proxy.ts`.
- El layout raíz `/dashboard/layout.tsx` ya aplica la guarda de vigencia (`verificarVigenciaCliente`) para PARENT.
- Los tokens `cielo` existen en `tailwind.config.ts` y las variables CSS en `globals.css`.
- SPEC-231 debe mergarse antes que SPEC-211 llegue a implementar su vista de suscripción.

## Decisiones propuestas / Deuda

1. **Sin permisos granulares por módulo para padre**: el catálogo de módulos (`permisos-catalogo.ts`) no tiene entradas para PARENT. En v1 el sidebar muestra todos los items; si en el futuro se requiere ocultar secciones por configuración, se agregarán módulos y filtrado.
2. **Tema padre**: se propone `.theme-padre` en `globals.css` que mapee a tokens `cielo` (análogo a `.theme-colegio` que mapea a `pino`).
3. **Coordinación 231↔211**: el sidebar queda completo en esta SPEC. SPEC-211 solo reemplaza el contenido de `/dashboard/padre/suscripcion/page.tsx`.
4. **Deuda técnica**: las rutas antiguas `/dashboard/mis-reportes`, `/dashboard/circulo-confianza`, `/dashboard/apelaciones` conviven con `/dashboard/padre/*`. En una fase posterior se evaluará migrar el contenido de las antiguas a las nuevas rutas del sidebar.

## Impacto en arquitectura:

- Agrega `src/components/modules/padre/PadreSideNav.tsx` (nuevo componente cliente, patrón sidebar).
- Agrega `src/app/dashboard/padre/layout.tsx` + 7 páginas placeholder (nueva sub-ruta UI).
- Extiende `src/lib/nav-items.ts` con `PADRE_NAV_ITEMS` y `src/lib/permisos-catalogo.ts` con módulo `padre`.
- Extiende `src/app/globals.css` con `.theme-padre` (mapeo a tokens `cielo`).
- Regenera artefactos de arquitectura `docs/architecture/02-roles-capacidades.md` y `03-pantallas.md` (SPEC-126).
- Cero cambios en `src/lib/ai/**`, cero cambios de schema Prisma, cero migraciones.
- Cero imports de `@/lib/prisma` en nuevas páginas/componentes.
