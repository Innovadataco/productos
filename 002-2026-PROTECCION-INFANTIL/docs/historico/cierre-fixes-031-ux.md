# Cierre · Fixes 031 UI de grupos/mapa + UX de seguimiento

## Fixes entregados

### FIX 1 — Completar Spec 031 (UI + mapa)

1. **UI de gestión de grupos de categoría**
   - Nuevo componente `src/components/modules/CategoriaGruposEditor.tsx`.
   - Sección agregada en `src/components/modules/ConfigPanel.tsx`.
   - Permite crear/eliminar grupos, renombrarlos y mover categorías entre grupos. Guarda en `ui.grupos_categoria` vía API de parámetros.
   - El parámetro `ui.grupos_categoria` ya no se muestra como JSON editable en la lista general.

2. **Mapa de calor real**
   - `src/components/modules/MapaUbicaciones.tsx`: escala de color por cantidad de reportes por ciudad.
   - Mayor cantidad → rojo, media → naranja, menor → verde. Radio proporcional.

3. **Fallback sin tiles externos**
   - Se eliminó `TileLayer` de OpenStreetMap. Fondo neutro con cuadrícula para que la distribución por ciudad sea legible sin salida a internet.

### FIX 2 — UX del seguimiento

1. **Ocultar clasificación provisional**
   - `src/app/api/reportes/seguimiento/[numero]/route.ts`: solo envía `clasificacion` cuando el estado es `CLASIFICADO` o `CORREGIDO`.
   - `SeguimientoClient.tsx` no muestra el bloque si `clasificacion` no viene. Aplica a las 3 vías de búsqueda y a "Mis reportes".

2. **Quitar % de confianza del usuario final**
   - Eliminado de: endpoint de seguimiento, `mis-reportes`, `consulta`, `consulta/detalle` y componentes `SeguimientoClient`, `MisReportesList`, `ConsultaPublicaClient`, `ConsultaEnriquecidaClient`.
   - El % de confianza sigue disponible para operador/comité/métricas internas.

## Verificación

- `npx tsc --noEmit` ✅
- `npm run test` ✅ 407 tests
- `rm -rf .next && npm run build` ✅
- Smoke E2E en `http://localhost:5005` ✅
- Tests específicos de seguimiento, consulta y componentes afectados ✅ 34 tests

## Deploy

- App y worker reiniciados en `:5005` con build limpia.
- Healthcheck: `curl http://localhost:5005` → 200.

## Commits

- `ef1db24` fix(031): mapa de calor con escala de color y fallback sin tiles externos
- `5bc98bf` fix(031): UI de gestión de grupos de categoría en configuración
- `0e4c9c2` fix(seguimiento): ocultar clasificación provisional y quitar % confianza de vistas de usuario

## Archivos tocados

- `src/components/modules/CategoriaGruposEditor.tsx` (nuevo)
- `src/components/modules/ConfigPanel.tsx`
- `src/components/modules/MapaUbicaciones.tsx`
- `src/app/api/reportes/seguimiento/[numero]/route.ts`
- `src/components/modules/SeguimientoClient.tsx`
- `src/app/api/reportes/mis-reportes/route.ts`
- `src/components/modules/MisReportesList.tsx`
- `src/app/api/consulta/route.ts`
- `src/app/api/consulta/detalle/route.ts`
- `src/components/modules/ConsultaPublicaClient.tsx`
- `src/components/modules/ConsultaEnriquecidaClient.tsx`
- Tests afectados:
  - `src/app/api/reportes/seguimiento/[numero]/route.test.ts`
  - `src/components/modules/SeguimientoClient.test.tsx`
  - `src/app/api/consulta/route.test.ts`
  - `src/app/api/consulta/detalle/route.test.ts`
  - `src/components/modules/ConsultaPublicaClient.test.tsx`
  - `src/components/modules/ConsultaEnriquecidaClient.test.tsx`
