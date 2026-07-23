# Research — Spec 034

## Hallazgos de la exploración

### Número de spec
El directorio `specs/` contiene specs hasta el 033 (`033-correcciones-vistas-roles`) y `088-pendientes-afinamiento`. El siguiente número disponible es **034**.

### User Story 1 — Redirect y protección del rol Comité
- `src/app/login/page.tsx` (línea 30): el ternario de redirección solo considera `ADMIN`, `SCHOOL_ADMIN` y `OPERADOR`; todo lo demás va a `/mis-reportes`.
- `src/app/mis-reportes/page.tsx`: no tiene guarda de rol interno; llama a `/api/reportes/mis-reportes` y muestra el error que devuelve el backend (403 para roles no PARENT).
- `src/app/dashboard/circulo-confianza/page.tsx`: no tiene guarda de rol interno; comportamiento similar.
- El backend ya protege ambas rutas con `verifyAuth("PARENT")`, pero la experiencia es pobre porque la página renderiza y muestra error.

### User Story 2 — Guardado explícito con UPSERT
- `src/app/api/config/parametros/[clave]/route.ts`: GET/PATCH/DELETE requieren `ADMIN`. PATCH falla con 404 si la clave no existe.
- `src/components/modules/CategoriaGruposEditor.tsx`: cada acción (renombrar, mover, crear, eliminar) dispara `guardar()` vía PATCH. Si el parámetro no existe, el PATCH falla silenciosamente y no persiste.
- `src/components/modules/ConfigPanel.tsx`: ya usa guardado explícito por parámetro y por sección, pero no tiene advertencia de cambios sin guardar ni indicador visual de dirty state.
- El parámetro `ui.grupos_categoria` no está en el seed de Prisma; por eso no existe en BD.

### User Story 3 — Rediseño visual del mapa
- `src/components/modules/MapaUbicaciones.tsx`: usa `react-leaflet` con GeoJSON local. Actualmente:
  - Centro mundial genérico (`[4.5, -74]` con zoom 5, pero el cálculo se basa en datos).
  - Fondo de océano básico `#e0f2fe`, tierra sin datos `#e2e8f0`.
  - Colores rojo/naranja/verde con umbrales 75% / 25%.
  - Burbujas de ciudad sin etiquetas ni números visibles.
  - Sin leyenda.
  - Mapeo de nombres por normalización textual simple (sin diccionario).
  - Popups básicos con HTML string.
- `public/geo/world-countries.json`: nombres en inglés (ej. "United States of America", "Colombia", "Brazil"). La BD usa nombres en español (ej. "Estados Unidos", "Colombia", "Brasil").
- Design System del dashboard: `design-system/proteccion-infantil-dashboard/MASTER.md` indica paleta azul/ámbar, densidad 8/10, sin emojis, hover con transiciones, contraste 4.5:1.

## Referencias
- `specs/033-correcciones-vistas-roles/spec.md` — trabajo previo relacionado.
- `specs/001-multi-role-auth-config/spec.md` — formato de referencia para spec.
- `.specify/memory/constitution.md` — principios del producto.
- `design-system/proteccion-infantil-dashboard/MASTER.md` — guía visual del dashboard.
- `src/lib/categoria-grupos.ts` — `GRUPOS_CATEGORIA_FALLBACK`.
- `src/app/api/estadisticas-publicas/route.ts` — fuente de datos del mapa.
