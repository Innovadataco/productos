# Quickstart — SPEC-205

## Requisitos previos

- Node.js >= 22 (Hermes en `/Users/idc/.hermes/node/bin`).
- Docker con contenedor `002-2026-proteccion-infantil-db-1` corriendo en puerto `5433`.
- `.env` con `DATABASE_URL`, `JWT_SECRET`, etc.

## Setup local

```bash
export PATH="$HOME/.hermes/node/bin:$PATH"
cd /Users/idc/Documents/GitHub/productos-002-pi-102/002-2026-PROTECCION-INFANTIL
npm install
npx prisma generate
npm run db:migrate
npm run db:seed
```

## Verificar funcionalmente

1. Levantar app:
   ```bash
   npm run dev
   ```
2. Iniciar sesión como admin.
3. Navegar a `/dashboard/admin/usuarios`.
4. Confirmar:
   - 5 tarjetas KPI visibles (Padres, Rectores, Operadores, Comité, Admins).
   - Sub-tabs: Padres, Rectores, Operadores, Comité de convivencia, Comité de validación, Admins.
   - Total del KPI coincide con total de la tabla activa.
   - Tabla "Operadores" muestra los mismos casos abiertos que `/dashboard/admin/operadores/asignar`.
   - "Ver detalle" abre ficha con datos cruzados del rol.

## Comandos de gate local

```bash
npx tsc --noEmit
npm run lint -- --no-cache
npm run arch:check
npm run test
npm run build
```

## Validar divergencia de conteos (smoke manual)

```bash
# Como admin autenticado, comparar:
curl -s -b "token=$TOKEN" "http://localhost:5005/api/admin/usuarios?rol=OPERADOR" | jq '.pagination.total'
curl -s -b "token=$TOKEN" "http://localhost:5005/api/admin/operadores/asignacion" | jq '.operadores | length'
# Ambos deben coincidir.
```
