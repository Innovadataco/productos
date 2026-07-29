# Feature Specification: Vigencia del servicio por cliente (padres y colegios)

**Feature Branch**: `feature/001-scaffolding` | **Date**: 2026-07-29 | **Status**: IMPLEMENTADO (SIN push ni deploy; el coordinador de la cola empuja en serie y ZEUS gatea release)

## Contexto

Padres (`PARENT`) y colegios (`SCHOOL_ADMIN`) son **clientes de pago**: cada uno tiene una
ventana de servicio (inicio/fin) y al vencer se corta el acceso autenticado. Hoy la ventana
solo existe para colegios (`Colegio.inicioServicio`/`finServicio`, aplicada por
`verificarVigenciaColegio` en login, layout y APIs `/api/colegio/**`); para padres no existe
nada: una cuenta `PARENT` activa entra para siempre.

Esta spec generaliza el mecanismo existente (no crea uno segundo) para que una sola función
decida la vigencia de cualquier cliente y unos pocos puntos documentados la apliquen.

**Guardas**: implementar y commitear en `feature/001-scaffolding`, **SIN PUSH ni deploy**
(el coordinador de la cola empuja en serie; el deploy lo gatea ZEUS).

**Reglas innegociables**:

- Vencer NO borra nada: datos y reportes intactos (posible evidencia).
- La consulta pública NO se toca: sigue abierta a todos, con o sin sesión.
- Un reporte ya enviado sigue su curso aunque la cuenta venza (el worker no consulta vigencia).
- Sin vigencia definida = acceso permitido (nadie se corta por omisión del dato).

## User Stories

- **US-1 (P1)**: Como plataforma, quiero que una sola función decida la vigencia de un
  cliente (padre o colegio) para no mantener dos mecanismos divergentes.
  - AS-1.1: `verificarVigenciaCliente(usuarioId)` cubre `SCHOOL_ADMIN` (ventana del colegio,
    comportamiento idéntico al actual) y `PARENT` (ventana propia en `Usuario`).
  - AS-1.2: `verificarVigenciaColegio` se conserva como alias delegado (cero cambios en los
    ~20 puntos que ya la llaman); los estados y mensajes del colegio no cambian.
  - AS-1.3: roles internos (`ADMIN`, `OPERADOR`, `COMITE_VALIDACION`) siempre vigentes.
  - AS-1.4: padre sin `inicioServicio`/`finServicio` definidos → vigente.
- **US-2 (P1)**: Como plataforma, quiero cortar el acceso autenticado al vencer la ventana,
  con un mensaje claro que diga qué pasó y a quién acudir.
  - AS-2.1: login de padre vencido → 403 con mensaje claro mostrado en la página de login
    (no "Credenciales incorrectas", no un 403 seco).
  - AS-2.2: padre vencido con sesión activa → al entrar a `/mis-reportes` o `/dashboard/*`
    ve una pantalla completa "Servicio no vigente" con el mensaje y un botón para cerrar
    sesión (mismo patrón visual que el colegio vencido).
  - AS-2.3: APIs de padre (`POST /api/reportes` autenticado, `GET /api/reportes/mis-reportes`
    y `[id]`) → 403 JSON `{ error: { message, code: "FORBIDDEN" } }` con el mismo mensaje.
  - AS-2.4: colegio vencido → exactamente el mismo mecanismo y mensajes que hoy.
- **US-3 (P1)**: Como admin, quiero ver, fijar y extender la ventana de servicio de un padre
  desde la gestión de padres (SPEC-117), y la de un colegio desde la gestión de colegios.
  - AS-3.1: `GET /api/admin/padres` incluye `inicioServicio`/`finServicio` de cada cuenta.
  - AS-3.2: `PATCH /api/admin/padres/[id]/vigencia` fija/extiende/limpia la ventana
    (fin debe ser posterior a inicio; AuditLog con valores anterior/nuevo).
  - AS-3.3: la pantalla `admin/padres` muestra la vigencia y permite editarla (fechas).
  - AS-3.4: colegio: ya existe (`PATCH /api/admin/colegios/[id]` + UI); se documenta, no se
    duplica.
  - AS-3.5: tras extender la ventana de un padre vencido, su login vuelve a funcionar.
- **US-4 (P1)**: Como cumplimiento, quiero que vencer no destruya ni altere datos.
  - AS-4.1: los reportes de un padre vencido siguen intactos en BD (mismo conteo y contenido).
  - AS-4.2: `GET /api/consulta` sin sesión sigue 200 con un identificador reportado por un
    padre vencido.

### Edge Cases

- Padre con `finServicio` hoy → vigente todo el día (comparación normalizada a medianoche).
- Padre con `inicioServicio` futuro → `no_iniciado`, mensaje claro, sin acceso.
- Padre con solo `finServicio` (sin inicio) → se aplica solo el límite de fin.
- `finServicio <= inicioServicio` en el PATCH → 400 (validación Zod + regla de rango).
- Id de padre inexistente o no `PARENT` en el PATCH → 404.
- Token `PARENT`/`OPERADOR` en endpoints de gestión → 403; sin token → 401.

