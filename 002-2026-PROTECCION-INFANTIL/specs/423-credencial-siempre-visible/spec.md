# SPEC-423 · La credencial de respaldo se muestra SIEMPRE — cierra I-298

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: PI-1 (`idc-32`) · **Origen**: I-298 verificado por CEO en fuente + BD 22:0x/22:1x — dejó a Jelkin trabado dos veces en producción.

## Para qué

**El defecto (I-298)**: cuatro endpoints admin usaban el patrón
```ts
passwordTemporal: emailEnviado ? undefined : password
```
El `emailEnviado` medía si el motor de notificaciones logró **ENCOLAR**, no si el correo **LLEGÓ**. Encolar siempre funciona (SPEC-201/296) → `emailEnviado` era siempre `true` → **la credencial nunca se revelaba**, incluso cuando el envío real fallaba río abajo (proveedor caído por cuota — `[daily_quota_exceeded][429]`). **El respaldo solo se activaba cuando el correo andaba, que es cuando no hace falta.**

**Origen histórico**: SPEC-117/I-37 · `admin/padres/[id]/restablecer-password:80`, cuando el envío era directo. Al pasar al motor de notificaciones (SPEC-201/296), nadie actualizó la pregunta. El mismo código se copió a padres, colegios, operadores y profesionales.

**Diseño elegido (CEO 22:1x, patrón colegios)**: **dos acciones separadas**, no una que adivina. El admin decide el canal.

- **`Restablecer contraseña`** → genera + muestra en pantalla **siempre**. No consulta el correo.
- **`Reenviar por correo`** → acción aparte, explícita: regenera + encola envío + muestra la credencial en pantalla como respaldo. Mensaje dice *«encolado»*, nunca *«enviado»*.

CEO desactivó en prod `auth.registro_enlace_profesional` y `auth.bienvenida_profesional` como rodeo hasta que este PR entre; los reactiva al mergear.

## Qué trae

### 1) Padres y Profesionales — split en dos endpoints

- **`POST /api/admin/padres/[id]/restablecer-password`** — reescrito: genera + persiste + audita + **devuelve `passwordTemporal: password` SIEMPRE**. NO toca el correo. Mensaje: *«Contraseña temporal generada. Se muestra abajo una sola vez… Para reenviarla por correo, use la acción "Reenviar por correo".»*
- **NUEVO `POST /api/admin/padres/[id]/reenviar-email`** — regenera + encola `enviarEmailCredencialesPadre` + audita + **devuelve `passwordTemporal: password` SIEMPRE** + `encolado: boolean`. Mensaje según encolado: *«Envío por correo encolado — puede no llegar (proveedor asíncrono). La temporal está abajo…»* / *«No se pudo encolar el envío…»*.
- Mismo par para `profesionales`: `restablecer-password` reescrito + `reenviar-email` nuevo.

### 2) Operadores y Colegios — fix quirúrgico del `reenviar-email` existente

- **`POST /api/admin/operadores/[id]/reenviar-email`**: el condicional `emailEnviado ? undefined : password` se **borra**. `passwordTemporal: password` siempre; se agrega `encolado`; mensaje honesto sobre asíncrono.
- **`POST /api/admin/colegios/[id]/reenviar-email`**: mismo tratamiento.

### 3) Enlace de registro — mismo criterio

- **`POST /api/admin/profesionales/solicitudes/reenviar`**: el enlace SIEMPRE viaja en la respuesta. Antes solo salía si el correo falló (mismo bug).

### 4) Client

- **`ProfesionalesGestionClient.tsx`** — nuevo botón "Reenviar por correo" junto a "Restablecer contraseña". El banner que ya mostraba `passwordTemporal` cuando venía se activa siempre ahora.
- **`PadresPageClient.tsx`** — misma pareja de botones (nueva función `reenviarPorCorreo`).

### 5) Candado permanente

- **`src/app/api/admin/credencial-siempre-visible.candado.test.ts`** — recorre `src/app/api/admin/**/route.ts`, elimina comentarios y busca el patrón
  ```
  \b(passwordTemporal|enlace|password|token)\s*:\s*[^,{}]*\?\s*undefined\s*:
  ```
  Con violaciones lista archivo + match y falla con la razón del CEO. Contraprueba: hay ≥20 archivos escaneados para que un mueve-carpetas no lo esconda.
- **Regresión probada**: `sed 's/passwordTemporal: password,/passwordTemporal: encolado ? undefined : password,/'` en un endpoint → 1 test candado ROJO listando la fuga. Restaurado.

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

Formaliza el par **`restablecer-password` + `reenviar-email`** para cuentas gestionadas por admin (padres, profesionales; colegios ya lo tenía en `regenerar-password` + `reenviar-email`; operadores queda con `regenerar-password` + `reenviar-email`). El primero NO envía; el segundo SIEMPRE regenera + encolla + muestra la credencial. **Un solo formato de respuesta**: `passwordTemporal: password` (o `enlace: url`) siempre en la respuesta, más `encolado: boolean` explícito.

El candado `credencial-siempre-visible.candado.test.ts` protege el patrón hacia adelante en TODOS los endpoints admin — cualquier nuevo endpoint que introduzca el condicional buggy queda ROJO en CI.

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
