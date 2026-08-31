# Tasks: SPEC-318 · Los tres porteros apagados

**Radicado**: 002-PI-218 · **Rama**: work/pi-SPEC-318-tres-porteros-apagados

## Callsites completos (Candado 22 v5)

| Sección | Archivo:línea | Qué hay ahí |
|---------|---------------|-------------|
| A1 | `src/app/api/auth/login/route.ts:76` | `return NextResponse.json({user: ...})` — `user.id` disponible en :78 |
| A2 | `src/app/api/auth/activar/route.ts:44` | `return NextResponse.json({user:...}, {status:200})` — `user.id` en :47 |
| A3 🔴HALLAZGO | `src/app/api/auth/recuperar/restablecer/route.ts:46` | Sin `createToken`/`setSessionCookie` → sin sesión → **NO emite cookie** (A1 lo cubre al hacer login posterior) |
| B1 | `src/app/api/consentimiento/aceptar/route.ts:69` | `return NextResponse.json({ok:true, version:...}, {status:201})` — `user.id` de `verifyAuth()` |
| B2 | `src/app/api/auth/cambiar-password/route.ts:61` | `return NextResponse.json({ok:true})` — `user.id` de `verifyAuth()`:40 |
| B3 🔴HALLAZGO | `src/app/api/auth/recuperar/restablecer/route.ts:46` | Sin sesión → ciclo cubierto por A1 al próximo login |
| C1 | `src/app/api/session/ping/route.ts:37` | `return NextResponse.json({ok:true})` después de `pingSesion` — `user.id` de `verifyAuth()` |
| D1 | `src/lib/consentimiento/guard.ts:19` | `console.error(...)` existente → sumar logging JSON estructurado |
| E1 | `prisma/schema.prisma:53` | `enum AccionAudit { ... }` → agregar `USUARIO_CAMBIO_PASSWORD` |
| F1 | `src/app/api/auth/cambiar-password/route.ts:61` | Antes del return — `user.id` disponible, agregar `logAudit` |
| F2 | `src/app/api/auth/activar/route.ts:44` | Antes del return — `user.id` disponible, agregar `logAudit` |
| F3 🔴HALLAZGO | `src/app/api/auth/recuperar/restablecer/route.ts:46` | `ResultadoRestablecer` retorna solo `{ok, email}` — necesita `userId` para `logAudit`. Requiere extender tipo en `src/lib/dal/services/autenticacion.ts:~245` |
| G1 | `src/lib/colegio/vigencia.ts:26-29` | Docstring obsoleto (menciona layouts) → actualizar |

> **HALLAZGOS A3/B3/F3**: `restablecer/route.ts` no llama `createToken` ni `setSessionCookie`. No crea sesión → no puede emitir `sesion_estado`. `ResultadoRestablecer` solo devuelve `email`, sin `userId`. Pendiente decisión Fábrica (ver señal barrido-callsites).

---

## Candados activos

- **Candado 22 v5**: callsites enumerados arriba con archivo:línea; prohibido resumir a un conteo
- **Candado 15 v5**: archivos leídos línea a línea pre-tasks (login:94, activar:64, restablecer:56, cambiar-password:71, aceptar:91, session/ping:48, guard.ts:22, vigencia.ts:29, schema.prisma:53+)
- **Candado 24 v2**: tests de todo lo editado (helper + rutas A + rutas B + session/ping + guard + specs-discipline)
- **Candado 26**: `sesion_estado` guard en middleware ya evaluado (barrido pre-spec); guard.ts fail-open evaluado
- **Solo-lectura**: `src/lib/ai/**`, `.github/workflows/**`, `deploy-prod.sh`; comité/profesores A-57/A-58
- **Edge**: middleware no toca Prisma; helper en Node runtime
- **DB turno**: avisar a Fábrica antes de `prisma migrate dev` (contenedor compartido con Dev PI-3)
- **npm ci**: `npm ci` propio en worktree antes de `prisma generate` (no symlink al principal)

---

## Phase 1: Foundational (base bloqueante)

**Propósito**: Helper compartido + migración enum. Bloquea todas las fases siguientes.

