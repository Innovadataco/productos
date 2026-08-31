# SPEC-318 · Los tres porteros apagados

> **Status**: DESARROLLO (Rama: work/pi-SPEC-318-tres-porteros-apagados · Radicado: 002-PI-218)

**Impacto en arquitectura:** Emisión de la cookie `sesion_estado` desde las rutas de autenticación (login, activar, restablecer) mediante helper compartido en `src/lib/routing/sesion-estado-emitter.ts`. Refresco periódico vía `SessionPingProvider` que pasa de `/api/session/ping` a `/api/vigencia/refresh`. Cierre del ciclo en `consentimiento/aceptar` y en los dos handlers de contraseña (caminos 2 y 3 de A-59, ya en main). Auditoría de cambio de contraseña con nuevo valor `AccionAudit` + migración. Visibilidad persistente en `consentimiento/guard.ts` (error estructurado). Cero cambio en el middleware Edge, cero nueva librería.

## Contexto

`middleware.ts:187` lee `sesion_estado` y ejecuta los tres guardas solo `if (estado)`. Cuando la cookie no existe (que es el 100 % del tráfico real), el bloque nunca corre y los tres guardanes están apagados: un colegio vencido navega libremente, un usuario sin consentimiento entra al dashboard, uno con `debeCambiarPassword=true` salta `/cambiar-password`. Incidencia I-211 · I-217. La causa raíz: `POST /api/vigencia/refresh` firma y emite la cookie correctamente pero **nadie lo invoca** al autenticarse. El histórico del bucle I-25/I-111/I-141 está documentado en `guardias.ts:6-11`.

## Alcance

### US1 — La señal se enciende (§3.1)

Después de autenticarse, antes de que el browser pueda navegar a una ruta protegida, la cookie `sesion_estado` existe y refleja el estado real del usuario.

**Callsites a cablear:**

| # | Ruta | Evento |
|---|---|---|
| A1 | `POST /api/auth/login` | Usuario entra con credenciales |
| A2 | `POST /api/auth/activar` | Usuario activa por invitación |
| A3 | `POST /api/auth/recuperar/restablecer` | Usuario restablece por token |

**Helper nuevo:** `src/lib/routing/sesion-estado-emitter.ts` — `emitirSesionEstado(userId: string): Promise<string>` — hace el mismo `Promise.all` que `vigencia/refresh/route.ts` y devuelve el valor firmado de la cookie. Las rutas A1–A3 y `vigencia/refresh` lo usan; cero duplicación.

**`SessionPingProvider`:** pasa de `POST /api/session/ping` a `POST /api/vigencia/refresh` (al montar y cada 5 minutos). Esto garantiza que la cookie se refresca durante la sesión abierta (§3.4).

### US2 — El ciclo se cierra (§3.2)

Cada operación que cambia una de las tres condiciones refresca la cookie.

| # | Ruta | Qué cambia | Email disponible |
|---|---|---|---|
| B1 | `POST /api/consentimiento/aceptar` | `requiereConsentimiento → false` | `user.id` de `verifyAuth()` |
| B2 | `POST /api/auth/cambiar-password` | `debeCambiarPassword → false` | ya tiene A-59 wrapper |
| B3 | `POST /api/auth/recuperar/restablecer` | `debeCambiarPassword → false` | ya tiene A-59 wrapper |

Callsites B2 y B3 ya están en main (A-59): se suma el refresco de cookie junto al aviso de correo existente.

Callsite 4 del instructivo (cambios de vigencia): cubierto indirectamente por `SessionPingProvider` que refresca cada 5 min — un colegio con `finServicio` en el pasado queda sin acceso en ≤5 min, que cumple §3.4.

### US3 — Conducta explícita ante cookie ausente (§3.3)

Si `sesion_estado` falta o expiró, el sistema la **produce** (US1 la emite en auth; `SessionPingProvider` la refresca en sesión activa). El middleware nunca hace fail-closed por cookie ausente — esa conducta es ya la actual y debe preservarse para no tumbar producción.

`consentimiento/guard.ts:17-22` ya hace `console.error` en `:19`. Se suma logging estructurado (objeto JSON con `usuarioId`, `evento`, `timestamp`) compatible con el sistema de logs del servidor. El `console.error` existente no se toca.

### US4 — Vigencia fuera del login (§3.4)

`SessionPingProvider` llama `POST /api/vigencia/refresh` al montar y cada 5 min. Un colegio cuyo `finServicio` venció con sesión abierta recibirá una cookie con `vigencia !== ACTIVA` en ≤5 min; el middleware entonces lo redirige. Cumple "sin esperar 24h".

El docstring de `vigencia.ts:26-29` se actualiza para reflejar la realidad: el middleware cubre la vigencia vía cookie; los layouts y APIs de cliente ya no lo aplican directamente.

### US5 — Auditoría del cambio de contraseña (§3.5)

Los tres caminos propios (token, voluntario, activación) no dejan huella hoy. Se agrega:
- Valor `USUARIO_CAMBIO_PASSWORD` al enum `AccionAudit` en `prisma/schema.prisma:53` + migración Prisma
- Auditoría en los tres caminos con IP por `protegerIp()` (HMAC-SHA256, nunca en claro)
- Los resets de tercero (`admin/operadores/[id]/regenerar-password`, etc.) ya se auditan y no se tocan

### US6 — Quien ya entró sin firmar (§3.6)

No se re-registra a nadie. Al volver, el usuario cae en `/consentimiento` con su colegio/cursos/profesores intactos, sin acceso al dashboard hasta firmar. Decisión de Jelkin registrada en el instructivo.

## Criterios de éxito

- SC-01: login + navegar a ruta protegida → middleware bloquea si `requiereConsentimiento=true`. Sin cookie previa → se crea en el login.
- SC-02: aceptar consentimiento → refresca cookie → sin bucle. Recargar 3 veces → sin bucle.
- SC-03: usuario con `debeCambiarPassword=true` no puede saltarse `/cambiar-password` por URL.
- SC-04: colegio con `finServicio` en el pasado + sesión abierta → deja de operar en ≤5 min sin logout.
- SC-05: cambiar clave por los tres caminos → fila en `AuditLog`, IP protegida (HMAC, no en claro).
- SC-06: test "cookie ausente" afirma que el sistema produce la cookie (no expulsa).
- SC-07: `specs-discipline.test.ts` pasa (Status catálogo · Impacto · fila README).

## Candados

- Candado 26: grep de si el guard se evalúa antes de tocar cada guard
- Candado 15 v5: leer línea a línea `middleware.ts`, `guardias.ts`, `vigencia-cookie.ts`, `vigencia.ts` (hecho pre-spec)
- Candado 22 v5: callsites completos con archivo:línea en tasks.md
- Candado 24 v2: tests de todo lo editado, incluyendo `specs-discipline.test.ts`
- Candado 25: evidencia = navegación real en producción (7 puntos del instructivo §6)
- Solo-lectura: `src/lib/ai/**`, `.github/workflows/**`, `deploy-prod.sh`, comité/profesores (A-57/A-58)
- Edge: el middleware NO toca Prisma (helper en Node runtime)
- Disciplina de specs: Status catálogo · `Impacto en arquitectura:` · fila `specs/README.md`
