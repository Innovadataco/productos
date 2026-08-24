# Checklist de requisitos: SPEC-226

## User Stories

- [ ] US-1: Ejecutor automático para reglas modo EJECUTA.
  - [ ] `ejecutarAccion(recomendacionId)` invocado por el worker de SPEC-221.
  - [ ] Regla `RECOMIENDA` nunca ejecuta automáticamente.
  - [ ] Acción desconocida o fallida → `EjecucionAccion(FALLIDA)` + `AuditLog`, sin perder la recomendación.
  - [ ] Fallo aislado no detiene el tick del worker.
  - [ ] TX única para acción + trazabilidad; notificaciones post-TX fail-open.
- [ ] US-2: Acción `crear_bono`.
  - [ ] Crea `BonoPromocional` vía repositorio de pagos existente.
  - [ ] Vigencia en `America/Bogota`, nombre único trazable, `creadoPorAdminId = regla.creadaPorAdminId`.
  - [ ] Parámetros inválidos → FALLIDA sin crear nada.
  - [ ] Rollback → `activo = false` (sin tocar usos previos).
- [ ] US-3: Acciones `enviar_notificacion` y `crear_alerta`.
  - [ ] Solo `programar()`/`cancelar()` del Motor Notif.
  - [ ] `programadas = 0` no es fallo.
  - [ ] `crear_alerta` emite evento `analisis.alerta.admin` con severidad y enlace al panel.
  - [ ] Rollback de notificación futura → `cancelar()`.
- [ ] US-4: Acción `asignar_operador`.
  - [ ] `operadorId` explícito o estrategia `menor_carga`.
  - [ ] Sin operadores → FALLIDA `sin_operadores_disponibles`.
  - [ ] Notifica al operador; rollback desasigna y notifica.
  - [ ] NO reutiliza `asignarOperadorAReporte`.
- [ ] US-5: Rate-limit por regla y rollback manual.
  - [ ] Scope `analisis_accion`, identifier = reglaId, parametrizable.
  - [ ] Rechazo sin efectos colaterales, motivo `rate_limit_regla`.
  - [ ] `POST .../revertir` ejecuta rollback por tipo + `AuditLog`.
  - [ ] Segunda reversión → 409.
  - [ ] `POST .../aplicar` ejecuta por el mismo ejecutor y marca `APLICADA`.

## Functional Requirements

- [ ] FR-001: `src/lib/analisis/acciones/ejecutor.ts` implementado.
- [ ] FR-002: Registry con 4 handlers; tipo desconocido → FALLIDA.
- [ ] FR-003: Handler `CREAR_BONO` con Zod, vigencia Bogotá, nombre trazable.
- [ ] FR-004: Handler `ENVIAR_NOTIFICACION` solo vía `programar()`.
- [ ] FR-005: Handler `CREAR_ALERTA` con evento `analisis.alerta.admin` y destinatarios parametrizables.
- [ ] FR-006: Handler `ASIGNAR_OPERADOR` sin reutilizar el asignador de reportes.
- [ ] FR-007: Tabla `EjecucionAccion` + enums + índices (migración aditiva).
- [ ] FR-008: `AuditLog` con regla origen en toda ejecución/fallo/reversión; valores `AccionAudit` aditivos.
- [ ] FR-009: Rate-limit por regla con scope `analisis_accion`.
- [ ] FR-010/011: Endpoints `aplicar`/`revertir` operativos.
- [ ] FR-012: Zod + `verifyAuth("ADMIN")` + rate-limit admin + códigos canónicos.
- [ ] FR-013: Worker SPEC-221 invoca el ejecutor; fallo aislado.
- [ ] FR-014: Seed idempotente de parámetros + eventos/plantillas.
- [ ] FR-015: TX para mutación + trazabilidad; Motor Notif post-TX.
- [ ] FR-016: Tests de handlers, rate-limit, rollback, seed, endpoints, fallo aislado, frontera horaria.
- [ ] FR-017: Candados: `src/lib/ai/**`, rate-limit reporte público, Motor Notif y bonos sin cambios de código.

## Success Criteria

- [ ] SC-001: Ejecución < 500 ms con trazabilidad consistente.
- [ ] SC-002: 100% de excesos de rate-limit rechazados sin efectos colaterales.
- [ ] SC-003: Rollback efectivo por tipo; segunda reversión 409.
- [ ] SC-004: Fallo aislado no detiene el tick.
- [ ] SC-005: 100% de ejecuciones automáticas en `AuditLog` con `reglaId`.
- [ ] SC-006: Vigencia de bono correcta en frontera 23:59/00:01 Bogotá.
- [ ] SC-007: Seed idempotente.
- [ ] SC-008: Gate local verde (tsc + lint + test:unit + build).

## Candados y restricciones

- [ ] NO se modificó `src/lib/ai/**`.
- [ ] NO se modificó el rate-limit del reporte público.
- [ ] NO se modificó código del Motor Notificaciones (solo API pública + upserts de catálogo).
- [ ] NO se modificó el módulo Pagos/Bonos (solo consumo del repositorio).
- [ ] Migraciones 100% aditivas (cero DROP, cero destructivas).
- [ ] Sin PII de reportes en `parametros`/`resultado`/`AuditLog` (Ley 1581).
- [ ] Sin IA en la ejecución de acciones (reglas determinísticas).
- [ ] Terminología criolla del brief §3 respetada (regla, sugerencia, "Ejecuta sola").
- [ ] Textos de UI en tono neutral, sin voseo.
- [ ] Timestamptz(6) en campos nuevos.
- [ ] NO se implementó panel de reglas (SPEC-224) ni historial con métricas (SPEC-227).

## Dependencias externas

- [ ] SPEC-221 (modelo reglas + worker) integrado en la rama antes de implementar.
- [ ] SPEC-216 (Bonos) y Motor Notif (SPEC-201..204) disponibles en prod.
