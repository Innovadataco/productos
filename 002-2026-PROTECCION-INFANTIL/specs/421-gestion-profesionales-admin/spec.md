# SPEC-421 · El admin gestiona psicólogos igual que gestiona padres (mirror `/admin/padres`) + reenvía solicitudes de registro cuando el correo se cae

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: PI-1 (`idc-32`) · **Origen**: brief CEO 20:3x/20:4x/20:5x (Jelkin). **Prioridad alta**: destraba la prueba de punta a punta del Verificador (SPEC-408).

## Para qué

Con el correo caído por cuota desde las 06:16, el registro del profesional se rompe: `RegistroEnlaceService.crear()` NO crea el Usuario — solo un `TokenRegistro`, y el token en claro **solo viaja en el correo**. Sin correo, no hay enlace → no hay Usuario → **el admin no tiene a quién restablecer nada**. Este SPEC le da al admin dos salidas manuales:

1. **Espejo de `/admin/padres`**: gestionar cuentas ya creadas (listar, ver detalle, dar de baja, reactivar, restablecer contraseña). El profesional es externo — como el padre — no interno; su forma de gestión es la del padre, no la del operador.
2. **Solicitudes de registro pendientes**: ver quién pidió entrar. Si el correo no salió, el admin reenvía el enlace y **la URL se muestra una vez en pantalla** para entregarla a mano — mismo criterio que `restablecer-password` de padres.

**Límite duro (orden Jelkin)**: el admin **no crea** cuentas (padre y psicólogo se registran solos) y **no llena** el perfil (ficha, tarifa y los 4 documentos los sigue cargando el propio profesional · SPEC-391).

Sin modelo de asignación: al psicólogo lo elige el padre (SPEC-395 · directorio abierto).

## Qué trae

### 1) Módulo nuevo `profesionales_admin`

`src/lib/permisos-catalogo.ts` entrada `profesionales_admin` en categoría admin (default: SOLO ADMIN por `modulosSeed.map(...)`). `admin_verificacion_profesionales` (SPEC-408) sigue existiendo aparte — verifica documentos; este otro gestiona cuentas.

### 2) API espejo de `/admin/padres` (sin vigencia, sin círculo)

- **`GET /api/admin/profesionales`** — listado paginado con filtro `q` (email/nombre). Mismo `padresQuerySchema` en shape.
- **`GET /api/admin/profesionales/[id]`** — detalle (email, nombre, estado, debeCambiarPassword, creadoEn, ultimaSesion).
- **`DELETE /api/admin/profesionales/[id]`** — desactivar (baja lógica, mismo patrón).
- **`POST /api/admin/profesionales/[id]/reactivar`** — vuelve a activo.
- **`POST /api/admin/profesionales/[id]/restablecer-password`** — **espejo EXACTO** de `admin/padres/[id]/restablecer-password:80`:
  - genera clave temporal (`randomBytes(6).toString("hex")`),
  - hashea + marca `debeCambiarPassword=true`,
  - intenta enviar por email,
  - devuelve **`passwordTemporal: emailEnviado ? undefined : password`** con mensaje literal *«No se pudo enviar el email. Copie la contraseña temporal y compártala manualmente (se muestra una sola vez).»*
  - nunca persiste en claro ni loguea la clave.

### 3) API para solicitudes pendientes

- **`GET /api/admin/profesionales/solicitudes`** — `TokenRegistro` con `rol=PROFESIONAL`, `usado=false`, `expiraEn > now`. Devuelve email + creadoEn + expiraEn. **Nunca** el token en claro ni el hash.
- **`POST /api/admin/profesionales/solicitudes/reenviar`** con body `{ email }`:
  - Reusa `RegistroEnlaceService.solicitarEnlace(email, "PROFESIONAL")` — anti-enumeración incluida (SPEC-338).
  - Si el email YA tiene cuenta (`tipo: "existente"`): devuelve mensaje que instruye usar `Restablecer contraseña`.
  - Si el rate-limit se agotó: 429.
  - Intenta enviar el enlace por correo.
  - **`enlace: emailEnviado ? undefined : ${baseUrl}/registro-profesional/crear-clave/${token}`** — la URL viaja solo si el email falló, y se muestra en pantalla al admin **una sola vez**.
  - Nunca persiste el token en claro (`TokenRegistro` guarda solo el hash).

### 4) Pantalla admin — dos tabs

`/dashboard/admin/profesionales/gestion` (gate `profesionales_admin`). Client component `ProfesionalesGestionClient`:

