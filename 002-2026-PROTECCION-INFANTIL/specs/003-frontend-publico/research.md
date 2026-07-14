# Research: Frontend Público y Flujo de Reporte

**Date**: 2026-07-13
**Feature**: specs/003-frontend-publico/spec.md

## Decision: Diseño visual — adaptación del prototipo DCLogic a Next.js + Tailwind

**Decision**: Adaptar la estética del prototipo `design/Protección Infantil - Standalone.html` a componentes React + Tailwind CSS, sin copiar el framework propietario ni sus dependencias.

**Rationale**:
- El prototipo valida la dirección visual (glassmorphism, paleta oklch, animaciones floatUp).
- Next.js App Router + Tailwind es el stack heredado del proyecto (constitución §2.1).
- No se introduce ninguna dependencia de UI nueva (sin Material-UI, Chakra, etc.).

**Alternatives considered**:
- Copiar el framework DCLogic del prototipo → RECHAZADO: framework propietario, no mantenible.
- Usar shadcn/ui → RECHAZADO: añade dependencias no aprobadas en constitución; Tailwind puro es suficiente.

## Decision: Animaciones — CSS transitions + Tailwind keyframes

**Decision**: Implementar micro-animaciones con CSS puro (Tailwind `transition`, `animate-floatUp`, `backdrop-blur`). Sin librerías de animación externas (Framer Motion, GSAP).

**Rationale**:
- Cumple el requisito de "animaciones cuidadas" sin añadir dependencias.
- Tailwind soporta `animate-*` personalizados vía `tailwind.config.ts`.
- Glassmorphism se logra con `bg-white/10 backdrop-blur-md`.

## Decision: Manejo de estado de formularios — React useState (no form library)

**Decision**: Usar `useState` + validación manual/Zod para los formularios de 4 pasos. Sin React Hook Form ni Formik.

**Rationale**:
- Los formularios son de complejidad media (4 pasos, validación inline).
- El backend ya valida con Zod (`src/lib/validators.ts`); reutilizar el mismo schema en cliente.
- Menor bundle size, sin dependencias adicionales.

## Decision: Fetching de datos — fetch nativo + custom hook useApi

**Decision**: Usar `fetch` nativo del navegador con un hook personalizado `useApi` para manejar loading, error y retry. Sin TanStack Query (React Query) ni SWR.

**Rationale**:
- El proyecto no usa React Query actualmente.
- Los endpoints son simples (GET/POST); un hook ligero `useApi` es suficiente.
- Cookie httpOnly se envía automáticamente con `fetch` + `credentials: "include"`.

## Decision: Auth state — contexto React simple

**Decision**: Usar un `AuthContext` con `useState` para el usuario autenticado. El token vive en cookie httpOnly; el frontend solo almacena el objeto usuario (no el JWT).

**Rationale**:
- La cookie httpOnly no es accesible desde JS; el frontend hace `GET /api/me` para obtener el usuario al cargar.
- No se usa localStorage para datos sensibles (constitución §6.1).
- Patrón ya existente en el proyecto (`src/lib/auth.ts`).

## Decision: Pagina de inicio — reemplaza /app/page.tsx existente

**Decision**: La página de inicio (consulta de identificador) será `src/app/page.tsx`, reemplazando la página actual de placeholder.

**Rationale**:
- La página actual (`src/app/page.tsx`) es un placeholder simple.
- La consulta pública es la entrada principal del producto; debe ser la raíz.

## Decision: Flujo de reporte — ruta dinámica con steps

**Decision**: El flujo de 4 pasos se implementa como `src/app/reportar/page.tsx` con un wizard interno (step 1-4), no como 4 rutas separadas.

**Rationale**:
- Mantiene el estado del formulario entre pasos sin necesidad de state management complejo.
- La URL permanece `/reportar` durante todo el flujo; más simple para el usuario.
- Si el usuario recarga en paso 3, puede perder progreso — aceptable para MVP.

## Decision: Fuentes — Google Fonts via next/font

**Decision**: Cargar Plus Jakarta Sans y DM Mono vía `next/font/google` en `src/app/layout.tsx`.

**Rationale**:
- `next/font` optimiza automáticamente las fuentes (subset, preload, sin layout shift).
- Constitución §7.3 permite Tailwind como única fuente de estilos; `next/font` es parte de Next.js.

## Decision: Entidades Pais y Ciudad — catálogos globales con relación a Reporte

**Decision**: Crear `Pais` y `Ciudad` como catálogos globales (sin `tenantId`). Reporte guarda **ambos**: FKs (`paisId`, `ciudadId`) para consultas agregadas consistentes, y strings (`pais`, `ciudad`) para preservar texto exacto del usuario y compatibilidad con reportes existentes.

**Rationale**:
- Los catálogos geográficos son globales por naturaleza; no varían por tenant (constitución §4.5).
- FKs permiten joins eficientes para distribución por ciudad/país en consulta pública.
- Strings preservan el valor exacto cuando el usuario elige "Otra ciudad" (FK null).
- Reportes existentes quedan compatibles (FKs null, strings intactos).

**Alternatives considered**:
- Reemplazar strings por FKs obligatorios → RECHAZADO: rompe compatibilidad con reportes existentes y no soporta "Otra ciudad".
- Solo strings sin FKs → RECHAZADO: imposible hacer joins agregados consistentes para distribución geográfica.

## Decision: Plataforma "Otra" — mapeo a clave "otro" + campo libre

**Decision**: Cuando el usuario selecciona "Otra" plataforma, `plataformaId` apunta a la fila con `clave = "otro"` y `otraPlataforma` (nuevo campo en Reporte) guarda el nombre escrito.

**Rationale**:
- Mantiene la integridad referencial (siempre hay un `plataformaId` válido).
- El campo libre permite flexibilidad sin crear plataformas dinámicas en BD.
- El backend puede procesar "otro" como categoría genérica en clasificación IA.

## Decision: Seed de Latinoamérica — no exhaustivo

**Decision**: ~18 países, ~8-10 ciudades principales por país (capitales + ciudades grandes). No es exhaustivo.

**Rationale**:
- El alcance del producto es Latinoamérica; seed debe cubrir el 80% de casos de uso.
- "Otra ciudad" cubre el 20% restante sin necesidad de mantener un catálogo exhaustivo.
- Menor tiempo de migración y seed.

## Unknowns Resolutions

| Unknown | Resolution |
|---------|------------|
| Prototipo usa framework DCLogic propietario | Adaptar visualmente a Tailwind; no copiar código |
| Endpoint GET /api/reportes/mis-reportes no existe | Crear como parte del plan técnico (FR-020) |
| Estado "REQUIERE_ANONIMIZACION" en UI de padre | Mapear a "En revisión de privacidad" en el frontend |
| ¿Cómo almacenar "Otra" plataforma? | `plataformaId` → clave "otro", `otraPlataforma` → texto libre |
| ¿FK o string para país/ciudad? | Ambos: FKs para joins, strings para compatibilidad y "Otra" |
