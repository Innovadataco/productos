# Tasks · SPEC-401 · I-283

**Status**: DESARROLLO
**Fecha**: 2026-09-03 · **Dev**: Infra (PI-2)

- [ ] T001 Análisis 15v5: leer `enviar-email.ts`, `procesar-lote.ts`, `inicio-admin.ts:senalCorreosFallidos`, `notificacion` repo, seed monitoreo; identificar callers directos y regex existente
- [ ] T002 `src/lib/notificaciones/motivo-error.ts` (helper puro + `EmailProveedorError`)
- [ ] T003 `src/lib/notificaciones/motivo-error.test.ts` (unit: sanitiza email/tokens, serializa, resume error Resend/Error/string/undefined, preserva "429"/"rate limit")
- [ ] T004 `enviar-email.ts`: sustituir `throw new Error(...)` por `throw new EmailProveedorError(resumen)`
- [ ] T005 `inicio-admin.ts`: nueva `senalProveedorEmailCaido` + registrarla en `calcularEstadoInicio`
- [ ] T006 `prisma/seed.ts`: parámetro `monitoreo.notif.proveedor_caido_ventana` = 10
- [ ] T007 `procesar-lote.test.ts`: nuevo caso "persiste motivo real en `ultimoError`"
- [ ] T008 `route.test.ts` inicio/senales: nuevo caso "10 FALLIDA seguidas → alta 'proveedor_caido'"
- [ ] T009 `tsc` limpio + `vitest run` verde local para los archivos tocados
- [ ] T010 Commit + push + PR + reportar al CEO idc-a6
