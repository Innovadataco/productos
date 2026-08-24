# Quickstart — SPEC-233

## Verificación local

1. Instalar dependencias: `npm install`
2. Levantar la app: `./scripts/dev-restart.sh` (o `npm run dev`)
3. Sembrar datos de prueba: 2 usuarios PARENT con expedientes sobre el mismo identificador (por seed o creando reportes/expedientes vía UI), más expedientes sobre un segundo identificador.

### Vista padre

4. Iniciar sesión como PARENT A.
5. Ir a `http://localhost:5005/dashboard/padre/expedientes`, entrar al detalle de un expediente y hacer clic en "Ver todos tus expedientes sobre este identificador".
6. Verificar en `/dashboard/padre/identificador/[nick]`:
   - Cabecera muestra el identificador.
   - Solo aparecen expedientes propios sobre ese identificador, ordenados nuevo → anterior.
   - Cada card muestra estado, nivel de gravedad, fecha de apertura, número de eventos y navega al detalle correcto.
   - La caja de búsqueda navega a otro identificador (probar con un nick con caracteres especiales).
   - Buscar un identificador sin expedientes propios → estado vacío con botón a "Reportar".
7. Iniciar sesión como PARENT B y repetir la búsqueda del mismo identificador: los resultados son independientes (cero fuga cruzada).

### Vista admin

8. Iniciar sesión como ADMIN (o COMITE_VALIDACION).
9. Ir a `http://localhost:5005/dashboard/admin/identificador/[nick]`:
   - Aparece el agregado anónimo (totales por estado, categorías, plataformas, países/ciudades, primera/última aparición).
   - La lista anonimizada muestra los expedientes de TODOS los padres; verificar en el HTML (ver código fuente) que no aparece `padreUsuarioId`, correos ni textos.
   - Buscar un identificador inexistente → "Sin expedientes registrados sobre este identificador".
10. Iniciar sesión como OPERADOR e intentar la misma URL → redirect a `/dashboard/admin`.
11. Probar `[nick]` de más de 100 caracteres → mensaje de entrada inválida (no 500).

## Gate de calidad

```bash
npx tsc --noEmit
npm run lint -- --no-cache
npm run arch:check
npm run test
npm run build
./scripts/dev-restart.sh
```

## Push

```bash
git fetch origin
git rebase origin/feature/001-scaffolding
git diff --name-status origin/feature/001-scaffolding..HEAD
# Debe listar solo archivos de SPEC-233
git push -u origin work/002-PI-133
```
