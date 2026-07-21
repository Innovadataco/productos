# Feature Specification: Módulo Colegios — Fase 1: Fundación (Colegio + creación por admin + login institucional) (Spec 074)

**Feature Branch**: `[feature/001-scaffolding]`

**Created**: 2026-07-21

**Status**: PLANEADO

**Input**: Fase 1 del módulo Colegios (SaaS institucional). La Fase 0 (Spec 073, ubicación país→departamento→ciudad) ya está cerrada. Esta fase crea el colegio, su usuario SCHOOL_ADMIN, el login con validación de vigencia de servicio y la identidad visual verde institucional. No se implementa cobro ni pasarela. No se permite que el SCHOOL_ADMIN cree reportes desde la cuenta institucional. No se implementa código hasta aprobación humana del plan.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El admin crea colegios (Priority: P1)

El administrador de la plataforma necesita dar de alta instituciones educativas que usarán el servicio. Cada colegio requiere datos de ubicación, del representante legal y del periodo de servicio, y se le asigna un único usuario SCHOOL_ADMIN para el acceso.

**Why this priority**: Es la puerta de entrada del modelo SaaS institucional. Sin colegios, no hay tenant ni usuarios SCHOOL_ADMIN.

**Independent Test**: Un ADMIN puede crear un colegio con todos sus datos; el sistema crea el usuario SCHOOL_ADMIN con contraseña temporal, envía email de bienvenida y registra la acción en auditoría.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado con rol ADMIN, **When** envía los datos completos de un colegio (nombre, ubicación, representante legal, fechas de servicio, tipo de periodo), **Then** el sistema crea el colegio, el usuario SCHOOL_ADMIN asociado con email único y contraseña temporal, y responde con los datos del colegio y del usuario creado.
2. **Given** un usuario con rol SCHOOL_ADMIN, OPERADOR, COMITE_VALIDACION o PARENT, **When** intenta crear un colegio, **Then** el sistema rechaza la operación con 403.
3. **Given** un admin que intenta crear un colegio con un email de SCHOOL_ADMIN ya registrado, **When** envía el formulario, **Then** el sistema devuelve 409 con un mensaje claro de duplicidad.
4. **Given** un admin que crea un colegio, **When** la operación finaliza, **Then** se registra en `AuditLog` la acción `COLEGIO_CREADO` con el ID del colegio, el usuario que lo creó y los datos relevantes.
5. **Given** un admin que edita o desactiva un colegio, **When** la operación finaliza, **Then** se registra en `AuditLog` la acción correspondiente (`COLEGIO_ACTUALIZADO`, `COLEGIO_DESACTIVADO`, `COLEGIO_REACTIVADO`).
6. **Given** un colegio existente, **When** el admin lo edita (nombre, fechas de servicio, representante, etc.), **Then** los cambios se persisten, se mantiene la vigencia del servicio y se actualiza el `AuditLog`.

**Edge Cases**:
- ¿Qué ocurre si el email del SCHOOL_ADMIN coincide con un usuario OPERADOR/COMITE/PARENT existente? Se rechaza con 409; el email debe ser único globalmente.
- ¿Qué ocurre si el periodo de servicio es inválido (`finServicio` < `inicioServicio`)? Se rechaza con 400.
- ¿Qué ocurre si el colegio se desactiva? El SCHOOL_ADMIN no puede iniciar sesión ni acceder a rutas del colegio.
- ¿Qué pasa con la ubicación si no se selecciona departamento? Se permite mientras `paisId` y `ciudadId` estén presentes; `departamentoId` es opcional.

---

### User Story 2 — Login institucional con identidad visual verde (Priority: P1)

El SCHOOL_ADMIN inicia sesión con el email y contraseña que le asignó el admin. Al ingresar, ve el panel institucional con una identidad visual verde que lo distingue del resto de la plataforma, sin cambiar el diseño base.

**Why this priority**: El colegio necesita una experiencia propia, reconocible y segura, pero no se puede duplicar el sistema de diseño existente.

**Independent Test**: Un SCHOOL_ADMIN puede iniciar sesión y acceder a su panel institucional; la interfaz muestra acento verde en botones, links, anillos de foco y gradientes, manteniendo el glassmorphism y el layout existente.

