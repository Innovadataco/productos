# Arquitectura técnica — Producto 002 (Protección Infantil)

## 1. Introducción

Este documento describe la arquitectura técnica del SaaS de reportes comunitarios de riesgos para menores desarrollado por Innovadataco. Va dirigido a desarrolladores, operadores y agentes de software que necesiten entender la división de responsabilidades entre las capas de la aplicación, el flujo de vida de un reporte y las convenciones que rigen el código.

`AGENTS.md` establece las reglas operativas, el entorno y la metodología Spec-Kit. `.specify/memory/constitution.md` define los principios del producto y las restricciones técnicas no negociables. Este documento complementa ambos con detalle de arquitectura, flujo de datos y decisiones de implementación. Si existe alguna contradicción, prevalecen `AGENTS.md` y la constitución.

## Capas de la aplicación

El sistema se organiza en cinco capas bien separadas:

| Capa | Responsabilidad | Ubicación clave |
|------|----------------|-----------------|
| UI y App Router | Renderizar páginas, layouts y componentes; orquestar Server Components. | `src/app/**`, `src/components/**` |
| API Routes | Exponer endpoints HTTP, validar entradas, autenticar y delegar a servicios. | `src/app/api/**/route.ts` |
| Servicios/utilidades | Lógica de negocio reutilizable: auth, colas, IA, permisos, cifrado, rate limiting. | `src/lib/**` |
| Capa de datos | Persistencia relacional mediante Prisma ORM sobre PostgreSQL. | `prisma/schema.prisma`, `src/lib/prisma.ts` |
| Workers | Procesamiento asíncrono de jobs `pg-boss`, principalmente clasificación IA. | `scripts/worker-reportes.mjs`, `scripts/worker-supervisor.mjs` |

### Diagrama de capas

```
┌─────────────────────────────────────────────────────────────┐
│  Navegador / Cliente                                        │
│  (React Server Components, Client Components, Tailwind)    │
└──────────────┬──────────────────────────────────────────────┘
               │ HTTP / cookie httpOnly
┌──────────────▼──────────────────────────────────────────────┐
│  Next.js App Router                                         │
│  ├── Pages (src/app/page.tsx, layout.tsx)                   │
│  └── API Routes (src/app/api/**/route.ts)                   │
└──────────────┬──────────────────────────────────────────────┘
               │ import / función
┌──────────────▼──────────────────────────────────────────────┐
│  Capa de servicios (src/lib/)                               │
│  ├── auth.ts          (JWT, cookies, verifyAuth)            │
│  ├── proxy.ts         (redirección por rol)                   │
│  ├── queue.ts         (pg-boss: sendReporte, drainPending)  │
│  ├── prisma.ts        (singleton PrismaClient)              │
│  ├── errors.ts        (AppError, ERROR_CODES)               │
│  ├── rate-limit.ts    (rate limiting basado en PostgreSQL)  │
│  ├── param-encryption.ts (AES-256-GCM)                      │
│  └── ai/              (classifier, embedder, anonimizador)    │
└──────────────┬──────────────────────────────────────────────┘
               │ Prisma Client / SQL
┌──────────────▼──────────────────────────────────────────────┐
│  PostgreSQL 16+                                             │
│  ├── Datos de negocio (reportes, usuarios, tenants)         │
│  ├── pg-boss (colas de jobs)                                │
│  ├── pgvector (embeddings)                                  │
│  └── RateLimit (ventanas fijas)                             │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
              ┌────────────────────────────┐
              │ Worker (scripts/worker-*)    │
              │ consume jobs de pg-boss y    │
              │ llama a Ollama local         │
              └────────────────────────────┘
```

### Responsabilidades de cada capa

