# Quickstart — Spec 033

## Prerrequisitos
- Repo en rama `feature/001-scaffolding`.
- Base de datos levantada (Docker Postgres en puerto 5433).
- Dependencias instaladas: `npm install`.
- Build limpio: `rm -rf .next && npm run build`.
- Deploy: `./scripts/dev-restart.sh`.

## User Story 1 — Menú del rol Comité
1. Crear o usar un usuario con rol `COMITE_VALIDACION` (puede crearse desde `/dashboard/admin/operadores` con rol `COMITE_VALIDACION`).
2. Iniciar sesión con ese usuario.
3. Abrir el menú de usuario (avatar en la esquina superior derecha).
4. Verificar que aparece "Mi bandeja" y apunta a `/dashboard/admin/comite`.
5. Verificar que **no** aparecen "Círculo de Confianza" ni "Mis reportes".
6. Acceder manualmente a `/mis-reportes`: debe devolver 403 o redirigir a login.
7. Acceder manualmente a `/dashboard/circulo-confianza`: debe devolver 403 o redirigir a login.
8. Repetir con un usuario `PARENT` para confirmar que sí ve esas opciones.

## User Story 2 — Editor de grupos de categoría
1. Iniciar sesión con rol `ADMIN`.
2. Ir a `/dashboard/admin/configuracion`.
3. Localizar la sección "Grupos de categoría".
4. Si `ui.grupos_categoria` está vacío, verificar que se muestran los 5 grupos fallback con categorías asignadas.
5. Mover una categoría de un grupo a otro usando el selector "Agregar categoría...".
6. Verificar que el chip se mueve y aparece el mensaje de guardado exitoso.
7. Renombrar un grupo y verificar que persiste.
8. Eliminar un grupo: verificar que sus categorías aparecen en "Sin agrupar" con la advertencia visible.
9. Recargar la página y verificar que los cambios se mantienen.

## User Story 3 — Mapa real del dashboard público
1. Abrir `/dashboard-publico` sin autenticación.
2. Verificar que el mapa muestra contornos de países (no solo puntos sobre fondo blanco).
3. Verificar que los países con reportes se colorean (rojo, naranja o verde).
4. Hacer clic en un país: debe aparecer popup con nombre y cantidad de reportes.
5. Hacer clic en un punto de ciudad: debe aparecer popup con ciudad, país y cantidad.
6. Simular modo offline: bloquear la URL del tile server o verificar que no hay requests externos en la pestaña Network del navegador; el mapa debe seguir cargando.

## Validación automática
```bash
npm run lint
npx tsc --noEmit
npm run test
```

## Limpieza y reinicio
```bash
rm -rf .next
npm run build
./scripts/dev-restart.sh
```
