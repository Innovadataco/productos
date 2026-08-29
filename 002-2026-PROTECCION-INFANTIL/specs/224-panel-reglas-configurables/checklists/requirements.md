# Checklist de requisitos: SPEC-224

## User Stories

- [ ] US-1: Tabla del catálogo de reglas en `/dashboard/admin/analisis/reglas`.
  - [ ] Columnas: nombre, categoría, modo, frecuencia, activa, generadas 7d.
  - [ ] Orden por prioridad descendente; inactivas diferenciadas.
  - [ ] Activar/desactivar persiste y audita.
  - [ ] 403 para roles sin permiso.
- [ ] US-2: Editor con SQL preview y test en solo lectura.
  - [ ] Test devuelve columnas, muestra (máx param), duración.
  - [ ] Validador estático rechaza mutación y multi-sentencia (400).
  - [ ] `statement_timeout` aborta queries lentas.
  - [ ] Verificación de variables `{{...}}` de la plantilla (advertencia).
  - [ ] `REGLA_SQL_TEST` en AuditLog sin filas.
  - [ ] Validación repetida en servidor al guardar.
- [ ] US-3: Promoción RECOMIENDA → EJECUTA con confirmación fuerte (D-77).
  - [ ] Confirmación tipada `EJECUTA` + motivo ≥ 20 chars.
  - [ ] `REGLA_PROMOVIDA_EJECUTA` en AuditLog con valores y motivo.
  - [ ] Reversión con motivo → `REGLA_REVERTIDA_RECOMIENDA`.
  - [ ] EJECUTA sin `accionEjecutable` se comporta como RECOMIENDA.
  - [ ] API rechaza promoción sin confirmación/motivo (400).
- [ ] US-4: Versionado con historial.
  - [ ] Cada edición: snapshot en `ReglaRecomendacionHistorial` + `version+1` en TX.
  - [ ] Motivo obligatorio (≥ 10 chars) en edición.
  - [ ] `GET .../historial` ordenado descendente.
  - [ ] Historial de solo lectura (sin restauración automática v1).
- [ ] US-5: API protegida.
  - [ ] 401/403/400/409 según caso.
  - [ ] Paginación estándar `{ items, pagination }`.
  - [ ] Rate limit `admin_read`/`admin_write`.
  - [ ] Toda mutación en AuditLog.

## Functional Requirements

- [ ] FR-001: Página con tabla del catálogo.
- [ ] FR-002: Módulo `analisis_admin` en catálogo + permiso + `assertModulo`.
- [ ] FR-003: `GET /api/admin/analisis/reglas` paginado con conteo 7d.
- [ ] FR-004: POST/GET/PATCH con Zod y códigos canónicos.
- [ ] FR-005: `clave` única e inmutable (409 en duplicada).
- [ ] FR-006: `src/lib/analisis/reglas/validar-sql.ts` con fail-closed.
- [ ] FR-007: `POST .../test-sql` con TX `READ ONLY` + `statement_timeout` + `LIMIT` envolvente + audit sin filas.
- [ ] FR-008: Editor con preview, botón Probar, muestra y chequeo de variables.
- [ ] FR-009: `POST .../[id]/modo` con Zod discriminado y `z.literal("EJECUTA")`.
- [ ] FR-010: Versionado transaccional (snapshot + bump).
- [ ] FR-011: `GET .../[id]/historial` + vista Historial de solo lectura.
- [ ] FR-012: Acciones `REGLA_*` en AuditLog sin datos sensibles.
- [ ] FR-013: Seed idempotente de parámetros `analisis.reglas.*` y permiso.
- [ ] FR-014: Tests de validador, test-sql, CRUD, promoción, versionado, permisos.
- [ ] FR-015: Sistema visual heredado (vidrio, `ambar`, radios) y tono neutral sin voseo.

## Success Criteria

- [ ] SC-001: Crear + probar + guardar regla en < 5 min sin deploy.
- [ ] SC-002: 100% de queries de mutación/multi-sentencia rechazadas (≥ 10 casos en test).
- [ ] SC-003: Imposible escribir desde el test (TX READ ONLY verificada en integración) y timeout acotado.
- [ ] SC-004: Promoción siempre auditada; sin confirmación/motivo → 400 el 100%.
- [ ] SC-005: Versión + snapshot por edición; historial < 500 ms.
- [ ] SC-006: Gate I-101 verde y diff del lote limpio.

## Candados y restricciones

- [ ] NO se tocó `src/lib/ai/**`.
- [ ] NO se tocó el rate-limit del reporte público.
- [ ] NO se modificó el Motor de Notificaciones ni el worker de SPEC-221 (esta spec no evalúa reglas ni ejecuta acciones).
- [ ] Migraciones aditivas: cero `DROP`, cero destructivas.
- [ ] Sin PII de reportes en agregados ni en AuditLog del test SQL (Ley 1581).
- [ ] Lenguaje descriptivo/estadístico; sin veredictos sobre personas (presunción de inocencia).
- [ ] Terminología del brief §3 ("Regla", "Recomienda", "Ejecuta sola", "Sugerencia").
- [ ] Sin voseo en textos de UI.
- [ ] `$queryRawUnsafe` acotado al servicio de test-sql (excepción documentada en research §2.4).
- [ ] Timestamptz(6) en timestamps nuevos.
- [ ] Filtros Prisma tipados (`Prisma.ReglaRecomendacionWhereInput`), cero `any` nuevo.

## Dependencias externas

- [ ] SPEC-221 implementada en la rama (modelos + worker + reglas semilla).
- [ ] SPEC-220 implementada en la rama (parámetros `analisis.*` base).