- **Next.js App Router**: Las páginas en `src/app/` usan Server Components por defecto. Los layouts (por ejemplo, `src/app/dashboard/admin/layout.tsx`) verifican el rol antes de renderizar. Los componentes de cliente (`"use client"`) se limitan a interacción y data fetching local.
- **API Routes**: Cada endpoint HTTP reside en su propio `route.ts`. No se agrupan métodos en archivos separados. Las rutas de administración viven bajo `src/app/api/admin/**` y requieren rol interno.
- **Capa de servicios**: Contiene la lógica reutilizable. `src/lib/proxy.ts` no es un middleware de Next.js tradicional, sino una función exportada (`proxy`) que evalúa la ruta, el token y el rol para decidir redirección, `next()`, `401` o `403`.
- **Capa de datos**: `src/lib/prisma.ts` exporta un singleton `PrismaClient`. El esquema (`prisma/schema.prisma`) define roles, estados de reporte, tenant, clasificaciones, embeddings, audit logs y suscripciones. Las migraciones son aditivas y nunca destructivas, según `AGENTS.md`.
- **Workers**: `scripts/worker-reportes.mjs` consume la cola `reporte-procesamiento` de `pg-boss`. Adquiere un PostgreSQL advisory lock para garantizar que solo haya una instancia activa. Llama a `POST /api/reportes/procesar` con el header `X-Worker-Secret`. También gestiona backfills de anonimización, embeddings y evaluaciones de clasificador.

## Flujo de datos

El caso de uso principal es el recorrido de un reporte desde su recepción hasta su posible aparición en la consulta pública.

### 3.1 Recepción del reporte

1. El usuario anónimo o autenticado con rol `PARENT` envía `POST /api/reportes`.
2. El endpoint valida el payload con `crearReporteSchema` (Zod) y verifica rate limits:
   - `report` por IP o usuario autenticado.
   - `report_fingerprint` por fingerprint de dispositivo.
   - `report_identificador` por combinación `identificador:plataforma` (scope suave).
3. Si el usuario está autenticado con rol interno, se rechaza con `403`.
4. Se descarta contenido multimedia: el sistema solo acepta texto, identificador, plataforma y metadatos contextuales, de acuerdo con la constitución.
5. Se genera un número de seguimiento único.
6. El texto original se cifra con `encryptParameter` (AES-256-GCM) y se almacena en `Reporte.textoOriginal`. El campo `texto` se conserva para el procesamiento asíncrono.
7. Se crea o incrementa el registro agregado `IdentificadorReportado`.
8. El estado inicial es `PENDIENTE`, salvo que los rate limits suaves indiquen `POSIBLE_SPAM` o `REVISION_MANUAL`.
9. Si el estado es `PENDIENTE`, se encola el job `reporte-procesamiento` mediante `sendReporte` en `src/lib/queue.ts`.
10. La respuesta HTTP (`201`) devuelve el número de seguimiento y el estado; no espera la clasificación.

### 3.2 Encolamiento y procesamiento asíncrono

1. `src/lib/queue.ts` gestiona el singleton `PgBoss` y publica jobs con prioridad, límite de reintentos y backoff exponencial.
2. El worker `scripts/worker-reportes.mjs` consume un job a la vez, con concurrencia configurable desde `ParametroSistema`.
3. Antes de procesar, el worker verifica que Ollama responda (`/api/tags`). Si no, el job se reencola hasta agotar reintentos.
4. El worker invoca `POST /api/reportes/procesar` con el `reporteId` y el `X-Worker-Secret`.
5. `src/app/api/reportes/procesar/route.ts` ejecuta, de forma atómica:
   - Generación del embedding del texto (`generarEmbedding`).
   - Búsqueda de ejemplos corregidos similares para RAG (`buscarEjemplosSimilares`).
   - Deduplicación anónima por similitud de embeddings (`buscarReporteSimilar`).
   - Clasificación de conducta mediante votos con `clasificarConVotos` (modelo configurable, por defecto `ornith:9b`).
   - Detección de PII y doxing en paralelo.
   - Anonimización del texto si se detecta PII (`anonimizarTexto`).
   - Detección de ráfagas de reportes contra el mismo identificador.
   - Registro de transiciones de estado (`registrarTransicion`).

### 3.3 Estados posibles tras clasificación

El reporte puede terminar en uno de estos estados:

- `CLASIFICADO`: la IA clasificó la conducta con confianza suficiente y no hay PII pendiente.
- `CORREGIDO`: un administrador corrigió la clasificación inicial.
- `REVISION_MANUAL`: confianza baja, señales de doxing, keywords de riesgo, ráfaga o fallo del pipeline.
- `POSIBLE_SPAM`: la IA detectó SPAM con confianza alta o el rate limit suave lo marcó como spam.
- `DUPLICADO`: un reporte anónimo muy similar a otro previo.
- `REQUIERE_ANONIMIZACION`: contiene PII y debe anonimizarse antes de publicarse.

