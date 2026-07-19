# Plan de implementación — Spec 034

## Resumen
Correcciones de redirect del rol Comité, guardado explícito con UPSERT en Configuración y rediseño visual del mapa del dashboard público.

## Enfoque
Cambios mínimos y aislados por User Story. No se añaden dependencias ni se modifica el modelo de datos. Se reutiliza `react-leaflet` y el GeoJSON local.

## Fases

### Phase 1 — Artefactos Spec-Kit
- Crear todos los artefactos del spec 034.
- Verificar que 034 sea el siguiente número libre.

### Phase 2 — User Story 1: Redirect y protección del rol Comité
- `src/app/login/page.tsx`: incluir `COMITE_VALIDACION` en redirect post-login.
- `src/app/mis-reportes/page.tsx`: redirigir roles internos a su área.
- `src/app/dashboard/circulo-confianza/page.tsx`: redirigir roles internos a su área.

### Phase 3 — User Story 2: Guardado explícito con UPSERT
- `src/app/api/config/parametros/[clave]/route.ts`: modificar PATCH para UPSERT.
- `src/components/modules/CategoriaGruposEditor.tsx`: botón "Guardar cambios", dirty state, confirmación, beforeunload.
- `src/components/modules/ConfigPanel.tsx`: advertencia de cambios sin guardar e indicador visual de dirty.

### Phase 4 — User Story 3: Rediseño visual del mapa
- `src/components/modules/MapaUbicaciones.tsx`: centro LATAM, estilos pulidos, leyenda, burbujas con etiquetas, mapeo de nombres, hover, popups.
- `src/components/modules/PublicDashboard.tsx`: ajustes de layout si son necesarios.

### Phase 5 — Validación
- `npm run lint`, `npx tsc --noEmit`, `npm run test`.
- `rm -rf .next && npm run build`.
- `./scripts/dev-restart.sh`.
- Pruebas con `quickstart.md`.

### Phase 6 — Cierre
- Commits: uno por US + uno de docs.
- Push a `feature/001-scaffolding`.
- Documentar cierre, sección Implementación en `spec.md`, deuda técnica.

## Decisiones técnicas
- **UPSERT**: modificar PATCH existente para crear el parámetro si no existe, manteniendo compatibilidad con ConfigPanel.
- **Guardado explícito**: reemplazar autosave en CategoriaGruposEditor para alinearlo con el resto de ConfigPanel.
- **Mapa**: mejorar visualmente sin tiles externos; usar diccionario de nombres para mapeo español→inglés; centro por defecto en Colombia.

## Dependencias externas
Ninguna. Se reutiliza `react-leaflet` y el GeoJSON local.
