# Plan — Spec 039: Middleware perimetral real

## Fase 1: Análisis y preparación

- P1.1 Verificar la convención de middleware en Next.js 16.2.10: `src/proxy.ts` con export `proxy` y `config`, no `src/middleware.ts`.
- P1.2 Revisar la lógica de `src/lib/proxy.ts` para asegurar que sea edge-safe y reutilizable desde `src/proxy.ts`.
- P1.3 Definir el matcher exacto y la matriz de roles.
- P1.4 Consolidar: `src/proxy.ts` como entrypoint de convención Next.js 16, `src/lib/proxy.ts` como helper de lógica.

## Fase 2: Implementación por User Story

- P2.1 **US1**: Confirmar que `src/proxy.ts` exporta `proxy` + `config.matcher`, reutilizando `src/lib/proxy.ts`. Incluir `COMITE_VALIDACION` en roles internos.
- P2.2 **US1**: Probar los 5 roles (ADMIN, SCHOOL_ADMIN, OPERADOR, PARENT, COMITE_VALIDACION) con `curl`; confirmar que ninguno queda bloqueado.
- P2.3 **US1**: Mantener `verifyAuth` en endpoints y layouts (no quitar defensa en profundidad).
- P2.4 **US1**: Validar que rutas públicas (incluyendo API anónima como `POST /api/reportes`) no sean bloqueadas por el proxy.

## Fase 3: Tests y validación

- P3.1 Probar manualmente con curl las redirecciones para los 5 roles y rutas anónimas.
- P3.2 Ejecutar `npx tsc --noEmit`, `npm run lint`, `npm run test`.
- P3.3 Ejecutar `rm -rf .next && npm run build`.
- P3.4 Ejecutar `./scripts/dev-restart.sh` y probar con `quickstart.md`.

## Fase 4: Cierre

- P4.1 Actualizar `spec.md` con sección Implementación (notando el ajuste a `src/proxy.ts` por Next.js 16).
- P4.2 Actualizar `research.md`, `plan.md`, `tasks.md` y `quickstart.md` para reflejar la convención `src/proxy.ts`.
- P4.3 Validar checklist de requisitos.
- P4.4 Commits: uno por User Story + uno de docs; push a `feature/001-scaffolding`.
- P4.5 Deploy limpio y pruebas con `quickstart.md`.