**Acceptance Scenarios**:

1. **Given** un SCHOOL_ADMIN activo con credenciales válidas, **When** inicia sesión, **Then** el sistema le otorga una sesión y lo redirige a su panel institucional (`/dashboard/colegio`).
2. **Given** un SCHOOL_ADMIN autenticado, **When** navega por `/dashboard/colegio`, **Then** todos los elementos de acento (botones primarios, focos, gradientes, badges) usan el color verde institucional, mientras que la estructura (glass, tipografía, espaciado) es idéntica al resto de la app.
3. **Given** un SCHOOL_ADMIN autenticado, **When** accede a `/dashboard/colegio`, **Then** el layout muestra el nombre del colegio y los datos del representante legal.
4. **Given** un usuario con otro rol (ADMIN, OPERADOR, COMITE, PARENT), **When** intenta acceder a `/dashboard/colegio`, **Then** el sistema redirige o rechaza según el rol correspondiente.

**Edge Cases**:
- ¿Qué ocurre si el SCHOOL_ADMIN cambia su contraseña? La identidad visual verde se mantiene.
- ¿Qué ocurre si el SCHOOL_ADMIN también tiene `debeCambiarPassword=true`? Se le obliga a cambiar la contraseña antes de entrar al panel, manteniendo el tema verde en la pantalla de cambio.
- ¿Qué pasa en modo oscuro? El verde se adapta a un tono más brillante para mantener contraste (por ejemplo, `text-green-400` en dark).

---

### User Story 3 — Validación de vigencia del servicio (Priority: P1)

El acceso del colegio solo está habilitado dentro del periodo de servicio contratado. Si el servicio venció o aún no comienza, el SCHOOL_ADMIN no puede ingresar ni usar el panel.

**Why this priority**: Es la base del modelo SaaS; sin vigencia, no hay control de acceso por periodo. No se cobra en esta fase, pero la puerta queda lista para facturación futura.

**Independent Test**: Un SCHOOL_ADMIN con un colegio cuyo `finServicio` ya pasó no puede iniciar sesión; un SCHOOL_ADMIN dentro del periodo sí puede.

**Acceptance Scenarios**:

1. **Given** un SCHOOL_ADMIN cuyo colegio tiene `inicioServicio <= hoy <= finServicio`, **When** inicia sesión, **Then** el login es exitoso y accede al panel.
2. **Given** un SCHOOL_ADMIN cuyo colegio tiene `finServicio < hoy`, **When** inicia sesión, **Then** el login rechaza con mensaje "Servicio no vigente, contacte al administrador".
3. **Given** un SCHOOL_ADMIN cuyo colegio tiene `inicioServicio > hoy`, **When** inicia sesión, **Then** el login rechaza con el mismo mensaje de servicio no vigente.
4. **Given** un SCHOOL_ADMIN con servicio vigente que ha iniciado sesión, **When** el admin edita el colegio y pone `finServicio` en el pasado, **Then** en el próximo request del SCHOOL_ADMIN a una ruta del colegio el sistema lo desautoriza con el mensaje de servicio no vigente.
5. **Given** un SCHOOL_ADMIN con servicio vigente, **When** accede a una ruta de API del colegio, **Then** el guard (middleware/proxy) verifica la vigencia antes de servir la respuesta.

**Edge Cases**:
- ¿Qué pasa si `finServicio` es nulo? Se considera servicio permanente/vigente hasta nueva definición. El spec recomienda siempre fijar `finServicio`, pero el sistema no falla si es null.
- ¿Qué pasa si el colegio está desactivado (`estado = inactivo`)? Se comporta igual que servicio vencido: login y acceso bloqueados.
- ¿Qué pasa con ADMIN y otros roles? No se les aplica la vigencia de colegio; la validación es solo para usuarios vinculados a un colegio.
- ¿Qué pasa si el SCHOOL_ADMIN intenta usar una ruta fuera del módulo colegio? Se le aplica su restricción de rol (no puede acceder a rutas de admin/operador/comité), pero no se le bloquea por vigencia.

---

### User Story 4 — El colegio NO puede reportar (Priority: P1)

La cuenta institucional del colegio no puede crear reportes. Si alguien de la institución quiere reportar, debe usar la vía anónima o una cuenta personal PARENT.

