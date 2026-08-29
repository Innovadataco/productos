# Quickstart: SPEC-192 — UX del simulador anti-abuso

## Prerrequisitos

- Docker con Postgres corriendo (`docker compose up -d db`).
- Node 22+ configurado (`export PATH="$HOME/.hermes/node/bin:$PATH"`).
- Variables de entorno en `.env` y `.env.test`.

## Pasos para probar

1. Aplicar migración:
   ```bash
   npx prisma migrate dev
   ```

2. Correr seed si es necesario:
   ```bash
   npx prisma db seed
   ```

3. Levantar app y worker:
   ```bash
   ./scripts/dev-restart.sh
   ```

4. Ir a `/dashboard/admin/anti-abuso` → tab "Simulador".

5. Probar cada fix:
   - Cambiar de escenario: el detalle anterior debe desaparecer.
   - Lanzar dos escenarios seguidos: el segundo no debe bloquearse por fingerprint.
   - Plataforma: debe ser un dropdown con las plataformas del sistema.
   - Llenar identificador + identificadores: debe usar el array.
   - Ver historial: primera columna debe mostrar label legible.
   - Añadir nota interna y verificar que persiste.
   - Tras completar, el botón "Iniciar simulación" debe habilitarse.

## Verificación de bypass fingerprint

```bash
curl -X POST http://localhost:5005/api/reportes \
  -H "Content-Type: application/json" \
  -H "x-simulacion: true" \
  -b "token=<JWT_ADMIN>" \
  -d '{"identificador":"3000000001","plataforma":"whatsapp","texto":"Reporte de prueba del simulador"}'
```

Repitiendo 6 veces no debe devolver 429 por fingerprint (pero sí respetar `report_identificador`).
