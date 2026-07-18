# Feature Specification: Rediseño completo del Home (Landing)

**Feature Branch**: `[028-redisenio-home]`

**Created**: 2026-07-18

**Status**: CERRADA

**Input**: Rediseño completo de la landing page para que el home se centre exclusivamente en actuar: reportar o consultar. El buscador de identificador se integra dentro de la tarjeta "Consultar" y el resultado se muestra dentro de la misma tarjeta. Se mantiene el estilo glassmorphism y los tokens de diseño existentes.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visitante entiende inmediatamente qué puede hacer (Priority: P1)

Un padre que llega al sitio desde un celular debe ver de un vistazo las dos acciones posibles: crear un reporte o consultar un identificador. El home no debe distraer con explicaciones largas ni enlaces redundantes.

**Why this priority**: El home es la puerta de entrada. Cada fracción de segundo de confusión aumenta la probabilidad de abandono o de usar el flujo equivocado.

**Independent Test**: Un visitante anónico abre `/`, ve el título, la bajada y dos tarjetas grandes; reportar es la más prominente; consultar contiene el buscador.

**Acceptance Scenarios**:

1. **Given** un visitante anónimo en `/`, **When** carga la página, **Then** ve el título "Protege a quienes más importan", la bajada aprobada, la tarjeta "Crear un reporte" y la tarjeta "Consultar" con el buscador integrado.
2. **Given** la tarjeta "Crear un reporte", **When** el usuario hace clic, **Then** navega a `/reportar`.
3. **Given** el buscador dentro de "Consultar", **When** el usuario ingresa un identificador y presiona "Buscar", **Then** el resultado aparece dentro de la misma tarjeta, debajo del buscador.

---

### User Story 2 - Buscador integrado muestra resultados coherentes (Priority: P1)

El buscador integrado en la tarjeta "Consultar" debe comportarse igual que el buscador anterior, pero mostrando el resultado dentro de la tarjeta.

**Acceptance Scenarios**:

1. **Given** un usuario que busca un identificador sin reportes, **When** presiona "Buscar", **Then** se muestra un mensaje claro dentro de la tarjeta.
2. **Given** un usuario que busca un identificador con 1-2 reportes, **When** presiona "Buscar", **Then** se muestra un resumen compacto inline dentro de la tarjeta.
3. **Given** un usuario que busca un identificador con más de 2 reportes, **When** presiona "Buscar", **Then** se muestra un resumen agregado y un enlace a la vista completa en `/consulta`.
4. **Given** un usuario que deja el campo vacío, **When** presiona "Buscar", **Then** el formulario muestra el error y no ejecuta la consulta.

---

### User Story 3 - Barra superior simplificada (Priority: P2)

La barra superior debe contener solo lo esencial: logo, toggle de tema, acceso al dashboard público e inicio de sesión. Las acciones de reportar y consultar ya están en el hero.

**Acceptance Scenarios**:

1. **Given** un visitante anónimo, **When** mira la barra superior, **Then** ve solo logo, "Dashboard", "Iniciar sesión" y el toggle de tema; no ve "Consultar" ni "Reportar".
2. **Given** el menú móvil, **When** se abre, **Then** no contiene "Consultar" ni "Reportar".

---

### User Story 4 - Home enfocado: sin distracciones (Priority: P2)

El home debe eliminar contenido redundante: no debe haber sección "¿Cómo funciona?" ni accesos secundarios "Crear una cuenta" / "Ver estadísticas". Sí debe conservarse la sección de canales oficiales de denuncia.

**Acceptance Scenarios**:

1. **Given** la página de inicio, **When** se desplaza hacia abajo, **Then** no ve la sección "¿Cómo funciona?" ni los accesos secundarios de registro/estadísticas.
2. **Given** la página de inicio, **When** se desplaza hacia abajo, **Then** ve la sección "Canales oficiales de denuncia".

---

### User Story 5 - Español neutro en todo el home (Priority: P2)

Todos los textos visibles en la landing deben usar español neutro, sin voseo ni imperativos en -á/-é/-í.

**Acceptance Scenarios**:

1. **Given** cualquier texto visible en la landing, **When** se lee, **Then** no contiene imperativos con voseo (por ejemplo "Reportá", "Creá", "Verificá", "Buscá").

---

## Edge Cases

