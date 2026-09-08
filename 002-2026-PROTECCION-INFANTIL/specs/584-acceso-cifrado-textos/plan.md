# Plan — SPEC-584 · Acceso cifrado y auditado a textos (Fases 2 y 3)

## Contexto

La Fase 1 (SPEC-581, en main) separó el texto del reporte en `ContenidoReporte`
(cifrado AES-256-GCM con DEK por fila, envuelta en `LlaveReporte`). Los lectores
descifran por la frontera DAL `src/lib/dal/services/descifrar-contenido.ts`
(`descifrarCampoReporte`/`descifrarCamposReporte`), usada por ~9 call-sites
(rutas admin y libs de spam/comité/expediente). Diseño aprobado por el dueño en
`_DISENO-CIFRADO-ACCESO-2026-09-07.md`.

## Decisiones técnicas

### 1. Identidad del actor con AsyncLocalStorage (decisión clave)

`conActor(actor, fn)` (src/lib/auditoria-lectura/actor.ts) envuelve el handler de
ruta tras `verifyAuth`; la frontera DAL lee `actorActual()` al auditar. Se eligió
ALS sobre el parámetro explícito en `descifrarCamposReporte` porque hay ~9
call-sites entre rutas, servicios DAL y libs de negocio: un parámetro nuevo
obligaría a cambiar todas las firmas y cada llamador interno, con riesgo de
perder el hilo en caminos futuros. ALS propaga la identidad por el async context
sin tocar firmas; es el mecanismo estándar de la industria (OpenTelemetry,
CLS). Alternativa descartada salvo fallo de ALS en algún entorno.

Sin actor en el ALS (lector no instrumentado) la lectura se audita con
`usuarioId = null`: fail-loud de identidad, no de lectura — la fila nunca se
pierde (decisión 7).

### 2. Auditoría fail-loud, notificación best-effort

La escritura de `LecturaReporte` lanza si falla: el descifrado ya exige la base
de datos, así que sin rastro no hay lectura. La notificación al padre (motor de
reglas) jamás tumba la lectura: se registra y loguea.

### 3. Token de sesión opaco

Al canjear se genera un UUID aleatorio; en reposo vive solo `sha-256(token)`
(columna única `sesionTokenHash`). El token viaja como query param en
`/api/reportes/acceso/ver?token=...` y se revalida en cada llamada (15 min).
Se eligió token opaco hasheado (y no un JWT) porque la sesión es de un solo
recurso y corta duración: no hay claims que firmar ni rotación que justifique
un JWT, y el hash en reposo protege si la tabla se filtra.

### 4. Código de acceso

8 caracteres del alfabeto `A-Z 2-9` sin 0/O/1/I (CSPRNG `crypto.randomInt`);
en reposo solo `sha-256(codigo)`. Un solo código activo por reporte (una nueva
solicitud expira los anteriores). Rate limit: 3 solicitudes/hora por padre.

### 5. Single-canje sin transacción distribuida

El canje es un `updateMany({ where: { id, canjeadoEn: null } })`: la condición
hace atómico el "un solo canje" aunque dos canjes compitan; el perdedor ve
`count === 0` → 409.

### 6. Proxy

`/api/reportes/acceso` y `/canjear-acceso` se abren al PROFESIONAL (lista
blanca) y se exceptúan del candado bidireccional del padre (`esRutaCanjeCompartida`),
porque el canje es compartido padre/profesional (decisión 4). Cada handler
revalida rol (`verifyAuth(["PARENT","PROFESIONAL"])`).

### 7. El externo solo ve el texto de trabajo

`ver` devuelve únicamente `texto`. El `textoOriginal` es evidencia legal
interna y jamás sale por la vía externa.

## Modelo de datos (migración aditiva `20260907120000_spec_584_acceso_cifrado_auditoria`)

- `LecturaReporte`: id, reporteId?/eventoId? (dueño del contenido), contenidoId,
  campo, tipoActor (PLATAFORMA|EXTERNO), usuarioId?, rol?, codigoAccesoId?,
  hashContenido (sha-256), ip?, userAgent?, creadoEn. Índices (reporteId,creadoEn)
  y (usuarioId).
- `CodigoAccesoContenido`: id, reporteId, codigoHash @unique, solicitadoPorId,
  vigenteHasta (30 min), canjeadoEn?, canjeadoPorId?, sesionExpiraEn? (15 min),
  sesionTokenHash? @unique, ipSolicitud?, ipCanje?, creadoEn. Índice (reporteId).
- `AccionAudit` += CODIGO_ACCESO_SOLICITADO, CODIGO_ACCESO_CANJEADO.
- `ERROR_CODES` += GONE (410).

## Endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/admin/reportes/[id]/accesos-texto` | ADMIN/OPERADOR/COMITE (caso) | Historial de accesos al texto |
| POST | `/api/reportes/[id]/solicitar-acceso` | PARENT dueño | Genera código (201 `{codigo, vigenteHasta}`) |
| POST | `/api/reportes/acceso/canjar` | PARENT/PROFESIONAL | Canjea (`{tokenSesion, expiraEn, reporteId}`; 404/409/410) |
| GET | `/api/reportes/acceso/ver` (query `token`) | PARENT/PROFESIONAL + sesión | Texto de trabajo (`{texto, expiraEn}`; 410 vencida) |

Eventos Motor Notif (seed aditivo `seedAccesoCifradoTextos`):
`padre.reporte.texto_leido` (email+in_app), `padre.reporte.acceso_codigo` (email),
`padre.reporte.acceso_canjeado` (email+in_app).

## Tests

- Unitarios (sin BD): ALS (propagación/aislamiento/paralelo/actorDesdeRequest),
  generador de códigos (alfabeto, normalización, hashes).
- Integración: frontera escribe auditoría (actor, hash, batch, EXTERNO);
  flujo completo solicitar→canjar→ver (201/404/409/410/400); detalle admin real
  audita + notifica al padre; anónimo audita sin notificar; historial accesos-texto.

## Riesgos / deuda

- Lecturas de LISTA (bandeja spam) generan una notificación por reporte con
  dueño: puede ser ruidoso en operación intensiva; es la conducta decidida
  (decisión 5) y queda visible en `LecturaReporte`.
- Rutas lectoras no envueltas con `conActor` auditan con `usuarioId = null`;
  el barrido actual cubre los 9 call-sites existentes de la frontera.
