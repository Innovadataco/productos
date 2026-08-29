# Checklist de requerimientos — SPEC-217

## Functional Requirements

- [x] FR-001 Activación de freemium al crear suscripción si parámetro activo. (`crearSuscripcionCliente`)
- [x] FR-002 Asignación de plan básico del rol. (`MES_1` del año Bogotá vía `PagosFreemiumRepository.obtenerPlanBasico`)
- [x] FR-003 Cálculo de `freemiumFechaFin` Bogotá. (`calcularFreemiumFechaFin`, fin del día de corte)
- [x] FR-004 Anti-doble freemium por histórico. (`freemiumFechaFin != null` por `usuarioId`/`colegioId`)
- [x] FR-005 Extensión de vigencia al pagar durante freemium. (`extenderVigenciaDesdeFreemium`, hook en autorización admin)
- [x] FR-006 Transición a `SUSPENDIDA` por SPEC-213. (preexistente: worker de vigencia, sin cambios)
- [x] FR-007 Notificaciones T-7, T-1, T=0. (preexistente: worker de vigencia, sin cambios)
- [x] FR-008 Endpoint con datos freemium. (`esFreemium` + `freemiumFechaFin` + `diasRestantesFreemium` en `VistaSuscripcion`)
- [x] FR-009 AuditLog. (`SUSCRIPCION_FREEMIUM_ACTIVADA` / `SUSCRIPCION_FREEMIUM_CONVERTIDA`; el corte lo audita SPEC-213)
- [x] FR-010 Frontera DAL. (`PagosFreemiumRepository` nuevo; `pagos-repository.ts` intacto)

## Non-Functional Requirements

- [x] NFR-001 Gate local completo. (tsc + eslint de archivos tocados + test:unit + tokens:check verdes; build/dev-restart los corre el coordinador)
- [x] NFR-002 Tests de integración. (escritos: `freemium.service.integration.test.ts`; los corre el coordinador con la BD compartida)
- [x] NFR-003 Logs con formato estándar. (`[Freemium] <acción>: <suscripcionId> — <resultado>`)

## Success Criteria

- [x] SC-001 Activación correcta. (test unitario + integración T008)
- [x] SC-002 Vista muestra días restantes. (`SuscripcionResumen` + tests)
- [x] SC-003 Evento T-7. (cubierto por SPEC-213, preexistente)
- [x] SC-004 Corte por vencimiento. (cubierto por SPEC-213, preexistente)
- [x] SC-005 Anti-doble. (tests T009a/T009b/T009c)
- [x] SC-006 Extensión al pagar. (test T010)
- [ ] SC-007 CI 6/6 verde. (pendiente: corre en CI tras el commit del coordinador)
