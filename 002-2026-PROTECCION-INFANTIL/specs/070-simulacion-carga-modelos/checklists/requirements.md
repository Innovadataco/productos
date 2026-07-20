# Checklist: Simulación de carga y comparación de modelos (Spec 070)

## Requisitos funcionales

- [ ] FR-001: Carga de archivo CSV/JSON con validación.
- [ ] FR-002: Estructura de caso con texto, plataforma, identificador y categoría esperada opcional.
- [ ] FR-003: Tope máximo de casos por corrida (propuesto 200).
- [ ] FR-004: Errores de validación por línea/índice con mensaje claro.
- [ ] FR-005: Selector de modelo Ollama local.
- [ ] FR-006: Lanzamiento de casos al pipeline real de reportes anónimos.
- [ ] FR-007: Estados de corrida y control de corrida única en progreso.
- [ ] FR-008: Monitoreo en vivo con progreso, tiempo transcurrido y estado.
- [ ] FR-009: Cancelación de corrida en progreso.
- [ ] FR-010: Resultados por caso: categoría, confianza, estado, latencia, acierto.
- [ ] FR-011: Métricas agregadas: aciertos, precisión/recall, matriz, falsos negativos, p50/p95.
- [ ] FR-012: Comparación de dos corridas lado a lado.
- [ ] FR-013: Exportación a CSV y JSON.
- [ ] FR-014: Persistencia en `SimulacionRun` y `SimulacionReporte` sin modificar `Reporte`.
- [ ] FR-015: Reutilización del patrón visual del Laboratorio.

## Criterios de éxito

- [ ] SC-001: Archivo de 200 casos validado en < 5 segundos.
- [ ] SC-002: 100% de errores reportados por línea/índice.
- [ ] SC-003: Pipeline real invocado para cada caso.
- [ ] SC-004: Progreso actualizado en vivo.
- [ ] SC-005: Métricas calculadas correctamente cuando hay categorías esperadas.
- [ ] SC-006: Comparación de corridas por índice de caso y resumen.
- [ ] SC-007: Exportación CSV/JSON completa.
- [ ] SC-008: Patrón visual del Laboratorio replicado.
- [ ] SC-009: Tests de integración Vitest para todos los endpoints nuevos.
- [ ] SC-010: Modelo `Reporte` no modificado.

## Validación manual

- [ ] Admin puede cargar archivo CSV/JSON válido.
- [ ] Admin ve errores por línea si el archivo es inválido.
- [ ] Admin selecciona modelo y lanza simulación.
- [ ] Progreso se actualiza en vivo.
- [ ] Cancelar corrida funciona.
- [ ] Resultados por caso se muestran tras finalizar.
- [ ] Análisis agregado muestra aciertos, precisión/recall, matriz, falsos negativos, p50/p95.
- [ ] Comparación de dos corridas funciona.
- [ ] Exportación CSV/JSON funciona.
- [ ] Tabla "Simulación" es la 4ª pestaña de `/dashboard/admin/ia?tab=eval`.

## Seguridad e higiene

- [ ] Migraciones aditivas, no destructivas.
- [ ] No se modifica `Reporte`.
- [ ] No se toca `SPEC-050` ni `SPEC-060`.
- [ ] Endpoint accesible solo para `ADMIN`.
- [ ] Datos de simulación marcados como descartables (prefijo SIM-, origen SIMULACION).
- [ ] Un solo worker; no se crea worker adicional.
- [ ] `DISABLE_RATE_LIMIT=true` en dev para simulaciones.

## Reglas de oro (al cerrar)

- [ ] Spec-Kit completo: spec, plan, research, data-model, quickstart, tasks, checklists, contracts.
- [ ] Commit por User Story + uno de docs con evidencia; push a `feature/001-scaffolding`.
- [ ] Deploy limpio con `./scripts/dev-restart.sh` (un solo worker, healthcheck OK).
- [ ] Probar con `quickstart.md` + `tsc`/`lint`/`test`/`build`.
- [ ] Documentar: sección Implementación en `spec.md` + `cierre.md` + deuda técnica + Status `CERRADA`.