- [X] T001 Verificar `npm ci` propio en el worktree (node_modules aislado, no symlink) — PENDIENTE: sin node_modules; T014/T015/T016/T023 difieren hasta turno DB
- [X] T002 Crear `src/lib/routing/sesion-estado-emitter.ts` — función `buildSesionEstadoValue(userId: string): Promise<string>` extrayendo el `Promise.all` de `src/app/api/vigencia/refresh/route.ts:46-58`
- [ ] T003 Agregar `USUARIO_CAMBIO_PASSWORD` al enum `AccionAudit` en `prisma/schema.prisma:53` — **ESPERA TURNO DB (PI-3)**
- [ ] T004 **[TURNO DB — esperar OK de Fábrica]** Correr `npx prisma migrate dev --name add-usuario-cambio-password` y verificar que la migración aparece en `prisma/migrations/`
- [ ] T005 Correr `npx prisma generate` con node_modules propio del worktree y verificar que el cliente TypeScript reconoce `AccionAudit.USUARIO_CAMBIO_PASSWORD`
- [X] T006 [P] Extender `ResultadoRestablecer` en `src/lib/dal/types/auth.ts:34` — `{ok, email, userId}` + `src/lib/dal/services/autenticacion.ts:~245` retorna userId

**Checkpoint**: Helper listo + enum migrado + cliente generado → rutas pueden importar `buildSesionEstadoValue` y `AccionAudit.USUARIO_CAMBIO_PASSWORD`

---

## Phase 2: US1 — La señal se enciende (§3.1)

**Meta**: Rutas de auth emiten `sesion_estado` en la respuesta exitosa.
**Prueba independiente**: POST /api/auth/login → response headers contienen `Set-Cookie: sesion_estado=...`

- [X] T007 [US1] Cablear A1 `src/app/api/auth/login/route.ts:76` — capturar `NextResponse.json(...)` en `res`, llamar `await buildSesionEstadoValue(user.id)`, `res.cookies.set(NOMBRE_COOKIE, valor, {httpOnly:true, sameSite:'lax', path:'/', maxAge: TTL_SEG})`, `return res`
- [X] T008 [US1] Cablear A2 `src/app/api/auth/activar/route.ts:44` — mismo patrón con `user.id` de `:47`

**Nota A3**: `restablecer/route.ts` excluido de emisión de cookie (HALLAZGO — sin sesión; A1 cubre el flujo posterior al login).

**Checkpoint**: login + activar devuelven `Set-Cookie: sesion_estado=...`

---

## Phase 3: US2 — El ciclo se cierra (§3.2)

**Meta**: Operaciones que cambian una de las tres condiciones refrescan la cookie.
**Prueba independiente**: POST /api/consentimiento/aceptar → response contiene cookie refrescada.

- [X] T009 [US2] Cablear B1 `src/app/api/consentimiento/aceptar/route.ts:69` — después de `servicio.aceptar()`, antes del return exitoso, llamar `buildSesionEstadoValue(user.id)` y set cookie en `res`
- [X] T010 [US2] Cablear B2 `src/app/api/auth/cambiar-password/route.ts:61` — mismo patrón con `user.id` de `verifyAuth()`

**Nota B3**: `restablecer/route.ts` excluido (HALLAZGO — sin sesión; cookie se emite en login posterior A1).

**Checkpoint**: aceptar-consentimiento y cambiar-password devuelven `Set-Cookie: sesion_estado=...`

---

## Phase 4: US4 — Vigencia fuera del login (§3.4 + session/ping)

**Meta**: `session/ping` también refresca la cookie; provider no cambia.
**Prueba independiente**: POST /api/session/ping → response contiene `Set-Cookie: sesion_estado=...`

- [X] T011 [US4] Cablear C1 `src/app/api/session/ping/route.ts:37` — después de `pingSesion`, construir `res = NextResponse.json({ok:true})`, llamar `buildSesionEstadoValue(user.id)`, set cookie, return res. `SessionPingProvider` y `useSessionPing` NO se modifican.
- [X] T012 [US4] Actualizar docstring `src/lib/colegio/vigencia.ts:26-29` — reflejar que middleware cubre vigencia vía cookie; layouts y APIs de cliente ya no lo aplican directamente

**Checkpoint**: session/ping devuelve `Set-Cookie: sesion_estado=...`

---

## Phase 5: US3 — Guard visible (§3.3)

**Meta**: `consentimiento/guard.ts` emite logging estructurado persistente en cada fallo.

- [X] T013 [US3] `src/lib/consentimiento/guard.ts:19` — sumar `console.error(JSON.stringify({usuarioId: userId ?? null, evento: "consentimiento.guard.fail", timestamp: new Date().toISOString()}))` **junto** al `console.error` existente (no borrarlo)

---

## Phase 6: US5 — Auditoría cambio de contraseña (§3.5)

**Meta**: Tres caminos propios dejan huella en `AuditLog` con IP protegida.

