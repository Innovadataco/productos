# Tasks · SPEC-815

- [x] **T1** · Fuente única `src/lib/mask-email.ts` (`maskEmail`, endurecida sin-`@` → `***`).
- [x] **T2** · Enmascarar correos en los 5 sitios de servidor (digest-semanal, apelacion-mantenimiento,
  circulo-confianza/notificaciones ×2, hijos/notificaciones, notificacion-spam).
- [x] **T3** · `identificador` → `reporte.id` en las líneas latentes (colegio/alertas, circulo
  notificaciones «omitida» + «Enviando alerta»).
- [x] **T4** · `logger.ts` serializa args Error (incl. anidados en objeto/arreglo plano) con
  `safeErrorMessage`; no toca objetos no-planos (Date/Map).
- [x] **T5** · ~21 interpolaciones de error crudo (`${err.message}`/`${String(err)}`) en emisión de
  servidor → `safeErrorMessage(err)`, uniforme. `safeErrorMessage` importado por ruta relativa en la cadena
  del worker (`incidentes.ts`), por `@/lib/errors` en el resto.
- [x] **T6** · Candado `emision-sin-pii-815.candado.test.ts`: (A) runtime @ `LOG_LEVEL=debug` + control
  doble; (B) lexer estático Rule-1 (PII) + Rule-2 (error crudo, `safeErrorMessage` verde). Registrado en
  `vitest.unit.includes.ts` (carril que BLOQUEA vía `pi-gate`). RED-first con violación multi-línea.

## Gate
- [x] `tsc --noEmit` = 0
- [x] `lint` = 0 errores (warnings pre-existentes: complejidad de `clasificarConRubrica`, no introducida)
- [x] candado @ debug VERDE + RED-first (plantado multi-línea con `(x=1)`) ROJO
- [x] `arch:check` VERDE (incl. (f) worker sin alias, (i) mask-email cableado)
- [ ] `test:unit` completo (preflight antes de abrir PR)

## Nota
- Las ~3 interpolaciones «fuera de PII» (rubrica/pagos/cita) se incluyeron igual: la uniformidad es lo que
  vuelve estructural la regla (exceptuarlas = allowlist = inventario).
