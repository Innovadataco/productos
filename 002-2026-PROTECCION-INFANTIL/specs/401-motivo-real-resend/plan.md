# Plan · SPEC-401 · I-283 — guardar el motivo real del proveedor de correo

**Status**: EN CURSO
**Fecha**: 2026-09-03 · **Dev**: Infra (PI-2)

## Decisiones

**Texto plano formateado sobre columnas nuevas.** Añadir `ultimoErrorNombre String?` + `ultimoErrorCodigo Int?` sería más "limpio" para agregaciones futuras, pero exige una migración, tocar `NotificacionRepository.marcarFallida{,Definitiva}` y sus consumidores, y sube el radio del PR. El campo `ultimoError String?` ya existe y no está limitado: guardar `"[rate_limit_exceeded][429] You exceeded the rate limit..."` cabe, es humano y sobrevive a `PATRON_CUOTA` sin cambios. Si mañana Data pide columnas dedicadas, se abren en otro PR con backfill parseando el texto — no rompemos hoy.

**PII: hash SHA-256 truncado, no borrado silencioso.** El correo del destinatario puede aparecer en el mensaje del proveedor ("Recipient <a@b.com> is on the suppression list"). Borrarlo pierde la pista de que el mismo destinatario está haciendo rebotar todos los intentos. Hasheado y truncado a 8 hex se puede correlar sin exponer la dirección. El salt viene de `PII_HASH_SALT` con fallback a un salt de módulo — igual que ya se hace en `src/lib/audit.ts` para IPs.

**El helper de sanitización es puro** — sin `crypto` async, sin I/O. Todo el test se hace unit con vectores fijos. La única dependencia es `crypto.createHmac`.

**`EmailProveedorError` extends Error (no AppError).** `AppError` está pensado para respuestas HTTP con `statusCode` semántico HTTP hacia el usuario final. Aquí el consumidor primario es el `catch` de `procesar-lote` que solo mira `.message`. Una clase dedicada permite además `err instanceof EmailProveedorError` si algún día conviene distinguir errores del proveedor de otros. Sigo el mismo patrón interno que `WebhookResendError` en `src/lib/notificaciones/webhook-resend.ts:47`.

**Señal `senalProveedorEmailCaido` mira estados terminales.** Excluir `REINTENTANDO` es deliberado: una notificación que fallará puede aún terminar bien en el próximo backoff. Solo el `FALLIDA` definitivo (agotó intentos) cuenta como "el proveedor no acepta". Esto asegura que la señal no se dispare por una avalancha transitoria que se recupera sola.

**Convive con `senalCorreosFallidos`, no la reemplaza.** La existente mira 24 h de volumen y patrón de cuota; la nueva mira "cero éxitos en la ventana reciente". Un canal totalmente caído dispara ambas — está bien, dan lecturas distintas ("hay volumen inusual" vs "no está saliendo ni uno").

**Sin `docs/architecture/*.md`.** Ningún cambio de modelo de datos ni de contratos. La spec dice "impacto en arquitectura: no".

## Archivos

- **NUEVO** `src/lib/notificaciones/motivo-error.ts` — helper puro + `EmailProveedorError`.
- **NUEVO** `src/lib/notificaciones/motivo-error.test.ts` — unit.
- **EDIT** `src/lib/notificaciones/enviar-email.ts` — lanzar `EmailProveedorError`.
- **EDIT** `src/lib/dal/services/inicio-admin.ts` — agregar `senalProveedorEmailCaido` a `calcularEstadoInicio`.
- **EDIT** `src/lib/notificaciones/procesar-lote.test.ts` — nuevo caso "persiste motivo real".
- **EDIT** `src/app/api/admin/inicio/senales/route.test.ts` — nuevo caso "10 FALLIDA seguidas → alta".
- **EDIT** `prisma/seed.ts` — parámetro `monitoreo.notif.proveedor_caido_ventana`.

## Riesgos

- **Falsos positivos en `senalProveedorEmailCaido`** si el sistema estuvo idle mucho tiempo y las 10 últimas notificaciones son viejas. Mitigación: la ventana solo mira TERMINADAS, no vencidas; si no llegan a `ventana` filas terminadas, la señal no se dispara (`if rows.length < ventana return null`).
- **Cambios en la forma del error de Resend** entre versiones del SDK. Mitigación: `resumirErrorProveedor` prueba `.name`, `.message`, `.statusCode` de forma defensiva y siempre devuelve un `ResumenErrorProveedor` válido.
- **El `PATRON_CUOTA` deja de casar** si el nuevo formato cambia el orden. Mitigación: el mensaje sanitizado se concatena AL FINAL de los brackets — el regex sigue casando "quota"/"429"/"rate limit" en cualquier posición del string, y hay test que lo verifica.
