# Quickstart — Spec 036: Consistencia y limpieza

## Prerrequisitos

- Repo en rama `feature/001-scaffolding`.
- Dependencias instaladas: `npm install`.
- Base de datos levantada con datos de prueba.

## User Story 1 — Renombrar apeaciones → apelaciones

1. Ejecutar `grep -R "apeaciones\|apealaciones" src/ scripts/ --include="*.ts" --include="*.tsx"`.
2. Verificar que no queden ocurrencias en código ejecutable (documentación histórica no cuenta).
3. Ejecutar `npm run test` y verificar que los tests de apelaciones pasan.
4. Probar manualmente la creación de una apelación pública y su gestión en el admin.

## User Story 2 — Barrido final de voseo

1. Ejecutar `grep -R "revisá\|clasificá\|gestioná\|mostrá\|copiá\|mostrála\|verificá\|buscá\|enviá\|guardá" src/ --include="*.tsx" --include="*.ts"`.
2. Verificar que no queden coincidencias en strings de UI o mensajes de error.
3. Revisar visualmente las páginas de gestión de operadores, comité y bandeja admin.

## User Story 3 — Logger mínimo

1. Revisar `src/lib/logger.ts`.
2. Verificar que no queden `console.log` en `src/lib` (`grep -R "console.log" src/lib` debe devolver 0).
3. Ejecutar `npm run test` y confirmar que los tests que espiaban `console.log` ahora espián el logger.
4. Probar con `LOG_LEVEL=debug` y `LOG_LEVEL=warn` para verificar niveles.

## User Story 4 — Buscador en bandeja admin

1. Iniciar sesión como `ADMIN` u `OPERADOR`.
2. Ir a `/dashboard/admin`.
3. Escribir un número de seguimiento existente (ej. RPT-ABC123) en el campo de búsqueda.
4. Verificar que la tabla muestra el reporte correspondiente.
5. Limpiar el campo y buscar por identificador/nick.
6. Verificar que los resultados coinciden.
7. Combinar con filtros de estado/categoría y verificar que se aplican todos.

## User Story 5 — eval-results en .gitignore

1. Crear un archivo temporal en `eval-results/test-ignore.json`.
2. Ejecutar `git status`.
3. Verificar que el archivo no aparece como untracked.
4. Eliminar el archivo temporal.

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
