# Plan · SPEC-212 · Panel admin Pagos

## Fases

### Fase 1 — Especificación y diseño (compuerta §4)
1. Redactar `spec.md` con contexto, user stories, acceptance scenarios, FR/NFR.
2. Redactar `data-model.md` con cambios de schema necesarios (enum `EstadoPago.REEMBOLSADO`).
3. Redactar `research.md` con análisis de `AdminNav`, tablas/CRUD vivos y `pagos-repository`.
4. Redactar `contracts/` con endpoints admin/pagos.
5. Redactar `tasks.md` con tareas TNNN ordenadas por dependencias.
6. Redactar `checklists/requirements.md` y `quickstart.md`.
7. Commit docs: `docs(SPEC-212/002-PI-112): panel admin pagos`.

### Fase 2 — Implementación
1. Agregar `REEMBOLSADO` a `EstadoPago` en schema + migración aditiva.
2. Extender `pagos-repository.ts` con métodos para bandeja, bonos, planes, reembolsos, ficha cliente.
3. Crear endpoints API bajo `src/app/api/admin/pagos/**/route.ts`.
4. Modificar `AdminNav.tsx` para agregar sección "Pagos" color `ambar`.
5. Crear página `/dashboard/admin/pagos/page.tsx` con layout de tabs.
6. Implementar tabs: Pendientes, Vencimientos, Mora, Bonos, Planes, Reembolsos, Analítica stub.
7. Crear ficha `/dashboard/admin/pagos/cliente/[id]/page.tsx`.
8. Tests unitarios e integración para endpoints y componentes críticos.
9. Gate local completo.
10. Commit feat: `feat(SPEC-212/002-PI-112): panel admin pagos`.

### Fase 3 — Integración y cierre
1. Rebase sobre `origin/feature/001-scaffolding` si es necesario.
2. Push único (lote con SPEC-214).
3. Verificar CI 6/6 verde.
4. Documentar cierre y deuda técnica.

## Riesgos y mitigaciones

- **Riesgo**: `pagos-repository` no tiene aún métodos de listado paginado.  
  **Mitigación**: extenderlo con funciones tipo `listarPagosPendientes`, `listarSuscripcionesPorVencer`, etc.
- **Riesgo**: Cambio de enum `EstadoPago` puede chocar con SPEC-210.  
  **Mitigación**: migración aditiva pura (`ADD VALUE`); no modificar valores existentes.
- **Riesgo**: `AdminNav` puede cambiar por trabajo paralelo.  
  **Mitigación**: rebasear antes del push y resolver conflictos localmente.
