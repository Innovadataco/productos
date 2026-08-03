# Quickstart: SPEC-145 — Verificación manual

**Spec**: [../spec.md](../spec.md) · Ejecutar tras implementar, antes del PR.

## 1. I-49 — Inspección del SQL (OBLIGATORIA antes de aplicar)

```bash
cat prisma/migrations/*modelo_profesor*/migration.sql
grep -iE "DROP INDEX|DROP TABLE|ALTER TYPE.*DROP" prisma/migrations/*modelo_profesor*/migration.sql
# → SIN resultados. Si aparece uno: PARA y reporta a ZEUS.
```

## 2. Reversibilidad (candado §7.4)

```bash
export PATH="$HOME/.local/bin:$PATH"
node --env-file=.env.test ./node_modules/prisma/build/index.js migrate reset --force
node --env-file=.env.test ./node_modules/prisma/build/index.js migrate deploy
node --env-file=.env.test ./node_modules/prisma/build/index.js db seed
# → todo se recrea; cursos preexistentes con profesorTitularId NULL
```

## 3. CRUD tenant A/B (FR-005/006)

```bash
# App levantada con ./scripts/dev-restart.sh; sesión SCHOOL_ADMIN colegio A:
curl -X POST localhost:5005/api/colegio/profesores -b cookiesA.txt \
  -H "Content-Type: application/json" -d '{"nombre":"María","apellidos":"López"}'
# → 201
curl -X POST localhost:5005/api/colegio/profesores -b cookiesA.txt \
  -H "Content-Type: application/json" -d '{"nombre":"María"}'
# → 400 "Falta el apellido del profesor"
curl localhost:5005/api/colegio/profesores -b cookiesA.txt        # → lo lista
curl localhost:5005/api/colegio/profesores/<id> -b cookiesB.txt   # → 404 (colegio B)
curl -X PATCH localhost:5005/api/colegio/profesores/<id> -b cookiesB.txt \
  -H "Content-Type: application/json" -d '{"estado":"inactivo"}'  # → 404 (colegio B)
curl -X PATCH localhost:5005/api/colegio/profesores/<id> -b cookiesA.txt \
  -H "Content-Type: application/json" -d '{"estado":"inactivo"}'  # → 200; la fila sigue en BD
psql "$DATABASE_URL" -c "SELECT estado FROM \"Profesor\" WHERE id='<id>';"  # → inactivo
```

## 4. Cargas O-1 / O-2

```bash
node --env-file=.env.test --import tsx ./node_modules/vitest/vitest.mjs run \
  src/components/ui/LuzAmbiental.test.tsx \
  "src/app/api/reportes/mis-reportes/[id]/route.test.ts"
# → verdes; fixture M1/M2 mayúscula; barrido amplio restaurado
```

## 5. Arch + tokens + gate

```bash
npm run arch:check    # VERDE con 01-modelo-datos.md regenerado (52 modelos)
npm run tokens:check  # sin subir del piso (1166)
npx tsc --noEmit && npm run lint && npm run test:coverage && npm run build && npm run arch:check
./scripts/dev-restart.sh
```
