# Parámetros de Sistema — Protección Infantil

Este documento describe todos los parámetros configurables de la plataforma, su propósito, dónde se usan y cómo probarlos manualmente.

Los parámetros viven en la tabla `ParametroSistema` (Prisma) y se gestionan desde el panel de administración o las API de configuración.

---

## 1. Cómo acceder a los parámetros

### Desde la UI

- **Panel de administración**: `http://192.168.2.23:5005/dashboard/admin/configuracion`
- Requiere iniciar sesión con un usuario con rol `ADMIN`.
- Desde allí se pueden editar valores, ver descripciones y eliminar parámetros (excepto los de seguridad y sistema).

### API REST

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| `GET` | `/api/config/parametros` | Lista paginada de todos los parámetros | Admin |
| `GET` | `/api/config/parametros/publicos` | Solo parámetros marcados como `esPublico: true` | Público |
| `GET` | `/api/config/parametros/{clave}` | Detalle de un parámetro + historial de cambios | Admin |
| `PATCH` | `/api/config/parametros/{clave}` | Actualiza el valor de un parámetro | Admin |
| `DELETE` | `/api/config/parametros/{clave}` | Elimina un parámetro (no permite `security.*` ni `system.*`) | Admin |

Ejemplo de actualización con `curl`:

```bash
ADMIN_COOKIE="..."
curl -X PATCH http://localhost:5005/api/config/parametros/visibility.report_threshold \
  -H "Content-Type: application/json" \
  -H "Cookie: $ADMIN_COOKIE" \
  -d '{"valor":"5"}'
```

> **Nota sobre caché**: el endpoint `/api/config/parametros/publicos` cachea la respuesta en memoria por 60 segundos. Si cambias un parámetro público y lo consultas por API pública, espera ese tiempo o reinicia el servidor para ver el cambio inmediato.

---

## 2. Convenciones de nombres

| Prefijo | Área |
|---------|------|
| `visibility.*` | Visibilidad pública de identificadores reportados |
| `security.*` | Autenticación, bloqueos, JWT |
| `system.*` | Comportamiento general de la plataforma |
| `reportes.*` | Procesamiento de reportes con IA / worker |
| `ranking.*` | Antiguo sistema de score (no usado en runtime) |
| `scoring.*` | Sistema de score F1 actual |
| `ratelimit.*` | Límites de peticiones por ventana de tiempo |
| `alerts.*` | Envío de alertas por email |

---

## 3. Tabla maestra de parámetros

### Leyenda

- **Público**: indica si el parámetro se expone en `/api/config/parametros/publicos`.
- **Usado**: indica si el código lo lee en runtime.
  - ✅ Sí
  - ⚠️ Sí, con fallback si no existe
  - ❌ No (solo existe en seed/tests)

### 3.1 Visibilidad pública

| Clave | Tipo | Default | Categoría | Público | Usado | Descripción | Cómo probar |
|-------|------|---------|-----------|---------|-------|-------------|-------------|
| `visibility.report_threshold` | `INTEGER` | `3` | `VISIBILITY` | ✅ | ✅ | Mínimo de reportes independientes para que un identificador sea visible públicamente | 1. Crea varios reportes para un mismo identificador+plataforma. 2. Procesa los reportes. 3. Consulta `/api/consulta?identificador=XXX`. Con menos de N reportes no debe aparecer; con N o más, debe aparecer. |
| `visibility.min_authenticated_ratio` | `FLOAT` | `0.5` | `VISIBILITY` | ✅ | ✅ | Ratio mínimo de reportes autenticados (`autenticados / total`) para visibilidad pública | 1. Cambia el valor a `0` o `1`. 2. Crea reportes mixtos (autenticados y anónimos). 3. Verifica que con `1` solo aparezcan identificadores reportados 100% por usuarios autenticados. |

### 3.2 Seguridad de autenticación

