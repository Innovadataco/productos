# Plan — Spec 041: Cierre de blindaje + saneamiento

## Fase 1: Verificación y análisis

- P1.1 Ejecutar `npm run db:verify:hnsw` y confirmar índices.
- P1.2 Revisar `package.json` y `scripts/*` para confirmar que no hay `migrate dev`/`reset`/`db push`.
- P1.3 Revisar `src/app/api/reportes/procesar/route.ts` y `src/app/api/reportes/fallback/route.ts` para identificar donde se persiste `processingError` con mensaje crudo.
- P1.4 Revisar tests de `fallback` para actualizar expectativas.

## Fase 2: Implementación por User Story

- P2.1 **US1**: Confirmar que `npm run db:verify:hnsw` pasa y documentar resultado en `cierre.md`. Sin cambios de código si ya está OK.
- P2.2 **US1**: Documentar en `AGENTS.md` y/o `cierre.md` que `prisma migrate deploy` es el único método permitido.
- P2.3 **US2**: En `procesar/route.ts`, cambiar `processingError: errMsg` por mensaje genérico con `errorCode`.
- P2.4 **US2**: En `fallback/route.ts`, cambiar `processingError` y `motivo` por mensajes genéricos y metadatos con `errorCode`; aceptar `errorCode` opcional en el body.
- P2.5 **US2**: Actualizar `fallback/route.test.ts` para esperar mensaje genérico.

## Fase 3: Tests y validación

- P3.1 Ejecutar `npm run db:verify:hnsw`.
- P3.2 Ejecutar `npx tsc --noEmit`, `npm run lint`, `npm run test`.
- P3.3 Ejecutar tests específicos de `procesar` y `fallback`.
- P3.4 Ejecutar `rm -rf .next && npm run build`.
- P3.5 Ejecutar `./scripts/dev-restart.sh` y healthcheck.

## Fase 4: Cierre

- P4.1 Actualizar `spec.md` con sección Implementación.
- P4.2 Crear `docs/cierre-041.md`.
- P4.3 Validar checklist de requisitos.
- P4.4 Commits: uno por US + uno de docs; push a `feature/001-scaffolding`.
- P4.5 Deploy limpio y pruebas con `quickstart.md`.
