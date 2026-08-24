# Research — SPEC-211

## Módulos vivos a reutilizar

| Módulo | Ubicación | Uso |
|---|---|---|
| `ColegioSideNav` | `src/components/modules/colegio/ColegioSideNav.tsx` (asumido) | Layout rector. |
| `PagosRepository` | SPEC-210 | DAL. |
| `verifyAuth` | `src/lib/auth.ts` | Auth endpoints. |
| `date-fns-tz` | D-69 | Fechas Bogotá. |
| `fechaCorta` | SPEC-208 | Formato de fechas. |

## APIs externas

Ninguna.

## Riesgos técnicos

1. **Sidebar padre inexistente**: el instructivo dice explícitamente no crearlo aquí. Si SPEC-231 no está, la vista padre queda huérfana.
2. **ColegioSideNav**: no confirmado en este worktree; se asume vivo por BRIEF.
3. **Upload de archivos**: requiere decisión de storage. En v1 se propone disco local bajo `/uploads/comprobantes/`.

## Dependencias rotas identificadas

- **SPEC-231**: layout/sidebar padre (`/dashboard/padre/*`) no existe en rama base.
- **ColegioSideNav**: si no existe en `src/components/modules/colegio/`, la vista rector también está bloqueada.
