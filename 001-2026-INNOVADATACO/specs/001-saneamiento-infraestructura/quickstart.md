# Quickstart — Validación del saneamiento de infraestructura

Guía de validación end-to-end para cuando la implementación esté aplicada.
Todos los comandos se ejecutan DESDE `001-2026-INNOVADATACO/`. Ningún comando
toca contenedores, volúmenes ni puertos de otros productos.

## Prerrequisitos

- Colima + docker compose operativos.
- `.env` creado a partir de `.env.example` (con la contraseña real). NO commitear.
- (Solo para el paso 6) Ollama corriendo en el host (`:11434`) y **turno de
  trabajo pesado aprobado por Jelkin** (ADR_002).

## 0. Snapshot de aislamiento (SC-003 / FR-009) — ANTES de cualquier cambio

```bash
lsof -nP -iTCP:5005 -iTCP:5433 -iTCP:5010 -iTCP:5434 -sTCP:LISTEN > /tmp/idc001-ports-pre.txt
docker ps --format '{{.Names}}\t{{.Ports}}' | grep -E "5005|5433|5010|5434" >> /tmp/idc001-ports-pre.txt || true
```

Repetir al final en `...-post.txt` y comparar con `diff` → debe ser idéntico.

## 1. Validación estática del compose (SC-001, FR-001/002/006/007)

```bash
docker compose config                          # debe validar sin errores
docker compose config | grep -A2 'published'   # db → 5435; app → 5001; nada más
docker compose config | grep DATABASE_URL      # app/worker → @db:5432 con credenciales de .env
docker compose config | grep OLLAMA_BASEURL    # default host.docker.internal:11434 (si .env lo deja vacío)
```

Fallo explícito sin `.env` (edge case):

```bash
mv .env /tmp/idc001-env-backup && docker compose config ; mv /tmp/idc001-env-backup .env
# Esperado: error "Definir POSTGRES_USER en .env" (o similar), NO una config con vacíos
```

Cero credenciales literales y `.env` fuera de git (SC-004, FR-005):

```bash
grep -nE "innova|idc_admin|password" docker-compose.yml   # sin matches de credenciales literales
git check-ignore .env && ! git ls-files | grep -x ".env"  # .env ignorado y no versionado
```

## 2. Levantar solo la BD (SC-002, US1)

```bash
docker compose up -d db
PGPASSWORD="$POSTGRES_PASSWORD" psql -h localhost -p 5435 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select 1;"
lsof -nP -iTCP:5432 -sTCP:LISTEN   # ningún proceso de ESTE proyecto en 5432
```

## 3. Stack completo (FR-007)

```bash
docker compose up -d --build
docker compose ps            # app, worker, db en running
docker compose logs worker | head -30   # worker conectado a pg-boss, sin errores de conexión
```

## 4. App accesible

```bash
curl -sf http://localhost:5001/ > /dev/null && echo "app OK en 5001"
```

## 5. Ollama alcanzable desde el contenedor (SC-005, US3)

```bash
docker compose exec app sh -c 'wget -qO- "$OLLAMA_BASEURL/api/tags" | head -c 200'
# Esperado: JSON de Ollama del host. (Petición de metadatos, no inferencia.)
```

> Nota H-01: aunque la variable funcione, la IA de la app usa el `baseUrl`
> guardado en BD. Hasta resolver la PREGUNTA PARA ZEUS (research.md D-07), en modo
> compose puede requerirse actualizar el baseUrl en Configuración.

## 6. Job end-to-end (SC-006) — ⚠️ REQUIERE TURNO APROBADO (ADR_002)

Con turno de Jelkin aprobado y Ollama arriba:

1. Login en `http://localhost:5001`, subir un PDF pequeño en Base Oficial.
2. `docker compose logs -f worker` → job `process-document` consumido.
3. Verificar transición `queued` → `processing` → estado final en la UI.

## 7. Snapshot post + cierre

```bash
lsof -nP -iTCP:5005 -iTCP:5433 -iTCP:5010 -iTCP:5434 -sTCP:LISTEN > /tmp/idc001-ports-post.txt
docker ps --format '{{.Names}}\t{{.Ports}}' | grep -E "5005|5433|5010|5434" >> /tmp/idc001-ports-post.txt || true
diff /tmp/idc001-ports-pre.txt /tmp/idc001-ports-post.txt && echo "SC-003 OK: PI y SICOV intactos"
```

Si cualquier paso falla por conflicto de puertos: **DETENERSE y reportar**
(AGENTS.md). Jamás liberar puertos matando procesos ajenos.
