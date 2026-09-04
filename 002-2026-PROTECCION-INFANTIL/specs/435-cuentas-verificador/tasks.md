# SPEC-435 · Tasks

## Estado: CERRADO — PR pendiente de abrir

- [x] Worktree fresco `.worktrees/pi-SPEC-435` desde `origin/main 2bd6f0ae2` + `npm install` + `prisma generate`.
- [x] Verificado en fuente: `VERIFICADOR: ["admin_verificacion_profesionales"]` ya sembrado (`prisma/seed-modulos-grants.ts:72`).
- [x] Verificado: no existe `PerfilVerificador` en schema — la cuenta solo necesita `Usuario`.
- [x] Módulo nuevo `verificadores_admin` en catálogo, categoria `admin`, `esCritico: true`, orden 131 (`src/lib/permisos-catalogo.ts`).
- [x] Refactor liviano: `clavesPorRol` → `export const CLAVES_POR_ROL` (top-level, importable por candados).
- [x] `VerificadorService` (`src/lib/dal/services/verificadores.ts`) con listar / crear / cambiarEstado / restablecerPassword / prepararReenvioEmail.
- [x] `UsuarioRepository.listarPorRol(rol)` (Q-3: prisma sigue solo en el repo).
- [x] Ruta principal `GET|POST /api/admin/verificadores` — `passwordTemporal` SIEMPRE en alta.
- [x] Subruta `PATCH /api/admin/verificadores/[id]/estado` (activo/inactivo).
- [x] Subruta `POST /api/admin/verificadores/[id]/restablecer-password` — `passwordTemporal` SIEMPRE + aviso al dueño.
- [x] Subruta `POST /api/admin/verificadores/[id]/reenviar-email` — NUNCA devuelve la clave si el envío se encoló.
- [x] Zod schemas en archivo aparte (`src/lib/schemas/verificador.ts`) para no cruzar el techo de 500 líneas del índice.
- [x] Item nav en `ADMIN_NAV_ITEMS` (visible con `verificadores_admin`).
- [x] UI: server gate + `VerificadoresGestionClient.tsx` (lista + form de alta + acciones por fila).
- [x] Candado permanente `verificador-modulos.candado.test.ts` (unit) — verificado por mutación.
- [x] Piso del candado `credencial-siempre-visible` subido a 6.
- [x] Test integración `route.test.ts` — 4 casos (verificado por mutación).
- [x] Preflight: tsc + eslint + arch:check (regenerando docs) + tokens:check + unit + integración.
- [ ] Commit + push + PR + reportar al CEO.
