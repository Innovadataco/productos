# Plan — Spec 039: Middleware perimetral real

## Fase 1: Análisis y preparación

- P1.1 Verificar que `src/middleware.ts` no existe y que `src/proxy.ts`/`src/lib/proxy.ts` no se ejecutan como middleware (confirmar exports y nombres).
- P1.2 Revisar la lógica de `src/lib/proxy.ts` para asegurar que sea edge-safe y reutilizable desde un middleware real.
- P1.3 Definir el matcher exacto y la matriz de roles.
- P1.4 Planear la consolidación: `src/middleware.ts` como entrypoint, `src/lib/proxy.ts` como helper, eliminar `src/proxy.ts`.

## Fase 2: Implementación por User Story

- P2.1 **US1**: Crear `src/middleware.ts` que exporte `middleware` + `config.matcher`, reutilizando/refactorizando `src/lib/proxy.ts` para que sea invocable desde el middleware. Incluir `COMITE_VALIDACION` en roles internos.
- P2.2 **US1**: Probar los 5 roles (ADMIN, SCHOOL_ADMIN, OPERADOR, PARENT, COMITE_VALIDACION) con `curl` o E2E; confirmar que ninguno queda bloqueado.
- P2.3 **US1**: Recién después de validar los 5 roles, eliminar `src/proxy.ts` y ajustar cualquier import residual.
- P2.4 **US1**: Mantener `verifyAuth` en endpoints y layouts (no quitar defensa en profundidad).

## Fase 3: Tests y validación

- P3.1 Escribir tests para `src/middleware.ts` o probar manualmente con curl las redirecciones.
- P3.2 Ejecutar `npx tsc --noEmit`, `npm run lint`, `npm run test`.
- P3.3 Ejecutar `rm -rf .next && npm run build`.
- P3.4 Ejecutar `./scripts/dev-restart.sh` y probar con `quickstart.md`.

## Fase 4: Cierre

- P4.1 Actualizar `spec.md` con sección Implementación.
- P4.2 Validar checklist de requisitos.
- P4.3 Commits: uno por User Story + uno de docs.
- P4.4 Deploy limpio y pruebas con `quickstart.md`.
