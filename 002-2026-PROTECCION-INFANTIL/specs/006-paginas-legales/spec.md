# Feature Specification: Páginas Legales y Footer

**Feature Branch**: `feature/006-paginas-legales`

**Created**: 2026-07-14

**Status**: Implemented

**Input**: User description: "Crear páginas legales accesibles (/terminos y /privacidad) e integrar un footer global con enlaces a términos, privacidad y canales oficiales de denuncia."

---

## User Scenarios & Testing

### User Story 1 — Páginas de términos y privacidad (Priority: P1) 🎯 MVP

Cualquier visitante puede acceder a las páginas legales desde el footer o URL directa.

**Why this priority**: Cumplimiento legal y transparencia para usuarios que reportan o consultan datos.

**Independent Test**: Navegar a `/terminos` y `/privacidad`; verificar que cargan contenido claro y enlaces de navegación.

**Acceptance Scenarios**:

1. **Given** un visitante en cualquier página pública, **When** hace clic en "Términos" del footer, **Then** llega a `/terminos` y ve los términos de uso.
2. **Given** un visitante en cualquier página pública, **When** hace clic en "Privacidad", **Then** llega a `/privacidad` y ve la política de privacidad.
3. **Given** un visitante anónimo, **When** accede directamente a `/terminos` o `/privacidad`, **Then** la página carga sin requerir autenticación.

---

### User Story 2 — Footer global (Priority: P1) 🎯 MVP

El footer aparece en todas las páginas públicas y proporciona navegación legal y contextual.

**Why this priority**: Navegación consistente y acceso permanente a información legal y canales oficiales.

**Independent Test**: Verificar que el footer se renderiza en `/`, `/reportar`, `/terminos`, `/privacidad` y `/seguimiento`.

**Acceptance Scenarios**:

1. **Given** cualquier página pública, **When** se carga, **Then** se muestra el footer con enlaces a términos, privacidad y reportar.
2. **Given** un visitante en el footer, **When** hace clic en un canal oficial, **Then** abre el enlace externo correspondiente en una nueva pestaña.
3. **Given** una pantalla pequeña, **When** se carga el footer, **Then** los elementos se organizan verticalmente sin desbordarse.

---

## Requirements

### Functional Requirements

- **FR-001**: Crear página estática `/terminos` con contenido de términos de uso.
- **FR-002**: Crear página estática `/privacidad` con contenido de política de privacidad.
- **FR-003**: Crear componente `LandingFooter` con enlaces a términos, privacidad, reportar y copyright.
- **FR-004**: Integrar `LandingFooter` en las páginas públicas principales.
- **FR-005**: Incluir metadatos básicos (`title`, `description`) en las páginas legales.

### Non-Functional Requirements

- **NFR-001**: Las páginas deben ser estáticas y cacheables.
- **NFR-002**: El footer no debe interferir con la accesibilidad del contenido principal.

---

## Success Criteria

- **SC-001**: `/terminos` y `/privacidad` son accesibles sin autenticación.
- **SC-002**: El footer aparece en todas las páginas públicas principales.
- **SC-003**: Tests E2E verifican navegación desde el footer a ambas páginas legales.

---

## Assumptions

- El layout base y el sistema de rutas de Next.js ya están configurados.
- Los textos legales iniciales son genéricos y deben ser revisados por asesoría legal antes de producción.
