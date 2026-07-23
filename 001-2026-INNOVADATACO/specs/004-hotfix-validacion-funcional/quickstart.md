# Quickstart — Verificación del hotfix de validación funcional

Comandos de verificación de la spec 004. **El stack está arriba y en uso por Jelkin: no
se baja en ningún paso.** Todo se ejecuta desde `001-2026-INNOVADATACO/`.

## 0. Baseline (medido el 2026-07-23, antes de implementar)

```bash
grep -c "11434" src/app/configuracion/page.tsx          # -> 3
grep -c "NODE_ENV" src/app/api/auth/login/route.ts      # -> 1
ls src/app/api/projects/                                 # -> solo route.ts
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5001/api/projects   # -> 200 (sin cookie)
```

Catálogos (solo lectura sobre la BD viva):

```bash
set -a; . ./.env; set +a
docker-compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
 'select (select count(*) from "AiModel"), (select count(*) from "AgentApi"),
         (select count(*) from "EntidadLicitacion"), (select count(*) from "LicitacionStatus");'
# -> 0|0|0|0
```

## 1. I-005 · Sesión (US1)

```bash
grep -rn "NODE_ENV" src/app/api/auth/        # objetivo: ninguna línea decide Secure
grep -n "AUTH_COOKIE_SECURE" .env.example    # objetivo: documentada
npx vitest run src/lib/authCookie.test.ts    # objetivo: verde
```

Comprobación real de la cabecera (con el stack ya reconstruido):

```bash
curl -si -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | grep -i "set-cookie"
# objetivo: SIN el atributo Secure (porque el .env local lo apaga)
```

**Verificación manual (SC-001)**: iniciar sesión en **Safari** por
`http://localhost:5001` y ejecutar después una acción autenticada. Baseline: "No
autenticado".

## 2. I-007 · Listado de proyectos (US4)

```bash
npx vitest run src/app/api/projects/route.test.ts     # objetivo: verde

curl -s -o /dev/null -w "sin cookie: %{http_code}\n" http://localhost:5001/api/projects
# objetivo: 401 (baseline 200)

curl -s -b cookies.txt -o /dev/null -w "con cookie: %{http_code}\n" http://localhost:5001/api/projects
# objetivo: 200
```

## 3. I-006 · Seed (US3)

```bash
npx prisma migrate deploy        # aplica el índice único de los catálogos
npm run seed                     # primera ejecución
npm run seed                     # segunda: debe informar que omite todo
```

Recuentos tras sembrar (objetivo: los cuatro > 0 e **iguales** entre ejecuciones):

```bash
set -a; . ./.env; set +a
docker-compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
 'select (select count(*) from "AiModel"), (select count(*) from "AgentApi"),
         (select count(*) from "EntidadLicitacion"), (select count(*) from "LicitacionStatus");'
```

**No destructivo (FR-009)**: desactivar una API desde la interfaz, volver a ejecutar
`npm run seed` y comprobar que **sigue desactivada**.

## 4. I-004 · Descubrir (US2)

```bash
grep -n "11434" src/app/configuracion/page.tsx   # objetivo: 1 sola línea (el placeholder)
```

**Verificación manual (SC-004)**: abrir Configuración → Modelos, comprobar que el campo
de URL está **vacío**, pulsar *Descubrir* y ver la lista de modelos del host. Baseline:
`fetch failed`.

## 5. Cierre

```bash
npm run test                     # >= 107 verdes, sin BD ni Ollama
npm run build                    # compila
npx eslint src/lib src/app/api | grep -c "no-explicit-any"   # -> 0

# Aislamiento y alcance
lsof -nP -iTCP:5005 -iTCP:5433 -iTCP:5010 -iTCP:5434 -sTCP:LISTEN
git diff --cached --name-only | grep -v "^001-2026-INNOVADATACO/" || echo "OK: solo 001"
git branch --show-current        # -> feature/001-scaffolding (NUNCA main)
```

## Recordatorio de alcance

Se observarán otras rutas `GET` sin `verifyAuth`. **No se tocan**: son I-008/I-009 y
pertenecen a la spec 005. Cerrarlas antes de que la sesión funcione dejaría la interfaz
entera en 401.