| Clave | Tipo | Default | Categoría | Público | Usado | Descripción | Cómo probar |
|-------|------|---------|-----------|---------|-------|-------------|-------------|
| `security.max_login_attempts` | `INTEGER` | `5` | `SECURITY` | ❌ | ✅ | Intentos fallidos antes de bloquear temporalmente la cuenta | 1. Crea un usuario. 2. Envía login con contraseña incorrecta 5 veces. 3. El intento 6 debe devolver `401` con mensaje de cuenta bloqueada. |
| `security.lockout_duration_minutes` | `INTEGER` | `30` | `SECURITY` | ❌ | ✅ | Minutos que dura el bloqueo tras exceder los intentos fallidos | 1. Bloquea una cuenta. 2. Intenta login antes de que pasen los minutos configurados → bloqueado. 3. Espera el tiempo configurado → login correcto debe funcionar. |
| `security.password_min_length` | `INTEGER` | `8` | `SECURITY` | ✅ | ❌ | Longitud mínima de contraseña | **No implementado en runtime.** La validación está hardcodeada a 8 caracteres, 1 letra y 1 número en registro y verificación. |
| `security.jwt_ttl_hours` | `INTEGER` | `24` | `SECURITY` | ❌ | ❌ | Vida del token JWT en horas | **No implementado en runtime.** El TTL está hardcodeado a `"24h"` en `src/lib/auth.ts`. |

### 3.3 Procesamiento de reportes (IA / worker)

| Clave | Tipo | Default | Categoría | Público | Usado | Descripción | Cómo probar |
|-------|------|---------|-----------|---------|-------|-------------|-------------|
| `reportes.classification_model` | `STRING` | `ornith:9b` | `SECURITY` | ❌ | ✅ | Modelo de Ollama usado para clasificar conductas y anonimizar PII | 1. Cambia el modelo a otro disponible en Ollama. 2. Envía un reporte a `/api/reportes/procesar`. 3. Revisa `ClasificacionIA.modeloUsado` en BD. |
| `reportes.embedding_model` | `STRING` | `nomic-embed-text` | `SECURITY` | ❌ | ✅ | Modelo de Ollama usado para generar embeddings de similitud | 1. Cambia el modelo. 2. Procesa un reporte. 3. Verifica `EmbeddingReporte.modeloUsado`. También se usa en `/api/admin/reportes/{id}/anonimizar`. |
| `reportes.duplicate.similarity_threshold` | `FLOAT` | `0.92` | `SECURITY` | ❌ | ✅ | Umbral de similitud coseno para marcar reportes anónimos como duplicados | 1. Crea dos reportes anónimos con texto casi idéntico para el mismo identificador+plataforma. 2. Procesa ambos. 3. Con umbral alto (`0.99`) no deben marcarse duplicados; con umbral bajo (`0.5`) sí. |
| `reportes.spam.min_text_length` | `INTEGER` | `20` | `SECURITY` | ✅ | ❌ | Longitud mínima de texto para no marcar como spam | **No implementado en runtime.** La heurística de spam está hardcodeada a `< 30` caracteres. |
| `reportes.worker.max_retries` | `INTEGER` | `3` | `SECURITY` | ❌ | ❌ | Máximo de reintentos de procesamiento por job | **No implementado en runtime.** |
| `reportes.worker.stalled_threshold_minutes` | `INTEGER` | `5` | `SECURITY` | ❌ | ❌ | Minutos antes de alertar cola estancada | **No implementado en runtime.** |
| `reportes.anonymization_model` | `STRING` | `ornith:9b` | `SECURITY` | ❌ | ❌ | Modelo de Ollama para anonimización automática de PII | **No implementado en runtime.** La anonimización reutiliza `reportes.classification_model`. |

### 3.4 Scoring F1 (score de riesgo 0-100)

Todos se leen en `src/lib/scoring.ts` y se aplican en `calcularScore()`.

