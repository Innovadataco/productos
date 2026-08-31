# Tasks: El comité de convivencia, operativo (SPEC-319 · 002-PI-219)

**Entrega en 2 PRs (aprobado por Fábrica PI-1, PARA 2026-08-30 19:10):**
- **PR-1 = Fase 1** (US1/§2.1 + US6/§2.6) — MVP que desbloquea a Jelkin, desplegable solo.
- **PR-2 = Fases 2-5** (US2/§2.2, US3/§2.3, US4/§2.4, US5/§2.5).

**Etiqueta única de `/dashboard/colegio/comite/casos`:** "Gestión de casos" (aprobado).
**Decisión A (CEO 2026-08-30 19:14, revierte B):** PARENT → `/dashboard/padre` explícito (cierra deuda A-54/SPEC-317). Rol desconocido → `/mis-reportes` (fallback neutro sin rebote). El rebote de `/mis-reportes` se mantiene por **lista explícita de roles** (excluye PARENT), NO por comparación con el home.

---

## Phase 1: Setup
- [X] T001 Confirmar worktree y rama (`work/pi-SPEC-319-comite-convivencia-operativo` desde `origin/main`), `npx tsc --noEmit` limpio de base antes de tocar (baseline).

---

## Phase 2: US1 · §2.1 — Fuente única rol→home (Priority: P1) 🔴 [PR-1]

**Goal:** el comité aterriza en `/dashboard/colegio/comite` por login directo y tras cambiar clave; `/mis-reportes` rebota; OPERADOR unificado; PARENT preservado.
**Independent Test:** unit de `homeParaRol` (todos los roles + default); ejercicio real con cuenta del comité (login, cambiar-clave, /mis-reportes a mano).

- [X] T002 [US1] Crear `src/lib/auth/home-para-rol.ts`: función pura `homeParaRol(rol: string | undefined): string` con el mapa canónico (ADMIN→/dashboard/admin, OPERADOR→/dashboard/admin, SCHOOL_ADMIN→/dashboard/colegio, COMITE_VALIDACION→/dashboard/admin/comite, COMITE_CONVIVENCIA→/dashboard/colegio/comite, **PARENT→/dashboard/padre** [Decisión A], **default rol desconocido→/mis-reportes** [fallback neutro sin rebote]). JSDoc citando SPEC-319, Decisión A (A-54/SPEC-317), y comentario cruzado con `homeForRole` (proxy.ts:192) para que no se dupliquen.
- [X] T003 [P] [US1] Crear `src/lib/auth/home-para-rol.test.ts`: caso por rol + assert PARENT→/dashboard/padre + rol desconocido→/mis-reportes + COMITE_CONVIVENCIA→/dashboard/colegio/comite + OPERADOR→/dashboard/admin.
- [X] T004 [US1] `src/app/login/page.tsx`: reemplazar `getRoleHome` local (`:33-38`) por import y uso de `homeParaRol`. Conservar la precedencia de `redirectTo`. (Dueño Dev PI-2.)
- [X] T005 [US1] `src/app/cambiar-password/page.tsx`: reemplazar el ternario local (`:56-63`) por `homeParaRol(user?.rol)`. Resuelve la omisión de COMITE_VALIDACION/COMITE_CONVIVENCIA y la contradicción de OPERADOR. (Dueño Dev PI-2.)
- [X] T006 [US1] `src/app/mis-reportes/page.tsx`: en el bloque de desvío (`:42-56`), mantener **lista explícita de roles con panel propio** y **sumar COMITE_CONVIVENCIA**: `const ROLES_CON_PANEL_PROPIO = ["ADMIN","OPERADOR","COMITE_VALIDACION","SCHOOL_ADMIN","COMITE_CONVIVENCIA"]; if (ROLES_CON_PANEL_PROPIO.includes(user.rol)) { router.push(homeParaRol(user.rol)); return; }`. **PARENT NO se incluye** — ve su lista de reportes sin rebote. ⚠️ NO usar `homeParaRol(rol) !== rutaActual` como condición (bajo A expulsaría al padre de su propia página y loopearía roles desconocidos). Condición = lista; destino = `homeParaRol(rol)`. Comentar por qué. (Dueño Dev PI-2.)
- [X] T007 [P] [US1] `src/app/dashboard/admin/operadores/page.tsx:5`: agregar comentario explicando que `homeParaRol` local es el fallback de acceso-denegado (no la fuente única de landing) — considerar renombrar a `homeAccesoDenegado` para no confundir con la fuente única.
- [X] T008 [P] [US1] `src/components/modules/NavHeader.tsx:18` (`destinoLogo`): agregar comentario de que es el destino del logo (contextual), no la fuente única de landing; ya maneja COMITE_CONVIVENCIA.
- [X] T009 [US1] Correr tests de los archivos tocados (candado 24 v2): `home-para-rol.test.ts` + tests existentes de login/cambiar-password/mis-reportes si existen. `npx tsc --noEmit` limpio.

