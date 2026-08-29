# Quickstart — SPEC-231

## Verificación local

1. Instalar dependencias: `npm install`
2. Levantar la app: `npm run dev`
3. Iniciar sesión como PARENT.
4. Ir a `http://localhost:5005/dashboard/padre`.
5. Verificar:
   - Sidebar visible a la izquierda con 7 items.
   - Item "Inicio" activo (fondo cielo).
   - Contenido principal muestra "Inicio" + "Próximamente".
6. Navegar a cada item del sidebar y verificar que:
   - El item activo cambia.
   - La página placeholder muestra el nombre de la sección + "Próximamente".
7. Redimensionar a mobile (<640px): el sidebar se oculta.

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
# Debe listar solo archivos de SPEC-231
git push -u origin work/002-PI-131
```
