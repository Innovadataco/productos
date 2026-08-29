# Tasks — Spec 103: Fix fuga de PII en seguimiento público (I-28)

- [x] T001 FR-1: quitar `piiDetectada` de la respuesta en `src/app/api/reportes/seguimiento/[numero]/route.ts` (conservar `contienePii`).
- [x] T002 FR-2: quitar `piiDetectada` del tipo de respuesta en `SeguimientoClient.tsx` y tipos compartidos.
- [x] T003 FR-3: barrido `piiDetectada` en `src/app/api/**` — documentar ocurrencias permitidas (procesar escribe BD; admin gateado) y corregir cualquier otra salida no-admin.
- [x] T004 FR-4: fail-closed para scopes `seguimiento` y `login` en `src/lib/rate-limit.ts` (resto de scopes intacto).
- [x] T005 [P] Test regresión `seguimiento/[numero]/route.test.ts`: respuesta sin `piiDetectada`, con `contienePii`.
- [x] T006 [P] Test fail-closed scope `seguimiento` en rate-limit.
- [x] T007 Gate: `npx tsc --noEmit` + `npm run lint` + `npm run test` + `npm run build`.
- [x] T008 `cierre.md` + actualizar `specs/README.md` + commit APARTE. **SIN DESPLEGAR** (deploy diferido al lote de release de ZEUS).
