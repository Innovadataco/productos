# Quickstart: SPEC-133 — journeys por rol

## Correr solo los journeys (local)

```bash
docker compose up -d db          # BD de test en :5433
npm run test:journeys            # solo src/lib/e2e/journeys/**
```

## Qué afirmar al añadir un caso

- Patrón SPEC-114: import del handler (`route.ts`), `Request` nativo, `entrarComo`,
  `sembrarBase`/`datosCiclo` en `beforeEach`.
- §9: no basta el 200 — afirma el efecto en BD (estado del reporte, AuditLog, fila creada).
- Negativos: afirma 403/404 exactos del handler, no del proxy.
- Nada de Ollama: si el flujo necesita un estado que hoy produce el motor, siémbralo.

## CI

El paso `Journeys por rol` del workflow `ci-002-proteccion-infantil` corre
`npm run test:journeys` después de la suite completa. Un journey roto falla ESE paso.

## Branch protection (ACCIÓN DEL CEO, no de ODIN)

GitHub → repo `Innovadataco/productos` → Settings → Branches → rule para
`feature/001-scaffolding`: activar **Require status checks to merge** y marcar el check
`gate` del workflow `ci-002-proteccion-infantil`. Sin ese paso el gate existe pero no
bloquea el merge por UI.