**Why this priority**: Separa la identidad institucional de la acción ciudadana. La cuenta del colegio es para gestión institucional, no para denunciar.

**Independent Test**: Un SCHOOL_ADMIN autenticado no puede acceder a `/reportar` ni realizar POST a `/api/reportes` desde su sesión.

**Acceptance Scenarios**:

1. **Given** un SCHOOL_ADMIN autenticado, **When** intenta acceder a `/reportar`, **Then** el proxy/middleware lo redirige a `/dashboard/colegio` (o a una página de no permitido).
2. **Given** un SCHOOL_ADMIN autenticado, **When** intenta hacer POST a `/api/reportes` con su sesión, **Then** el endpoint devuelve 403 con mensaje de permisos insuficientes.
3. **Given** un usuario anónimo, **When** accede a `/reportar` o hace POST a `/api/reportes`, **Then** el acceso sigue permitido como hoy.
4. **Given** un usuario PARENT autenticado, **When** accede a `/reportar`, **Then** el acceso sigue permitido.

**Edge Cases**:
- ¿Qué pasa si el SCHOOL_ADMIN accede a `/dashboard` (consulta enriquecida padre)? El proxy actualmente redirige usuarios internos desde rutas de usuario final. Se mantiene: SCHOOL_ADMIN es rol interno, por lo que `/dashboard` y `/mis-reportes` lo redirigen a su home.
- ¿Qué pasa si un SCHOOL_ADMIN intenta acceder a `/api/reportes/mis-reportes`? Devuelve 403.
- ¿Qué pasa si alguien del colegio tiene una cuenta PARENT? Puede crear reportes como PARENT, no como SCHOOL_ADMIN.

---

### User Story 5 — Aislamiento del rol SCHOOL_ADMIN (Priority: P1)

El rol SCHOOL_ADMIN fue heredado en múltiples guards, helpers, endpoints y componentes que le otorgan acceso a funciones de administración, operación, comité y reportes reales de la plataforma. Esta User Story audita todos esos usos y restringe el rol exclusivamente a su propio módulo institucional (`/dashboard/colegio/*` y `/api/me/colegio`, con extensión futura a cursos/alumnos).

**Why this priority**: Es un riesgo de seguridad y privacidad: un colegio no debe ver reportes, casos de operadores, ni datos de comité de otros usuarios ni de la plataforma. Debe quedar aislado a su propio dominio institucional.

**Independent Test**: Un SCHOOL_ADMIN autenticado recibe 403 o redirección en cualquier ruta que no sea de su módulo colegio; ADMIN/OPERADOR/COMITE/PARENT conservan sus accesos actuales.

**Acceptance Scenarios**:

1. **Given** un SCHOOL_ADMIN autenticado, **When** intenta acceder a `/dashboard/admin`, `/dashboard/admin/operadores`, `/dashboard/admin/comite`, `/dashboard/admin/estadisticas`, `/dashboard/admin/ia`, `/dashboard/admin/configuracion` o cualquier subruta de `/dashboard/admin/*`, **Then** el proxy/middleware lo redirige a `/dashboard/colegio` con un mensaje de permisos insuficientes.
2. **Given** un SCHOOL_ADMIN autenticado, **When** realiza una petición a cualquier endpoint bajo `/api/admin/*`, **Then** el endpoint devuelve 403 sin exponer datos.
3. **Given** un SCHOOL_ADMIN autenticado, **When** intenta acceder a `/mis-reportes`, `/dashboard` o `/dashboard/circulo-confianza`, **Then** el proxy lo redirige a `/dashboard/colegio` (rutas de usuario final bloqueadas para roles internos).
4. **Given** un SCHOOL_ADMIN autenticado, **When** intenta acceder a `/consulta` o `/dashboard-publico`, **Then** el acceso se permite como a cualquier usuario autenticado o interno (sin datos reales de reportes) — **salvo** que se decida en implementación que se redirija al panel institucional para evitar confusión.
5. **Given** los helpers `requireAdmin`, `requireOperadorOAdmin`, `requireComiteOAdmin`, `requireAdminOComiteOOperador` en `src/lib/auth.ts`, **When** un SCHOOL_ADMIN los invoca, **Then** devuelven 403, ya que ninguno de ellos debe incluir a SCHOOL_ADMIN.
6. **Given** un ADMIN, OPERADOR, COMITE o PARENT, **When** acceden a sus rutas habituales, **Then** el comportamiento es idéntico al actual (sin regresión).