| Clave | Tipo | Default | Categoría | Público | Usado | Descripción | Cómo probar |
|-------|------|---------|-----------|---------|-------|-------------|-------------|
| `scoring.weight.count` | `INTEGER` | `10` | `SECURITY` | ❌ | ✅ | Peso de la cantidad de reportes en el score | Cambia el peso y verifica que el score de un identificador con muchos reportes varía. |
| `scoring.weight.recency` | `INTEGER` | `15` | `SECURITY` | ❌ | ✅ | Peso de la recencia de reportes en el score | Cambia el peso y compara el score de reportes recientes vs antiguos. |
| `scoring.weight.severity` | `INTEGER` | `45` | `SECURITY` | ❌ | ✅ | Peso de la severidad promedio de categorías en el score | Cambia el peso y procesa reportes con categorías de alta severidad. |
| `scoring.weight.authenticated` | `INTEGER` | `20` | `SECURITY` | ❌ | ✅ | Peso del ratio de reportes autenticados en el score | Compara score de reportes 100% autenticados vs 100% anónimos. |
| `scoring.weight.diversity` | `INTEGER` | `10` | `SECURITY` | ❌ | ✅ | Peso de la diversidad geográfica en el score | Crea reportes desde varias ciudades y observa cómo crece el componente de diversidad. |
| `scoring.recency_days` | `INTEGER` | `90` | `SECURITY` | ❌ | ✅ | Días para considerar un reporte como reciente | Cambia a `1` día y verifica que reportes de hace una semana ya no sumen recencia. |
| `scoring.diversity.max_cities` | `INTEGER` | `5` | `SECURITY` | ❌ | ✅ | Número de ciudades distintas necesarias para puntaje máximo de diversidad | Cambia a `2` y verifica que con 2 ciudades distintas ya se obtenga el máximo en diversidad. |
| `scoring.threshold.low` | `INTEGER` | `35` | `SECURITY` | ❌ | ✅ | Score mínimo para nivel de riesgo `MEDIO` | Ajusta umbrales y verifica que el `nivelRiesgo` cambie en `/api/consulta` o seguimiento. |
| `scoring.threshold.medium` | `INTEGER` | `60` | `SECURITY` | ❌ | ✅ | Score mínimo para nivel de riesgo `ALTO` | Idem. |
| `scoring.threshold.high` | `INTEGER` | `80` | `SECURITY` | ❌ | ✅ | Score mínimo para nivel de riesgo `CRITICO` | Idem. |

### 3.5 Severidad por categoría (valores fallback)

Estos parámetros **no se crean en el seed**, pero el código los lee dinámicamente con valores por defecto si no existen.

| Clave | Tipo | Fallback | Categoría | Público | Usado | Descripción | Cómo probar |
|-------|------|----------|-----------|---------|-------|-------------|-------------|
| `scoring.severity.CONTACTO_INSISTENTE` | `INTEGER` | `30` | `SECURITY` | ❌ | ⚠️ | Severidad base para la categoría | Crea el parámetro con valor alto/bajo y procesa reportes de esa categoría; observa el score resultante. |
| `scoring.severity.SOLICITUD_MATERIAL` | `INTEGER` | `80` | `SECURITY` | ❌ | ⚠️ | Severidad base para la categoría | Idem. |
| `scoring.severity.OFRECIMIENTO_REGALOS` | `INTEGER` | `60` | `SECURITY` | ❌ | ⚠️ | Severidad base para la categoría | Idem. |
| `scoring.severity.SUPLANTACION_IDENTIDAD` | `INTEGER` | `70` | `SECURITY` | ❌ | ⚠️ | Severidad base para la categoría | Idem. |
| `scoring.severity.SOLICITUD_ENCUENTRO` | `INTEGER` | `90` | `SECURITY` | ❌ | ⚠️ | Severidad base para la categoría | Idem. |
| `scoring.severity.COMPARTIMIENTO_SEXUAL` | `INTEGER` | `95` | `SECURITY` | ❌ | ⚠️ | Severidad base para la categoría | Idem. |
| `scoring.severity.OTRO` | `INTEGER` | `20` | `SECURITY` | ❌ | ⚠️ | Severidad base para la categoría | Idem. |

