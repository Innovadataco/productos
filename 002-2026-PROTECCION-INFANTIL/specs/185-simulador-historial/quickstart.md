# Quickstart: SPEC-185 — Historial y sugerencias del simulador de abusos

## Setup previo

- Tener SPEC-184 desplegada (tabla `SimulacionAbusoRun`, worker `pi-simulador-abuso`, endpoints `/api/admin/anti-abuso/simular/*`).
- Variables de entorno: `ANTI_ABUSO_SALT`, `DATABASE_URL`, `API_BASE_URL`.
- Opcional: crear un usuario con rol `PARENT` para el escenario "Denunciante spam" y anotar su ID.

## Configurar usuario de prueba para denunciante spam

```bash
# Opción 1: seed (si se añade el parámetro en prisma/seed.ts)
npm run db:seed

# Opción 2: manual desde ConfigPanel o Prisma Studio
# Clave: simulacion.spam.usuario_id
# Valor: <id-del-usuario-PARENT-de-prueba>
```

Si se deja vacío, el escenario "Denunciante spam" requerirá que el admin seleccione manualmente un usuario PARENT antes de lanzar.

## Probar el flujo

1. Ir a `/dashboard/admin/anti-abuso` → tab "Simulador".
2. Seleccionar "Nueva corrida".
3. Elegir escenario "Robot inundando". El form debe autocompletar IP, identificador, N y plataforma.
4. Clic en "Refrescar sugerencia": IP e identificador cambian.
5. Lanzar la simulación.
6. Cambiar a tab "Historial": debe aparecer la corrida con estado `PENDIENTE` / `EN_PROGRESO`.
7. Esperar a que termine (puede tardar ~1.5 min/reporte por Ollama).
8. Clic en la fila: abre detalle con descripción en criollo y resultados.
9. Clic en "Repetir con nueva sugerencia": lanza otra corrida del mismo escenario con IPs frescas.

## Verificar bugfix I-64

```bash
# Correr backfill una sola vez tras deploy
node --env-file=.env --import tsx scripts/reparar-simulaciones-fechafin.mjs
```

Debe reportar cuántas corridas pasaron de `FALLIDA` a `COMPLETADA`.

## Comandos de gate local

```bash
npx tsc --noEmit
npm run lint -- --no-cache
npm run test:unit
npm run test:integration
npm run build
./scripts/dev-restart.sh
```