**Edge Cases**:
- ¿Qué pasa si un SCHOOL_ADMIN tiene `tenantId` coincidente con reportes de su institución? Aunque coincide, no puede verlos en esta fase; el acceso se define por rol, no por tenant. La lógica multi-tenant existente se ignora para SCHOOL_ADMIN en módulos de reportes/operadores/comité.
- ¿Qué pasa con `src/lib/reporte-transiciones.ts`? El helper que asigna responsable `ADMIN` para `ADMIN`/`SCHOOL_ADMIN` debe excluir a SCHOOL_ADMIN; un SCHOOL_ADMIN no realiza transiciones de reportes.
- ¿Qué pasa con `src/lib/operadores/permisos.ts`? El check que devuelve `rol === ADMIN || rol === SCHOOL_ADMIN` debe limitarse a contextos institucionales; en el módulo de reportes debe devolver `false` para SCHOOL_ADMIN.
- ¿Qué pasa con `src/components/modules/AdminNav.tsx` y `ComiteSubNav`? Se quita SCHOOL_ADMIN de las listas de roles permitidos; no ve pestañas ni secciones de admin.
- ¿Qué pasa con `src/app/dashboard/admin/layout.tsx`? SCHOOL_ADMIN no debe pasar el layout de admin; se redirige antes.
- ¿Qué pasa si hay rutas de admin que hoy no tienen guard explícito? Se audita y se corrige con `verifyAuth` adecuado o se protege en el proxy.

---

## Edge Cases generales

