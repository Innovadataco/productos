# Research: El comité de convivencia, operativo (SPEC-319)

Decisiones técnicas resueltas **en fuente** (candado 15 v5), antes de implementar.

## D-1 · Fuente única rol→home: módulo cliente nuevo, no importar `homeForRole`

- **Decisión**: crear `src/lib/auth/home-para-rol.ts` — función pura `homeParaRol(rol: string | undefined): string`. Los tres consumidores (`login`, `cambiar-password`, `mis-reportes`) la importan.
- **Rationale**: `homeForRole` vive en `src/lib/proxy.ts:192`, que importa `NextRequest`/`NextResponse` y es código de middleware/edge. Importarlo en componentes cliente arrastra dependencias de servidor. Un módulo puro es testeable en unit y no tiene ese problema. El brief confirma que `homeForRole` quedó fuera del runtime del landing (SPEC-287); la fuente única del cliente **es** el runtime real.
- **Coherencia**: `homeParaRol` replica exactamente el mapa canónico de `homeForRole` para los roles no-padre. Se deja un comentario cruzado en ambos archivos para que no se dupliquen silenciosamente en el futuro.
- **Mapa (Decisión A · CEO 2026-08-30 19:14)**:
  - `ADMIN` → `/dashboard/admin`
  - `OPERADOR` → `/dashboard/admin` (resuelve la contradicción con `login:36` que decía `/dashboard/admin/operadores`)
  - `SCHOOL_ADMIN` → `/dashboard/colegio`
  - `COMITE_VALIDACION` → `/dashboard/admin/comite`
  - `COMITE_CONVIVENCIA` → `/dashboard/colegio/comite`
  - `PARENT` → `/dashboard/padre` **explícito** (Decisión A — cierra deuda A-54/SPEC-317)
  - default (rol **desconocido/futuro**) → `/mis-reportes` **fallback neutro que NO dispara rebote** (evita loop; misma lección que D-99: un rol sin piso propio cae en un piso que no re-dispara un guard)
- **Alternativas descartadas**: (a) importar `homeForRole` — arrastra edge deps + código muerto (proxy.ts fuera del runtime, confirmado por Fábrica); (b) parchear las 3 copias sin fuente única — reintroduce el bug de omisión (candado 22 v5, causa raíz); (c) **default (incl. PARENT) → /mis-reportes** (Decisión B previa) — revertida por el CEO a favor de A.

## D-2 · Callsites que NO son la fuente única (quedan locales)

- `src/app/dashboard/admin/operadores/page.tsx:5` `homeParaRol` (nombre colisiona, cuidado): es el destino de **acceso-denegado al módulo operadores**, no el home del rol. Semántica distinta → queda local, con comentario. (Considerar renombrar el local a `homeAccesoDenegado` para evitar confusión de nombre con la fuente única — decisión menor en tasks.)
- `src/components/modules/NavHeader.tsx:18` `destinoLogo`: destino del click en el logo, contextual (público vs autenticado), ya maneja `COMITE_CONVIVENCIA` correcto. Queda local.

## D-3 · Rebote de `/mis-reportes` — lista explícita, NO derivada del home (crítico bajo A)

- **Decisión**: en `mis-reportes/page.tsx`, el desvío se mantiene por **lista explícita de roles con panel propio** (`ROLES_CON_PANEL_PROPIO = ["ADMIN","OPERADOR","COMITE_VALIDACION","SCHOOL_ADMIN","COMITE_CONVIVENCIA"]`). Si `user.rol` está en la lista → `router.push(homeParaRol(user.rol))`. PARENT (y cualquier rol no listado) **NO rebota**: ve su lista de reportes.
- **Separación clave**: la **condición** (quién rebota) es la lista explícita; el **destino** (a dónde) usa `homeParaRol(rol)` (consistencia — OPERADOR→/dashboard/admin).
- **Por qué NO derivar del home (bug evitado)**: bajo Decisión A, `homeParaRol(PARENT)=/dashboard/padre ≠ /mis-reportes`. La lógica ingenua `if (homeParaRol(rol) !== rutaActual) rebota` expulsaría al padre de su propia `/mis-reportes` **y** loopearía a un rol desconocido (cuyo default ES /mis-reportes). Cazado por Fábrica en el PARA; la lista explícita lo neutraliza.
- **Rationale**: `/mis-reportes` es una página **legítima del padre** (su lista de reportes, la abre desde el menú). El rebote es solo para roles que no deben verla. Es un guard semánticamente distinto de la fuente única de landing — como el fallback de `operadores/page.tsx`.

