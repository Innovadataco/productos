# Feature Specification: Accesibilidad (WCAG 2.2)

**Feature Branch**: `[feature/001-scaffolding]`

**Spec Number**: 049

**Created**: 2026-07-20

**Status**: CERRADA

**Input**: User description: "Saneamiento de accesibilidad conforme a WCAG 2.2 para el Producto 002. No rediseños masivos; solo correcciones concretas que fallan criterios de accesibilidad."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Iconos y controles con nombre accesible (Priority: P1)

Los usuarios que dependen de lectores de pantalla necesitan comprender el estado y la función de los controles que solo muestran un ícono. Los indicadores de riesgo no deben depender únicamente del color para transmitir su significado.

**Why this priority**: WCAG 2.2 requiere que los controles tengan un nombre accesible (1.1.1, 4.1.2) y que la información no se transmita solo mediante color (1.4.1).

**Independent Test**: Con un lector de pantalla, cada botón de solo-ícono anuncia su propósito; cada badge de riesgo incluye texto o forma adicional que describe el nivel sin depender del color.

**Acceptance Scenarios**:

1. **Given** un botón cuyo contenido visible es solo un ícono, **When** recibe el foco, **Then** un lector de pantalla anuncia su función mediante `aria-label`, `title` o texto anclado.
2. **Given** un badge de nivel de riesgo, **When** se muestra en escala de grises, **Then** sigue siendo distinguible por su texto y/o forma además del color.
3. **Given** un ícono decorativo junto a texto visible, **When** el lector de pantalla navega por el contenido, **Then** el ícono se omite (no se anuncia) y no duplica información.

---

### User Story 2 - Contraste del glassmorphism medido y ajustado (Priority: P1)

Los textos sobre superficies de vidrio (glassmorphism) deben alcanzar el contraste mínimo exigido por WCAG 2.2. No se rediseña por suposición; solo se corrige lo que la medición demuestre que falla.

**Why this priority**: WCAG 2.2 exige 4.5:1 para texto normal y 3:1 para texto grande (1.4.3). Las superficies translúcidas pueden degradar el contraste dependiendo del fondo.

**Independent Test**: Medir el contraste de cada combinación de texto/fondo del sistema de diseño y documentar que las combinaciones usadas cumplen 4.5:1 (o 3:1 para texto grande) en estados normal, `:hover` y `:focus-visible`.

**Acceptance Scenarios**:

1. **Given** una combinación de texto sobre fondo glass, **When** se calcula el contraste sobre el fondo de página real, **Then** el ratio es ≥ 4.5:1 para texto normal y ≥ 3:1 para texto grande.
2. **Given** un estado `:hover` o `:focus-visible` de un control, **When** se mide el contraste, **Then** se mantiene el ratio mínimo requerido.
3. **Given** un texto sobre fondo translúcido, **When** la medición indica que falla el ratio, **Then** se ajusta el color del texto o del fondo hasta cumplir, sin rediseñar el componente.

---

### User Story 3 - Navegación por teclado, foco visible y touch targets (Priority: P2)

Todos los usuarios, incluidos quienes navegan solo con teclado o con dispositivos táctiles, deben poder operar la interfaz. Cada control interactivo debe tener un foco visible y un área táctil suficiente.

**Why this priority**: WCAG 2.2 exige foco visible (2.4.7), orden de foco lógico (2.4.3), operabilidad con teclado (2.1.1) y targets de toque de al menos 44×44 px (2.5.5, objetivo).

**Independent Test**: Navegar la interfaz con `Tab` y `Shift+Tab`; verificar que cada control interactivo recibe foco visible, que se activa con `Enter`/`Space`, y que los targets táctiles son ≥ 44×44 px.

**Acceptance Scenarios**:

1. **Given** un usuario navegando con teclado, **When** presiona `Tab`, **Then** el foco se mueve por todos los controles interactivos en orden visual y lógico.
2. **Given** un control interactivo con foco, **Then** existe un indicador de foco visible (anillo, borde o cambio de color) con contraste suficiente.
3. **Given** un botón o enlace táctil, **Then** su área de activación es al menos 44×44 px o tiene un equivalente accesible sin afectar el diseño.
4. **Given** un dropdown o panel desplegable, **When** el usuario presiona `Escape`, **Then** se cierra y el foco retorna al control que lo abrió.