- ¿Qué ocurre si se elimina el usuario SCHOOL_ADMIN de un colegio? No se permite la eliminación física; se puede desactivar el colegio o regenerar el usuario. Si se desactiva el usuario, el colegio queda sin acceso.
- ¿Qué ocurre si se cambia el email del SCHOOL_ADMIN? Se mantiene la unicidad global y se actualiza el `AuditLog`.
- ¿Qué ocurre si dos colegios comparten el mismo nombre? Se permite; la unicidad es por usuario/administrador. Se recomienda incluir ciudad en la visualización para diferenciarlos.
- ¿Qué ocurre con el modelo `Tenant` existente? Se reutiliza: al crear un colegio se crea un `Tenant` asociado, y el `Usuario` del colegio tiene `tenantId` apuntando a ese tenant y `colegioId` apuntando al colegio.
- ¿Qué ocurre si se desactiva un colegio? El SCHOOL_ADMIN no puede loguear; los reportes o datos del colegio no se borran (soft delete por estado).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE crear un modelo `Colegio` con campos: `id`, `nombre`, `paisId`, `departamentoId` (opcional), `ciudadId`, `direccion`, `representanteLegalNombre`, `representanteLegalIdentificacion`, `representanteLegalEmail`, `representanteLegalTelefono`, `inicioServicio`, `finServicio`, `tipoPeriodo` (enum `MENSUAL`, `SEMESTRAL`, `ANUAL`), `estado` (`activo`/`inactivo`), `tenantId`, `creadoEn`, `actualizadoEn`.
- **FR-002**: El sistema DEBE agregar `colegioId String?` al modelo `Usuario`, con FK a `Colegio.id`. Solo los usuarios con `rol = SCHOOL_ADMIN` pueden tener `colegioId` no nulo.
- **FR-003**: El sistema DEBE mantener el `tenantId` de `Usuario` y sincronizarlo con el `tenantId` del colegio al crear el colegio.
- **FR-004**: El sistema DEBE crear un `Tenant` automáticamente al crear un colegio, vinculando `Colegio.tenantId` a ese tenant.
- **FR-005**: El sistema DEBE permitir que solo el rol ADMIN cree, lea, actualice, active y desactive colegios (`/api/admin/colegios/*`).
- **FR-006**: El sistema DEBE generar un usuario SCHOOL_ADMIN por colegio al momento de la creación, reutilizando el patrón de creación de operadores (contraseña temporal hasheada, `debeCambiarPassword = true`, email de bienvenida).
- **FR-007**: El sistema DEBE garantizar que solo exista un usuario SCHOOL_ADMIN por colegio.
- **FR-008**: El sistema DEBE agregar acciones al enum `AccionAudit`: `COLEGIO_CREADO`, `COLEGIO_ACTUALIZADO`, `COLEGIO_DESACTIVADO`, `COLEGIO_REACTIVADO`, `COLEGIO_PASSWORD_REGENERADA`, `COLEGIO_EMAIL_REENVIADO`.
- **FR-009**: El sistema DEBE registrar `AuditLog` en cada mutación de colegio y en la creación/regeneración de credenciales del SCHOOL_ADMIN.
- **FR-010**: El sistema DEBE validar la vigencia del servicio (`inicioServicio <= hoy <= finServicio`) en el login del SCHOOL_ADMIN y en el guard de rutas del colegio.
- **FR-011**: El sistema DEBE bloquear el acceso del SCHOOL_ADMIN si el colegio está `inactivo` o fuera de vigencia, con un mensaje claro y sin exponer datos internos.
- **FR-012**: El sistema DEBE aplicar una identidad visual verde en las interfaces del módulo colegio (`/dashboard/colegio` y subrutas), reutilizando los tokens de acento existentes (`text-accent`, `accent-gradient`, `ring-accent`, `text-gradient`) mediante una variante condicional (clase `theme-colegio` o `data-theme="green"`), sin duplicar estilos.
- **FR-013**: El sistema DEBE mantener el acceso anónimo y de PARENT a `/reportar` y `POST /api/reportes`.
- **FR-014**: El sistema DEBE rechazar a SCHOOL_ADMIN en `/reportar` y `POST /api/reportes` con 403 (o redirección en página).
- **FR-015**: El sistema DEBE exponer un endpoint `/api/me/colegio` para que el SCHOOL_ADMIN obtenga los datos de su colegio.
- **FR-016**: El sistema DEBE quitar SCHOOL_ADMIN de todos los helpers `requireAdmin`, `requireOperadorOAdmin`, `requireComiteOAdmin` y `requireAdminOComiteOOperador` en `src/lib/auth.ts`, así como de cualquier `verifyAuth([..., "SCHOOL_ADMIN", ...])` en endpoints de admin/operador/comité/reportes.
- **FR-017**: El sistema DEBE redirigir o rechazar con 403 a un SCHOOL_ADMIN que intente acceder a `/dashboard/admin/*`, `/api/admin/*`, `/mis-reportes`, `/dashboard` o `/dashboard/circulo-confianza`.
- **FR-018**: El sistema DEBE actualizar `src/components/modules/AdminNav.tsx`, `ComiteSubNav.tsx` y `NavHeader.tsx` para que SCHOOL_ADMIN no vea opciones de admin/operador/comité.
- **FR-019**: El sistema DEBE realizar un inventario previo y posterior de los usos de `SCHOOL_ADMIN` en `src/lib/auth.ts`, `src/lib/proxy.ts`, endpoints y componentes, y documentarlo en `research.md`.
- **FR-020**: El sistema DEBE agregar tests que verifiquen 403/redirección para SCHOOL_ADMIN en al menos: `/dashboard/admin`, `/dashboard/admin/operadores`, `/dashboard/admin/comite`, `/dashboard/admin/estadisticas`, `/api/admin/reportes-revision`, `/api/admin/operadores`, `/api/admin/comite/pendientes`, `/api/admin/estadisticas`, `/mis-reportes`, `/dashboard/circulo-confianza`.
- **FR-021**: El sistema DEBE migrar de forma aditiva: nunca eliminar datos ni tablas; no usar `prisma migrate reset` ni `prisma migrate dev` en entornos con datos.
- **FR-022**: El sistema DEBE hacer un dump de respaldo de la BD antes de ejecutar migraciones o seed relacionados con colegios.
- **FR-023**: El sistema DEBE mantener los 605 tests existentes verdes; todo endpoint nuevo o afectado por seguridad debe tener su archivo `.test.ts` actualizado.

### Key Entities

