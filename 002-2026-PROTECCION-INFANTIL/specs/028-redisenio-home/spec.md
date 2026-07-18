# Feature Specification: Rediseño del Home (Landing)

**Feature Branch**: `[028-redisenio-home]`

**Created**: 2026-07-18

**Status**: CERRADA

**Input**: Reordenar la landing page para orientar de un vistazo los dos caminos principales del producto: reportar y consultar. Mantener el buscador funcional y el estilo glassmorphism existente.

---

## Implementación (documentado retroactivamente el 2026-07-18)

### Objetivo alcanzado
Rediseñar la landing page para que el usuario distinga inmediatamente las acciones principales: reportar (acción destacada) y consultar (acción secundaria), con accesos a registro y dashboard público.

### Decisiones de diseño derivadas del código
- **Dos acciones grandes**: grid responsive con tarjeta principal "Crear un reporte" (fondo blanco sobre gradiente azul) y tarjeta secundaria "Consultar" (glass).
- **Iconos inline**: SVGs para escudo, bandera, lupa, usuario-plus y gráfico de barras; sin nuevas dependencias.
- **Accesos secundarios**: botones glass debajo de las acciones principales para "Crear una cuenta" y "Ver estadísticas".
- **Buscador conservado**: `HomePageClient.tsx` mantiene `ConsultaForm` en `#consultar` sin cambios.

### Componentes afectados
- `src/components/modules/LandingHero.tsx`: nuevo layout, textos e iconos.

### Tests
- Tests de componentes React relacionados con landing y consulta.
- `scripts/smoke-e2e.ts`: smoke E2E de punta a punta del flujo crítico.

### Verificaciones
- Lint: 0 errores.
- TypeScript: sin errores.
- Tests: 343 pasados.
- Build: exitosa.
- Smoke E2E: pasó.
- App y worker reiniciados en `:5005`.


---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visitante entiende qué puede hacer (Priority: P1)

Un padre que llega al sitio desde un celular debe entender inmediatamente que puede (a) reportar un identificador de riesgo y (b) consultar si un identificador tiene reportes. La acción principal es reportar; la consulta es secundaria pero visible.

**Why this priority**: El home es la puerta de entrada. Si el usuario no distingue reportar de consultar, abandona o usa el flujo equivocado.

**Independent Test**: Un visitante anónimo abre `/`, ve el título, la bajada y dos acciones grandes; reportar es la más prominente; consultar es la secundaria; debajo hay accesos a registro y dashboard público.

**Acceptance Scenarios**:

1. **Given** un visitante anónimo en `/`, **When** carga la página, **Then** ve el título "Protege a quienes más importan", la bajada aprobada, y dos tarjetas de acción: "Crear un reporte" y "Consultar".
2. **Given** la acción "Crear un reporte", **When** el usuario hace clic, **Then** navega a `/reportar`.
3. **Given** la acción "Consultar", **When** el usuario hace clic, **Then** navega a la sección `#consultar` de la misma página.
4. **Given** los accesos secundarios, **When** el usuario hace clic en "Crear una cuenta", **Then** navega a `/registro`; y en "Ver estadísticas", **Then** navega a `/dashboard/publico`.

---

### User Story 2 - Buscador de consulta sigue operativo (Priority: P1)

La funcionalidad de consulta pública desde el home debe seguir funcionando igual: el formulario en `#consultar` debe consultar `/api/consulta` y mostrar resultados o mensajes de vacío/error.

**Why this priority**: El rediseño no puede romper el flujo existente de consulta.

**Independent Test**: Un usuario ingresa un identificador en el buscador del home y obtiene el mismo resultado que antes.

**Acceptance Scenarios**:

1. **Given** un usuario en el home, **When** ingresa un identificador con reportes y consulta, **Then** se muestran los resultados.
2. **Given** un usuario en el home, **When** ingresa un identificador sin reportes o inexistente, **Then** se muestra el mensaje correspondiente sin crashear.

---

### User Story 3 - Diseño responsive y accesible (Priority: P2)

La landing debe verse bien en móvil (stack vertical) y escritorio (grid 2 columnas), con contraste adecuado y etiquetas `aria-label` en botones que solo usan iconos.

**Acceptance Scenarios**:

1. **Given** una pantalla de 320 px, **When** se renderiza el home, **Then** las dos acciones se apilan verticalmente y el texto es legible.
2. **Given** un lector de pantalla, **When** navega por las acciones, **Then** cada botón tiene nombre accesible (`aria-label` o texto visible).

---

## Edge Cases

- ¿Qué pasa si el usuario está autenticado como ADMIN/OPERADOR? El enlace a reportar sigue funcionando según la lógica del bug 021 (ruta `/reportar` ignora la cookie interna o muestra bloqueo, fuera del alcance de este rediseño).
- ¿Qué pasa si el usuario está autenticado como PARENT? El acceso "Crear una cuenta" sigue visible pero redundante; no se oculta para mantener la simplicidad visual.
- ¿Qué pasa si el dashboard público está deshabilitado? El enlace "Ver estadísticas" debe seguir siendo una ruta válida; el control de disponibilidad es responsabilidad del dashboard.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El home DEBE mostrar el título "Protege a quienes más importan".
- **FR-002**: El home DEBE mostrar la bajada: "Consulta y reporta identificadores asociados a conductas de riesgo para menores en plataformas digitales. De forma gratuita, con o sin cuenta."
- **FR-003**: El home DEBE presentar dos acciones grandes lado a lado en escritorio: "Crear un reporte" (principal) y "Consultar" (secundaria).
- **FR-004**: La acción principal DEBE enlazar a `/reportar` y tener subtítulo "De forma anónima o con tu cuenta".
- **FR-005**: La acción secundaria DEBE enlazar a `#consultar` y tener subtítulo "Buscar un identificador".
- **FR-006**: El home DEBE mostrar dos accesos secundarios debajo: "Crear una cuenta" (→ `/registro`) y "Ver estadísticas" (→ `/dashboard/publico`).
- **FR-007**: El home DEBE conservar el buscador de identificador en `#consultar` con la funcionalidad actual.
- **FR-008**: El rediseño DEBE ser responsive y accesible (contraste, `aria-labels`).

### Key Entities

- **LandingHero**: Componente que renderiza el encabezado y las acciones principales.
- **HomePageClient**: Componente contenedor que incluye `LandingHero`, el buscador, y las secciones inferiores.
- **ConsultaForm**: Formulario de consulta existente; no se modifica.

---

## Success Criteria *(mandatory)*

- **SC-001**: Un visitante puede identificar las dos acciones principales en menos de 3 segundos.
- **SC-002**: El tiempo de carga del home no aumenta respecto a la versión anterior.
- **SC-003**: 100% de los tests de UI existentes (landing, consulta, reporte) pasan tras el cambio.
- **SC-004**: El home pasa validación de contraste en ambos temas (claro/oscuro).

---

## Assumptions

- No se agregan dependencias nuevas (iconos inline o componentes existentes).
- El tono de textos es español neutral, formal pero cercano, sin voseo.
- El bug 021 (reporte anónimo para usuarios internos) no se resuelve en este rediseño; el enlace a `/reportar` se mantiene.
- El dashboard público existe en `/dashboard/publico`.
- El estilo glassmorphism y los tokens de color actuales son la base visual.
