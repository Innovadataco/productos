# SPEC-404 · Plan

## Diseño (fijado por CEO 03-09 11:22)

- La bandeja tiene URL propia `/dashboard/admin/bandeja` que renderiza `<AdminReportesTable>`.
- `/dashboard/admin` queda como aterrizaje: redirige a Inicio si el módulo `inicio_admin` está, a Bandeja si `bandeja_reportes` está, al primer item permitido si no, `<SinModulosAsignados />` si no hay nada.
- El item del menú "Bandeja de reportes" apunta a la URL propia; los 5 "volver" también.
- Nueva aserción `arch:check (d-bis)`: page.tsx de item no puede `redirect()` a otro item del menú.

## Pasos

1. Worktree fresco `.worktrees/pi-SPEC-404` desde `origin/main d832ec3db` + `npm install`.
2. Análisis: leer `nav-items.ts`, `page.tsx` raíz, los 5 callsites de "volver", `arch:check` y las aserciones existentes.
3. Crear `src/app/dashboard/admin/bandeja/page.tsx`.
4. Reescribir `src/app/dashboard/admin/page.tsx` como aterrizaje.
5. Cambiar el href en `nav-items.ts`.
6. Cambiar los 5 callsites "volver" (`NavHeader.tsx:28`, `operadores/page.tsx:11`, `identificador/[nick]/page.tsx:37`, `consentimiento/page.tsx:14-16`, `circulo-confianza/page.tsx:39`).
7. Nueva aserción `scripts/arch/asercion-menu-no-redirige-a-otro-item.ts` + wire-up en `arch-check.ts` + caso en `aserciones.test.ts`.
8. Regenerar los 5 artefactos de `docs/architecture/*.md`.
9. Actualizar tests unit afectados (`AdminNav.test.tsx`, `NavHeader.test.tsx`, `nav-logo.test.ts`).
10. `spec.md`, `plan.md`, `tasks.md`, fila en `specs/README.md`.
11. Correr `npm run arch:check` + `npm run test:unit` + `tsc` + `eslint`.
12. Validar que la aserción nueva **cazaba** el defecto original (regresión) con `git stash` del cambio de nav.
13. Commit específico, push, PR.

## Coordinación

- **SPEC-405 (Calidad)** merge antes que este PR. Cuando entre, rebasar la rama y quitar el `test.fail` del spec `tests/e2e/admin-menu-alcanzable-y-muestra.spec.ts` (el (A) verifica que el clic no rebote a Inicio, no la URL — mi ruta pasa el test).

## Verificación

- `arch:check` completo VERDE (a/b/c/d/d-bis/e/f).
- 2111/2111 unit tests.
- Recorrido en producción tras deploy: ADMIN con Inicio hace login → cae en Inicio; click "Bandeja de reportes" → cae en `/dashboard/admin/bandeja` y ve la tabla.