---

## Edge Cases

- **Íconos con cambio de estado**: los iconos que cambian (sol/luna del tema) deben actualizar su `aria-label` al cambiar el estado. ThemeToggle ya lo hace; se valida.
- **Badges en tablas**: las celdas de nivel de riesgo deben mantener su información sin depender solo del color incluso cuando se listan en tablas densas.
- **Gradientes**: los botones con gradientes se evalúan por el color más claro del gradiente para garantizar el peor caso de contraste.
- **Fondos animados**: el fondo de página con gradientes no afecta el contraste porque el color base es fijo (#f8fafc / #020617) y el glass se mide sobre él.
- **Hover con transparencia**: los estados `:hover` que aclaran/oscurecen un fondo translúcido no deben reducir el contraste por debajo del mínimo.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE proveer un nombre accesible (`aria-label`, `aria-labelledby`, `title` o texto visible) para cada control que comunica estado mediante un ícono sin texto adyacente.
- **FR-002**: El sistema DEBE marcar los íconos puramente decorativos como `aria-hidden="true"` para evitar que los lectores de pantalla los anuncien.
- **FR-003**: El sistema DEBE garantizar que los indicadores de nivel de riesgo incluyan texto y/o forma que permita distinguir el nivel sin depender exclusivamente del color.
- **FR-004**: El sistema DEBE alcanzar un ratio de contraste mínimo de 4.5:1 para texto normal y 3:1 para texto grande sobre superficies glass, fondos sólidos y estados interactivos (`:hover`, `:focus-visible`).
- **FR-005**: El sistema DEBE ajustar únicamente las combinaciones de color que fallen la medición; no se rediseñarán componentes por suposición.
- **FR-006**: El sistema DEBE permitir que todos los controles interactivos sean operables con teclado (`Tab`, `Enter`, `Space`, `Escape` donde aplique).
- **FR-007**: El sistema DEBE mostrar un indicador de foco visible en todos los controles interactivos.
- **FR-008**: El sistema DEBE garantizar que los targets táctiles sean al menos 44×44 px, o proveer una alternativa equivalente.

### Key Entities

- **RiskBadge**: Componente visual de nivel de riesgo. Debe incluir texto del nivel y un punto de color con alternativa textual.
- **GlassCard / glass**: Superficie translúcida base. El contraste del texto sobre ella debe cumplir WCAG 2.2.
- **Button**: Componente de botón. Debe mantener foco visible, target táctil adecuado y contraste de texto sobre fondo.
- **NavHeader / AdminNav**: Navegación. Debe permitir operación completa con teclado y foco visible.
- **ThemeToggle**: Botón de solo-ícono con estado. Ya cuenta con `aria-label` dinámico; se conserva y se valida.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los botones de solo-ícono tienen un nombre accesible (verificación con inspección de código y lector de pantalla).
- **SC-002**: El 100% de los íconos decorativos están marcados como `aria-hidden="true"`.
- **SC-003**: Los badges de riesgo son distinguibles en una simulación de escala de grises por su texto/forma además del color.
- **SC-004**: Todas las combinaciones de texto/fondo medidas cumplen 4.5:1 para texto normal y 3:1 para texto grande; los fallos quedan corregidos o documentados.
- **SC-005**: Todos los controles interactivos son alcanzables y operables con teclado; el foco visible está presente en todos.
- **SC-006**: El 100% de los botones y controles táctiles principales tienen un área de activación ≥ 44×44 px (o equivalente documentado).

---

## Assumptions

- El saneamiento se realiza sobre el sistema de diseño existente sin rediseños masivos.
- No se agregan dependencias nuevas de librerías de accesibilidad; se usan atributos HTML y estilos nativos.
- No se modifican datos de usuario ni esquema de base de datos.
- Las mediciones de contraste se hacen con herramientas manuales/script locales; si no hay acceso a axe/Lighthouse en el entorno, se documenta la auditoría manual con criterios WCAG 2.2.
- Los targets táctiles de 44×44 px son el objetivo; se aceptan excepciones mínimas documentadas si el diseño ya establecido no permite agrandar sin afectar el layout.
- SPEC-050 y SPEC-060 no se modifican.

---

## Implementación (documentado al cierre)

A continuación el resumen de lo realizado para cerrar el Spec 049.

### Status
CERRADA

### User Stories implementadas
- US1: Nombres accesibles para controles de ícono y badges de riesgo no solo por color.
- US2: Contraste de texto sobre fondo glassmorphism medido y ajustado.
- US3: Foco visible, navegación por teclado y targets táctiles ≥ 44×44 px.

### Decisiones técnicas
- Se usaron atributos HTML nativos (`aria-label`, `aria-hidden`, `role`, `title`) y CSS nativo; no se agregaron librerías externas.
- Para contraste se midieron textos sobre fondos del sistema de diseño y se ajustaron solo los que fallaban (texto accent/subtle y botones primarios). No se rediseñaron componentes masivamente.
- Se priorizó `outline` y `outline-offset` para foco visible sin romper layouts de glassmorphism.
- Se crearon scripts de auditoría (`scripts/a11y_audit.js`, `scripts/contrast_check.js`) para permitir verificación repetible en el futuro.

### Archivos principales tocados
- `src/components/NavHeader.tsx` — `aria-label` en botones de solo ícono.
- `src/components/AuditLogViewer.tsx` — `aria-label` en controles de ícono.
- `src/components/AdminNav.tsx`, `src/components/LandingHero.tsx`, `src/components/LandingFeatures.tsx`, `src/components/CanalesOficiales.tsx`, `src/components/ConfirmacionReporte.tsx`, `src/components/IaDocsPanel.tsx`, `src/components/offline.tsx`, `src/app/dataset/page.tsx`, `src/components/ui/Select.tsx`, `src/components/ThemeToggle.tsx`, `src/components/AdminReportesTable.tsx`, `src/components/ConfigPanel.tsx` — `aria-hidden` en íconos decorativos.
- `src/components/RiskBadge.tsx` — punto de color con alternativa textual y rol `img` para no depender solo del color.
- `src/app/globals.css` — ajustes de color de texto (accent/subtle), fallback de foco visible para botones y enlaces nativos.
- `src/components/ui/Button.tsx` — fondos `sky-700`, `emerald-700`, `red-700` para contraste mínimo.
- `src/lib/labels.ts` — colores de riesgo `700` (texto) y `400` (fondo) para contrastes superiores a 4.5:1.
- `src/app/admin/anti-abuso/components/AdminAntiAbusoSimulacion.tsx` — colores de acento ajustados.
- `src/components/ThemeToggle.tsx` — target táctil 44×44 px.
- `src/components/NavHeader.tsx` — target táctil de botones de navegación ≥ 44×44 px.
- `scripts/a11y_audit.js` — auditoría de icon-only buttons y SVGs sin nombre accesible.
- `scripts/contrast_check.js` — verificación de contraste entre pares de color.
- Artefactos del Spec-Kit en `specs/049-accesibilidad-wcag/`.

### Tests y validación
- `npx tsc --noEmit` — OK.
- `npm run lint` — OK (1 warning preexistente en `GestionPageClient.tsx`, no relacionado con este spec).
- `npm run test` — 531 passed.
- `npm run build` — OK.
- `./scripts/a11y_audit.js` — 0 icon-only buttons sin label, 0 SVGs sin accesible name.
- `./scripts/contrast_check.js` — 0 fallos de contraste sobre los pares evaluados.
- Deploy limpio con `./scripts/dev-restart.sh` — healthcheck OK, app en puerto 5005.
- Smoke test: landing responde HTTP 200.

### Migraciones y datos
- No se realizaron migraciones ni cambios de esquema de base de datos.
- No se modificaron datos de usuario.

### Deuda técnica
- La auditoría de contraste se mantiene con pares de color codificados; a futuro se puede extender para extraer tokens del tema automáticamente.
- No se integró axe-core en el pipeline de CI; se recomienda como mejora posterior.
- El warning preexistente de `useEffect` en `GestionPageClient.tsx` queda fuera del alcance de este spec.