### 3.6 Rate limiting

Cada scope lee dos claves: `{scope}.window_seconds` y `{scope}.max_requests`.

| Clave | Tipo | Default | Categoría | Público | Usado | Descripción | Cómo probar |
|-------|------|---------|-----------|---------|-------|-------------|-------------|
| `ratelimit.report.window_seconds` | `INTEGER` | `3600` | `SECURITY` | ❌ | ✅ | Ventana de rate limiting para reportes | Cambia `max_requests` a `1` y envía 2 reportes desde la misma IP. El segundo debe devolver `429`. |
| `ratelimit.report.max_requests` | `INTEGER` | `5` | `SECURITY` | ❌ | ✅ | Máximo de reportes por ventana | Idem. |
| `ratelimit.login.window_seconds` | `INTEGER` | `300` | `SECURITY` | ❌ | ✅ | Ventana de rate limiting para login | Envía varios logins desde la misma IP hasta superar el máximo. |
| `ratelimit.login.max_requests` | `INTEGER` | `10` | `SECURITY` | ❌ | ✅ | Máximo de intentos de login por ventana | Idem. |
| `ratelimit.consulta.window_seconds` | `INTEGER` | `60` | `SECURITY` | ❌ | ✅ | Ventana de rate limiting para consulta pública | Cambia `max_requests` a `2` y consulta 3 veces; la tercera debe ser `429`. |
| `ratelimit.consulta.max_requests` | `INTEGER` | `30` | `SECURITY` | ❌ | ✅ | Máximo de consultas públicas por ventana | Idem. |
| `ratelimit.register.window_seconds` | `INTEGER` | `3600` | `SECURITY` | ❌ | ✅ | Ventana de rate limiting para registro | Intenta registrar múltiples cuentas desde la misma IP. |
| `ratelimit.register.max_requests` | `INTEGER` | `10` | `SECURITY` | ❌ | ✅ | Máximo de registros por ventana | Idem. |

> **Nota**: si la variable de entorno `DISABLE_RATE_LIMIT=true` está activa, los rate limits se saltan y estas pruebas no funcionarán.

### 3.7 Alertas por email

| Clave | Tipo | Default | Categoría | Público | Usado | Descripción | Cómo probar |
|-------|------|---------|-----------|---------|-------|-------------|-------------|
| `alerts.admin.enabled` | `BOOLEAN` | `true` | `EMAIL` | ❌ | ✅ | Envía alertas a administradores cuando un reporte requiere revisión manual | 1. Desactívalo. 2. Envía un reporte que genere `REVISION_MANUAL` o `REQUIERE_ANONIMIZACION`. 3. Verifica que no se llame a Resend ni se envíe email. |
| `alerts.critical_score.enabled` | `BOOLEAN` | `true` | `EMAIL` | ❌ | ✅ | Envía alerta cuando un identificador alcanza score crítico | 1. Desactívalo. 2. Procesa reportes hasta que un identificador llegue a `nivelRiesgo === "CRITICO"`. 3. Verifica que no se envíe alerta. |
| `alerts.subscriptions.enabled` | `BOOLEAN` | `true` | `EMAIL` | ❌ | ✅ | Envía alertas a usuarios suscritos a un identificador | 1. Desactívalo. 2. Suscríbete a un identificador. 3. Crea un nuevo reporte para ese identificador. 4. Verifica que no se envíe email al suscriptor. |

### 3.8 Sistema

| Clave | Tipo | Default | Categoría | Público | Usado | Descripción | Cómo probar |
|-------|------|---------|-----------|---------|-------|-------------|-------------|
| `system.maintenance_mode` | `BOOLEAN` | `false` | `SYSTEM` | ✅ | ❌ | Modo mantenimiento de la plataforma | **No implementado en runtime.** No hay middleware ni página que lo consulte. |

---

## 4. Parámetros huérfanos (en seed pero no usados)

