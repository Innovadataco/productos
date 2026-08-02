# Quickstart: SPEC-139 — evento de match (F5)

> Spec en compuerta §4 (PLANEADO): esta guía describe cómo se probará la feature
> una vez implementada. Hasta entonces los comandos de test no existen.

## Qué es un match

Dos personas que no se conocen reportan el mismo identificador (misma plataforma)
y ambos reportes quedan APROBADOS (D-08: CLASIFICADO/CORREGIDO, categoría ∉
{SPAM, OTRO}, no eliminado). El segundo reporte dispara un `EventoMatch` con el
conteo de fuentes independientes, las ciudades y las conductas coincidentes.

## Cómo se dispara

Automático: el worker procesa el reporte y, tras el estado final, un post-hook
fire-and-forget (`worker-reportes.mjs`, junto a los hooks de círculo y colegio)
llama a `detectarYRegistrarMatch(reporteId)`. Fail-open: un error del hook se
loguea y no afecta el reporte.

## Probar de punta a punta (manual, dev)

1. Levantar el entorno: `docker compose up -d db`, `./scripts/dev-restart.sh`.
2. Crear el escenario (seed o UI):
   - Reporte 1 (usuario autenticado A, ciudad X) sobre el identificador `+57…` →
     que quede CLASIFICADO con categoría de riesgo.
   - Reporte 2 (anónimo desde otra fuente, ciudad Y) sobre el MISMO
     identificador+plataforma → CLASIFICADO con la misma categoría.
3. Verificar en BD: existe UN `EventoMatch` con `conteoAcumulado = 2`,
   `ciudades = {X, Y}`, `interCiudad = true`, `conductasCoincidentes` con la
   categoría común.
4. Verificar superficies:
   - `GET /api/estadisticas-publicas` incluye `identificadoresConMatch ≥ 1`.
   - `GET /api/admin/eventos-match` (admin) lista el evento con detalle, sin
     `usuarioId` ni huellas ni textos.
   - La bandeja del comité muestra el evento como prioritario (inter-ciudad).
5. Negativos: repetir el reporte 2 con el MISMO usuario A → no hay evento nuevo;
   reencolar el mismo reporte (reintento del worker) → sigue habiendo un solo
   evento.

## Tests

```bash
node --env-file=.env.test --import tsx ./node_modules/vitest/vitest.mjs run src/lib/dal/services/evento-match.test.ts
```
