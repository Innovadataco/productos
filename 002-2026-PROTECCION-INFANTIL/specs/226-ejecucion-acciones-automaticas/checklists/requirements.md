# Checklist de requisitos: SPEC-226

Estado tras implementación (2026-08-24): código completo, 24/24 tests unitarios
en verde, `tsc --noEmit` limpio en archivos propios. Los tests de integración
están escritos bajo `src/**` pero los corre el coordinador (BD compartida);
los SC medibles quedan pendientes de ese gate.

## User Stories

- [x] US-1: Ejecutor automático para reglas modo EJECUTA.
  - [x] `ejecutarAccion(recomendacionId)` invocado por el worker de SPEC-221 (hook en `evaluarRegla`).
  - [x] Regla `RECOMIENDA` nunca ejecuta automáticamente (FALLIDA `modo_no_ejecuta`).
  - [x] Acción desconocida o fallida → `EjecucionAccion(FALLIDA)` + `AuditLog`, sin perder la recomendación.
  - [x] Fallo aislado no detiene el tick del worker (ejecutor nunca lanza + try/catch en el motor).
  - [x] TX única para acción + trazabilidad; notificaciones post-TX fail-open.
- [x] US-2: Acción `crear_bono`.
  - [x] Crea `BonoPromocional` vía `PagosRepository.crearBonoPromocional`.
  - [x] Vigencia en `America/Bogota`, nombre único trazable, `creadoPorAdminId = regla.creadaPorAdminId`.
  - [x] Parámetros inválidos → FALLIDA sin crear nada.
  - [x] Rollback → `activo = false` (sin tocar usos previos; detalle "bono con usos: solo desactivado").
- [x] US-3: Acciones `enviar_notificacion` y `crear_alerta`.
  - [x] Solo `programar()`/`cancelar()` del Motor Notif.
  - [x] `programadas = 0` no es fallo (EJECUTADA con warning en log).
  - [x] `crear_alerta` emite evento `analisis.alerta.admin` con severidad y enlace al panel.
  - [x] Rollback de notificación futura → `cancelar()`; ya enviada → "no reversible (ya enviada)".
- [x] US-4: Acción `asignar_operador`.
  - [x] `operadorId` explícito o estrategia `menor_carga`.
  - [x] Sin operadores → FALLIDA `sin_operadores_disponibles`.
  - [x] Notifica al operador; rollback desasigna y notifica.
  - [x] NO reutiliza `asignarOperadorAReporte`.
- [x] US-5: Rate-limit por regla y rollback manual.
  - [x] Scope `analisis_accion`, identifier = reglaId, parametrizable.
  - [x] Rechazo sin efectos colaterales, motivo `rate_limit_regla`.
  - [x] `POST .../revertir` ejecuta rollback por tipo + `AuditLog`.
  - [x] Segunda reversión → 409.
  - [x] `POST .../aplicar` ejecuta por el mismo ejecutor y marca `APLICADA`.

## Functional Requirements

- [x] FR-001: `src/lib/analisis/acciones/ejecutor.ts` implementado.
- [x] FR-002: Registry con 4 handlers; tipo desconocido → FALLIDA.
- [x] FR-003: Handler `CREAR_BONO` con Zod, vigencia Bogotá, nombre trazable.
- [x] FR-004: Handler `ENVIAR_NOTIFICACION` solo vía `programar()`.
- [x] FR-005: Handler `CREAR_ALERTA` con evento `analisis.alerta.admin` y destinatarios parametrizables.
- [x] FR-006: Handler `ASIGNAR_OPERADOR` sin reutilizar el asignador de reportes.
- [x] FR-007: Tabla `EjecucionAccion` + enums + índices (migración aditiva `20260824160000`).
- [x] FR-008: `AuditLog` con regla origen en toda ejecución/fallo/reversión; valores `AccionAudit` aditivos.
- [x] FR-009: Rate-limit por regla con scope `analisis_accion`.
- [x] FR-010/011: Endpoints `aplicar`/`revertir` operativos.
- [x] FR-012: Zod + `verifyAuth("ADMIN")` + rate-limit admin + códigos canónicos.
- [x] FR-013: Worker SPEC-221 invoca el ejecutor (hook en `motor.ts`); fallo aislado.
- [x] FR-014: Seed idempotente de parámetros + eventos/plantillas.
- [x] FR-015: TX para mutación + trazabilidad; Motor Notif post-TX.
- [x] FR-016: Tests de handlers (unitarios), rate-limit, rollback, endpoints, fallo aislado (integración escritos), frontera horaria (unitario, verde). Idempotencia de seed: patrón `update: {}`/upsert igual que SPEC-223/225.
- [x] FR-017: Candados: `src/lib/ai/**`, rate-limit reporte público, Motor Notif y bonos sin cambios de código.

## Success Criteria

- [ ] SC-001: Ejecución < 500 ms con trazabilidad consistente. *(pendiente gate con BD — coordinador)*
- [ ] SC-002: 100% de excesos de rate-limit rechazados sin efectos colaterales. *(test de integración escrito; pendiente corrida)*
- [ ] SC-003: Rollback efectivo por tipo; segunda reversión 409. *(tests de integración escritos; pendiente corrida)*
- [ ] SC-004: Fallo aislado no detiene el tick. *(test de integración escrito; pendiente corrida)*
- [ ] SC-005: 100% de ejecuciones automáticas en `AuditLog` con `reglaId`. *(test de integración escrito; pendiente corrida)*
- [x] SC-006: Vigencia de bono correcta en frontera 23:59/00:01 Bogotá. *(unitario, verde)*
- [ ] SC-007: Seed idempotente. *(patrón idempotente; verificación de doble corrida en quickstart — coordinador)*
- [ ] SC-008: Gate local verde (tsc + lint + test:unit + build). *(tsc + test:unit propios verdes; lint/build completos en gate del coordinador)*

## Candados y restricciones

- [x] NO se modificó `src/lib/ai/**`.
- [x] NO se modificó el rate-limit del reporte público.
- [x] NO se modificó código del Motor Notificaciones (solo API pública + upserts de catálogo).
- [x] NO se modificó el módulo Pagos/Bonos (solo consumo del repositorio).
- [x] Migraciones 100% aditivas (cero DROP, cero destructivas).
- [x] Sin PII de reportes en `parametros`/`resultado`/`AuditLog` (Ley 1581).
- [x] Sin IA en la ejecución de acciones (reglas determinísticas).
- [x] Terminología criolla del brief §3 respetada (regla, sugerencia, "Ejecuta sola").
- [x] Textos de UI en tono neutral, sin voseo (sin UI nueva en esta spec).
- [x] Timestamptz(6) en campos nuevos.
- [x] NO se implementó panel de reglas (SPEC-224) ni historial con métricas (SPEC-227).

## Dependencias externas

- [x] SPEC-221 (modelo reglas + worker) integrado en la rama antes de implementar.
- [x] SPEC-216 (Bonos) y Motor Notif (SPEC-201..204) disponibles en prod.