---

## Phase 3: US6 · §2.6 — Higiene de rol en el header (Priority: P3) [PR-1]

**Goal:** el header no ofrece opciones de padre al comité.

- [X] T010 [US6] `src/components/modules/NavHeader.tsx:59`: sumar `COMITE_CONVIVENCIA` a `esEmpleado`. Verificar que el bloque `!esEmpleado` (`:195,:265`) deja de ofrecerle "Mi panel"/"Círculo de Confianza"/"Mis reportes".
- [X] T011 [US6] Correr tests de `NavHeader` (candado 24 v2) si existen; verificación visual con cuenta del comité.

---

## Cierre PR-1 (Fase 1)
- [X] T012 Gate pre-push: `git fetch origin && git rebase origin/main`; `git diff --name-status origin/main..HEAD` (solo archivos §2.1/§2.6 + specs). `npm run arch:check` verde (sin ruta nueva). `npm run lint -- <archivos>` + grep `error`.
- [X] T013 Evidencia §6 (PR-1) en producción, **capturas en el PR** (candado 25):
  - Cuenta del comité → login y cambiar-clave aterrizan en `/dashboard/colegio/comite`, no `/mis-reportes`.
  - Comité escribe `/mis-reportes` a mano → rebota a su panel.
  - **(dura, Decisión A)** Padre real → login aterriza en `/dashboard/padre`.
  - **(dura, Decisión A)** Padre real → abre `/mis-reportes` desde su menú → ve su lista **sin rebote** (las dos caras del riesgo de A; sin ambas no hay CUMPLE).
- [X] T014 Push, `gh pr create`, señal `desarrollo-2: 002-PI-219 · Fase 1 · REALIZADO · commit <hash> · PR #<N> · evidencia §6 publicada`.

---

## Phase 4: US2 · §2.2 — Acceso por email (Priority: P2) [PR-2]

**Goal:** la cuenta del comité se activa por email; cero clave en pantalla.

- [X] T015 [US2] `src/lib/dal/services/comite-convivencia.ts` `crearCuenta`: dejar de generar/retornar `passwordTemporal`; crear la cuenta con `estadoActivacion: "INVITADO"`, `tokenInvitacion` (32 bytes), `tokenInvitacionExpiraEn` (vigencia `pagos.invitacion.token_vigencia_horas`, default 48 h). Programar evento `colegio.invitacion.enviada` con `linkActivacion = ${baseUrl}/activar?token=…`.
- [X] T016 [US2] `src/components/modules/colegio/comite/ComiteCuentaCard.tsx`: quitar el pintado de `passwordTemporal` (`:89-95,:126-132`); reemplazar el mensaje por confirmación de "invitación enviada por email". El form de crear no muestra secreto.
- [X] T017 [US2] Endpoint `/api/colegio/comite/cuenta` (POST): ajustar respuesta para no incluir `passwordTemporal`; retornar la cuenta y estado de invitación.
- [X] T018 [P] [US2] Verificar que la plantilla `colegio.invitacion.enviada` renderiza con variables genéricas del comité (nombre "Comité de Convivencia"); si exige `nombreRector`, pasar un rótulo válido sin romper.
- [X] T019 [US2] Tests: integration de `crearCuenta` (crea INVITADO+token, programa evento, no retorna password); `activarPorToken` con la cuenta del comité (rol-agnóstico, sin tocar el servicio). `npx tsc --noEmit`.

---

## Phase 5: US3 · §2.3 — Directorio de integrantes (Priority: P2) [PR-2]

**Goal:** integrantes operable (contador, estado, reenviar invitación, editar, fecha con hora).

- [X] T020 [US3] `src/components/modules/colegio/comite/IntegrantesList.tsx:82`: reemplazar el `<h2>` fijo por contador "N integrantes · M activos".
- [X] T021 [US3] `IntegrantesList.tsx:161-168`: mostrar estado ACTIVO/INACTIVO por fila como etiqueta/texto (además del botón).
- [X] T022 [US3] `IntegrantesList.tsx`: formatear fechas como `DD-MM-AAAA HH:MM` (COT) — agregar la hora.
- [X] T023 [US3] `ComiteCuentaCard.tsx`: reemplazar "Regenerar contraseña" por "Reenviar invitación" (regenera token+vigencia y reprograma `colegio.invitacion.enviada`, sin pintar secreto). Backend: método en `comite-convivencia.ts` (reusa la lógica de token de T015).
- [X] T024 [US3] `IntegrantesList.tsx`: agregar acción "Editar integrante" llamando al endpoint existente `integrantes/[id]/route.ts:31` (servicio `actualizar:99`). Form mínimo de edición.
- [X] T025 [US3] Tests de `IntegrantesList` (candado 24 v2): contador, estado por fila, no romper activar/inactivar. `npx tsc --noEmit`.