### 3.4 Revisión humana

- Los reportes en `REVISION_MANUAL` o `POSIBLE_SPAM` se asignan automáticamente a un operador (`asignarOperadorAReporte`).
- Los operadores (`OPERADOR`) y administradores (`ADMIN`, `SCHOOL_ADMIN`) pueden revisar, corregir, anonimizar, dar de baja o escalar casos al comité (`COMITE_VALIDACION`).
- El comité puede resolver casos escalados; sus integrantes son usuarios con rol `COMITE_VALIDACION`.
- Cada acción relevante genera un `AuditLog` y, cuando aplica, una `TransicionReporte`.

### 3.5 Agregación y visibilidad pública

1. Cuando un reporte llega a `CLASIFICADO` o `CORREGIDO`, se actualiza `IdentificadorReportado` mediante `actualizarVisibilidadPublica` y se recalcula el score (`recalcularYGuardarScore`).
2. Un identificador solo aparece en la consulta pública si supera los umbrales configurados en `ParametroSistema`:
   - `visibility.report_threshold`: mínimo de reportes visibles.
   - `visibility.min_authenticated_ratio`: mínimo ratio de reportes autenticados.
3. `GET /api/consulta?identificador=...` devuelve estadísticas agregadas: total de reportes, plataformas, ubicaciones, timeline mensual, nivel de riesgo y resumen textual. No expone textos de reportes, nombres de personas ni datos personales, siguiendo la constitución.
4. Si un identificador acumula score crítico, se envía alerta a administradores; si hay usuarios suscritos, se les notifica.

### 3.6 Endpoints y módulos clave del flujo

| Paso | Endpoint / módulo | Archivo |
|------|-------------------|---------|
| Recepción | `POST /api/reportes` | `src/app/api/reportes/route.ts` |
| Encolamiento | `sendReporte` | `src/lib/queue.ts` |
| Worker | `scripts/worker-reportes.mjs` | `scripts/worker-reportes.mjs` |
| Procesamiento IA | `POST /api/reportes/procesar` | `src/app/api/reportes/procesar/route.ts` |
| Clasificación | `clasificarConVotos` | `src/lib/ai/classifier.ts` |
| Anonimización | `anonimizarTexto` | `src/lib/ai/anonimizador.ts` |
| Embeddings | `generarEmbedding` | `src/lib/ai/embedder.ts` |
| Visibilidad | `actualizarVisibilidadPublica` | `src/lib/visibility.ts` |
| Scoring | `recalcularYGuardarScore` | `src/lib/scoring.ts` |
| Consulta pública | `GET /api/consulta` | `src/app/api/consulta/route.ts` |

## Convenciones

### 4.1 Nombres de archivos y estructura

- Rutas API: `route.ts` (por ejemplo, `src/app/api/reportes/route.ts`).
- Páginas: `page.tsx`.
- Layouts: `layout.tsx`.
- Componentes: PascalCase (`ReporteForm.tsx`).
- Hooks personalizados: `use` + PascalCase (`useAuth.ts`).
- Utilidades: camelCase (`reporteValidator.ts`).
- Constantes globales: SCREAMING_SNAKE_CASE.
- Modelos Prisma: PascalCase singular (`Reporte`, `Colegio`).
- Tablas en base de datos: lowercase/snake_case (`reportes`, `colegios`).

### 4.2 Manejo de errores

Se usa `AppError` (`src/lib/errors.ts`) con códigos canónicos:

- `400`: input inválido o falta campo requerido.
- `401`: no autenticado.
- `403`: autenticado pero sin permisos.
- `404`: recurso no encontrado.
- `409`: conflicto (por ejemplo, disputa ya existente).
- `413`: payload too large.
- `429`: rate limit.
- `500`: error interno del servidor.
- `502`: error de upstream (modelo IA falló).
- `503`: servicio no disponible (sin modelo IA activo).

Nunca se exponen stack traces ni mensajes internos al cliente. Las excepciones no controladas se traducen a mensajes seguros mediante `safeErrorMessage`.

