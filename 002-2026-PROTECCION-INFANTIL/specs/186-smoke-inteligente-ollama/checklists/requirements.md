# Checklist de requisitos: SPEC-186

## Funcionales

- [ ] FR-001: probe `ollama_smoke` con 3 niveles ordenados (ping → piggyback → smoke real).
- [ ] FR-002: `ollama_ping` sigue cada `monitoreo.ollama.ping.intervalo_seg` sin cargar modelo.
- [ ] FR-003: piggyback consulta `ClasificacionIA` reciente y registra probe verde sin tocar Ollama.
- [ ] FR-004: smoke real solo si no hay piggyback y ya pasó `intervalo_min` desde el último smoke exitoso.
- [ ] FR-005: smoke real usa modelo vigente del motor (`ia.rubrica.modelos[0]`) y timeout configurado.
- [ ] FR-006: método de probe registrado de forma limpia (columna `metodo` o alternativa aprobada).
- [ ] FR-007: tablero muestra resumen 24h y historial de últimos 50 chequeos.
- [ ] FR-008: endpoint `/api/admin/monitoreo/historial` nuevo; `/api/admin/monitoreo/estado` conserva contrato.
- [ ] FR-009: seed siembra `piggyback_min=15` y resiembra `intervalo_min=30` aditivamente.
- [ ] FR-010: todo acceso a BD pasa por repositorios; `probes.ts`/`incidentes.ts` no importan prisma.
- [ ] FR-011: sin cambios en `src/lib/ai/**`.

## No funcionales / arquitectura

- [ ] Migración (si aplica) es aditiva y sin `DROP`.
- [ ] No se tocan índices HNSW/trgm ni índices existentes de forma destructiva.
- [ ] Sin acciones destructivas en el monitor.
- [ ] Advisory lock del monitor intacto.
- [ ] Cobertura I-51 conservada (caída total ≤1 min, degradación de clasificación ≤30 min).

## Tests

- [ ] Tests de `probeOllamaSmoke` (piggyback, smoke real, skip por intervalo).
- [ ] Tests de `MonitoreoRepository` (resumen 24h, historial, crearProbe con metodo).
- [ ] Tests de `ClasificacionIARepository` (ventana de clasificación).
- [ ] Tests de integración de `/api/admin/monitoreo/historial`.
- [ ] Tests unitarios del componente `OllamaSmokeHistorial`.
- [ ] Gate local verde: tsc, lint --no-cache, unit, integration, build.

## Documentación

- [ ] `spec.md` y `plan.md` actualizados con decisiones de compuerta.
- [ ] `tasks.md` refleja la opción elegida (columna vs detalle).
- [ ] `cierre.md` con evidencia (hash, PR, gate).
- [ ] `specs/README.md` actualizado (ambas tablas).