- **Cuentas**: input de búsqueda + lista de cuentas con estado + acciones inline (Restablecer contraseña · Dar de baja · Reactivar). Banner cuando la respuesta trae `passwordTemporal` — se muestra una vez en `font-mono` con etiqueta *«se muestra una sola vez»*.
- **Solicitudes pendientes**: listado con creadoEn/expiraEn + botón "Reenviar enlace". Cuando la respuesta trae `enlace`, se muestra igual que la contraseña.

Diseño con tokens (`bg-pino`, `bg-ambar`, `bg-tinta/5`, `text-estado-*`). Instrument Serif titulares, DM Mono etiquetas técnicas y correos. `anim-entrada` escalonada.

### 5) Nav

`/dashboard/admin/profesionales/gestion` entrada en `ADMIN_NAV_ITEMS` con módulo `profesionales_admin`.

## Candados

- **El admin no crea**: no hay `POST /api/admin/profesionales` que cree Usuario. Los dos endpoints hermanos (restablecer + reenviar) operan sobre entidades ya existentes.
- **El admin no llena perfil**: el service no toca `PerfilProfesional`. Perfil/tarifa/documentos vienen de SPEC-391 (`/api/profesional/perfil`) y SPEC-408 (verificación).
- **Secretos una sola vez**: contraseña temporal + enlace de registro viajan **solo en la respuesta cuando el email falla**. Nunca se persisten en claro ni se loguean (mismo patrón padres).
- **Anti-enumeración** en reenviar: reusa `RegistroEnlaceService.solicitarEnlace` — respuesta idéntica exista o no la cuenta.
- **Rate-limit** `admin_write` en todas las mutaciones + `admin_read` en las lecturas.
- **Auditoría** en cada acción (`USER_UPDATE` con `tipoRecurso: "Usuario:PROFESIONAL"` + valorAnterior/valorNuevo).
- **Sin cupo, sin asignación**: `profesionales-admin.ts` no importa `OperadorService` ni el modelo de asignación. Al psicólogo lo elige el padre.

## Verificación

- `npm run test:unit` → **2296/2296**.
- `tsc --noEmit` verde.
- `arch:check` completo VERDE (a/b/c/d/d-bis/e/f).
- `tokens:check` VERDE (piso 1079 intacto).
- **Post-deploy** — para Calidad:
  1. Un profesional pide registrarse → aparece en "Solicitudes pendientes".
  2. Con el correo caído, admin da click en "Reenviar" → la URL aparece en pantalla.
  3. Admin entrega la URL al profesional; el profesional crea clave; su cuenta existe.
  4. Aparece en la lista "Cuentas". El admin puede dar de baja, reactivar y restablecer contraseña — y cuando el correo no sale, la clave se muestra una vez para copiar a mano.
  5. `audit_logs` muestra los eventos `USER_UPDATE / CODE_REQUEST` con `tipoRecurso: "Usuario:PROFESIONAL" | "TokenRegistro:PROFESIONAL"`.

## Impacto en arquitectura:

Nueva **capa de gestión externa** para el rol PROFESIONAL: se instala junto a la gestión ya existente para PARENT (`/admin/padres`), separada de la gestión de internos (`/admin/operadores`), separada también de la verificación de documentos (`admin_verificacion_profesionales` · SPEC-408). Cada uno con su módulo, su UI y sus endpoints — la separación de poderes se mantiene.

El patrón **"secreto en pantalla si el correo falla"** — copiado exacto de padres — queda instalado como respuesta estándar del proyecto ante caídas del proveedor de correo: contraseñas temporales, enlaces de registro y códigos que hoy dependen de la bandeja tienen un fallback manual sin comprometer la seguridad (se muestran una sola vez, no se persisten en claro, no se loguean).

## Fuera de alcance

- **Vigencia del servicio**: es del padre (SPEC-119). El profesional no tiene ventana de servicio.
- **Círculo de confianza**: es del padre.
- **Creación de cuenta desde admin**: eliminada del alcance por Jelkin (20:5x). Si mañana IDC capta profesionales a mano vía email desde adentro, se abre otro SPEC.
- **Editar nombre/email desde admin**: fuera de alcance. Si hace falta, se toca en otro SPEC (padres tampoco tiene edit inline).
- **Purga automática de solicitudes vencidas**: fuera de alcance. La lista muestra las que aún viven; las vencidas caen solas por su `expiraEn`.

## Referencias

- **Brief CEO 20:3x / 20:4x / 20:5x** (orden Jelkin).
- **`/admin/padres/[id]/restablecer-password:80`** — patrón espejo exacto.
- **SPEC-391** — registro del profesional (paso complementario).
- **SPEC-408** — Verificador que necesita cuentas creadas para probar el recorrido.
- **SPEC-339** · **SPEC-338** — `RegistroEnlaceService` y anti-enumeración que reusamos.
- Worktree `.worktrees/pi-SPEC-421` desde `origin/main 36564bc55`.