### 4.3 Paginación

Las listas que pueden crecer indefinidamente implementan paginación estándar:

```typescript
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

const page = Math.max(1, Number(searchParams.get("page") || "1"));
const pageSize = Math.min(
  MAX_PAGE_SIZE,
  Math.max(1, Number(searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE)))
);
const skip = (page - 1) * pageSize;
```

La respuesta incluye `{ items, pagination: { page, pageSize, total, totalPages } }`.

### 4.4 Autenticación

- JWT manual con `jose` y `bcryptjs`. No se usa NextAuth.js ni Auth.js.
- El token se almacena en cookie `httpOnly` (`__Host-token` en HTTPS, `token` en desarrollo según `COOKIE_SECURE`).
- `src/lib/auth.ts` es la única fuente de verdad: `verifyAuth`, `getUserFromToken`, `setSessionCookie`.
- Rutas públicas: `POST /api/auth/login`, `POST /api/reportes`, `GET /api/consulta`, entre otras. El resto requiere sesión válida y, en muchos casos, rol específico.
- El layout de administración (`src/app/dashboard/admin/layout.tsx`) verifica que el rol sea interno (`ADMIN`, `SCHOOL_ADMIN`, `OPERADOR`, `COMITE_VALIDACION`) antes de renderizar.

### 4.5 Validación

- El objetivo es migrar a Zod. Actualmente `POST /api/reportes` y `GET /api/consulta` usan Zod; otros endpoints aún realizan validación manual explícita.
- Reglas generales: verificar campos requeridos, parsear números con `parseInt` y verificar `!isNaN`, sanitizar strings, validar formato E.164 para teléfonos, rechazar URLs de imágenes, base64 o referencias a multimedia.
- El texto de reporte está limitado a 2000 caracteres; la consulta pública a 100 caracteres en el identificador.

### 4.6 Roles y permisos

Roles definidos en el enum `RolUsuario`:

- `ADMIN`: superadministrador de plataforma.
- `SCHOOL_ADMIN`: administrador de un tenant (colegio) específico.
- `OPERADOR`: revisa reportes y spam asignados a su cuenta.
- `COMITE_VALIDACION`: resuelve casos escalados al comité.
- `PARENT`: usuario final que crea reportes y consulta identificadores.

Helper de permisos en `src/lib/operadores/permisos.ts`:

- `esAdminRol`, `esOperadorRol`, `esComiteRol`.
- `puedeGestionarReporte`: `ADMIN` y `SCHOOL_ADMIN` gestionan reportes de su tenant; `OPERADOR` solo los que tiene asignados.
- `puedeGestionarApelacion`: similar para apelaciones.
- `validarExclusividadRolComite`: `OPERADOR` y `COMITE_VALIDACION` son mutuamente excluyentes.

El proxy (`src/lib/proxy.ts`) redirige:

- Usuarios internos fuera de `/dashboard` y `/mis-reportes` hacia su home.
- Usuarios no internos fuera de `/dashboard/admin` y `/api/admin` hacia `/` o `401/403`.
- Roles distintos de `ADMIN` y `SCHOOL_ADMIN` fuera de `/dashboard/admin/comite/gestion` y `/dashboard/admin/comite/auditoria`.

### 4.7 Multi-tenant

- Cada colegio es un `Tenant` aislado.
- `tenantId` existe en entidades de negocio (`Usuario`, `Reporte`, etc.) excepto catálogos globales.
- `SCHOOL_ADMIN` solo puede acceder a recursos de su propio `tenantId` o sin tenant.
- La consulta pública agrega datos de todos los tenants sin identificar la fuente.
- El modelo de datos contempla desde el inicio `Plan`, `Subscription`, `Tenant` y `BillingCycle` para la fase SaaS.

## Seguridad y despliegue

### 5.1 Protección de datos

