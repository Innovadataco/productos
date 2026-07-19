# Plan de implementación — Spec 033

## Resumen
Correcciones de UI y autorización para tres User Stories: menú del rol Comité, editor de grupos de categoría con fallback y mapa real del dashboard público.

## Enfoque
Cambios mínimos y aislados. Se reutiliza `react-leaflet` ya instalado para el mapa, añadiendo un GeoJSON local de países. No se requieren migraciones ni nuevas dependencias si el GeoJSON es ligero.

## Fases

### Phase 1 — Preparación y artefactos
- Crear todos los artefactos Spec-Kit 033.
- Verificar que el número de spec 033 sea el siguiente libre.

### Phase 2 — User Story 1: Menú del rol Comité
- `src/components/modules/NavHeader.tsx`: incluir `COMITE_VALIDACION` en `esEmpleado`, añadir estilos propios y menú "Mi bandeja".
- Verificar `verifyAuth("PARENT")` en `src/app/api/reportes/mis-reportes/route.ts` y `src/app/api/circulo-confianza/route.ts`.

### Phase 3 — User Story 2: Editor de grupos de categoría
- `src/components/modules/CategoriaGruposEditor.tsx`: importar `GRUPOS_CATEGORIA_FALLBACK`, sembrar el editor cuando el parámetro esté vacío, mejorar advertencia de categorías sin agrupar.

### Phase 4 — User Story 3: Mapa real del dashboard público
- Descargar GeoJSON de países a `public/geo/world-countries.json`.
- `src/components/modules/MapaUbicaciones.tsx`: cargar GeoJSON, colorear por cantidad, mostrar popups, mantener puntos de ciudad.
- `src/components/modules/PublicDashboard.tsx`: pasar `data.porPais` al mapa.

### Phase 5 — Validación
- `npm run lint`, `npx tsc --noEmit`, `npm run test`.
- `rm -rf .next && npm run build`.
- `./scripts/dev-restart.sh`.
- Probar con `quickstart.md`.

### Phase 6 — Cierre
- Commits: uno por User Story + uno de docs.
- Push a `feature/001-scaffolding`.
- Documentar `cierre.md`, sección Implementación en `spec.md` y deuda técnica.

## Decisiones técnicas
- **Mapa**: Leaflet + GeoJSON local. Se descarta `react-simple-maps` para no agregar dependencias; `react-leaflet` ya está en el proyecto.
- **Colores**: escala rojo/naranja/verde basada en el máximo de reportes por país.
- **Fallback de categorías**: se usa el mismo `GRUPOS_CATEGORIA_FALLBACK` que el servidor, garantizando consistencia.
- **Comité**: se trata como rol interno, separado de `PARENT`, con su propio menú de administración.

## Dependencias externas
- GeoJSON de países baja resolución (~230 KB). Si no se encuentra una fuente ligera, se evalúa instalar `topojson-client` y usar un TopoJSON más pequeño.
