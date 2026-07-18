# Feature Specification: Rediseño del Home (Landing)

**Feature Branch**: `[028-redisenio-home]`

**Created**: 2026-07-18

**Status**: CERRADA

**Input**: Reordenar la landing page para que, de un vistazo, el usuario distinga los dos caminos principales: reportar y consultar. El buscador de identificador se integra dentro de la tarjeta de "Consultar". Se mantienen el estilo glassmorphism y los tokens de diseño existentes.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visitante entiende qué puede hacer (Priority: P1)

Un padre que llega al sitio desde un celular debe entender inmediatamente que puede (a) reportar un identificador de riesgo y (b) consultar si un identificador tiene reportes. La acción principal es reportar; la consulta es secundaria pero visible, con el buscador integrado en su tarjeta.

**Why this priority**: El home es la puerta de entrada. Si el usuario no distingue reportar de consultar, abandona o usa el flujo equivocado.

**Independent Test**: Un visitante anónimo abre `/`, ve el título, la bajada y dos tarjetas de acción; reportar es la más prominente; consultar contiene el buscador; debajo hay accesos a registro y dashboard público.

**Acceptance Scenarios**:

1. **Given** un visitante anónimo en `/`, **When** carga la página, **Then** ve el título "Protege a quienes más importan", la bajada aprobada, la tarjeta "Crear un reporte" y la tarjeta "Consultar" con el buscador integrado.
2. **Given** la acción "Crear un reporte", **When** el usuario hace clic, **Then** navega a `/reportar`.
3. **Given** el buscador dentro de "Consultar", **When** el usuario ingresa un identificador y presiona "Buscar", **Then** se ejecuta la consulta y se muestran los resultados debajo del hero.
4. **Given** los accesos secundarios, **When** el usuario hace clic en "Crear una cuenta", **Then** navega a `/registro`; y en "Ver estadísticas", **Then** navega a `/dashboard/publico`.

---

### User Story 2 - Buscador integrado sigue operativo (Priority: P1)

La funcionalidad de consulta pública desde el home debe seguir funcionando igual: el formulario dentro de la tarjeta "Consultar" consulta `/api/consulta` y muestra resultados o mensajes de vacío/error.

**Why this priority**: El rediseño no puede romper el flujo existente de consulta.

**Independent Test**: Un usuario ingresa un identificador en el buscador integrado y obtiene el mismo resultado que antes.

**Acceptance Scenarios**:

1. **Given** un usuario en el home, **When** ingresa un identificador con reportes y consulta, **Then** se muestran los resultados debajo de las tarjetas.
2. **Given** un usuario en el home, **When** ingresa un identificador sin reportes o inexistente, **Then** se muestra el mensaje correspondiente sin crashear.
3. **Given** un usuario en el home, **When** deja el campo vacío y consulta, **Then** se muestra el mensaje de error del formulario sin ejecutar la consulta.

---

### User Story 3 - Diseño responsive y accesible (Priority: P2)

La landing debe verse bien en móvil (stack vertical) y escritorio (grid con tarjeta de consulta un poco más ancha), con contraste adecuado y etiquetas `aria-label` en botones que solo usan iconos.

**Acceptance Scenarios**:

1. **Given** una pantalla de 320 px, **When** se renderiza el home, **Then** las dos tarjetas se apilan verticalmente, el buscador es usable y el texto es legible.
2. **Given** una pantalla de escritorio, **When** se renderiza el home, **Then** la tarjeta "Consultar" es más ancha que la tarjeta "Crear un reporte" para acomodar el buscador.
3. **Given** un lector de pantalla, **When** navega por las acciones, **Then** cada botón tiene nombre accesible (`aria-label` o texto visible).

---

## Edge Cases

