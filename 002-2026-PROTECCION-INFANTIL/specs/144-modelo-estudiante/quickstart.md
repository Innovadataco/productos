# Quickstart: SPEC-144 — Verificación manual del rename + expansión

**Spec**: [../spec.md](../spec.md) · Ejecutar tras implementar, antes del PR.

## 1. Reversibilidad de la migración (candado §7.4)

```bash
export PATH="$HOME/.local/bin:$PATH"
cd 002-2026-PROTECCION-INFANTIL
# Sobre la BD de TEST (nunca sobre dev con datos reales):
node --env-file=.env.test ./node_modules/prisma/build/index.js migrate reset --force
node --env-file=.env.test ./node_modules/prisma/build/index.js migrate deploy
node --env-file=.env.test ./node_modules/prisma/build/index.js db seed
```

✔ Todo se recrea desde cero y el seed corre sin error.

## 2. El rename no tocó el físico

```bash
# En la BD migrada:
psql "$DATABASE_URL" -c '\d "Alumno"'          # tabla existe con su nombre original
psql "$DATABASE_URL" -c '\d "IdentificadorAlumno"'
psql "$DATABASE_URL" -c "SELECT enumlabel FROM pg_enum e
  JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='EtiquetaRelacionAlumno';"
# → incluye 'ALUMNO' (físico) aunque el código diga ESTUDIANTE
```

✔ Tablas `"Alumno"`/`"IdentificadorAlumno"` y enum `"EtiquetaRelacionAlumno"`
intactos; columnas nuevas `apellidos`, `documentoTipo`, `documentoNumero` presentes.

## 3. Backfill idempotente

```bash
psql "$DATABASE_URL" -c "SELECT count(*) FROM \"Alumno\" WHERE apellidos IS NULL;"
# → 0 (los existentes quedaron con '')
# Re-aplicar migrate deploy → "Already in sync" / no-op.
```

## 4. Cascada de código completa

```bash
grep -rn "Alumno\b" src/ --include="*.ts" --include="*.tsx" \
  | grep -v "@@map\|@map\|^\s*\*\|//"     # solo docstrings/comentarios permitidos
```

✔ Cero identificadores de producto con el nombre viejo (SC-003).

## 5. Contrato de alta (FR-010)

```bash
# App levantada con ./scripts/dev-restart.sh; sesión SCHOOL_ADMIN:
curl -X POST localhost:5005/api/colegio/cursos/<id>/alumnos \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{"nombre":"Ana"}'
# → 400 "Falta el apellido del estudiante"

curl -X POST localhost:5005/api/colegio/cursos/<id>/alumnos \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{"nombre":"Ana","apellidos":"Pérez Torres"}'
# → 201
```

## 6. Tenant A/B (FR-009)

Con dos colegios (A y B) sembrados: el id de un curso de A consultado con sesión de B
→ 404 en GET y POST de `cursos/[id]/alumnos` (los route.test.ts A/B lo cubren).

## 7. Gate completo

```bash
npx tsc --noEmit && npm run lint && npm run test:coverage && npm run build && npm run arch:check
./scripts/dev-restart.sh
```

✔ Todo verde; `docs/architecture/01-modelo-datos.md` regenerado en el mismo PR.
