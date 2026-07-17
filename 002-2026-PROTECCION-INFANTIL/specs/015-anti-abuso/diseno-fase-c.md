# Diseño — Fase C: Descargo/apelación del identificador reportado

> Documentado el 2026-07-18 como parte del lote nocturno.

## Objetivo

Dar a la persona detrás de un identificador reportado un mecanismo controlado de descargo/apelación, reduciendo daño reputacional por reportes falsos sin convertirse en un vector de abuso.

## Decisiones de diseño aprobadas

### Titularidad

- **Teléfonos** (WhatsApp, etc.): verificación por OTP SMS detrás de una interfaz de proveedor parametrizada. En desarrollo se usa un provider `mock` que loguea el código; nunca se hardcodea un proveedor real.
- **Nicks** (Roblox, Discord, etc.): descargo sin verificación, marcado como *"titularidad no verificada"* visible para el admin. El admin debe tratarla con mayor escepticismo.

### Anti-abuso de la apelación

- Una sola apelación activa por identificador+plataforma.
- Tras un rechazo, no se puede re-apelar salvo que un admin rehabilite manualmente el derecho (con nota de auditoría).
- Pausa de visibilidad pública solo en la primera apelación, con duración máxima configurable (`anti_abuso.apelacion_pausa_dias`, default 7).
- Si vence sin resolución, la visibilidad se restaura automáticamente, la apelación pasa a `VENCIDA` y queda pendiente de revisión admin.
- Rate limit estricto sobre creación de apelaciones (scope `apelacion`).

### Superficie de información (R2)

El apelante ve únicamente:

> "Este identificador registra reportes de conducta de riesgo. Estado de tu apelación: <estado>."

Nunca ve: textos, cantidad de reportes, fechas, categorías, ni datos derivables. La UI usa lenguaje jurídico prudente; nunca se califica conducta como "delito".

### Admin

- Las apelaciones entran a una cola admin con badge propio.
- El admin ve la apelación y los reportes del identificador (vista normal de reportes).
- **Aceptar**: ejecuta la baja por `REPORTE_FALSO` (Spec 012) sobre los reportes que el admin seleccione.
- **Rechazar**: restaura visibilidad de inmediato.
- **AuditLog**: `APELACION_CREADA`, `APELACION_RESUELTA`, `APELACION_VENCIDA`, `APELACION_REHABILITADA`. Sin PII del apelante en el log.

### Análisis de amenaza del canal no verificado

El canal sin verificación (nicks) es inherentemente más vulnerable a apelaciones falsas porque cualquier persona puede reclamar un nick público. Mitigaciones:

- Badge explícito de "titularidad no verificada" en la vista admin.
- Solo se pausa visibilidad en la primera apelación; si vence, se restaura.
- Rechazo bloquea re-apelación a menos que un admin rehabilite.
- Rate limit dificulta ráfagas de apelaciones.

## Estados de una apelación

```
RECIBIDA → EN_REVISION → ACEPTADA
                    └→ RECHAZADA
                    └→ VENCIDA (por job automático)
```

## Schema

- `ApelacionIdentificador`
  - `id`, `identificador`, `plataformaId`
  - `tokenAcceso` (hash único para consulta pública)
  - `estado` enum `EstadoApelacion`
  - `motivoSolicitud`
  - `evidenciaUrl`
  - `respuestaAdmin`
  - `adminId`
  - `tipoVerificacion` (`SMS` | `NICK`)
  - `contacto` (teléfono, solo SMS)
  - `smsCodigoHash` (hash del OTP)
  - `smsVerificado`
  - `pausaHasta`
  - `visibilidadRestaurada`
  - `derechoApelar`
  - `notaRehabilitacion`
  - timestamps

## Componentes y endpoints

### Públicos

- `POST /api/apeaciones/solicitar` — inicia apelación; envía OTP si es teléfono.
- `POST /api/apeaciones/verificar` — verifica OTP.
- `GET  /api/apeaciones/[token]` — consulta estado público.
- `GET  /apelar` — página pública de apelación.

### Admin

- `GET    /api/admin/apeaciones` — lista.
- `GET    /api/admin/apeaciones/[id]` — detalle con reportes del identificador.
- `POST   /api/admin/apeaciones/[id]/resolver` — aceptar/rechazar.
- `POST   /api/admin/apeaciones/[id]/rehabilitar` — rehabilitar derecho a apelar.
- `POST   /api/admin/apeaciones/vencer` — job de vencimiento (protegido por `WORKER_SECRET`).
- `/dashboard/admin/apeaciones` — UI admin.

## Jobs

- `scripts/job-apelaciones-vencimiento.ts` — marca como `VENCIDA` las apelaciones cuya pausa expiró y restaura visibilidad si aplica.

## Tests

- Estados y transiciones de apelación.
- Vencimiento automático.
- Rate limit.
- Aceptar ejecuta baja de reportes seleccionados.
- Rechazo restaura visibilidad.
