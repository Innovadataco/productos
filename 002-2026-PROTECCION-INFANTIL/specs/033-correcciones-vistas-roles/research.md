# Research — Spec 033

## Hallazgos de la exploración

### Número de spec
El directorio `specs/` contiene specs hasta el 031 (`031-mejoras-ui-agrupacion-categorias`) y un spec `050-pendientes-afinamiento`. Por tanto, el siguiente número disponible es **033**.

### User Story 1 — Menú del rol Comité
- Archivo afectado: `src/components/modules/NavHeader.tsx`.
- Problema: `esEmpleado` solo incluye `ADMIN`, `SCHOOL_ADMIN` y `OPERADOR`. `COMITE_VALIDACION` no está incluido, por lo que cae en el bloque `!esEmpleado` y ve "Círculo de Confianza" y "Mis reportes".
- Consecuencia: al hacer clic en esas opciones, el backend responde 403 porque:
  - `src/app/api/reportes/mis-reportes/route.ts` usa `verifyAuth("PARENT")`.
  - `src/app/api/circulo-confianza/route.ts` usa `verifyAuth("PARENT")` en GET y POST.
- Contexto positivo: el layout de administración (`src/app/dashboard/admin/layout.tsx`) ya permite `COMITE_VALIDACION`, y `AdminNav` ya tiene la opción "Comité". Solo falta corregir el `NavHeader` del sitio público/administrativo.

### User Story 2 — Editor de grupos de categoría
- Archivo afectado: `src/components/modules/CategoriaGruposEditor.tsx`.
- Problema: cuando `ui.grupos_categoria` está vacío, el componente inicializa `grupos = []`.
- El servidor (`src/lib/categoria-grupos.ts`) usa `GRUPOS_CATEGORIA_FALLBACK` con 5 grupos y categorías asignadas.
- El editor ya tiene:
  - Renombrar grupo (`renombrarGrupo`).
  - Mover categoría entre grupos (`agregarCategoria` quita la categoría de otros grupos).
  - Guardado automático (`guardar`).
  - Zona de categorías sin agrupar (`disponibles`), aunque la advertencia es sutil.
- Solución: sembrar el estado inicial con `GRUPOS_CATEGORIA_FALLBACK` y mejorar la advertencia visual.

### User Story 3 — Mapa real del dashboard público
- Archivo afectado: `src/components/modules/MapaUbicaciones.tsx`.
- Problema: usa `MapContainer` de `react-leaflet` sin `TileLayer`, con un fondo de puntos sobre una cuadrícula blanca. No hay contornos de países ni ciudades reales.
- Contexto: el servidor no tiene salida a internet; los tiles externos no cargan.
- Dependencias: `package.json` tiene `react-leaflet` y `leaflet`, pero no `react-simple-maps`, `d3-geo` ni `topojson-client`.
- Datos disponibles: `/api/estadisticas-publicas` retorna `porPais` y `porCiudad` con coordenadas.
- Solución: descargar un GeoJSON de países ligero y empaquetarlo en `public/geo/world-countries.json`; usar `GeoJSON` de `react-leaflet` para renderizar contornos y colorear por cantidad.

## Referencias
- `specs/001-multi-role-auth-config/spec.md` — formato de referencia para spec.
- `.specify/memory/constitution.md` — principios del producto y reglas técnicas.
- `src/lib/categoria-grupos.ts` — definición de `GRUPOS_CATEGORIA_FALLBACK`.
- `src/app/api/estadisticas-publicas/route.ts` — fuente de datos del dashboard público.
