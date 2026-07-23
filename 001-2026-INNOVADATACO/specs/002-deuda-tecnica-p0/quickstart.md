# Quickstart — Verificación de la deuda técnica P0

Comandos de verificación de la spec 002. **Los números del baseline son los
criterios**: cada comando debe pasar de la columna "hoy" a la columna "objetivo".

Todos se ejecutan desde `001-2026-INNOVADATACO/`. Ninguno toca infraestructura de
otros productos.

## 0. Baseline (medido el 2026-07-22, antes de implementar)

```bash
# any en src/lib (sin tests)                        -> 5
grep -rnE ":\s*any\b|<any>|as any|\bany\[\]" src/lib --include="*.ts" | grep -v ".test.ts" | wc -l

# any en rutas API (sin tests)                      -> 29
grep -rnE ":\s*any\b|<any>|as any|\bany\[\]" src/app/api --include="*.ts" | grep -v ".test.ts" | wc -l

# archivos de ruta que filtran err.message          -> 13
grep -rln "err.message\|error.message" src/app/api --include="route.ts" | wc -l

# archivos de test de rutas API                     -> 3
find src/app/api -name "*.test.ts" | wc -l

# suite                                             -> 13 verdes, 1 archivo rojo
npm run test

# lint                                              -> 112 problemas (90 err + 22 warn)
npm run lint | tail -3
```

## 1. US1 — Harness (FR-001, FR-002, FR-003)

**Precondición del test honesto: los contenedores ABAJO.** Si la BD está arriba, un
test que abra conexión pasaría sin demostrar nada.

```bash
docker-compose down                     # asegurar que no hay BD disponible
npm run test                            # objetivo: exit 0, 0 archivos fallidos
npx vitest run src/app/api/auth/login/route.test.ts   # objetivo: verde
git ls-files .env.test                  # objetivo: versionado
grep -iE "innovadataco2026|[0-9a-f]{32}" .env.test    # objetivo: sin secretos reales
```

Prueba de aislamiento (la suite no debe depender del `.env` local):

```bash
mv .env /tmp/env-backup && npm run test ; mv /tmp/env-backup .env
# objetivo: verde igualmente
```

## 2. US2 — Contrato de errores (FR-004, FR-005, FR-006)

```bash
# Ninguna ruta devuelve el mensaje de excepción al cliente -> objetivo 0
grep -rn "err.message\|error.message" src/app/api --include="route.ts"
# (revisar caso por caso: las llamadas a auditLog SÍ pueden conservarlo — es log de servidor)

# El campo details desaparece del contrato                 -> objetivo 0
grep -rn "details:" src/app/api --include="route.ts" | wc -l

# Todas las rutas usan el helper
grep -rln "apiError" src/app/api --include="route.ts" | wc -l

npm run test    # los tests de contrato deben pasar
```

Verificación manual de una fuga (con el stack arriba y forzando un error):
la respuesta debe traer solo `{"error": "<mensaje legible>"}`, y el detalle técnico
debe aparecer en `docker-compose logs app`.

## 3. US3 — Tipado (FR-007, FR-008)

```bash
# objetivo: 0 y 0 (baseline 5 y 29)
grep -rnE ":\s*any\b|<any>|as any|\bany\[\]" src/lib --include="*.ts" | grep -v ".test.ts" | wc -l
grep -rnE ":\s*any\b|<any>|as any|\bany\[\]" src/app/api --include="*.ts" | grep -v ".test.ts" | wc -l

# filtros dinámicos de Prisma tipados (constitución §2.2)
grep -rn "WhereInput" src/app/api --include="route.ts"

npm run build   # objetivo: compila
npm run test    # objetivo: verde
npm run lint | tail -3          # objetivo: < 112 problemas
npm run lint 2>&1 | grep -c "no-explicit-any"   # objetivo: 0 en zonas saneadas
```

## 4. US4 — Cobertura (FR-009)

```bash
find src/app/api -name "*.test.ts" | wc -l      # objetivo: >= 15 (baseline 3)
find src/app/api -name "*.test.ts" | sort       # revisar los 5 módulos críticos
npm run test                                    # objetivo: verde, sin BD
```

Cobertura esperada por módulo: auth (2), licitaciones (4), documents (3),
config (9), research (1).

## 5. Cierre (FR-010, FR-011, FR-012)

```bash
# Sin regresión funcional: casos felices verdes
npm run test && npm run build

# Aislamiento multiproyecto: PI y SICOV intactos
lsof -nP -iTCP:5005 -iTCP:5433 -iTCP:5010 -iTCP:5434 -sTCP:LISTEN
docker ps --format '{{.Names}}' | grep -E "002-|003-"

# Solo archivos de 001 en el commit
git status --porcelain | grep -v "^.. 001-2026-INNOVADATACO/" || echo "OK: solo 001"
```

Reportar a ZEUS la tabla final baseline → resultado con los números reales, no solo
el cumplimiento del umbral (research.md → D-08).