- ¿Qué pasa si el usuario está autenticado como ADMIN/OPERADOR? El enlace a reportar sigue funcionando según la lógica del bug 021 (ruta `/reportar` ignora la cookie interna o muestra bloqueo, fuera del alcance de este rediseño).
- ¿Qué pasa si el usuario está autenticado como PARENT? El acceso "Crear una cuenta" sigue visible pero redundante; no se oculta para mantener la simplicidad visual.
- ¿Qué pasa si el dashboard público está deshabilitado? El enlace "Ver estadísticas" debe seguir siendo una ruta válida; el control de disponibilidad es responsabilidad del dashboard.
- ¿Qué pasa si el buscador integrado devuelve un error de red? El mensaje de error se muestra debajo del hero, como antes.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El home DEBE mostrar el título "Protege a quienes más importan".
- **FR-002**: El home DEBE mostrar la bajada: "Consulta y reporta identificadores asociados a conductas de riesgo para menores en plataformas digitales. De forma gratuita, con o sin cuenta."
- **FR-003**: El home DEBE presentar dos tarjetas de acción lado a lado en escritorio: "Crear un reporte" (principal) y "Consultar" (secundaria, más ancha).
- **FR-004**: La tarjeta principal DEBE enlazar a `/reportar`, tener subtítulo "De forma anónima o con tu cuenta" e ícono de bandera.
- **FR-005**: La tarjeta "Consultar" DEBE contener el buscador de identificador con placeholder "Ej: +573001234567" y botón "Buscar", además del subtítulo "Busca un número, nick o usuario".
- **FR-006**: El home DEBE mostrar dos accesos secundarios debajo: "Crear una cuenta" (→ `/registro`) y "Ver estadísticas" (→ `/dashboard/publico`).
- **FR-007**: El home DEBE mostrar el resultado de la consulta (cargando, error, datos o vacío) debajo de las tarjetas de acción.
- **FR-008**: El rediseño DEBE eliminar el bloque separado "Consulta un identificador" que existía debajo del hero.
- **FR-009**: El rediseño DEBE ser responsive y accesible (contraste, `aria-labels`).

### Key Entities

- **LandingHero**: Componente que renderiza el encabezado, las tarjetas de acción y el buscador integrado en la tarjeta de consultar.
- **HomePageClient**: Componente contenedor que pasa `onSearch` a `LandingHero` y muestra resultados/estados debajo del hero.
- **ConsultaForm**: Formulario de consulta reutilizado; se extiende con modo `compact` para ocultar el label dentro de la tarjeta.
- **ConsultaResultado**: Componente existente que muestra los resultados de la consulta.

---

## Success Criteria *(mandatory)*

- **SC-001**: Un visitante puede identificar las dos acciones principales en menos de 3 segundos.
- **SC-002**: El tiempo de carga del home no aumenta respecto a la versión anterior.
- **SC-003**: 100% de los tests de UI existentes (landing, consulta, reporte) pasan tras el cambio.
- **SC-004**: El home pasa validación de contraste en ambos temas (claro/oscuro).
- **SC-005**: Un usuario puede consultar un identificador desde el buscador integrado y ver el mismo resultado que en la consulta pública separada.

---

## Assumptions

- No se agregan dependencias nuevas (iconos inline o componentes existentes).
- El tono de textos es español neutral, formal pero cercano, sin voseo.
- El bug 021 (reporte anónimo para usuarios internos) no se resuelve en este rediseño; el enlace a `/reportar` se mantiene.
- El dashboard público existe en `/dashboard/publico`.
- El estilo glassmorphism y los tokens de color actuales son la base visual.

---

## Implementación (documentado retroactivamente el 2026-07-18)

### Objetivo alcanzado
Rediseñar la landing page para que el usuario distinga inmediatamente las acciones principales: reportar (acción destacada) y consultar (acción secundaria con buscador integrado), con accesos a registro y dashboard público.

### Decisiones de diseño derivadas del código
- **Dos acciones grandes**: grid responsive `sm:grid-cols-[1fr_1.25fr]` con tarjeta principal "Crear un reporte" (fondo blanco sobre gradiente azul) y tarjeta "Consultar" (glass, más ancha para el buscador).
- **Buscador integrado**: `ConsultaForm` se usa dentro de `LandingHero` con la prop `compact` para omitir el label; el resultado se renderiza en `HomePageClient` debajo del hero.
- **Iconos inline**: SVGs para escudo, bandera, lupa, usuario-plus y gráfico de barras; sin nuevas dependencias.
- **Accesos secundarios**: botones glass debajo de las tarjetas para "Crear una cuenta" y "Ver estadísticas".
- **Eliminación de bloque redundante**: se removió la sección `#consultar` con título y GlassCard de `HomePageClient.tsx`.

### Componentes afectados
- `src/components/modules/LandingHero.tsx`: nuevo layout, textos, iconos y buscador integrado.
- `src/components/modules/HomePageClient.tsx`: pasa `onSearch` a `LandingHero`, muestra resultados debajo y elimina el bloque de consulta separado.
- `src/components/modules/ConsultaForm.tsx`: modo `compact` opcional para ocultar el label.

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
