# Checklist de requisitos — SPEC-234

## Modelos y migración

- [ ] Migración aditiva con `InformeConsolidado` (campos exactos del brief §7.3), `SenalComunitariaCache` (PK `identificadorReportado`, campos exactos del brief §7.6), `PatronExpediente`.
- [ ] Enum `TipoPatronExpediente` con 4 valores.
- [ ] Todos los `DateTime` usan `@db.Timestamptz(6)`.
- [ ] Cero `DROP`, `RENAME` o alteraciones destructivas.
- [ ] Relaciones inversas en `Expediente` solo si ZEUS ratifica.

## Seed

- [ ] Parámetro `padre.senal_comunitaria.refresh_min` INTEGER 60 sembrado con upsert.
- [ ] Test de idempotencia del seed.

## Repositorios DAL (Q-3)

- [ ] `informe-consolidado-repository.ts`
- [ ] `senal-comunitaria-repository.ts`
- [ ] `patron-expediente-repository.ts`
- [ ] Ningún endpoint/servicio importa `@/lib/prisma` directamente.

## Compilación

- [ ] `compilar-expediente.ts` orquestador.
- [ ] Query SQL de categorías (`agregar-categorias.ts`).
- [ ] Query SQL/Repository de señal comunitaria (`senal-comunitaria.ts`).
- [ ] 4 reglas N1 puras con tests sintéticos.
- [ ] `calcular-score.ts` con fórmula parametrizada.
- [ ] `renderizar-markdown.ts` con secciones §9.

## Kit evidencia PDF

- [ ] `generar-pdf.ts` con `pdfmake`.
- [ ] `pdfHash` reproducible (timestamp fijo + JSON con keys canónicas).
- [ ] Almacenamiento en `/data/informes/[expedienteId]-v[n].pdf`.
- [ ] Endpoint `GET /api/publico/verificar-pdf/[hash]` con rate-limit.

## Worker

- [ ] `scripts/worker-senal-comunitaria.mjs` con advisory lock.
- [ ] Servicio en `docker-compose.prod.yml` con `TZ=America/Bogota`.
- [ ] Refresco de caché ante invalidación.

## Privacidad (Ley 1581)

- [ ] `SenalComunitariaCache` almacena `identificadorReportado` (PK en claro según brief §7.6) pero no textos originales ni datos re-identificables.
- [ ] `PatronExpediente` no almacena identificador en claro ni textos.
- [ ] PDF y `resumenTextoGenerado` no contienen texto original ni PII.
- [ ] Test de esquema verifica ausencia de campos sensibles.

## Gate de calidad

- [ ] `npx tsc --noEmit` verde.
- [ ] `npm run lint --no-cache` verde.
- [ ] `npm run arch:check` verde.
- [ ] `npm run test` verde (salvo fallos preexistentes documentados).
- [ ] `npm run build` verde.

## Documentación

- [ ] `spec.md` con sección Implementación completada.
- [ ] `cierre.md` con evidencia de commits y gate.
- [ ] `docs/architecture/01-modelo-datos.md` regenerado.
