# Cierre — Spec 042: Operador corrige la clasificación

## Resumen

Se completó la cobertura de tests del flujo "operador corrige la clasificación de la IA". Se agregaron tests de backend y de UI, y se corrigieron dos bugs menores descubiertos durante la validación.

## User Stories implementadas

### US1 — Tests del flujo de corrección del operador (P1)

- Se agregaron tests en `src/app/api/admin/correcciones/route.test.ts`:
  - Reporte asignado a operador → corrección → estado `CORREGIDO`.
  - Transición registrada con `responsableTipo = OPERADOR` y `responsableId` correcto.
  - Admin puede corregir un reporte asignado a un operador.
  - Operador no asignado recibe 403.
  - Usuario `PARENT` recibe 403.
  - Usuario `COMITE_VALIDACION` recibe 403.
  - Corrección duplicada recibe 409.
  - Reporte dado de baja recibe 409.
- Se corrigió `src/app/api/admin/correcciones/route.ts`:
  - Verificación de `reporte.eliminado` antes de corregir.
  - Verificación de `correccionExistente` antes de crear (evita 500 por unique constraint).

### US2 — Verificación de UI + quickstart (P1)

- Se creó `src/components/modules/AdminReporteDetalle.test.tsx` con 3 tests:
  - Botón "Corregir clasificación" visible cuando el reporte es corregible (`REVISION_MANUAL` + clasificación).
  - Botón no visible cuando el reporte está `CORREGIDO`.
  - Botón no visible cuando el reporte no tiene clasificación.
- `specs/042-operador-corrije-clasificacion/quickstart.md` documenta el flujo end-to-end.

## Validación

- `src/app/api/admin/correcciones/route.test.ts`: 9 tests, todos pasan.
- `src/components/modules/AdminReporteDetalle.test.tsx`: 3 tests, todos pasan.
- `npm run test`: 80 suites, 428 tests, todos pasan.
- `npx tsc --noEmit`: OK.
- `npm run lint`: OK (1 warning heredado de `GestionPageClient.tsx`).
- `rm -rf .next && npm run build`: OK.
- `./scripts/dev-restart.sh`: OK, healthcheck OK, un solo worker.

## Commits

- `fix(042): US1 — validaciones de corrección duplicada y reporte dado de baja`
- `test(042): US1 — tests de flujo de corrección del operador`
- `test(042): US2 — tests de UI para corrección de clasificación`
- `docs(042): cierre + checklist + sección Implementación`

## Ciclo de deuda

- **Bugs corregidos**:
  - Corrección duplicada devolvía 500 → ahora devuelve 409.
  - Corrección de reporte dado de baja devolvía 200 → ahora devuelve 409.
- **Deuda documentada**:
  - El endpoint de corrección no recalcula el score de riesgo público ni la visibilidad (a diferencia de confirmar). Se deja como deuda para revisión humana, ya que implica una decisión de diseño sobre los efectos públicos de una corrección. No se resuelve sin aprobación.

## Próximos pasos

Ninguno. El spec 042 está cerrado.