## D-4 · Acceso por email del comité: reusar `/activar` (rol-agnóstico)

- **Hallazgo en fuente**: `registro-colegio.ts:201 activarPorToken(token, password)` opera por `tokenInvitacion` + `estadoActivacion === "INVITADO"`, consume el token y setea el hash — **sin mirar el rol**. La página `/activar` y su endpoint `/api/auth/activar` sirven tal cual para el comité.
- **Decisión §2.2**: `comite-convivencia.ts crearCuenta` deja de generar `tempPassword()` visible y crea la cuenta con `estadoActivacion: "INVITADO"`, `tokenInvitacion` (32 bytes opaco), `tokenInvitacionExpiraEn` (vigencia `pagos.invitacion.token_vigencia_horas`, default 48 h), y programa el evento `colegio.invitacion.enviada` con `linkActivacion = ${baseUrl}/activar?token=…`. La UI ya no recibe ni pinta `passwordTemporal`.
- **§2.3 "Reenviar invitación"**: reemplaza `regenerarPassword` — regenera token + vigencia y reprograma el mismo evento. No pinta secreto.
- **Alternativas descartadas**: crear un flujo de activación paralelo para el comité (el brief lo prohíbe: reusar el mecanismo existente).
- **A confirmar en implement**: el evento `colegio.invitacion.enviada` usa variables `{nombreRector, nombreColegio, linkActivacion}`; para el comité se reusan las mismas (nombre genérico "Comité de Convivencia"). Si la plantilla exige `nombreRector`, se pasa un rótulo apropiado sin romper el render.

## D-5 · Firma del cierre: migración aditiva en `SolicitudComite`

- **Hallazgo**: `SolicitudComite` (schema.prisma:1687) no tiene campo de firmante. El cierre pasa por `comite-convivencia-bandeja.ts:230 resolver(colegioId, solicitudId, input, actorId, info)` con `input.resolucion`.
- **Decisión §2.4**: agregar `integranteFirmanteId String?` a `SolicitudComite` + relación opcional a `IntegranteComite`. `resolver()` recibe `input.integranteFirmanteId`, valida que sea un `IntegranteComite` **activo** del `colegioId`, lo persiste y lo incluye en el `logAudit` (`valorNuevo`). El endpoint `/api/colegio/comite/solicitudes/[id]/resolver` y el schema Zod del input suman el campo (requerido para cerrar). `CasoDetalle.tsx:197` agrega el selector poblado con los integrantes activos.
- **Migración**: aditiva, `NULL`able, sin backfill. Reversible. Filas históricas quedan con firmante `NULL` (cierres previos a esta feature).
- **Regla sin integrantes activos**: si no hay activos, el endpoint rechaza con mensaje claro (no se firma en el vacío) — FR-019.
- **Alternativas descartadas**: guardar el firmante solo en el texto `resolucion` (no consultable/trazable) o solo en `AuditLog` (el brief pide "en el caso").

## D-6 · Rediseño del inicio (§2.5) y etiqueta única

- **Patrón**: `HomeRectorPage.tsx:46-127` + `AccionesRapidas.tsx:12-38` + `EmptyStateColegio`. Se replica la estructura (cabecera humana, urgentes primero, métricas con `sub`, acciones en verbo, empty state propio) para el comité, sin duplicar menú ni la lista completa (que vive en Gestión de casos).
- **Etiqueta única**: `/dashboard/colegio/comite/casos` hoy es "Gestión casos" en `nav-items.ts:75` y "Mi bandeja" en `NavHeader.tsx:190-194,287-289`. Se elige **un** nombre y se usa en ambos. Propuesta: "Gestión de casos" (coherente con el lateral, que es la navegación primaria). Confirmar en implement con el estándar de nav.

## D-7 · Higiene de rol (§2.6)

- **Decisión**: `NavHeader.tsx:59 esEmpleado` suma `COMITE_CONVIVENCIA`. Así el bloque `!esEmpleado` (`:195,:265`) deja de ofrecer "Mi panel"/"Círculo de Confianza"/"Mis reportes" al comité. Es una segunda capa además del guard `esDestinoPermitidoPorRol` existente.
