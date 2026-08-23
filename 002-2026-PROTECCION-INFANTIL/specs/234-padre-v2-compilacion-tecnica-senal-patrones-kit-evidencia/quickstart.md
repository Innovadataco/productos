# Quickstart — SPEC-234 · Padre v2 · Compilación técnica + Señal + Patrones N1 + Kit evidencia

## Prerequisitos

- Node.js >= 22
- PostgreSQL 16+ con pgvector (Docker: `docker compose up -d db`)
- Variables de entorno en `.env` (ver `.env.example`)
- SPEC-230 mergeado en `feature/001-scaffolding` (modelos `Expediente` / `EventoExpediente` y parámetros `padre.score.*` / `padre.patron.*`)

## Setup inicial

```bash
# 1. Instalar dependencias
npm install

# 2. Aplicar migraciones y regenerar cliente Prisma
npx prisma migrate dev
npx prisma generate

# 3. Seed de parámetros (incluye padre.senal_comunitaria.refresh_min)
npx prisma db seed
```

## Verificar la compilación

```bash
# Tests del dominio de compilación
npm run test -- src/lib/expediente/compilacion
npm run test -- src/lib/expediente/pdf
npm run test -- src/lib/dal/repositories/informe-consolidado.test.ts
npm run test -- src/lib/dal/repositories/senal-comunitaria.test.ts
npm run test -- src/lib/dal/repositories/patron-expediente.test.ts
npm run test -- src/lib/seed-senal-comunitaria.test.ts
npm run test -- src/app/api/publico/verificar-pdf
```

## Probar manualmente

```bash
# Generar un informe para un expediente existente
npx tsx -e "
  import { compilarExpediente } from './src/lib/expediente/compilacion/compilar-expediente';
  compilarExpediente('EXPEDIENTE_ID_AQUI').then(console.log).catch(console.error);
"

# Verificar un PDF por hash
curl http://localhost:5005/api/publico/verificar-pdf/HASH_AQUI
```

## Gate de calidad local

```bash
npx tsc --noEmit
npm run lint --no-cache
npm run arch:check
npm run test
npm run build
./scripts/dev-restart.sh
```

## Notas de infraestructura

- El volumen `pi_informes_storage` debe estar montado en `/data/informes` dentro del contenedor `pi-app`.
- El worker `pi-senal-comunitaria` arranca con `docker compose --env-file .env.production -f docker-compose.prod.yml up -d pi-senal-comunitaria`.
