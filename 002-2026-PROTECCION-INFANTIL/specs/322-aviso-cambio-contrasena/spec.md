# SPEC-322 · Aviso por correo cuando cambia la contraseña

> Status: PLANEADO · Rama: work/pi-SPEC-322-aviso-cambio-contrasena · Radicado: 002-PI-222

## Contexto

Hoy ninguno de los 8 caminos que escriben `passwordHash` avisa al dueño de la cuenta. Si alguien
roba la sesión y cambia la clave, el usuario legítimo no se entera. I-214.

## Alcance

### US1 — El usuario recibe un correo de seguridad cuando su contraseña cambia

**Caminos cubiertos (el usuario actúa sobre su propia cuenta):**

| # | Camino | Ruta |
|---|---|---|
| 1 | Restablecer por token | `POST /api/auth/recuperar/restablecer` |
| 2 | Cambio voluntario/forzado | `POST /api/auth/cambiar-password` |
| 4 | Admin regenera clave operador/comité | `POST /api/admin/operadores/[id]/regenerar-password` |
| 6 | Admin regenera clave rector | `POST /api/admin/colegios/[id]/regenerar-password` |
| 7 | Rector regenera clave comité | `POST /api/colegio/comite/cuenta/regenerar-password` |
| 8 | Activación por invitación | `POST /api/auth/activar` |

**Fuera de alcance — caminos 3 y 5:** sí envían un correo de credenciales con la nueva clave al
mismo destinatario → duplicar el aviso sería peor que no mandarlo. Los caminos 4/6/7 NO mandan
ningún correo al dueño, por eso entran en este SPEC.

**Contenido del correo:** contraseña cambió + cuándo (fecha y hora Colombia) + qué hacer si no fue el
usuario (recuperar + contactar soporte). Sin la contraseña, sin enlaces de sesión.

**Regla:** `obligatoria: true` (evento transaccional de seguridad, no se puede dar de baja).

**Sin retención nocturna:** `auth.password_cambiada` entra en `CANALES_SIN_QUIET_HOURS` (EMAIL ya
está incluido en `quiet-hours.ts:21`).

### Ajuste previo requerido

`restablecerPassword()` devuelve solo `{ok:true}` — la ruta no sabe el email. Extender
`ResultadoRestablecer` en `src/lib/dal/types/auth.ts:34` para devolver `email: string` en la rama
de éxito.

## Criterios de éxito

- SC-01: tras cambiar la contraseña por cualquiera de los 3 caminos, llega un correo real al
  destinatario (Candado 25: evidencia = captura del correo recibido).
- SC-02: el correo llega de noche, en horario de silencio (no se retiene hasta el día siguiente).
- SC-03: el correo no contiene la contraseña ni la sesión.
- SC-04: `email.migracion.test.ts` pasa — `auth.password_cambiada` está en `EVENTOS_MIGRADOS`
  con regla activa + plantilla existente.
- SC-05: un fallo al enviar el correo no rompe el cambio de clave (try/catch en la ruta).

## Candados activos

- Solo-lectura ABSOLUTA: `src/lib/ai/**`, `prisma/**` (cero migración · cero campo nuevo),
  `deploy-prod.sh`, `.github/workflows/**`
- NO cambiar `api/admin/padres/[id]/restablecer-password/route.ts`
- NO tocar guard `/cambiar-password` en middleware
- Candado 22 v5: enumerar cada callsite con archivo:línea en tasks.md
- Candado 24 v2: correr tests de todo lo que toca
- Candado 25: evidencia = correo recibido de verdad, con captura