| Clave | Recomendación |
|-------|---------------|
| `security.password_min_length` | Implementar en registro/verificación o eliminar del seed |
| `security.jwt_ttl_hours` | Usar para calcular `JWT_TTL` o eliminar del seed |
| `system.maintenance_mode` | Implementar middleware/página o eliminar del seed |
| `reportes.spam.min_text_length` | Unificar con la heurística hardcodeada o eliminar |
| `reportes.worker.max_retries` | Implementar en worker o eliminar |
| `reportes.worker.stalled_threshold_minutes` | Implementar health check de cola o eliminar |
| `reportes.anonymization_model` | Usar en `anonimizarTexto` o eliminar |
| `ranking.*` (toda la familia) | Eliminar del seed; el scoring actual usa `scoring.*` |

---

## 5. Guía rápida de pruebas por flujo

### 5.1 Visibilidad pública

```bash
# 1. Consultar antes de crear reportes
curl "http://localhost:5005/api/consulta?identificador=prueba123&plataforma=whatsapp"
# Esperado: tieneReportes: false

# 2. Crear N reportes (autenticados o anónimos)
for i in {1..3}; do
  curl -X POST http://localhost:5005/api/reportes \
    -H "Content-Type: application/json" \
    -d '{"identificador":"prueba123","plataforma":"whatsapp","texto":"...","esAnonimo":false,"pais":"CO","ciudad":"Bogotá"}'
done

# 3. Procesar reportes (como admin)
curl -X POST http://localhost:5005/api/reportes/procesar \
  -H "Cookie: $ADMIN_COOKIE"

# 4. Consultar de nuevo
curl "http://localhost:5005/api/consulta?identificador=prueba123&plataforma=whatsapp"
# Esperado: tieneReportes: true si se cumplen umbral y ratio
```

### 5.2 Bloqueo por intentos de login

```bash
# Repetir 5 veces con contraseña incorrecta
for i in {1..6}; do
  curl -X POST http://localhost:5005/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"victima@example.com","password":"mala"}' \
    -w "\nHTTP %{http_code}\n"
done
# El sexto intento debe devolver 401 con mensaje de bloqueo.
```

### 5.3 Rate limiting

```bash
# Desactivar primero DISABLE_RATE_LIMIT=false en .env si estaba en true
# Cambiar ratelimit.consulta.max_requests a 2 desde el panel admin

for i in {1..3}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    "http://localhost:5005/api/consulta?identificador=rate$i"
done
# Esperado: 200, 200, 429
```

### 5.4 Alertas por email

```bash
# Desactivar alertas desde el panel admin
curl -X PATCH http://localhost:5005/api/config/parametros/alerts.admin.enabled \
  -H "Content-Type: application/json" \
  -H "Cookie: $ADMIN_COOKIE" \
  -d '{"valor":"false"}'

# Crear un reporte que requiera revisión manual (texto con PII o ambiguo)
curl -X POST http://localhost:5005/api/reportes \
  -H "Content-Type: application/json" \
  -d '{"identificador":"alerta1","plataforma":"whatsapp","texto":"mi numero es 3001234567","esAnonimo":true,"pais":"CO","ciudad":"Bogotá"}'

# Procesar y revisar logs de email; no debe enviarse alerta admin
```

---

## 6. Notas importantes

- **Caché pública**: `/api/config/parametros/publicos` tiene TTL de 60 segundos. Para pruebas de parámetros públicos, espera ese tiempo o reinicia el servidor.
- **Tests unitarios**: el entorno de test usa una base de datos separada (`proteccion_infantil_test`) y `src/lib/test-setup.ts` la configura. No ejecutes tests contra producción.
- **Parámetros críticos**: `security.*` y `system.*` no pueden eliminarse desde el panel admin por la regla del `DELETE`.
- **Variables de entorno**: algunos comportamientos como `DISABLE_RATE_LIMIT=true` o `COOKIE_SECURE=false` anulan o afectan el comportamiento de parámetros relacionados.

---

*Documento generado automáticamente a partir del schema Prisma y el código fuente. Última actualización: 2026-07-15.*
