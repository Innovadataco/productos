# SPEC-423 · La credencial de respaldo se muestra SIEMPRE — cierra I-298

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: PI-1 (`idc-32`) · **Origen**: I-298 verificado por CEO en fuente + BD 22:0x/22:1x — dejó a Jelkin trabado dos veces en producción.
**Actualizado 22:5x**: contrato Jelkin refinado — dos botones con semántica distinta (ver §Diseño elegido).

## Para qué

**El defecto (I-298)**: cuatro endpoints admin usaban el patrón
```ts
passwordTemporal: emailEnviado ? undefined : password
```
El `emailEnviado` medía si el motor de notificaciones logró **ENCOLAR**, no si el correo **LLEGÓ**. Encolar siempre funciona (SPEC-201/296) → `emailEnviado` era siempre `true` → **la credencial nunca se revelaba**, incluso cuando el envío real fallaba río abajo (proveedor caído por cuota — `[daily_quota_exceeded][429]`). **El respaldo solo se activaba cuando el correo andaba, que es cuando no hace falta.**

**Origen histórico**: SPEC-117/I-37 · `admin/padres/[id]/restablecer-password:80`, cuando el envío era directo. Al pasar al motor de notificaciones (SPEC-201/296), nadie actualizó la pregunta. El mismo código se copió a padres, colegios, operadores y profesionales.

**Diseño elegido (Jelkin 22:5x, refina CEO 22:1x)**: **dos acciones separadas** con **semántica distinta**:

- **`Restablecer contraseña` / `Regenerar contraseña`** → genera + muestra en pantalla **siempre**. No toca el correo. Es la salida cuando el admin necesita la credencial en la mano.
- **`Reenviar por correo`** → acción aparte, explícita: regenera + encola envío. **NUNCA devuelve la credencial** cuando el envío se encoló bien — para eso está el otro botón. Único fallback: si ni siquiera se pudo ENCOLAR, la credencial viaja como copia manual para no dejar al admin atascado. Mensaje dice *«encolado»*, nunca *«enviado»* (SPEC-201/296 es asíncrono).

**Por qué dos botones y no uno «adivinador»** (Jelkin): un botón que muestra u oculta según flags convierte la respuesta en un misterio; dos botones dan control explícito y hacen la auditoría legible (un `reenviar` sin credencial en el body es prueba de que se disparó por correo).

CEO desactivó en prod `auth.registro_enlace_profesional` y `auth.bienvenida_profesional` como rodeo hasta que este PR entre; los reactiva al mergear.

## Qué trae

### 1) Padres y Profesionales — split en dos endpoints

- **`POST /api/admin/padres/[id]/restablecer-password`** — reescrito: genera + persiste + audita + **devuelve `passwordTemporal: password` SIEMPRE**. NO toca el correo. Mensaje: *«Contraseña temporal generada. Se muestra abajo una sola vez… Para reenviarla por correo, use la acción "Reenviar por correo".»*
- **NUEVO `POST /api/admin/padres/[id]/reenviar-email`** — regenera + encola `enviarEmailCredencialesPadre` + audita. Devuelve `encolado: boolean` y **`passwordTemporal` SOLO como fallback** cuando `encolado === false` (Jelkin 22:5x: «reenviar NUNCA la devuelve»; el único fallback existe para no atascar al admin si ni siquiera se encoló).
- Mismo par para `profesionales`: `restablecer-password` reescrito + `reenviar-email` nuevo con el mismo contrato.

### 2) Operadores y Colegios — reenviar-email respeta el contrato Jelkin

- **`POST /api/admin/operadores/[id]/reenviar-email`**: mantiene `passwordTemporal: emailEnviado ? undefined : password` — happy path NO devuelve, fallback SÍ. Los tests viejos (I-37) codificaban ya ese contrato; los mensajes se aclaran para hablar de «encolado» en vez de «enviado».
- **`POST /api/admin/colegios/[id]/reenviar-email`**: mismo tratamiento.

### 3) Enlace de registro — sigue «SIEMPRE muestra»

- **`POST /api/admin/profesionales/solicitudes/reenviar`**: el enlace SIEMPRE viaja en la respuesta. Antes solo salía si el correo falló (mismo bug I-298). Este endpoint es contrato «SIEMPRE muestra» —el equivalente a «restablecer» para el flujo de solicitud— porque el admin necesita el enlace en pantalla para pasárselo al profesional por otro canal si el correo llega tarde.

### 4) Client