- **Colegio**: Institución educativa con datos de ubicación, representante legal y periodo de servicio. Se vincula a un `Tenant` y a un `Usuario` SCHOOL_ADMIN.
- **Usuario**: Existente. Se agrega `colegioId` nullable. Solo SCHOOL_ADMIN usa este campo.
- **Tenant**: Existente. Se crea automáticamente por colegio para aislamiento multi-tenant futuro.
- **Pais/Departamento/Ciudad**: Modelos de la Fase 0. Se usan para la ubicación del colegio.
- **AuditLog**: Registro inmutable de acciones sobre colegios y credenciales.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un ADMIN puede crear un colegio y el sistema responde con el colegio + usuario SCHOOL_ADMIN + contraseña temporal.
- **SC-002**: El email de bienvenida se envía (o se indica si falla, mostrando la contraseña temporal).
- **SC-003**: El `AuditLog` contiene las acciones `COLEGIO_CREADO`, `COLEGIO_ACTUALIZADO`, `COLEGIO_DESACTIVADO`, `COLEGIO_REACTIVADO` con el recursoId correcto.
- **SC-004**: Un SCHOOL_ADMIN fuera de vigencia no puede iniciar sesión; el mensaje es "Servicio no vigente, contacte al administrador".
- **SC-005**: Un SCHOOL_ADMIN dentro de vigencia puede iniciar sesión y ver `/dashboard/colegio` con acento verde.
- **SC-006**: El proxy/middleware verifica vigencia en rutas `/dashboard/colegio/*` y `/api/me/colegio`.
- **SC-007**: Un SCHOOL_ADMIN autenticado recibe 403 (o redirección) al intentar `POST /api/reportes` o acceder a `/reportar`.
- **SC-008**: Los usuarios anónimos y PARENT siguen pudiendo reportar sin cambios.
- **SC-009**: `npm run test` pasa con ≥ 605 tests (sin regresión) y los nuevos tests de colegios cubren creación, login, vigencia, permisos, aislamiento de SCHOOL_ADMIN y UI verde.
- **SC-010**: El suite `tsc`, `lint` y `build` sigue sin errores.
- **SC-011**: SCHOOL_ADMIN recibe 403 o redirección en todas las rutas de admin/operador/comité/reportes/usuario-final auditadas; ADMIN/OPERADOR/COMITE/PARENT conservan sus accesos.
- **SC-012**: El inventario de usos de `SCHOOL_ADMIN` en `research.md` refleja el estado previo y posterior de la corrección.

---

## Assumptions

- El rol SCHOOL_ADMIN ya existe en el enum `RolUsuario` y en `verifyAuth`.
- El modelo `Tenant` ya existe como tabla vacía; se reutilizará como tenant aislado por colegio.
- El modelo `Departamento` y la relación `Ciudad.departamentoId` ya existen por la Fase 0 (Spec 073).
- No se implementa cobro ni pasarela en esta fase; solo la validación de fechas de vigencia.
- El patrón de creación de operadores (hash bcrypt, contraseña temporal, email de bienvenida) es reutilizable tal cual para SCHOOL_ADMIN.
- El sistema de tokens de acento (`text-accent`, `accent-gradient`, etc.) se puede extender con una variante verde sin duplicar clases.
- El rol SCHOOL_ADMIN será aislado exclusivamente a su propio módulo; se quitará de todos los guards, endpoints y componentes de admin/operador/comité/reportes como parte de la US5 de seguridad.
- El proxy/middleware debe tratar a SCHOOL_ADMIN como una categoría separada de `INTERNAL_ROLES`, permitiéndole solo `/dashboard/colegio/*` y `/api/me/colegio`.
- El acceso a `/reportar` es público para anónimos y PARENT, pero no para SCHOOL_ADMIN.

---

## Implementación

### Resumen de cambios

