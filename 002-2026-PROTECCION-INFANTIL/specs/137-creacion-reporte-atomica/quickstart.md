# Quickstart: SPEC-137 — creación atómica

## Regla de oro

Toda escritura que forma UNA invariante (reporte + agregado del identificador) va en
UNA `withUnitOfWork`. Los efectos externos (cola, emails, señales) van DESPUÉS del
commit, con reconciliación periódica como garantía de entrega.

## Probar localmente

```bash
# Carrera: dos creaciones concurrentes → una 201, una 429
node --env-file=.env.test --import tsx ./node_modules/vitest/vitest.mjs run src/app/api/reportes/route-atomicidad.test.ts
# Reconciliación: sembrar PENDIENTE sin job, correr reencolarPendientesSinJob()
node --env-file=.env.test --import tsx ./node_modules/vitest/vitest.mjs run src/lib/queue-reconciliacion.test.ts
```

## Operación

El worker corre `reportes-reconciliacion` cada 15 min. Si pg-boss estuvo caído, los
reportes huérfanos se re-encolan solos (ver `[QUEUE]` en logs del worker).
