# Tasks — 001-auth-despacho-doble-token

> Ordenadas por dependencia. `[P]` = paralelizable. Cada tarea referencia FR/entidad. **Guardarraíl:** ninguna tarea consume APIs productivas; la integración se prueba contra stub.

## Fase 0 — Infraestructura y scaffold
- [x] T001 `docker-compose.yml` aislado 003 (5434, `mem_limit`, `003-*`). *(hecho)*
- [x] T002 `.env.example` con gate stub + `.gitignore` Next.js. *(hecho)*
- [ ] T003 `package.json` (Next 16.2.10, React 19.2.4, Prisma 5.22, jose 6, bcryptjs 3, zod 4; **sin pg-boss**), scripts dev/build/test/lint/worker/db.
- [ ] T004 [P] `tsconfig.json` (`strict`, `@/*`), `next.config.ts` (headers seguridad), `eslint.config.mjs`, `vitest.config.ts` (`fileParallelism:false`, jsdom), `postcss`/`tailwind.config`, `.env.test`.
- [ ] T005 [P] `src/app/layout.tsx`, `globals.css`, `src/lib/test-setup.ts`.

## Fase 1 — Datos (Prisma esquema `sicov`)
- [ ] T010 `prisma/schema.prisma`: `multiSchema` + `@@schema("sicov")`; 13 modelos del core (Rol, Usuario, Modulo, Submodulo, Funcionalidad, RolModulo, RolModuloFuncionalidad, UsuarioModulo, BloqueoUsuario, ProveedorVigilado, DespachoSolicitud, Estado, LogError) con `@map` a columnas reales. (data-model.md)
- [ ] T011 Migración `init_sicov_p1` (aditiva; `migrate dev`). Verificar índice `des_sol_estado_intento_idx`.
- [ ] T012 `prisma/seed.ts`: roles 1/2/3 (ids fijos), módulos + `roles_modulos`, admin (rol 1), vigilado (rol 2) con `tokenAutorizado`, `ProveedorVigilado` vigente, subusuario (rol 3) con `administradorId = identificación del vigilado`, despachos demo (pendiente/procesado/fallido).

## Fase 2 — Librería base
- [ ] T020 [P] `src/lib/prisma.ts` (singleton), `src/lib/env.ts` (`requireEnv`), `src/lib/errors.ts` (`AppError`+`ERROR_CODES`).
- [ ] T021 [P] `src/lib/bogota.ts` (fecha/hora `America/Bogota`), `src/lib/normalizar.ts` (`array_data|data|obj`, snake/camel, `extraerIdDespachoExterno`).
- [ ] T022 `src/lib/auth.ts`: jose HS256, `hashPassword`/`verifyPassword` (bcrypt 12), `createToken`/`verifyToken`, `verifyAuth(roles?)`, cookie httpOnly. + `auth.test.ts`.

## Fase 3 — US1 Autenticación (P1)  · corrige bugs 3, 4
- [ ] T030 `POST /api/auth/login` (FR-001..007): valida bcrypt, bloqueo `tbl_bloqueo_usuarios`, herencia rol 3 (contexto efectivo), set cookie, devuelve módulos. **Sin fallback demo** (bug 3). + test.
- [ ] T031 [P] `POST /api/auth/logout`, `GET /api/me` (401 → cliente redirige, sin demo; bug 4). + test.
- [ ] T032 [P] `POST /api/auth/cambiar-clave` (política regex del legacy; `claveTemporal=false`). + test.
- [ ] T033 [P] `POST /api/auth/recuperar` (clave temporal; email tras interfaz stub). + test.
- [ ] T034 `src/lib/integracion/contexto-usuario.ts`: herencia rol 3 (`usn_administrador → usn_identificacion`). + test. (FR-005)
- [ ] T035 Página `src/app/login/page.tsx` (**sin pestaña Vigía**) + hook de sesión (ante 401 → `/login`, nunca demo). Guardas por rol.

## Fase 4 — US2 Despacho doble token (P1)  · corrige bugs 1, 2, 5
- [ ] T040 `src/lib/integracion/token-proveedor.ts` (`TokenProveedorStore`: cache + refresh + margen). + test (stub).
- [ ] T041 `src/lib/integracion/cliente.ts` (interface + factory con **gate doble** stub/real), `cliente-stub.ts` (NUNCA red, arma 3 cabeceras, respuesta simulada configurable éxito/fallo). + test.
- [ ] T042 `src/lib/integracion/cliente-http.ts` (real; solo instanciable con `INTEGRACIONES_MODO=real` && `SUPERTRANSPORTE_HABILITADO=true` && credenciales). **No se ejercita contra la Super.** Armado de 3 cabeceras + `postTransaccional` (sin `console.log` de tokens).
- [ ] T043 `POST /api/integracion/despachos` (FR-016, FR-021): valida payload, resuelve contexto efectivo, inserta en `tbl_despachos_solicitudes` (`pendiente`). + test.
- [ ] T044 `scripts/worker-despachos.mjs` + `scripts/worker-supervisor.mjs`: loop table-driven (lote 20, `siguiente_intento`, backoff 5min, máx 3), advisory lock ID_003. Reintento **resetea contador** correctamente (bug 1). (FR-017..020)
- [ ] T045 `POST /api/despachos/[id]/reintentar` (bug 2: handler real): `estado=pendiente`, `reintentos=0`, `siguiente_intento=now`. + test.
- [ ] T046 `GET /api/dashboard` (bug 5): KPI "Despachos hoy" con `where fecha >= inicioDiaBogota`. + test.
- [ ] T047 UI mínima de despachos/log de cola con botón **Reintentar** funcional (paridad demo corregida).

## Fase 5 — US3 Limpieza / paridad
- [ ] T050 Retirar del port las pantallas inventadas (Terminales, CRUD Empresas) y el flujo Vigía (no reimplementar).
- [ ] T051 Script de deploy limpio (`rm -rf .next`, build, healthcheck, un solo worker).

## Fase 6 — Verificación y cierre (5 reglas de oro)
- [ ] T060 `npm run typecheck` (0 errores), `npm run lint` (0 errores).
- [ ] T061 `npm run test` (vitest, solo stubs) verde; cobertura de auth, contexto rol 3, cliente stub, worker, reintento.
- [ ] T062 `npm run build` OK. Prueba en vivo con `quickstart.md` (modo stub).
- [ ] T063 `cierre.md` + sección Implementación en `spec.md` + deuda técnica (ClienteHttp real inactivo pendiente de verificación humana).
- [ ] T064 Commits por User Story + docs, con evidencia; push a la rama.

## Bloqueado (fuera de esta entrega, requiere verificación humana)
- [ ] TX01 Activar `ClienteHttp` real y probar contra Supertransporte — **solo tras aprobación** y con credenciales rotadas.
- [ ] TX02 `/speckit.clarify` de payloads/endpoints reales y umbral de bloqueo.
