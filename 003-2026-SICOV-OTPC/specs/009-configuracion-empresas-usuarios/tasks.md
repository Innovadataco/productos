# Tasks: 009 — Configuración: Empresas (clientes) y Usuarios en cascada

**Input**: Design documents from `/specs/009-configuracion-empresas-usuarios/`
**Prerequisites**: [plan.md](./plan.md) (corregido por [REVISION-ZEUS-003.md](./REVISION-ZEUS-003.md)), [spec.md](./spec.md)
**Tests**: INCLUIDOS — FR-009 exige test para todo endpoint/función nueva + suite previa verde.

**Correcciones ZEUS-003 embebidas**: B1 (índices únicos PARCIALES, no `@@unique`), B2 (exclusión
completo↔submódulo server-side), seed por NOMBRE (no id 9), correo FUERA de la transacción de alta.

**Coordinación**: comparte la tanda de datos con [013-consola-apis](../013-consola-apis/tasks.md)
(misma migración de módulo `configuracion` + guard de submódulo). Ver orden en §Dependencies.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: US1 (empresas), US2 (cascada usuarios), US3 (correo Resend)

## Path Conventions

Next.js App Router: `src/app/api/**` (endpoints), `src/app/dashboard/**` (UI), `src/lib/**`
(servicios/libs), `prisma/**` (esquema/migraciones/seed). Tests junto al código (`*.test.ts`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: variables de entorno y andamiaje sin lógica.

- [ ] T001 Añadir a [.env.example](../../.env.example) las claves `RESEND_API_KEY=""` y `CORREO_REMITENTE="SICOV-OTPC <onboarding@resend.dev>"` (nombres solo; la key la carga el CEO — nunca en repo)
- [ ] T002 [P] Añadir `RESEND_API_KEY` y `CORREO_REMITENTE` (opcionales) al validador de entorno en [src/lib/env.ts](../../src/lib/env.ts) sin hacerlas requeridas

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: migración de datos, seeds, guard extendido e interfaz de correo — TODO lo que US1/US2/US3 necesitan.

**⚠️ CRITICAL**: ninguna user story arranca hasta cerrar esta fase. La migración B1 exige **revisión manual del SQL**.

### Esquema y migración (B1)

- [ ] T003 En [prisma/schema.prisma](../../prisma/schema.prisma) añadir a `UsuarioModulo` el campo `submoduloId Int? @map("usm_submodulo_id")` + relación `submodulo Submodulo? @relation(fields: [submoduloId], references: [id], onDelete: Cascade)`; **eliminar** `@@unique([usuarioId, moduloId])` y documentar en comentario que la unicidad va por índices parciales SQL (B1). Añadir back-relation `usuariosModulos UsuarioModulo[]` a `Submodulo`
- [ ] T004 Generar la migración con `npx prisma migrate dev --create-only --name add_submodulo_id_usuarios_modulos` (NO aplicar aún)
- [ ] T005 **[REVISIÓN MANUAL OBLIGATORIA]** Editar a mano el SQL de la migración generada: (a) `ALTER TABLE sicov.tbl_usuarios_modulos ADD COLUMN usm_submodulo_id INT NULL` + FK a `sicov.tbl_submodulos(smod_id)` ON DELETE CASCADE; (b) `DROP` del unique viejo `(usm_usuario_id, usm_modulo_id)`; (c) crear los DOS índices únicos PARCIALES de B1: `ux_usmod_completo (usm_usuario_id, usm_modulo_id) WHERE usm_submodulo_id IS NULL` y `ux_usmod_submodulo (usm_usuario_id, usm_modulo_id, usm_submodulo_id) WHERE usm_submodulo_id IS NOT NULL`
- [ ] T006 `pg_dump` previo + aplicar la migración (`npx prisma migrate deploy` en local) y regenerar el cliente (`npx prisma generate`)

### Seeds por NOMBRE (menor ZEUS: sin id 9 hardcodeado)

- [ ] T007 En [prisma/seed.ts](../../prisma/seed.ts) sembrar (idempotente, `upsert` por nombre) el módulo `configuracion` (solo rol 1) resolviendo su id por NOMBRE; nunca asumir id 9
- [ ] T008 [P] En [prisma/seed.ts](../../prisma/seed.ts) sembrar los `Submodulo` de `configuracion`: `empresas` y `apis` (013), resueltos por nombre del módulo padre
- [ ] T009 [P] En [prisma/seed.ts](../../prisma/seed.ts) sembrar submódulos de `mantenimientos`: `preventivos`, `correctivos`; y el catálogo asignable SIN pantalla de 006/007/008 (`alistamiento-diario`, `autorizaciones-nna`, `novedades-*`) — solo nombres, cero lógica

### Guard extendido y helpers de permisos

- [ ] T010 Extender [src/lib/guard-modulos.ts](../../src/lib/guard-modulos.ts): `requiereModulo(usuario, modulo, submodulo?)` — si el usuario tiene fila NULL (módulo completo) pasa; si tiene filas por submódulo exige el pedido. Añadir `"configuracion"` a `ModuloOperacion`. Rol 1 sigue pasando
- [ ] T011 [P] Crear `cargarSubmodulos(usuarioId)` en [src/lib/modulos.ts](../../src/lib/modulos.ts) que proyecta las filas de `UsuarioModulo` con `submoduloId` no nulo (para menú y guard)
- [ ] T012 [P] Tests de matriz del guard en [src/lib/guard-modulos.test.ts](../../src/lib/guard-modulos.test.ts): módulo completo (fila NULL) / solo submódulo / sin nada → pasa/403 correctos, incl. `configuracion`

### Interfaz de correo (D-048) — stub + factory (US3 añade Resend)

- [ ] T013 Crear la interfaz `src/lib/correo/correo.ts`: `enviarCorreo({para, asunto, texto}): Promise<ResultadoEnvio>` + factory `getCorreo()` (con `RESEND_API_KEY` → AdaptadorResend [US3]; sin ella → AdaptadorStub)
- [ ] T014 [P] Crear `src/lib/correo/stub.ts`: log `"[correo][stub] para=… asunto=…"` SIN clave temporal en el log; retorna `ResultadoEnvio` aceptado
- [ ] T015 [P] Tests de la interfaz+stub+factory en `src/lib/correo/correo.test.ts` (factory con/sin key; el stub nunca loguea la clave)

**Checkpoint**: datos migrados (B1 verificado), seeds por nombre, guard de submódulo con tests, interfaz de correo lista.

---

## Phase 3: User Story 1 - Rol 1 crea y administra EMPRESAS (Priority: P1) 🎯 MVP

**Goal**: rol 1 crea/edita/desactiva empresas (ProveedorVigilado + Usuario rol 2 + módulos + credencial por correo), con token modificable.

**Independent Test**: como rol 1, crear empresa (NIT único, token, módulos) → se crean `ProveedorVigilado` + `Usuario` rol 2 (clave temporal) + `UsuarioModulo`; correo stub registrado; 201. NIT duplicado → 409. Roles 2/3 → 403.

### Tests for User Story 1 ⚠️

- [ ] T016 [P] [US1] Test de servicio de empresas en `src/lib/configuracion/empresas.test.ts`: alta crea proveedor+usuario+módulos en una transacción; correo se invoca DESPUÉS del commit (B2/menor: fallo de Resend NO revierte el alta)
- [ ] T017 [P] [US1] Test de endpoints en `src/app/api/configuracion/empresas/route.test.ts`: 201 alta, 409 NIT/usuario duplicado, 403 roles 2/3, token visible solo rol 1

### Implementation for User Story 1

- [ ] T018 [US1] Crear el servicio `src/lib/configuracion/empresas.ts`: `crearEmpresa()` (transacción: ProveedorVigilado + Usuario rol 2 con `identificacion=NIT`, `tokenAutorizado=token`, `claveTemporal=true` + `UsuarioModulo`), `actualizarEmpresa()` (NIT/rol inmutables; desactivación lógica), `modificarToken()` (sincroniza `tpv_token`⇄`usn_token_autorizado` en transacción). **El envío de correo va FUERA de la transacción** (se invoca tras el commit)
- [ ] T019 [US1] Crear `POST` y `GET` en `src/app/api/configuracion/empresas/route.ts` (`verifyAuth([1])` + `requiereModulo(u,"configuracion","empresas")`); tras crear, invocar `getCorreo().enviarCorreo(...)` fuera de la tx; fallo → alta persiste + aviso
- [ ] T020 [P] [US1] Crear `GET`/`PATCH` en `src/app/api/configuracion/empresas/[nit]/route.ts` (detalle sin exponer clave; token solo rol 1; NIT no editable)
- [ ] T021 [P] [US1] Crear `PATCH` en `src/app/api/configuracion/empresas/[nit]/token/route.ts` (modifica token, sincroniza admin) y `POST` en `.../[nit]/reenviar-credencial/route.ts` (regenera temporal, reenvía; nunca reusa la anterior)
- [ ] T022 [US1] UI `src/app/dashboard/configuracion/page.tsx` (tarjetas Empresas y APIs) + `src/app/dashboard/configuracion/empresas/page.tsx` (tabla + modal crear/editar + modal token + reenviar). Hereda breadcrumb del layout (I-14)

**Checkpoint**: US1 funcional e independiente — crear/editar empresa + token + reenviar credencial.

---

## Phase 4: User Story 2 - Cascada de permisos: rol 2 crea sus usuarios (Priority: P1)

**Goal**: rol 2 crea rol 2/3 de SU empresa y reparte módulos/submódulos (subconjunto de los suyos), validado server-side. Guard de submódulo aplicado a preventivo/correctivo.

**Independent Test**: rol 2 crea operador con solo `preventivos` → 403 en correctivos, 200 en preventivos; con módulo completo opera ambos. Rol 2 no ve/edita usuarios de otro NIT (404). Asignar "módulo completo" purga las filas de submódulo (B2).

### Tests for User Story 2 ⚠️

- [ ] T023 [P] [US2] Test de servicio de usuarios en `src/lib/configuracion/usuarios.test.ts`: subconjunto validado contra el OTORGANTE (no el payload); **B2** — asignar completo borra submódulos y viceversa en la misma transacción; nunca coexisten
- [ ] T024 [P] [US2] Test de alcance/guard en `src/app/api/usuarios/route.test.ts`: rol 2 solo su NIT (404 ajeno), rol 3 sin módulo `usuarios`, política de clave (400), rol 1 ve todo

### Implementation for User Story 2

- [ ] T025 [US2] Crear el servicio `src/lib/configuracion/usuarios.ts`: `crearUsuario()`/`actualizarUsuario()` con validación de subconjunto contra `cargarModulos/Submodulos` del otorgante; **B2 server-side**: al asignar módulo completo borra filas de submódulo del módulo, al asignar submódulos borra la fila NULL — misma transacción; identificación/rol inmutables; alcance D-015; correo FUERA de la tx
- [ ] T026 [US2] Crear `POST`/`GET` en `src/app/api/usuarios/route.ts` (rol 1 ve todo; rol 2 solo su NIT; rol 3 sin `usuarios`) y `PATCH` + `POST reenviar-credencial` en `src/app/api/usuarios/[id]/route.ts`
- [ ] T027 [US2] Aplicar `requiereModulo(u,"mantenimientos","preventivos")` a las rutas de preventivo y `("mantenimientos","correctivos")` a las de correctivo (incl. bulk) en `src/app/api/mantenimientos/**` — extensión del guard ya presente
- [ ] T028 [US2] UI `src/app/dashboard/usuarios/page.tsx` (rol 1 y 2): tabla del alcance + modal crear/editar con selector módulos→submódulos (checkboxes anidados limitados al set del otorgante, servido por la API — nunca calculado en cliente)

**Checkpoint**: US1 + US2 funcionan de forma independiente; guard de submódulo activo en mantenimientos.

---

## Phase 5: User Story 3 - Correo real por Resend tras la interfaz (Priority: P2, D-048)

**Goal**: con `RESEND_API_KEY` la interfaz envía real vía API HTTP de Resend; sin key cae a stub. Refactor de recuperar-clave a la interfaz única.

**Independent Test**: sin key → flujos completan y quedan en log stub; con key (fetch mockeado) → POST a `api.resend.com/emails` con `Authorization: Bearer`; fallo de Resend → alta no se revierte, se puede reenviar. Cero secretos en logs.

### Tests for User Story 3 ⚠️

- [ ] T029 [P] [US3] Test del adaptador Resend en `src/lib/correo/resend.ts` con fetch mockeado (cero red): éxito devuelve id; error devuelve `ResultadoEnvio` fallido sin exponer la key ni la clave temporal

### Implementation for User Story 3

- [ ] T030 [US3] Crear `src/lib/correo/resend.ts`: adaptador HTTP `POST https://api.resend.com/emails` con `Authorization: Bearer <key>` vía `fetch` (cero deps); usa `CORREO_REMITENTE`
- [ ] T031 [US3] Refactorizar [src/app/api/auth/recuperar/route.ts](../../src/app/api/auth/recuperar/route.ts) para usar `getCorreo()` en vez del stub inline (mismo contrato)

**Checkpoint**: correo real disponible cuando el CEO cargue la key; sin ella, todo sigue igual.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T032 [P] Actualizar menú/navegación ([src/lib/navegacion.ts](../../src/lib/navegacion.ts)) para exponer `configuracion` (rol 1) y `usuarios` (rol 1/2) por NOMBRE de módulo
- [ ] T033 Ejecutar suite completa (`npm test`), `tsc --noEmit`, lint y `build`; verificar suite previa (127) + nuevos verdes
- [ ] T034 Verificación en navegador (ventana privada): crear empresa → login con temporal (cambio forzado) → crear operador solo-preventivos → 403 en correctivos → 200 en preventivos → reenviar credencial
- [ ] T035 Commit por fase con staging explícito (AGENTS §6): `feat(003-US1-009)`, `feat(003-US2-009)`, `feat(003-US3-009)`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)**: sin dependencias.
- **Foundational (P2)**: depende de Setup; **BLOQUEA** todas las user stories. T003→T004→T005 (revisión manual)→T006 es una cadena estricta.
- **US1 (P3)** y **US2 (P4)**: ambas P1; dependen de Foundational. US2 usa el servicio/UI de usuarios; puede ir tras US1 o en paralelo (archivos distintos).
- **US3 (P5)**: P2; depende de la interfaz de correo (T013). Independiente de US1/US2 salvo por compartir `getCorreo()`.
- **Polish (P6)**: tras las user stories deseadas.

