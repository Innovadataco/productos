# Feature Specification: SEO y Metadatos

**Feature Branch**: `feature/008-seo`

**Created**: 2026-07-14

**Status**: CERRADA

**Input**: User description: "Mejorar el SEO de la aplicación pública: metadatos por página, OpenGraph, sitemap, robots.txt, canonical URLs y datos estructurados."

---

## User Scenarios & Testing

### User Story 1 — Metadatos por página (Priority: P1) 🎯 MVP

Cada página pública tiene título, descripción y metadatos apropiados para motores de búsqueda y redes sociales.

**Why this priority**: SEO básico necesario para que la landing y páginas legales sean indexables.

**Independent Test**: Inspeccionar `<head>` de `/`, `/reportar`, `/consulta`, `/terminos`, `/privacidad`; verificar título y meta description únicos.

**Acceptance Scenarios**:

1. **Given** la página de inicio, **When** se carga, **Then** contiene `title`, `description`, `og:title`, `og:description`, `og:type=website`.
2. **Given** una página legal, **When** se carga, **Then** contiene metadatos descriptivos y `robots` apropiado.
3. **Given** el layout raíz, **Then** `themeColor` se define mediante export `viewport`, no dentro de `metadata`.

---

### User Story 2 — Sitemap y robots.txt (Priority: P1) 🎯 MVP

El sitio expone `robots.txt` y `sitemap.xml` para guiar a los rastreadores.

**Why this priority**: Facilita indexación y oculta rutas privadas del admin.

**Independent Test**: Solicitar `/robots.txt` y `/sitemap.xml`; verificar contenido válido.

**Acceptance Scenarios**:

1. **Given** cualquier rastreador, **When** accede a `/robots.txt`, **Then** permite indexar páginas públicas y bloquea `/dashboard` y `/api`.
2. **Given** cualquier rastreador, **When** accede a `/sitemap.xml`, **Then** lista las URLs públicas del sitio.

---

### User Story 3 — URLs canónicas y datos estructurados (Priority: P2)

Cada página pública incluye URL canónica y, en la landing, datos estructurados `WebSite` / `Organization`.

**Why this priority**: Reduce contenido duplicado y mejora rich snippets.

**Independent Test**: Verificar `<link rel="canonical">` en páginas públicas y script JSON-LD en `/`.

**Acceptance Scenarios**:

1. **Given** cualquier página pública, **When** se renderiza, **Then** incluye `<link rel="canonical" href="..." />`.
2. **Given** la página de inicio, **When** se renderiza, **Then** incluye JSON-LD con datos de la organización y sitio web.

---

## Requirements

### Functional Requirements

- **FR-001**: Definir `metadata` y `viewport` en `src/app/layout.tsx` siguiendo la API de Next.js 16.
- **FR-002**: Sobreescribir `metadata` en cada página pública (`/`, `/reportar`, `/seguimiento`, `/terminos`, `/privacidad`, `/offline`).
- **FR-003**: Exponer `src/app/robots.ts` con reglas públicas/privadas.
- **FR-004**: Exponer `src/app/sitemap.ts` con URLs públicas.
- **FR-005**: Incluir canonical URL en el layout o en páginas individuales.
- **FR-006**: Incluir OpenGraph básico (title, description, url) en metadatos.

### Non-Functional Requirements

- **NFR-001**: Los metadatos deben ser estáticos o generados en build time; no deben requerir llamadas de BD para páginas públicas.
- **NFR-002**: El sitemap debe respetar `NEXT_PUBLIC_APP_URL`.

---

## Success Criteria

- **SC-001**: Lighthouse SEO score ≥ 90 en `/`, `/reportar`, `/terminos`, `/privacidad`.
- **SC-002**: `/robots.txt` y `/sitemap.xml` son accesibles y válidos.
- **SC-003**: No hay warnings de Next.js sobre `themeColor` en `metadata`.

---

## Assumptions

- El dominio público está disponible en `NEXT_PUBLIC_APP_URL`.

---

## Implementación (documentado retroactivamente el 2026-07-18)

### Objetivo alcanzado
Mejorar la indexación y el compartido social del sitio público mediante metadatos, sitemap, robots y datos estructurados.

### Decisiones de diseño derivadas del código
- **`metadata` y `viewport` separados** en `src/app/layout.tsx` siguiendo la API de Next.js 16.
- **Metadatos por página** en `/`, `/reportar`, `/seguimiento`, `/terminos`, `/privacidad`, `/offline`.
- **`robots.ts` y `sitemap.ts`** generan las rutas estáticas `/robots.txt` y `/sitemap.xml`.
- **JSON-LD** en la landing con esquemas `WebSite` y `Organization`.

### Endpoints y componentes afectados
- `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/robots.ts`, `src/app/sitemap.ts`.
- Páginas públicas listadas en la sección de Requisitos.

### Tests
- `tests/e2e/seo.spec.ts`

### Migraciones relevantes
- Ninguna (cambios puros de frontend).

- Las páginas legales y la landing son las únicas que requieren indexación en v1.
