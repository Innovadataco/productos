# SPEC-401 · I-283 — guardar el motivo real del proveedor de correo

**Status**: EN CURSO
**Fecha**: 2026-09-03 · **Dev**: Infra (PI-2) · **Origen**: veredicto CEO idc-a6 10:55 (I-283)

## Para qué

El envío real de correo (`src/lib/notificaciones/enviar-email.ts:35-37`) hace `logger.error("Resend error notificación:", result.error)` y a continuación `throw new Error("Error al enviar notificación por email")`. Ese texto genérico es lo único que se persiste en `Notificacion.ultimoError`; el motivo real del proveedor muere en un log efímero del contenedor. Resultado medido en producción hoy: **10.498 fallos con el mismo texto**, imposible distinguir «cuota agotada» de «dominio sin verificar» o «cuenta suspendida».

Con este PR el próximo diagnóstico es de un minuto: cualquier fila `FALLIDA` cuenta por sí sola el nombre del error, el `statusCode` HTTP y un mensaje sanitizado del proveedor.

## Qué trae

### 1) Helper puro `src/lib/notificaciones/motivo-error.ts`

- `interface ResumenErrorProveedor { name: string; message: string; statusCode?: number; codigo?: string }`.
- `resumirErrorProveedor(err: unknown): ResumenErrorProveedor` — acepta la forma `result.error` del SDK de Resend (`{name, message, statusCode?}`), un `Error` nativo, o cualquier otra cosa (envuelve como `"UnknownError"`).
- `sanitizarPII(texto: string): string` — reemplaza:
  - correos electrónicos con `<email:HHHHHHHH>` (HMAC-SHA-256 truncado 8, usando `PII_HASH_SALT` con fallback a un salt de módulo).
  - tokens con prefijos conocidos: `re_...`, `sk_...`, `pk_...`, `whsec_...`, `Bearer <token>`.
- `serializarMotivoParaPersistencia(r): string` — formato canónico `"[<name>][<statusCode?>] <mensaje sanitizado>"` (máx. 500 chars). Es human-readable, cabe en `Notificacion.ultimoError` (String? sin límite) y sobrevive la búsqueda regex de `senalCorreosFallidos` (mantiene "429", "rate limit", "quota" cuando el proveedor los use).
- `class EmailProveedorError extends Error` con `readonly resumen: ResumenErrorProveedor` y `.message` seteado al serializado.

### 2) `enviar-email.ts` propaga el motivo real

- Sustituye el `throw new Error("Error al enviar notificación por email")` por `throw new EmailProveedorError(resumirErrorProveedor(result.error))`.
- `procesar-lote.ts` NO cambia su semántica: el `catch (err) { const mensaje = err.message; ... marcarFallida(id, mensaje, ...) }` ahora persiste el serializado con la info real, no el texto genérico.
- Los callers directos (`admin-service.ts:199` preview, `notificacion-admin.ts:269` preview) también reciben el error con contexto — devuelven mejor motivo al admin.

### 3) Señal admin: distinguir «fallan TODOS» de «falla uno»

Nueva `senalProveedorEmailCaido()` en `src/lib/dal/services/inicio-admin.ts`:

- Toma las últimas `ventana` notificaciones EMAIL con estado terminal (`ENVIADA` / `FALLIDA`) ordenadas por `createdAt desc`. Excluye `REINTENTANDO` (todavía puede terminar bien).
- Si `length >= ventana` **y todas son `FALLIDA`** → prioridad **alta**, texto: *"El proveedor de correo no aceptó ninguna de las últimas N notificaciones. Está caído."*
- Umbral: parámetro `monitoreo.notif.proveedor_caido_ventana` (default `10`).
- Coexiste con `senalCorreosFallidos` — esa mira volumen y patrón de cuota; esta mira "totalidad". Un canal caído dispara ambas; una avalancha con reintentos exitosos solo dispara la de volumen.
- Se ordena `alta` en la lista `calcularEstadoInicio` (después de las otras `alta`, empate por id).

### 4) Parámetro nuevo (seed idempotente)

`monitoreo.notif.proveedor_caido_ventana` = `10` (INTEGER, SYSTEM, no público). Bloque `parametrosMonitoreo` en `prisma/seed.ts`, con la descripción: *"Últimas N notificaciones EMAIL terminadas que se miran para gritar 'proveedor caído' cuando todas fallan"*.

## Candados

- **PII fuera del error persistido.** Ningún correo del destinatario, token o secreto llega a `Notificacion.ultimoError`. El helper sanitiza antes de serializar.
- **Sin migración.** `Notificacion.ultimoError` sigue siendo `String?` — el formato es texto plano human-readable + regex-friendly. Cambio no destructivo, reversible con solo revertir el commit.
- **Backward-compat de la señal existente.** El patrón `/(quota|rate\s*limit|429|too\s*many\s*requests)/i` sigue cazando: el mensaje serializado incluye la cadena original del proveedor (Resend habla en inglés), y el `statusCode` va en el prefijo `[429]`.
- **Sin exponer el objeto Resend crudo al logger.** El log conserva el objeto original (útil en dev), pero la fila persistida está sanitizada.
- **Helper puro y determinístico.** Sin `Date.now()`, sin I/O, sin acceso a red. Todo test en unit.

## Impacto en arquitectura: no

Ningún cambio de schema, contrato de API, ni de flujo. Solo se enriquece un campo de texto y se agrega una señal más al inicio del admin.

## Cómo se probará

- **Unit** `motivo-error.test.ts`: sanitiza email → `<email:HHHHHHHH>`; sanitiza `re_abc`, `sk_...`, `Bearer xyz`; `resumirErrorProveedor` con forma Resend, con Error nativo, con string, con undefined; serialización preserva "429"/"rate limit"/"quota" para el regex existente; `EmailProveedorError` propaga `.resumen` y `.message`.
- **Unit** `inicio-admin.proveedor-caido.test.ts` (nuevo o dentro del ratchet): 10 FALLIDA seguidas → señal alta; 9 FALLIDA + 1 ENVIADA → NO dispara; 5 FALLIDA (menos que ventana) → NO dispara; convive con `senalCorreosFallidos` sin duplicar el ruido.
- **Integration** `procesar-lote.test.ts`: nuevo caso "guarda el motivo real del proveedor en `ultimoError`" — mock que rechaza con `{name:"rate_limit_exceeded", message:"You exceeded the rate limit", statusCode:429}` → la fila queda con `ultimoError` que contiene `[rate_limit_exceeded][429]`.

## DoD (Definition of Done)

- [ ] `tsc` limpio en el paquete PI.
- [ ] `vitest run` verde local para los tests nuevos + los existentes de `procesar-lote` y `inicio-admin`.
- [ ] `Notificacion.ultimoError` en escenario de prueba contiene el nombre del error real y el statusCode.
- [ ] `senalProveedorEmailCaido` dispara con 10 FALLIDA seguidas y NO dispara con 1 ENVIADA intercalada.
- [ ] Ninguna PII (email del destinatario, tokens) en el texto persistido.
- [ ] PR abierto con este spec como descripción y verde en CI.
- [ ] Reportado al CEO idc-a6 con el número del PR.
