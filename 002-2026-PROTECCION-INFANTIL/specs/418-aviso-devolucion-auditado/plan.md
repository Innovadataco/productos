# Plan · SPEC-418 — El aviso de devolución al profesional no se pierde

## Análisis en fuente, antes de codificar

| Archivo | Qué se sacó |
|---|---|
| `profesionales/verificador/service.ts:288` | El defecto: `enviarEmailNotificacion` (envío directo por Resend) fuera de la transacción, con `catch` que solo hace `console.error`. |
| `notificaciones/enviar-email.ts` | Confirma que esa función **envía**, no encola: es el callsite del worker, no la API de dominio. |
| `notificaciones/motor.ts` | `programar()` es la API correcta… pero no acepta transacción, y despacha a pg-boss en línea. |
| `dal/repositories/notificacion*.ts` | Los cinco repositorios del motor YA aceptan `tx` en el constructor. Media solución estaba puesta. |
| `scripts/worker-notificaciones.mjs:207` | **El dato que decide el diseño**: el worker tiene *"polling de respaldo para reintentos y jobs perdidos"*. Una fila `ENCOLADA` se recoge aunque el despacho a pg-boss falle. |
| `procesar-lote.ts:173` | `listarPendientesParaEnvio(ahora, lote)` — el poll lee la tabla, no la cola. Confirma lo anterior. |
| `email.ts:41-50` | Precedente de **fallar en cerrado** cuando el motor no encuentra reglas (SPEC-296). |
| `prisma/seed.ts:1687` | El patrón de catálogo del motor (`seedEmergenciaExpediente`) para copiar: plantilla + `upsertNotificacionRegla`. |
| `test-utils.ts:122` | `resetDatabase` trunca todo y NO siembra parámetros ni reglas: el test de integración tiene que armar su propio catálogo. |

## La decisión de diseño, y por qué

El requisito es "que el aviso no se pueda perder". Se parte en dos mitades con garantías distintas:

1. **Persistir** la fila de `Notificacion` → **dentro** de la transacción. Atómico con la decisión.
2. **Avisarle al worker** (pg-boss) → **después** del commit. pg-boss usa otra conexión: adentro, un rollback dejaría un job huérfano.

La mitad 2 puede fallar sin consecuencia porque el worker también hace polling. Si no lo hiciera, este diseño no serviría — por eso se verificó antes de elegirlo.

## Riesgos

| Riesgo | Cómo se acota |
|---|---|
| Fallar en cerrado bloquea al Verificador si falta la regla | Las reglas se siembran idempotentes y son `obligatoria`, así que una preferencia no puede vaciarlas. Y bloquear es preferible a perder el aviso: es I-295. |
| Cambiar `ProgramarResult` rompe 18 archivos de test | `envios` es **opcional**: los llamadores y sus mocks no cambian. |
| Transacción más larga (el motor hace varias lecturas) | Son lecturas indexadas de catálogo sobre una transacción que ya escribía dos filas. Aceptable frente a perder el aviso. |
| Correr los tests contra la BD compartida | Base propia `pi_spec418_test`, creada y destruida. |