## Functional Requirements

- **FR-001**: El sistema DEBE añadir `inicioServicio`/`finServicio` (ambos nullable) al
  modelo `Usuario` mediante migración aditiva; `null` = sin vigencia definida = acceso.
- **FR-002**: El sistema DEBE exponer `verificarVigenciaCliente(usuarioId)` en
  `src/lib/colegio/vigencia.ts` como única función de decisión: `SCHOOL_ADMIN` delega en la
  ventana del colegio (estados/mensajes actuales intactos), `PARENT` evalúa su propia ventana
  (`vigente` | `no_iniciado` | `vencido`) con mensajes que indican qué pasó y a quién acudir.
- **FR-003**: El sistema DEBE aplicar la vigencia en: (a) login (`POST /api/auth/login`),
  (b) layouts de páginas de cliente (colegio: existente; padre: layouts de `/mis-reportes` y
  `/dashboard`), (c) APIs de cliente (`/api/colegio/**`: existente; padre: `POST /api/reportes`,
  `GET /api/reportes/mis-reportes`, `GET /api/reportes/mis-reportes/[id]`). El middleware
  (`src/lib/proxy.ts`) NO es punto de aplicación: corre en edge sin acceso a BD.
- **FR-004**: El login vencido DEBE devolver 403 con el mensaje de la función de decisión y
  la página de login DEBE mostrar ese mensaje del servidor (hoy `AuthContext.login` descarta
  el cuerpo de error y la página muestra siempre "Credenciales incorrectas").
- **FR-005**: El sistema DEBE exponer `PATCH /api/admin/padres/[id]/vigencia`
  (`verifyAuth("ADMIN")` + `assertModulo(admin, "padres")` + rate limit `admin_write`) con
  validación Zod, regla fin > inicio y AuditLog (`USER_UPDATE` con fechas anterior/nuevo).
- **FR-006**: `GET /api/admin/padres` DEBE incluir la ventana de servicio de cada cuenta.
- **FR-007**: La pantalla `admin/padres` DEBE mostrar y editar la vigencia de cada padre.
- **FR-008**: Vencer NO DEBE borrar ni alterar reportes, usuarios ni agregados; la consulta
  pública y el procesamiento de reportes ya enviados NO DEBEN consultar vigencia.

## Success Criteria

- SC-1: padre sin vigencia → login 200 y APIs 200 (nadie cortado por omisión del dato).
- SC-2: padre vencido → login 403 con mensaje claro visible en `/login`; APIs 403 con el
  mismo mensaje; páginas de padre muestran la pantalla "Servicio no vigente".
- SC-3: colegio vencido → mismo comportamiento que antes de la spec (tests existentes verdes).
- SC-4: admin extiende la ventana → el padre vuelve a entrar (login 200).
- SC-5: reportes del vencido intactos; `GET /api/consulta` anónima sigue 200.
- SC-6: gate verde: `tsc --noEmit`, `lint`, tests tocados, build y suite completa.

## Assumptions

- La ventana del padre vive en `Usuario` (no en un modelo propio): es un atributo del cliente,
  evita un join por login y modela "sin vigencia" como `null` sin filas huérfanas.
- Los mensajes del colegio no cambian (compatibilidad con layout y tests existentes).
- Las APIs secundarias de padre (círculo de confianza, apelaciones) quedan cubiertas por la
  pantalla de layout; su corte a nivel API se lista como deuda (lectura/escritura de datos
  propios, sin exposición a terceros).
- El worker y `POST /api/reportes/procesar` no consultan vigencia por diseño (un reporte ya
  enviado sigue su curso).

## Implementación

Completada el 2026-07-29 (SPEC-119, bloque B5 de la cola nocturna 002-PI-041). Detalle en
`cierre.md`. Resumen:

- Migración aditiva `20260729150000_add_vigencia_servicio_usuario`: columnas
  `inicioServicio`/`finServicio` (TIMESTAMP NULL) en `"Usuario"`.
- `verificarVigenciaCliente` en `src/lib/colegio/vigencia.ts` (única decisión);
  `verificarVigenciaColegio` queda como alias delegado; helper `assertVigenciaCliente`
  (lanza `AppError` 403 con el mensaje) para las APIs.
- Puntos de aplicación: login (PARENT + SCHOOL_ADMIN), layouts nuevos de padre
  (`src/app/mis-reportes/layout.tsx`, `src/app/dashboard/layout.tsx`) con pantalla
  `ServicioVencidoScreen`, y APIs de padre (`POST /api/reportes`,
  `GET /api/reportes/mis-reportes(/[id])`).
- Login muestra el mensaje del servidor (`AuthContext.login` devuelve `error`).
- Gestión admin: `PATCH /api/admin/padres/[id]/vigencia`, ventana en `GET /api/admin/padres`
  y editor de vigencia en `admin/padres`. Colegio: gestión ya existente, documentada.
