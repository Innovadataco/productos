# Quickstart — Spec 034

## Prerrequisitos
- Repo en rama `feature/001-scaffolding`.
- Base de datos levantada (Docker Postgres en puerto 5433).
- Dependencias instaladas: `npm install`.
- Build limpio: `rm -rf .next && npm run build`.
- Deploy: `./scripts/dev-restart.sh`.

## User Story 1 — Redirect y protección del rol Comité
1. Crear o usar un usuario `COMITE_VALIDACION`.
2. Iniciar sesión con ese usuario.
3. Verificar que el navegador redirige a `/dashboard/admin/comite` (no a `/mis-reportes`).
4. Acceder manualmente a `/mis-reportes` estando logueado como `COMITE_VALIDACION`.
5. Verificar que se redirige a `/dashboard/admin/comite` sin mostrar error.
6. Repetir con un usuario `OPERADOR`: redirige a `/dashboard/admin`.
7. Repetir con un usuario `PARENT`: `/mis-reportes` carga normalmente.
8. Repetir con `/dashboard/circulo-confianza` para `COMITE_VALIDACION`, `OPERADOR` y `PARENT`.

## User Story 2 — Guardado explícito en Configuración
1. Iniciar sesión con rol `ADMIN`.
2. Ir a `/dashboard/admin/configuracion`.
3. Localizar "Grupos de categoría".
4. Verificar que no aparece "Parámetro no encontrado"; se muestran los 5 grupos fallback.
5. Verificar que el botón "Guardar cambios" aparece y está deshabilitado inicialmente.
6. Renombrar un grupo.
7. Verificar que el botón se habilita y aparece indicador de cambios sin guardar.
8. Intentar cerrar la pestaña del navegador; debe aparecer la advertencia del navegador.
9. Presionar "Guardar cambios"; debe aparecer mensaje de éxito.
10. Recargar la página; verificar que el cambio persiste.
11. Editar un parámetro numérico/booleano en `ConfigPanel` sin guardar.
12. Intentar cerrar la pestaña; debe aparecer la advertencia.

## User Story 3 — Rediseño visual del mapa
1. Abrir `/dashboard-publico` sin autenticación.
2. Verificar que el mapa se centra en Colombia/LATAM.
3. Verificar que los países con reportes se colorean (rojo, naranja, verde).
4. Verificar que Colombia (si hay reportes) se colorea correctamente.
5. Hacer hover sobre un país; debe resaltar.
6. Hacer clic en un país; popup con nombre y cantidad.
7. Verificar que las burbujas de ciudad muestran el número y nombre de la ciudad.
8. Verificar que la leyenda explica la escala de colores.
9. Simular modo offline; el mapa debe seguir cargando.

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
