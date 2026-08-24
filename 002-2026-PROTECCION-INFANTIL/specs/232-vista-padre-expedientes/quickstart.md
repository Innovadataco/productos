# Quickstart — SPEC-232

## Verificación local

1. Instalar dependencias: `npm install`
2. Levantar la app: `npm run dev`
3. Iniciar sesión como PARENT.
4. Crear un expediente y eventos de prueba (por seed o API).
5. Ir a `http://localhost:5005/dashboard/padre/expedientes`.
6. Verificar:
   - Lista muestra solo expedientes propios.
   - Cards muestran identificador, estado, score, fecha, días desde última actividad.
   - Filtros "Todos / Activos / En revisión / Cerrados" funcionan.
   - AutoSuggest aparece si hay expediente activo con 3+ días sin eventos.
7. Entrar a un expediente y verificar:
   - Cronología ordenada por ordenSecuencial.
   - Botón "Agregar nueva situación" abre formulario.
   - Al enviar, aparece el nuevo evento y se actualiza contador.
8. Intentar entrar a un expediente ajeno (cambiar id): debe devolver 404.

## Gate de calidad

```bash
npx tsc --noEmit
npm run lint -- --no-cache
npm run arch:check
npm run test:unit
npm run test:integration
npm run build
./scripts/dev-restart.sh
```

## Push

```bash
git fetch origin
git rebase origin/feature/001-scaffolding
git diff --name-status origin/feature/001-scaffolding..HEAD
# Debe listar solo archivos de SPEC-232
git push -u origin work/002-PI-132
```