- **`ProfesionalesGestionClient.tsx`** — nuevo botón "Reenviar por correo" junto a "Restablecer contraseña". El banner que ya mostraba `passwordTemporal` cuando venía se activa siempre ahora.
- **`PadresPageClient.tsx`** — misma pareja de botones (nueva función `reenviarPorCorreo`).

### 5) Candado permanente — foco en endpoints «SIEMPRE muestra»

- **`src/app/api/admin/credencial-siempre-visible.candado.test.ts`** — recorre `src/app/api/admin/**/route.ts` pero SOLO evalúa los que caen en el contrato «SIEMPRE muestra»:
  - `**/restablecer-password/route.ts`
  - `**/regenerar-password/route.ts`
  - `**/solicitudes/reenviar/route.ts` (enlace de registro)

  En esos archivos, elimina comentarios y busca el patrón
  ```
  \b(passwordTemporal|enlace|password|token)\s*:\s*[^,{}]*\?\s*undefined\s*:
  ```
  Con violaciones lista archivo + match y falla con la razón del CEO. Contraprueba: hoy hay 5 endpoints alcanzados (piso duro); si desaparece uno, el candado avisa.
- **`reenviar-email/**` queda fuera del scan a propósito**: ahí el condicional ES el contrato Jelkin («reenviar NUNCA la devuelve» salvo fallback de encolado).

## Candados

- **`emailEnviado`/`encolado` mide ENCOLADO, no ENTREGA** — no confiar en él para decidir visibilidad de secretos. El mensaje siempre distingue las dos cosas.
- **La credencial se muestra UNA SOLA VEZ** — no se persiste en claro, no se loguea. Comportamiento inalterado.
- **No inventar un chequeo del estado final** — es asíncrono, el panel no puede esperarlo (CEO 22:0x: *«terminarías con otro "cree que sabe" distinto»*).
- **Colegios**: `regenerar-password` (ya devolvía password siempre) queda intacto — el fix es en `reenviar-email` que regenera + envía. Coherente con el patrón "dos acciones" que colegios ya establecía.
- **Auditoría inalterada** — `logAudit` sigue registrando cada mutación con `USER_UPDATE`.

## Verificación

- `npm run test:unit` → **2319/2319** (2 nuevos del candado).
- `tsc --noEmit` verde. `arch:check` VERDE completo (a/b/c/d/d-bis/e/f). `tokens:check` piso 1079 intacto.
- **Regresión candado**: demostrada con `sed` que reintroduce el bug → test ROJO con el mensaje del CEO.

## Impacto en arquitectura:

Formaliza el par **`restablecer-password` + `reenviar-email`** para cuentas gestionadas por admin (padres, profesionales; colegios y operadores siguen con `regenerar-password` + `reenviar-email`, misma semántica).

**Semántica de respuestas — contrato Jelkin**:
- `restablecer-password` / `regenerar-password` / `solicitudes/reenviar`: **la credencial (o el enlace) SIEMPRE viaja en el body**. `passwordTemporal: password` incondicional; `enlace: url` incondicional.
- `reenviar-email/*`: **la credencial NUNCA viaja cuando el envío se encoló bien**. `passwordTemporal: encolado ? undefined : password`. Fallback existe para no atascar al admin si el motor de notif ni siquiera acepta la tarea.

El candado `credencial-siempre-visible.candado.test.ts` protege el primer contrato hacia adelante en los endpoints listados — cualquier nuevo endpoint «SIEMPRE muestra» que introduzca el condicional buggy queda ROJO en CI. Los endpoints `reenviar-email` quedan explícitamente fuera del scan (el condicional ahí es el contrato).

## Fuera de alcance

- **Reactivar en prod las reglas `auth.registro_enlace_profesional` y `auth.bienvenida_profesional`**: lo hace el CEO cuando este PR entre, es su rodeo temporal.
- **Modificar `regenerar-password` de operadores/colegios**: ya devuelve password siempre; queda como está.
- **Chequeo asíncrono del estado real del correo** (webhook de Resend + polling): sería otro SPEC. La honestidad es no afirmar lo que no consta.

## Referencias

- **I-298** · verificado por CEO en fuente y BD.
- **SPEC-117/I-37** — origen histórico del patrón.
- **SPEC-201/296** — motor de notificaciones asíncrono que rompió la pregunta.
- **SPEC-421** — hereda el bug en `profesionales/restablecer-password`; ahora corregido y separado.
- **admin/colegios/[id]/regenerar-password:88** — patrón "credencial siempre visible" ya existente que se replica.
- Worktree `.worktrees/pi-SPEC-423` desde `origin/main f57eb7033`.
