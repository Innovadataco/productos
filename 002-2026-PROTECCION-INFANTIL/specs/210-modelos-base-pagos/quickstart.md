# Quickstart — SPEC-210

## Requisitos previos

- Node.js >= 22.
- Docker con contenedor `002-2026-proteccion-infantil-db-1` en puerto `5433`.
- `.env` con `DATABASE_URL`, `JWT_SECRET`, etc.

## Setup local

```bash
export PATH="$HOME/.hermes/node/bin:$PATH"
cd /Users/idc/Documents/GitHub/productos/002-2026-PROTECCION-INFANTIL
npm install
npx prisma generate
npm run db:migrate
npm run db:seed
```

## Verificar funcionalmente

1. Revisar schema:
   ```bash
   npx prisma migrate status
   npx prisma db pull --print | grep -E 'Suscripcion|Plan|Pago|BonoPromocional|BonoAplicado|CodigoReferidoUso|TasaCambio'
   ```
2. Verificar planes sembrados:
   ```sql
   SELECT "tipoTitular", duracion, año, "precioBaseUSD" FROM "Plan" WHERE año = 2026;
   -- Esperado: 20 filas (2 titulares × 5 duraciones).
   ```
3. Verificar parámetros `pagos.*`:
   ```sql
   SELECT clave FROM "ParametroSistema" WHERE clave LIKE 'pagos.%';
   -- Esperado: 11 filas.
   ```
4. Correr seed dos veces:
   ```bash
   npm run db:seed
   npm run db:seed
   ```
   No debe haber duplicados ni errores.

## Comandos de gate local

```bash
npx tsc --noEmit
npm run lint -- --no-cache
npm run arch:check
npm run test
npm run build
```

## Validar DAL

```bash
npx tsc --noEmit
npm run arch:check
```

`arch:check` debe reportar verde y no detectar imports de `@/lib/prisma` en endpoints/servicios de pagos.