---

## Phase 6: US4 · §2.4 — Firma del cierre (Priority: P2) [PR-2]

**Goal:** al cerrar un caso, se registra qué integrante activo firma.

- [ ] T026 [US4] `prisma/schema.prisma`: agregar `integranteFirmanteId String?` + relación opcional a `IntegranteComite` en `SolicitudComite` (+ lado inverso `solicitudesFirmadas` en `IntegranteComite`) + `@@index([integranteFirmanteId])`. Migración aditiva `npx prisma migrate dev --name spec319_firmante_cierre`.
- [ ] T027 [US4] `src/lib/dal/services/comite-convivencia-bandeja.ts:230` `resolver`: sumar `integranteFirmanteId` al input; validar que sea `IntegranteComite` activo del `colegioId` (si no hay activos → error claro); persistirlo; incluirlo en `logAudit` `valorNuevo`.
- [ ] T028 [US4] Schema Zod del input de `/api/colegio/comite/solicitudes/[id]/resolver`: `integranteFirmanteId` requerido.
- [ ] T029 [US4] `src/components/modules/colegio/comite/CasoDetalle.tsx:197`: agregar selector de integrante firmante (poblado con activos del colegio) en el form de resolver; requerido para enviar.
- [ ] T030 [US4] Tests integration de `resolver`: firmante válido activo (OK + audit), firmante inactivo/otro colegio (rechazo), sin activos (rechazo con mensaje). `npx tsc --noEmit`.

---

## Phase 7: US5 · §2.5 — Inicio del comité como bandeja (Priority: P3) [PR-2]

**Goal:** inicio prioriza lo urgente; no duplica menú ni lista; etiqueta única.

- [ ] T031 [US5] Rediseñar el inicio `src/app/dashboard/colegio/comite/` (page/componentes `ComiteHome*`): cabecera humana (saludo por franja + fecha larga español, patrón `HomeRectorPage.tsx:49-55`); urgentes primero (vencidos y por vencer 24 h) como lista accionable con botón encima; métricas `TarjetaMetrica` con `sub`; acciones en verbo (patrón `AccionesRapidas.tsx:12-38`); empty state propio (patrón `EmptyStateColegio`).
- [ ] T032 [US5] Quitar del inicio la duplicación del menú ("Ver bandeja de casos", "Ver estadísticas") y de la lista completa (vive en Gestión de casos).
- [ ] T033 [US5] Etiqueta única "Gestión de casos" para `/dashboard/colegio/comite/casos` en `src/lib/nav-items.ts:75` y en `src/components/modules/NavHeader.tsx:190-194,287-289` (fuera "Mi bandeja").
- [ ] T034 [US5] Tests de los componentes del inicio (candado 24 v2). Responsive (teléfono).

---

## Cierre PR-2 (Fases 2-5)
- [ ] T035 Gate pre-push: rebase sobre origin/main (post-merge de PR-1); `git diff --name-status`; `arch:check` verde; `lint` + grep `error`; `npx tsc --noEmit`.
- [ ] T036 Evidencia §6 (PR-2) en producción con la cuenta del comité: email de invitación → define clave; integrantes (contador/estado/reenviar/editar/fecha-hora); cerrar caso pide firmante; inicio muestra lo urgente y acciones en verbo; teléfono. Capturas en el PR. Huecos no ejercibles → declarar (candado 18).
- [ ] T037 Push, `gh pr create`, señal `desarrollo-2: 002-PI-219 · Fase 2-5 · REALIZADO · commit <hash> · PR #<N> · evidencia §6 publicada`.

---

## Phase 8: Polish / Cross-Cutting
- [ ] T038 Disciplina de specs: Status del catálogo real en spec.md; `Impacto en arquitectura:` real; fila en `specs/README.md`.
- [ ] T039 Confirmar cero regresión: landing de todos los roles ya correctos; activar/inactivar integrante intacto; PARENT aterriza en `/dashboard/padre` (Decisión A) y entra a `/mis-reportes` desde el menú sin rebote ni loop.

## Dependencias y orden
- **PR-1 (Fase 1):** T002 → T003 (test), luego T004/T005/T006 (consumidores, secuenciales por seguridad aunque distintos archivos), T007/T008 [P] (comentarios), T009 (tests), T010/T011 (§2.6), T012-T014 (cierre).
- **PR-2:** US2 → US3 comparten `ComiteCuentaCard.tsx`/`comite-convivencia.ts` (secuenciar T015→T016/T017 y T023). US4 independiente (migración). US5 independiente. T031-T033 tras las demás.
- **T026 (migración) antes de T027-T030.**

## MVP
**Fase 1 (US1+US6)** es el MVP: desbloquea a Jelkin y se despliega solo.
