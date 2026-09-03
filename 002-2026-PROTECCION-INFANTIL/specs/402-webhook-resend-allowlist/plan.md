# SPEC-402 · Plan

## Alcance
Una línea en `GUARDIAS_ACCESO.publicas` + test candado en `middleware.test.ts`. PR quirúrgico: cero riesgo de romper otra ruta.

## Pasos
1. Fetch fresco de `origin/main`, worktree nuevo `.worktrees/pi-SPEC-402`, `npm install`.
2. Editar `src/lib/routing/guardias.ts` — agregar `"/api/webhooks/resend"` a `publicas` con comentario.
3. Editar `src/lib/routing/middleware.test.ts` — tres `it()` que ejercitan la ruta con POST/GET/POST-con-firma-inválida y afirman `x-middleware-next: 1`.
4. Escribir `spec.md`, `plan.md`, `tasks.md`. Actualizar `specs/README.md`.
5. Correr `npm run test:unit -- src/lib/routing/middleware.test.ts` + `tsc --noEmit` + `eslint`.
6. Commit + push + `gh pr create` sobre `main`.
7. Reportar al CEO. Al desplegar, mirar eventos entrantes del proveedor para probar/descartar la hipótesis de I-283.

## Verificación
- Test candado en verde (3 casos nuevos).
- `curl -X POST` contra producción deja de dar 401 del middleware.
- Bandeja de `Notificacion` empieza a recibir marcas de bounce/entrega si la hipótesis es cierta.