- **Cifrado en reposo**: el texto original del reporte se cifra con AES-256-GCM (`src/lib/param-encryption.ts`) antes de persistirse. La clave (`PARAM_ENCRYPTION_KEY`) vive en variable de entorno y nunca en el código.
- **Anonimización**: si el procesador detecta PII, se genera una versión anonimizada del texto y se conserva el original cifrado.
- **Encriptación de parámetros**: algunos valores sensibles de configuración pueden almacenarse cifrados con el mismo esquema AES-256-GCM; `isEncryptedValue` permite detectar si un valor ya está cifrado o es texto plano (compatibilidad con migración gradual).
- **Logs**: los audit logs y los logs de aplicación nunca incluyen el texto completo del reporte, solo metadatos (id, timestamp, categoría, estado).
- **Disputas**: una apelación exitosa puede derivar en eliminación o anonimización del registro, conforme a la Ley 1581 de 2012.

### 5.2 Rate limiting

- Implementación basada en PostgreSQL con ventana fija (`src/lib/rate-limit.ts`).
- Scopes configurables: `report`, `login`, `consulta`, `register`, `admin_read`, `admin_write`, `report_fingerprint`, `report_identificador`, `apelacion`, entre otros.
- Los límites por defecto se pueden sobrescribir mediante `ParametroSistema` (`ratelimit.{scope}.window_seconds`, `ratelimit.{scope}.max_requests`).
- Si el limitador falla, la operación se permite (fail-open) para no bloquear el servicio; se registra el error.

### 5.3 Proxy y autenticación

- `src/lib/proxy.ts` centraliza las reglas de acceso a rutas. No se usa middleware de Next.js tradicional; la función `proxy` se invoca desde el punto de entrada de la aplicación.
- Las cookies son `httpOnly`, `secure` en HTTPS y `SameSite=strict` o `lax` según corresponda.
- El token JWT expira en 24 horas.

### 5.4 IA local

- Todos los textos sensibles se procesan con LLM local (Ollama). No salen del servidor.
- Modelo de clasificación por defecto: `ornith:9b`.
- Modelo de embedding por defecto: `nomic-embed-text`.
- El worker verifica la salud de Ollama antes de cada job y puede encolar evaluaciones de clasificador (`eval-classifier-run`).

### 5.5 Despliegue

- **Base de datos**: ejecutar `npx prisma migrate deploy` para aplicar migraciones. Las migraciones son siempre aditivas y no destructivas, según `AGENTS.md`.
- **Build**: `npm run build` tras `rm -rf .next` para evitar builds residuales.
- **Reinicio limpio**: `./scripts/dev-restart.sh` borra `.next`, compila, mata procesos anteriores y levanta la aplicación en el puerto `5005` con `-H 0.0.0.0` (necesario para Tailscale) más un único worker.
- **Workers**: debe haber exactamente un worker activo. El worker adquiere un PostgreSQL advisory lock para evitar duplicación; si otro worker ya tiene el lock, el segundo proceso termina con código `2`.
- **Monitoreo básico**: el worker escribe logs estructurados con latencia, intentos y estado de cada job.

### 5.6 Verificación de integridad

Antes de considerar un cambio listo, se ejecutan:

- `npx tsc --noEmit`
- `npm run lint`
- `npm run test`
- `npm run build`
- `./scripts/dev-restart.sh` (healthcheck y un solo worker)

Estas verificaciones son obligatorias en la metodología Spec-Kit y se documentan en los cierres de cada spec.

### 5.7 Headers HTTP, CSP y HSTS

- `next.config.ts` emite headers de seguridad en todas las rutas: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` y `Content-Security-Policy`.
- La CSP permite `script-src 'self' 'unsafe-inline'` en producción y añade `'unsafe-eval'` en desarrollo para HMR/Turbopack.
- Los headers `upgrade-insecure-requests` (CSP) y `Strict-Transport-Security` (HSTS) se gobiernan mediante la variable de entorno `ENABLE_HTTPS_HEADERS`:
  - `ENABLE_HTTPS_HEADERS=false` (default): no se emiten. Es el modo para acceso por HTTP en redes locales, Tailscale o cualquier entorno sin TLS.
  - `ENABLE_HTTPS_HEADERS=true`: se emiten ambos headers. Solo habilitar cuando la app corra realmente detrás de HTTPS con un certificado válido.
- Este mecanismo evita que el navegador bloquee estilos o scripts por política de HTTPS cuando el servidor se accede por HTTP, y evita grabar HSTS en clientes que no deberían usarlo.
