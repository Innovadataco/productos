# Cierre — Spec 119: Vigencia del servicio por cliente (padres y colegios)

**Fecha**: 2026-07-29 · **Rama**: `feature/001-scaffolding` · **Estado**: IMPLEMENTADA Y COMMITEADA, **SIN PUSH NI DESPLEGAR** (el coordinador de la cola 002-PI-041 empuja en serie; ZEUS gatea release).

## Lo hecho

- **Ventana por cliente (FR-001)**: migración aditiva
  `20260729150000_add_vigencia_servicio_usuario` — `Usuario.inicioServicio`/`finServicio`
  (TIMESTAMP NULL). `null` = sin vigencia definida = acceso. Para `SCHOOL_ADMIN` la ventana
  sigue siendo la del `Colegio` (no se duplica).
- **Una sola función que decide (FR-002)**: `verificarVigenciaCliente(usuarioId)` en
  `src/lib/colegio/vigencia.ts` cubre `PARENT` (ventana propia) y `SCHOOL_ADMIN` (delega en
  `verificarVigenciaPorColegioId`, estados y mensajes intactos). `verificarVigenciaColegio`
  queda como alias delegado: los ~20 puntos que ya la llamaban no se tocaron.
  `assertVigenciaCliente` (AppError 403 con el mensaje) es el helper de las APIs.
- **Puntos de aplicación (FR-003)**: login (`POST /api/auth/login`, tras la guarda
  `inactivo` de SPEC-117), layouts de cliente (colegio: el existente; padre: nuevos
  `src/app/mis-reportes/layout.tsx` y `src/app/dashboard/layout.tsx` con
  `ServicioVencidoScreen`), y APIs de padre (`POST /api/reportes` autenticado,
  `GET /api/reportes/mis-reportes`, `GET /api/reportes/mis-reportes/[id]`). El middleware
  (`src/lib/proxy.ts`) NO es punto de aplicación: corre en edge sin acceso a BD.
- **Mensaje claro (FR-004)**: `AuthContext.login` ya no descarta el cuerpo del error;
  `/login` muestra el mensaje del servidor (vencido/no iniciado/desactivado) con fallback al
  genérico de credenciales. Beneficia también al colegio vencido (antes veía
  "Credenciales incorrectas").
- **Gestión admin (FR-005/006/007)**: `PATCH /api/admin/padres/[id]/vigencia`
  (verifyAuth ADMIN + módulo `padres` + rate limit + Zod + regla fin>inicio + AuditLog
  `USER_UPDATE` con fechas anterior/nuevo); `GET /api/admin/padres` incluye la ventana;
  `admin/padres` muestra el estado de vigencia (Vigente/Vencida/No iniciada/Sin definir) con
  editor modal (fijar, extender, quitar). Colegio: gestión ya existente
  (`PATCH /api/admin/colegios/[id]` + `ColegiosPageClient`), documentada, no duplicada.

## Qué ve un cliente vencido al intentar entrar

- **Login**: 403 + recuadro rojo en `/login` con el mensaje ("Tu período de servicio ha
  vencido. Tus reportes e información siguen guardados. Contacta con el soporte de la
  plataforma para renovar tu acceso." / colegio: "El servicio del colegio ha vencido.
  Contacta al administrador."). Sin sesión, sin cookie.
- **Sesión activa al vencer (padre)**: pantalla completa "Servicio no vigente" en
  `/mis-reportes` y `/dashboard/*` con el mensaje y botón "Volver al inicio" (cierra sesión).
  APIs → 403 JSON con el mismo mensaje.
- **Colegio**: exactamente lo de hoy (pantalla del layout colegio + login 403).

## Pruebas (Regla 3)

- `src/lib/colegio/vigencia-cliente.test.ts` (nuevo, 12): padre sin vigencia → vigente;
  ventana vigente; fin hoy → vigente; fin ayer → vencido con mensaje (qué pasó + a quién
  acudir); inicio futuro → no_iniciado; solo fin → aplica el fin; roles internos → vigente;
  colegio vencido por la MISMA función; alias `verificarVigenciaColegio` ≡
  `verificarVigenciaCliente`; `assertVigenciaCliente` no lanza/lanza 403.
- `src/app/api/auth/login/route.test.ts` (nuevo, 7): padre sin vigencia → 200; vencido →
  403 + mensaje; no iniciado → 403 + mensaje; colegio vencido → 403 (mismo mecanismo); admin
  extiende (PATCH vigencia) → login 200; reportes del vencido intactos (texto y conteo);
  `GET /api/consulta` anónima sigue 200.
- `src/app/api/admin/padres/[id]/vigencia/route.test.ts` (nuevo, 7): 401/403/404, fija y
  limpia ventana, fin≤inicio → 400, body inválido → 400, AuditLog registrado.
- Extendidos: `mis-reportes/route.test.ts` (vencido → 403 + reportes intactos) y
  `reportes/route.test.ts` (vencido → 403 sin crear; sin vigencia → 201).
- Regresión `src/lib/colegio/vigencia.test.ts` (5 tests previos): verdes, comportamiento del
  colegio byte a byte igual.

## Gate (bajo candado /tmp/pi-gate-lock)

tsc ✅ (0 errores) · lint ✅ (0 errores; 1 warning preexistente en `IaModelSelector.tsx`) ·
tests tocados ✅ (54/54) · build ✅ · suite completa: **1108/1110** (1 skipped; el único
fallo es `src/lib/specs-discipline.test.ts` porque `specs/119-*` no está indexada en
`specs/README.md`, archivo reservado del coordinador — anotado según la consigna del bloque).

## Despliegue (Regla 4) — NO APLICA

Guarda de la tarea: sin deploy, sin `dev-restart.sh`, sin push. Validación = suite verde +
revisión del diff por ZEUS.

## Deuda

- APIs secundarias de padre (círculo de confianza, apelaciones) no cortan a nivel API; la
  pantalla de layout sí bloquea su UI. Endurecer si ZEUS lo pide.
- `specs/119-vigencia-servicio-cliente/` no se indexó en `specs/README.md` (archivo
  reservado del coordinador); si `src/lib/specs-discipline.test.ts` lo exige, fallará hasta
  que el coordinador indexe.
