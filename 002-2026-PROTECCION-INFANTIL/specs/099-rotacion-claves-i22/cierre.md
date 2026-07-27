# Cierre — Spec 099: Rotación de claves filtradas + regla no-secretos (I-22)

**Fecha**: 2026-07-27 · **Rama**: `feature/001-scaffolding`

## Lo hecho

1. **Rotación (FR-001)**: `ENCRYPTION_KEY` y `PARAM_ENCRYPTION_KEY` de producción reemplazadas
   por valores nuevos generados con `openssl rand -base64 32` **en el propio VPS** — los valores
   nunca pasaron por el chat ni por git. Entrega al CEO por canal seguro: archivo local fuera
   de git con permisos 600 (`~/Documents/SECRETOS-CEO/pi-claves-prod-rotacion-2026-07-27.txt`
   en la Mac) para mover a su gestor y borrar; en el VPS el temporal se eliminó tras la copia.
2. **BD re-sembrada limpia (FR-002)**: `docker compose down -v` (volumen `pi_postgres_data`
   eliminado — solo había datos de prueba, incluido el reporte E2E del 097) + `up` +
   `migrate deploy` (50 migraciones) + `db seed`. Lo cifrado con las claves viejas dejó de
   existir; las claves viejas están **muertas**.
3. **Scrub (FR-003)**: `specs/097-despliegue-hibrido-produccion/cierre.md` ya no contiene
   ningún valor; queda el puntero al `INVENTARIO-DE-SECRETOS.md` (repo de gestión) y la nota
   de que las claves originales fueron rotadas. Commit `58b2237b` (pusheado).
4. **Historial de git (FR-004) — decisión**: NO se reescribió. Los valores viven solo en el
   blob de `b9295f29` (un archivo). Reescribir exige force-push de `feature/001-scaffolding`,
   rama compartida donde trabajan otros frentes (001-INNOVADATACO): les rompería sus clones
   por un beneficio nulo — las claves ya no sirven (rotadas, BD limpia). Queda registrado en
   el INVENTARIO-DE-SECRETOS (v1.2) para que ZEUS decida si filtra el blob al liberar a `main`.
5. **Regla dura (FR-005)**: agregada a `AGENTS.md` §Seguridad: nunca valores de secretos en
   commits/cierres/specs/docs/chat; siempre puntero al inventario; valores solo en `.env`
   (fuera de git) + gestor del CEO. Misma regla quedó registrada en el inventario (v1.2).

## Verificación

- `git grep` de ambos valores en el árbol de trabajo: **0 coincidencias** (solo existen en la
  historia, commit `b9295f29`, decisión documentada arriba).
- **E2E con claves nuevas**: reporte `RPT-E0HH36` creado en https://pi.innovadataco.com →
  cifrado al insertar (nueva `PARAM_ENCRYPTION_KEY`) → worker → Ollama Mac (tailnet) →
  descifrado y clasificado `SOLICITUD_MATERIAL` (confianza 1.0) en 33 s. Cifra y descifra OK.
- Healthcheck prod: `{"status":"ok","workerAlive":true,"dbOk":true}`.
- Gate en la Mac: ver abajo.

## Pendientes

- ZEUS: decidir filtrado del blob `b9295f29` al liberar a `main` (registrado en inventario).
- CEO: mover las claves del archivo local a su gestor y borrar el archivo.
- El reporte `RPT-E0HH36` (de verificación) queda en prod; borrable.

## Deuda

- Ninguna nueva. (Se mantiene la del 097: `ENCRYPTION_KEY` sin consumidor en el código.)
