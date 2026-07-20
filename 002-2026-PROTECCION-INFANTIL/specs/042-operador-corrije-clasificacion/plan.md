# Plan — Spec 042: Operador corrige la clasificación

## Fase 1: Investigación y análisis

- P1.1 Verificar el flujo actual de resolución del operador: componentes, endpoints, permisos y estados.
- P1.2 Verificar que el endpoint `/api/admin/correcciones` ya cumple con FR-001 a FR-007.
- P1.3 Verificar que `AdminReporteDetalle` ya cumple con FR-008.
- P1.4 Identificar gaps de cobertura de tests.

## Fase 2: Tests y validación

- P2.1 **US1**: Agregar tests en `src/app/api/admin/correcciones/route.test.ts` para:
  - Estado final `CORREGIDO`.
  - Transición con `responsableTipo = OPERADOR`.
  - Corrección creada con categorías correctas.
  - 403 cuando el operador no tiene asignado el caso.
  - 409 cuando ya existe una corrección.
- P2.2 **US2**: Agregar test de componente para `AdminReporteDetalle` (si el proyecto ya tiene tests de componentes) o verificar manualmente el render condicional.
- P2.3 **US3**: Validar el flujo manualmente con el quickstart.

## Fase 3: Documentación

- P3.1 Crear `quickstart.md` con pasos end-to-end.
- P3.2 Actualizar `spec.md` con sección Implementación.
- P3.3 Completar checklist de requisitos.
- P3.4 Crear `docs/cierre-042.md`.

## Fase 4: Cierre

- P4.1 Ejecutar `npx tsc --noEmit`, `npm run lint`, `npm run test`.
- P4.2 Ejecutar `rm -rf .next && npm run build`.
- P4.3 Ejecutar `./scripts/dev-restart.sh` y healthcheck.
- P4.4 Commits: uno por US + uno de docs; push a `feature/001-scaffolding`.
- P4.5 Validar quickstart.md de punta a punta.

---

## Orden y dependencias

- Fase 1 → Fase 2 → Fase 3 → Fase 4.
- P2.1 (US1) y P2.2 (US2) pueden ejecutarse en paralelo.
- P3.1 depende de P2.3 (validación manual).
- P4.1-P4.3 dependen de P2.1 y P2.2.
- P4.4-P4.5 dependen de P4.3.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| El endpoint ya permite corregir, pero se descubre un bug en el flujo | Corregir solo el bug acotado; si es grande, documentar como deuda. |
| Tests de componente no existen en el proyecto | Usar prueba manual documentada en quickstart. |
| El cambio de estado a `CORREGIDO` no recalcula score público | Evaluar si es necesario; si lo es, documentar como deuda separada. |

---

## Notas

- No se requieren migraciones de Prisma.
- No se rediseña la UI.
- El scope es verificar, documentar y completar tests del flujo existente.
