# Requirements Checklist — Spec 033

## User Story 1 — Menú del rol Comité
- [x] `COMITE_VALIDACION` está incluido en `esEmpleado` de `NavHeader.tsx`.
- [x] El menú del rol Comité muestra "Mi bandeja" apuntando a `/dashboard/admin/comite`.
- [x] El menú del rol Comité **no** muestra "Círculo de Confianza" ni "Mis reportes".
- [x] El menú móvil tiene el mismo comportamiento que el dropdown.
- [x] `/api/reportes/mis-reportes` requiere rol `PARENT`.
- [x] `/api/circulo-confianza` (GET y POST) requiere rol `PARENT`.
- [x] Los estilos del header distinguen al rol Comité (borde, avatar, badge).
- [x] Los demás roles (`ADMIN`, `SCHOOL_ADMIN`, `OPERADOR`, `PARENT`) conservan su menú actual.

## User Story 2 — Editor de grupos de categoría
- [x] El editor importa `GRUPOS_CATEGORIA_FALLBACK` desde `src/lib/categoria-grupos`.
- [x] Si `ui.grupos_categoria` está vacío, el editor muestra los 5 grupos fallback con categorías asignadas.
- [x] Cada grupo se muestra como tarjeta.
- [x] Cada categoría asignada se muestra como chip separado.
- [x] El nombre del grupo es editable y se guarda automáticamente.
- [x] El selector "Agregar categoría..." permite mover una categoría de un grupo a otro.
- [x] La zona "Categorías sin agrupar" muestra una advertencia visible de que se ocultan a los usuarios.
- [x] El guardado automático tiene feedback claro de éxito o error.

## User Story 3 — Mapa real del dashboard público
- [x] Existe el archivo `public/geo/world-countries.json` con geometrías de países.
- [x] El dashboard público muestra contornos geográficos de países.
- [x] Los países se colorean según la escala rojo/naranja/verde por cantidad de reportes.
- [x] Se muestra popup con nombre del país y cantidad de reportes.
- [x] Se mantienen los puntos de ciudad con popup (ciudad, país, total).
- [x] El mapa funciona sin acceso a internet en el servidor (datos locales).
- [x] Si el GeoJSON falla, el componente se degrada graciosamente.

## General
- [x] Todos los artefactos Spec-Kit están creados.
- [x] `npm run lint` pasa sin errores.
- [x] `npx tsc --noEmit` pasa sin errores.
- [x] `npm run test` pasa (o los fallos existentes no son causados por este spec).
- [x] `npm run build` compila exitosamente.
- [x] `./scripts/dev-restart.sh` levanta la app en `:5005` con un solo worker.
- [x] Se completó el `quickstart.md` manualmente (validado vía curl y build).
- [x] Se generó `cierre.md` y se actualizó la sección Implementación en `spec.md`.
- [x] Se registró deuda técnica si aplica.
- [x] Se hicieron commits: uno por User Story + uno de docs.
- [x] Se hizo push a `feature/001-scaffolding`.
