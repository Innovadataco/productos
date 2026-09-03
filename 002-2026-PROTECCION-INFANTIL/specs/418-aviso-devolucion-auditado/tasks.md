# Tareas · SPEC-418 — El aviso de devolución al profesional no se pierde

- [x] T001 Verificar en fuente que el worker hace polling de la tabla (`worker-notificaciones.mjs:207`, `procesar-lote.ts:173`) — es lo que permite despachar fuera de la transacción sin riesgo de perder el aviso.
- [x] T002 `motor.ts`: `programar(input, { tx })` con repositorios armados sobre la transacción; `ProgramarResult.envios` (opcional) y `despacharEnvios()`. Sin `tx`, conducta idéntica a la de siempre.
- [x] T003 `notificaciones/index.ts`: exportar `despacharEnvios`, `ProgramarOpciones` y `EnvioPendiente`.
- [x] T004 `prisma/seed.ts`: `seedVerificacionProfesional()` — plantilla + regla `obligatoria` por evento (`aprobada`, `devuelta`), idempotente.
- [x] T005 `verificador/service.ts`: el aviso se encola dentro de la transacción; falla en cerrado si no hay regla; `despacharEnvios` después del commit; se elimina `enviarEmailProfesional` (código muerto).
- [x] T006 `decidir/route.test.ts` (4) contra BD real: fila encolada en devolución y en aprobación, y atomicidad — sin regla, ni decisión ni aviso.
- [x] T007 `service.aviso.test.ts` (13) candados estáticos, ignorando comentarios, con contraprueba.
- [x] T008 **Prueba negativa**: simular la conducta vieja → 3 de 4 tests caen con «sin fila, el aviso se perdió». El cuarto pasa, y por eso está anotado en la spec.
- [x] T009 `scripts/verify-reglas-notificacion.ts` + `npm run reglas:check` + paso en `deploy-prod.sh` después del seed (pedido del CEO 18:1x). Probado en sus tres estados: sin seed → rojo; con seed → verde; plantilla desactivada → rojo.
- [x] T010 Gate (`tsc`, `lint`, `tokens:check`, 2.242 unitarios) + seed ejecutado de verdad + fila en `specs/README.md` + PR.

## Anotado para el CEO

- El radicado decía «como el resto del motor»: **ningún otro llamador programa dentro de una transacción**. Esta spec estrena el camino; migrar los demás es decisión suya.
