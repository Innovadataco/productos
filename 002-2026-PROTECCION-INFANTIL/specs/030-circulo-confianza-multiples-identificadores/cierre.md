# Cierre 030 — Rediseño del Círculo de Confianza

## Resumen

Se implementó la Spec 030: un contacto del Círculo de Confianza ahora representa una persona y puede tener múltiples identificadores. Cada identificador tiene valor, tipo opcional y plataforma opcional. La lógica de reportes busca por valor del identificador sin filtrar por plataforma, evitando alertas perdidas.

## Archivos principales modificados

- `prisma/schema.prisma`: nuevo modelo `ContactoConfianza` (etiqueta, nota, activo) y `IdentificadorContacto` (valor, tipo, plataforma opcional, activo). Relaciones actualizadas en `Usuario` y `Plataforma`.
- `prisma/migrations/20260719030000_circulo_confianza_multiples_identificadores/migration.sql`: migración con copia de datos desde el modelo anterior.
- `src/lib/circulo-confianza.ts`: refactor completo de la lógica de negocio (listar, agregar, actualizar, detalle, vista agregada, notificación).
- `src/app/api/circulo-confianza/route.ts`: POST ahora recibe `identificadores`.
- `src/app/api/circulo-confianza/[id]/route.ts`: PATCH permite editar `identificadores`.
- `src/app/dashboard/circulo-confianza/page.tsx`: formulario multi-identificador, detalle por contacto, uso de componentes del design system.
- `src/lib/circulo-confianza.test.ts`: tests actualizados al nuevo modelo, incluyendo el escenario obligatorio WhatsApp + Minecraft.
- `src/app/api/circulo-confianza/route.test.ts`: tests actualizados para el nuevo formato de POST/GET.
- `specs/030-circulo-confianza-multiples-identificadores/`: spec.md, plan.md, data-model.md, quickstart.md.

## Modelo y migración

La migración se aplicó a ambas bases: `proteccion_infantil` (desarrollo) y `proteccion_infantil_test` (tests). Se conservó el contacto existente:

- Se creó `IdentificadorContacto`.
- Se copiaron los valores de `identificador`/`plataformaId` desde `ContactoConfianza`.
- Se eliminaron las columnas `identificador` y `plataformaId` de `ContactoConfianza`.
- Se agregó la columna `nota` a `ContactoConfianza`.

## DECISIÓN PENDIENTE DE REVISIÓN

El entorno de ejecución no es interactivo, por lo que `prisma migrate dev` no pudo ejecutarse (la CLI lo rechaza explícitamente). Se generó la migración con `prisma migrate diff` y se aplicó con `prisma migrate deploy`. Esto cumple el objetivo de mantener un historial de migraciones versionado, pero debe ser revisado por el equipo si el flujo requiere `migrate dev` de forma estricta.

## Tests

- `npm test`: **370 tests passed** (72 archivos).
- `npm run lint`: sin errores (1 warning preexistente en `src/lib/sms.ts`).
- `npx tsc --noEmit`: sin errores.
- `npm run build`: build exitoso.
- `npx tsx scripts/smoke-e2e.ts`: **SMOKE TEST PASÓ**.

## Despliegue

- Rebuild limpio: `rm -rf .next && npm run build`.
- Procesos anteriores en `:5005` finalizados.
- App relanzada con `nohup npm run start` en `app-5005.log` (PID en `app.pid`).
- Worker relanzado con `nohup npm run worker` en `worker.log` (PID en `worker-supervisor.pid`).
- Servicio respondiendo en `http://localhost:5005`.

## Validación en vivo

- El smoke test E2E creó, procesó y consultó un reporte exitosamente en `:5005`.
- No se observaron errores de migración ni de tipos en la aplicación desplegada.

## Commits

Ver `git log feature/001-scaffolding` para los commits de esta tarea.