- [ ] T014 [US5] `src/app/api/auth/cambiar-password/route.ts:61` — antes del return exitoso, agregar `await logAudit({accion: AccionAudit.USUARIO_CAMBIO_PASSWORD, tipoRecurso: "Usuario", recursoId: user.id, usuarioId: user.id, ipAddress: protegerIp(ip), ...})` (importar `logAudit` de `@/lib/audit`)
- [ ] T015 [US5] `src/app/api/auth/activar/route.ts:44` — mismo patrón antes del return exitoso con `user.id` de `:47`
- [ ] T016 [US5] `src/app/api/auth/recuperar/restablecer/route.ts:46` — agregar logAudit con `resultado.userId` antes del return exitoso (F3 APROBADO: opción a — `ResultadoRestablecer` extendida por T006)

---

## Phase 7: Pruebas (SC-06 + cobertura rutas + specs-discipline)

**Meta**: Tests de todo lo editado (Candado 24 v2).

- [X] T017 [P] Test en `src/lib/routing/middleware.test.ts` — SC-06 (k): autenticado sin cookie `sesion_estado` → no expulsa (fail-open). Agregado commit d171a2da4.
- [X] T018 [P] Test en `src/app/api/auth/login/route.test.ts` — SC-01: login exitoso incluye Set-Cookie `sesion_estado`. Agregado commit d171a2da4.
- [X] T019 [P] Test en `src/app/api/auth/activar/route.test.ts` — SC-02: activación exitosa incluye Set-Cookie `sesion_estado`. Agregado ahora.
- [X] T020 [P] Test en `src/app/api/session/ping/route.test.ts` — SC-04: ping exitoso incluye Set-Cookie `sesion_estado`. Agregado commit d171a2da4.
- [X] T021 Test en `src/app/api/consentimiento/aceptar/route.test.ts` — SC-03: aceptar exitoso incluye Set-Cookie `sesion_estado`. Agregado ahora.
- [ ] T022 [P] Test de enum en `src/__tests__/` — verificar que `AccionAudit.USUARIO_CAMBIO_PASSWORD` existe en el cliente Prisma (type-level o import)
- [ ] T023 Correr `npx vitest run src/__tests__/specs-discipline.test.ts` local y confirmar PASS antes de REALIZADO

---

## Phase 8: Polish

- [ ] T024 `git commit` con mensaje que menciona SPEC-318, los 5 caminos cableados (A1, A2, B1, B2, C1), migración enum, y HALLAZGO A3/B3/F3 en el cuerpo
- [ ] T025 Verificar `TZ=America/Bogota date +"%d-%m-%Y %H:%M"` en el mensaje de REALIZADO (nunca calculada)

---

## Dependencias y orden de ejecución

```
T001 (npm ci)
  ↓
T002 (helper emitter)  ←— bloquea T007, T008, T009, T010, T011
  ↓
T003 (schema enum)
  ↓
T004 (migrate — TURNO DB)
  ↓
T005 (prisma generate) ←— bloquea T014, T015, T016
  ↓
T006 (ResultadoRestablecer) — paralelo a T007-T015 (archivos distintos)

T007 (A1 login) ←— depende T002
T008 (A2 activar) [P con T007] ←— depende T002

T009 (B1 consentimiento) ←— depende T002
T010 (B2 cambiar-password) [P con T009] ←— depende T002

T011 (session/ping) ←— depende T002
T012 (docstring vigencia.ts) [P] ←— sin dependencias

T013 (guard.ts logging) ←— sin dependencias Prisma

T014 (logAudit cambiar-password) ←— depende T005 (enum)
T015 (logAudit activar) [P con T014] ←— depende T005 (enum)
T016 (logAudit restablecer) ←— depende T006 + T005 + decisión Fábrica

T017-T022 (tests) ←— dependen de sus respectivos archivos implementados
T023 (specs-discipline) ←— al final
```

## Oportunidades paralelas

- T007 y T008 (A1 + A2): archivos distintos, [P]
- T009 y T010 (B1 + B2): archivos distintos, [P]
- T014 y T015 (logAudit): archivos distintos, [P]
- T017-T022 (tests): todos [P] entre sí
- T012 (docstring) y T013 (guard) no bloquean nada: [P] con el resto

## MVP (US1 mínimo)

1. Fase 1 completa (T001–T005)
2. T007 + T008 (A1 + A2 emiten cookie)
3. T017 + T018 + T019 + T023 (tests de lo editado)
4. **PARAR y validar**: POST login → Set-Cookie sesion_estado → middleware bloquea ruta protegida si requiereConsentimiento=true