- ¿Qué pasa si el usuario está autenticado como ADMIN/OPERADOR? El enlace a `/reportar` en el hero sigue funcionando según la lógica del bug 021 (ruta `/reportar` ignora la cookie interna o muestra bloqueo, fuera del alcance de este rediseño).
- ¿Qué pasa si el resultado de la consulta es muy grande? Para más de 2 reportes se muestra solo resumen + enlace a vista completa, evitando que la tarjeta crezca desproporcionadamente.
- ¿Qué pasa si el dashboard público está deshabilitado? El enlace "Dashboard" en la barra superior sigue siendo una ruta válida; el control de disponibilidad es responsabilidad del dashboard.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El home DEBE mostrar el título "Protege a quienes más importan" y la bajada aprobada.
- **FR-002**: El home DEBE presentar dos tarjetas de acción lado a lado en escritorio: "Crear un reporte" (principal, azul/accent) y "Consultar" (secundaria, glass).
- **FR-003**: La tarjeta "Crear un reporte" DEBE enlazar a `/reportar`, tener subtítulo "De forma anónima o con tu cuenta" e ícono de bandera.
- **FR-004**: La tarjeta "Consultar" DEBE contener el buscador de identificador con placeholder "Ej: +573001234567" y botón "Buscar", además del subtítulo "Busca un número, nick o usuario".
- **FR-005**: El resultado de la consulta DEBE mostrarse dentro de la tarjeta "Consultar", debajo del buscador, separado por una línea sutil.
- **FR-006**: Para 0 reportes, la tarjeta DEBE mostrar un mensaje claro dentro de ella.
- **FR-007**: Para 1-2 reportes, la tarjeta DEBE mostrar un resumen compacto inline.
- **FR-008**: Para más de 2 reportes, la tarjeta DEBE mostrar un resumen agregado y un enlace a la vista completa en `/consulta`.
- **FR-009**: La barra superior DEBE contener solo logo, toggle de tema, "Dashboard" e "Iniciar sesión"; no debe mostrar "Consultar" ni "Reportar".
- **FR-010**: El home DEBE eliminar la sección "¿Cómo funciona?" (`LandingFeatures`) y los accesos secundarios "Crear una cuenta" / "Ver estadísticas".
- **FR-011**: El home DEBE conservar la sección "Canales oficiales de denuncia".
- **FR-012**: El footer DEBE mostrar el copyright "© 2026 Innovadataco. Todos los derechos reservados." y no debe contener el enlace "Reportar".
- **FR-013**: Todos los textos visibles en la landing DEBEN estar en español neutro, sin voseo.
- **FR-014**: El rediseño DEBE ser responsive y accesible.

### Key Entities

- **NavHeader**: Barra superior simplificada.
- **LandingHero**: Hero con título, bajada, tarjetas de acción y buscador integrado; recibe el estado de la consulta para mostrar el resultado dentro de la tarjeta.
- **HomePageClient**: Contenedor que maneja el estado de la consulta y pasa las props a `LandingHero`; conserva `CanalesOficiales` y `LandingFooter`.
- **ConsultaForm**: Formulario reutilizado con modo `compact`.
- **LandingFeatures**: Componente existente; se elimina del home (no se borra el archivo).
- **LandingFooter**: Footer actualizado con copyright de Innovadataco.
- **CanalesOficiales**: Componente existente; se conserva.

---

## Success Criteria *(mandatory)*

- **SC-001**: Un visitante puede identificar las dos acciones principales en menos de 3 segundos.
- **SC-002**: El tiempo de carga del home no aumenta respecto a la versión anterior.
- **SC-003**: 100% de los tests de UI existentes pasan tras el cambio.
- **SC-004**: El home pasa validación de contraste en ambos temas.
- **SC-005**: Un usuario puede consultar un identificador desde la tarjeta "Consultar" y ver el resultado dentro de ella.

---

## Assumptions

- No se agregan dependencias nuevas.
- El tono de textos es español neutral, formal pero cercano, sin voseo.
- El bug 021 (reporte anónimo para usuarios internos) no se resuelve en este rediseño; el enlace a `/reportar` se mantiene.
- El dashboard público existe en `/dashboard-publico`.
- El estilo glassmorphism y los tokens de color actuales son la base visual.

---

## Implementación (documentado retroactivamente el 2026-07-18)

### Objetivo alcanzado
Rediseño completo de la landing page para centrarla exclusivamente en las acciones reportar y consultar, con el buscador y su resultado dentro de la tarjeta "Consultar".

### Decisiones de diseño derivadas del código
- **Hero**: grid responsive `sm:grid-cols-[1fr_1.25fr]` con tarjeta principal "Crear un reporte" y tarjeta "Consultar" más ancha para acomodar el buscador y su resultado.
- **Resultado dentro de la tarjeta**: `LandingHero` recibe el estado de la consulta (`data`, `isLoading`, `error`, `buscado`) y renderiza el resultado dentro de la tarjeta. Se distingue entre 0, 1-2 y >2 reportes.
- **Barra superior simplificada**: `NavHeader` elimina los enlaces "Consultar" y "Reportar" de escritorio y móvil.
- **Eliminación de distracciones**: se removieron `LandingFeatures` del home y los accesos secundarios del hero.
- **Canales oficiales**: se conservaron en el home.
- **Footer**: copyright actualizado a "Innovadataco" y eliminación del enlace "Reportar".
- **Textos**: revisión de español neutro; se eliminaron los imperativos con voseo de `LandingFeatures` (que fue removida del home).

### Componentes afectados
- `src/components/modules/NavHeader.tsx`: barra superior simplificada.
- `src/components/modules/LandingHero.tsx`: hero con buscador integrado y resultado dentro de la tarjeta.
- `src/components/modules/HomePageClient.tsx`: contenedor simplificado, pasa estado de consulta al hero, conserva canales y footer.
- `src/components/modules/LandingFooter.tsx`: copyright Innovadataco.
- `src/components/modules/ConsultaForm.tsx`: modo `compact` (preexistente de iteración anterior).

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