- **Migración y modelo**: `prisma/migrations/20260720214140_add_colegio` crea `Colegio` y agrega `Usuario.colegioId`; `AccionAudit` recibe `COLEGIO_*`; `TipoPeriodoServicio` nuevo. Backup previo realizado en `/tmp/backup-pre-074-20260721-020758.dump`.
- **US1 (Admin crea colegios)**:
  - `src/app/api/admin/colegios/route.ts` (GET/POST) y `src/app/api/admin/colegios/[id]/route.ts` (PATCH/DELETE).
  - Creación transaccional de `Tenant`, `Colegio` y `Usuario` con `rol=SCHOOL_ADMIN`, `colegioId` y `tenantId` vinculados; contraseña temporal; email de bienvenida; `AuditLog`.
  - UI: `src/app/dashboard/admin/colegios/page.tsx`, `src/app/dashboard/admin/colegios/nuevo/page.tsx` y link en `AdminNav`.
  - Validación de ubicación (país/ciudad) en POST/PATCH.
- **US2 (Login institucional + verde)**:
  - `src/app/dashboard/colegio/layout.tsx` y `src/app/dashboard/colegio/page.tsx`.
  - `src/app/globals.css`: clase `.theme-colegio` sobreescribe `text-accent`, `accent-gradient`, `text-gradient`, `ring-accent`, `ring-accent-input`, `bg-page` en tonos verdes/emerald.
  - `NavHeader`, `login/page.tsx`, `cambiar-password/page.tsx` redirigen a `/dashboard/colegio` para SCHOOL_ADMIN.
- **US3 (Vigencia)**:
  - `src/lib/colegio/vigencia.ts`: verificación de vigencia, inactivo, sin colegio.
  - `src/app/api/auth/login/route.ts`: rechaza login de SCHOOL_ADMIN fuera de vigencia con 403.
  - `src/app/api/me/colegio/route.ts`: verifica vigencia antes de responder.
  - `src/app/dashboard/colegio/layout.tsx`: muestra pantalla de servicio no vigente.
- **US4 (Colegio no reporta)**:
  - `src/lib/proxy.ts`: `REPORTAR_ROUTE` bloqueada para roles internos (`ADMIN`, `OPERADOR`, `COMITE_VALIDACION`); SCHOOL_ADMIN ya está aislado.
- **US5 (Aislamiento SCHOOL_ADMIN)**:
  - `src/lib/proxy.ts`: SCHOOL_ADMIN solo puede `/dashboard/colegio/*` y `/api/me/colegio`; redirige a home en otras rutas; `/api/admin/*` devuelve 403.
  - `src/lib/auth.ts`: helpers sin SCHOOL_ADMIN; nuevo `requireSchoolAdmin`.
  - `src/lib/operadores/permisos.ts`, `src/lib/reporte-transiciones.ts`: sin SCHOOL_ADMIN.
  - `AdminNav`, `ComiteSubNav`, `NavHeader`, `dashboard/admin/layout.tsx`, `mis-reportes/page.tsx`, `circulo-confianza/page.tsx`: sin acceso para SCHOOL_ADMIN.
  - Endpoints `/api/admin/**` con `verifyAuth([..., "SCHOOL_ADMIN", ...])` ajustados a `verifyAuth("ADMIN")` y lógica residual de tenant limpiada.
- **Tests**: `src/app/api/admin/colegios/route.test.ts` (6 tests) cubre creación, duplicados, permisos, listado, `/api/me/colegio`, login con vigencia vencida. `src/lib/role-visibility.test.tsx` y otros tests ajustados. Total: 610 tests verdes.
- **Validación**: `npx tsc --noEmit`, `npm run lint`, `npm run build` y `npx vitest run` pasan. Deploy limpio con `./scripts/dev-restart.sh` (healthcheck ok, un worker). Smoke tests de 5 roles confirmaron accesos correctos.

### Corrección post-cierre: fechas datetime-local en formulario de colegio

- **Problema**: `src/app/dashboard/admin/colegios/nuevo/page.tsx` y `src/app/dashboard/admin/colegios/page.tsx` enviaban el valor crudo de los inputs `datetime-local` (sin zona horaria) al backend, que valida ISO 8601 con `z.string().datetime()`, produciendo error 400 "Datos inválidos".
- **Solución**: agregar helper `toISOString()` (nuevo) y `datetimeLocalToISO()` (edición) que convierten el valor `datetime-local` a `toISOString()` antes del `fetch`.
- **Validación**: se agregó test en `src/app/api/admin/colegios/route.test.ts` que simula el envío desde el formato `datetime-local` → ISO y verifica 201. Total actualizado: 611 tests verdes.

## Status

CERRADA
