# SPEC-338 · Registro avisa "ya tenés una cuenta" (I-226)

**Status**: IMPLEMENTADO
**Radicado**: I-226 · Prioridad 🟠 (frenó a Jelkin) · anti-enumeración (OWASP)
**Impacto en arquitectura:** ninguno — nuevo evento+plantilla en el motor de notificaciones (`auth.cuenta_existente`) + wrapper en `email.ts` + un envío en la rama `existente` de `verificar/solicitar`. NO se toca el modelo (email @unique sigue).

## Problema (verificado en fuente)

El registro self-service es `POST /api/auth/verificar/solicitar`. `AutenticacionService.solicitarCodigo` devuelve `{ok:true, tipo:"existente"}` si el correo ya tiene cuenta (autenticacion.ts:254). La ruta responde el mensaje genérico ("Si el email es válido, recibirás un código") — **anti-enumeración en pantalla ya correcto** — pero en esa rama **NO envía ningún correo** → el usuario "no recibe el código", sin feedback (Jelkin: intentó registrarse como padre con un correo que ya era SCHOOL_ADMIN).

## Fix (anti-enumeración OWASP)

La pantalla NO cambia (nunca revela existencia). El feedback va SOLO al buzón:
- correo nuevo → código (como hoy).
- correo existente → correo **"ya tenés una cuenta"** con enlaces a entrar y a recuperar clave.

## Requisitos funcionales

- **FR-001** Nuevo evento `auth.cuenta_existente` con plantilla `auth.cuenta_existente.email` (lenguaje de padre A-62: "Ya tenés una cuenta con este correo" + entrar + recuperar clave) y regla `rol:"ALL"`, `obligatoria:true` en el seed.
- **FR-002** `email.ts`: `enviarEmailCuentaExistente(email)` → `programar` con el evento + `{urlLogin, urlRecuperar}`.
- **FR-003** `verificar/solicitar`, rama `existente`: `enviarEmailCuentaExistente(email)` fire-and-forget (fallo silencioso, como el envío del código); la respuesta en pantalla queda IDÉNTICA.
- **FR-004** `email.migracion.test.ts`: `auth.cuenta_existente` entra en EVENTOS_MIGRADOS (ratchet: regla+plantilla EMAIL post-seed).
- **FR-005** NO se toca el modelo. Un correo = una cuenta sigue vigente.

## Nota A-63

La regla usa `rol:"ALL"` (precedente: `auth.password_cambiada`). El identity de regla incluye `rol` (SPEC-333); `"ALL"` es valor válido de la columna String y, al ser el único rol del evento, el motor no filtra por rol.

## Success Criteria
- **SC-001** Test de ruta (BD): correo registrado → 202 con mensaje genérico Y una `Notificacion` de `auth.cuenta_existente` al buzón.
- **SC-002** `email.migracion.test.ts` verde con el evento nuevo.
- **SC-003** `verificaciones` + `specs-discipline` verdes.