### Coordinación con 013

- La migración de módulo `configuracion` + submódulo `apis` (T007/T008) es **compartida**: sembrar UNA vez. 013 reusa el guard extendido (T010) y el submódulo `apis`.
- Orden recomendado: **Foundational de 009 (datos+guard+seeds) → US1/US2 de 009 → 013 completo** (013 depende del guard de submódulo y del módulo `configuracion`).

### Parallel Opportunities

- T008/T009 (seeds), T011/T012 (helper+test guard), T014/T015 (stub+test) en paralelo dentro de Foundational.
- T016/T017 (tests US1), T020/T021 (endpoints detalle/token) en paralelo.
- T023/T024 (tests US2) en paralelo.
- US1 y US2 pueden desarrollarse por personas distintas tras Foundational.

---

## Implementation Strategy

### MVP First (US1)

1. Setup → 2. Foundational (CRÍTICO, incl. revisión manual B1) → 3. US1 → validar alta de empresa → demo.

### Incremental Delivery

Foundational → US1 (empresas) → US2 (cascada + guard submódulo) → US3 (Resend) → Polish. Cada story se prueba y stagea de forma independiente.

---

## Notes

- **B1**: la unicidad del "módulo completo" la dan los índices PARCIALES SQL (T005), NO `@@unique` de Prisma. Revisión manual del SQL obligatoria.
- **B2**: la exclusión completo↔submódulo se materializa y valida en el servicio (T018/T025), no por índice.
- **Correo**: SIEMPRE fuera de la transacción de alta; un fallo de Resend nunca revierte datos.
- **Seeds por nombre**: nunca hardcodear ids serial (ni el 9 de `configuracion`).
- Cero llamadas a la Super (Fase 1, D-047/AGENTS §6): el token solo se persiste/modifica.
- Commit tras cada tarea o grupo lógico; staging explícito por commit.
