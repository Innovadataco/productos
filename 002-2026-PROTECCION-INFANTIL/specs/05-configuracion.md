# 05 — Sistema de Parámetros de Configuración

## 5.1 Visión General

El sistema de parámetros de configuración proporciona un mecanismo centralizado, tipado y auditado para gestionar el comportamiento de la plataforma sin requerir despliegues de código. Es la columna vertebral que permite a los administradores de plataforma ajustar umbrales, políticas de seguridad, textos legales y flags de sistema en tiempo real.

### Objetivos de Diseño

1. **Tipado estricto:** Cada parámetro tiene un tipo definido que se valida en escritura.
2. **Seguridad:** Los parámetros sensibles se cifran en reposo y requieren permisos específicos para lectura.
3. **Rendimiento:** Parámetros frecuentemente leídos se cachean en Redis con invalidación automática.
4. **Trazabilidad:** Todo cambio genera un registro de auditoría inmutable.
5. **Multi-entorno:** Soporte para valores diferenciados por ambiente (`development`, `staging`, `production`).

---

## 5.2 Taxonomía de Parámetros

### Categorías

| Categoría | Propósito | Ejemplos |
|-----------|-----------|----------|
| `VISIBILITY` | Umbrales y reglas de visibilidad pública | `report_threshold`, `daily_report_limit` |
| `SECURITY` | Políticas de autenticación y seguridad | `max_login_attempts`, `jwt_access_ttl_minutes` |
| `LEGAL` | Textos legales y URLs | `privacy_policy_url`, `terms_url` |
| `EMAIL` | Configuración de servicio de correo | `verification_ttl_hours`, `from_address` |
| `RATE_LIMIT` | Límites de uso por endpoint | `auth_rate_limit`, `api_rate_limit` |
| `SYSTEM` | Flags operacionales del sistema | `maintenance_mode`, `registration_enabled` |

### Niveles de Visibilidad

| Nivel | Lectura | Escritura | Caso de Uso |
|-------|---------|-----------|-------------|
| `isPublic = true` | Sin autenticación | `PLATFORM_ADMIN` | Umbrales que el frontend necesita conocer antes de login |
| `isPublic = false` | `PLATFORM_ADMIN` | `PLATFORM_ADMIN` | Parámetros de seguridad internos |
| `isSecret = true` | `PLATFORM_ADMIN` (descifrado automático) | `PLATFORM_ADMIN` | API keys, credenciales de servicios |

---

## 5.3 Ciclo de Vida de un Parámetro

```
┌─────────────────┐
│  Definición     │
│  (seed/migración)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐     modificación    ┌─────────────────┐
│   Activo        │ ◄────────────────── │  Edición        │
│  (en uso)       │                     │ (admin panel)   │
└────────┬────────┘                     └─────────────────┘
         │
         ▼
┌─────────────────┐
│  Lectura        │
│  (cache + BD)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Auditoría      │
│  (registro de   │
│   cambio)       │
└─────────────────┘
```

---

## 5.4 API de Configuración

### 5.4.1 Listar Parámetros Públicos

```http
GET /api/v1/config/public
```

**Respuesta 200 OK:**
```json
{
  "visibility.report_threshold": {
    "value": 3,
    "type": "INTEGER",
    "category": "VISIBILITY",
    "description": "Mínimo de reportes independientes para que un identificador aparezca en consultas públicas."
  },
  "visibility.daily_report_limit": {
    "value": 10,
    "type": "INTEGER",
    "category": "VISIBILITY"
  },
  "legal.privacy_policy_url": {
    "value": "https://proteccion-infantil.org/privacidad",
    "type": "STRING",
    "category": "LEGAL"
  },
  "system.maintenance_mode": {
    "value": false,
    "type": "BOOLEAN",
    "category": "SYSTEM"
  }
}
```

**Notas:**
- No requiere autenticación.
- Solo retorna parámetros donde `isPublic = true` y `environment` coincide con el entorno actual (o `ALL`).
- Útil para que el frontend conozca umbrales antes de que el usuario inicie sesión.

---

### 5.4.2 Listar Todos los Parámetros (Admin)

```http
GET /api/v1/config
Authorization: Bearer {accessToken}

# Query params opcionales:
# ?category=VISIBILITY&environment=PRODUCTION
```

**Respuesta 200 OK:**
```json
{
  "data": [
    {
      "id": "cuid123",
      "key": "visibility.report_threshold",
      "value": 3,
      "type": "INTEGER",
      "category": "VISIBILITY",
      "isSecret": false,
      "isPublic": true,
      "environment": "ALL",
      "description": "Mínimo de reportes independientes...",
      "validationRules": "{\"min\":1,\"max\":100}",
      "updatedAt": "2026-07-11T20:00:00Z",
      "updatedBy": {
        "id": "admin_cuid",
        "name": "Administrador Plataforma"
      }
    }
  ],
  "meta": {
    "total": 15,
    "page": 1,
    "perPage": 20
  }
}
```

**Permisos requeridos:** `config:read`

---

### 5.4.3 Obtener un Parámetro Específico

```http
GET /api/v1/config/:key
Authorization: Bearer {accessToken}
```

**Respuesta 200 OK:**
```json
{
  "id": "cuid123",
  "key": "visibility.report_threshold",
  "value": 3,
  "type": "INTEGER",
  "category": "VISIBILITY",
  "isSecret": false,
  "isPublic": true,
  "environment": "ALL",
  "description": "Mínimo de reportes independientes...",
  "validationRules": "{\"min\":1,\"max\":100}",
  "updatedAt": "2026-07-11T20:00:00Z",
  "updatedBy": "admin_cuid",
  "auditHistory": [
    {
      "changedBy": "admin_cuid",
      "oldValue": "5",
      "newValue": "3",
      "reason": "Ajuste tras análisis de falsos positivos",
      "createdAt": "2026-07-10T15:30:00Z"
    }
  ]
}
```

**Permisos requeridos:** `config:read`

---

### 5.4.4 Crear o Actualizar un Parámetro

```http
PUT /api/v1/config/:key
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "value": 5,
  "type": "INTEGER",
  "category": "VISIBILITY",
  "isSecret": false,
  "isPublic": true,
  "environment": "ALL",
  "description": "Mínimo de reportes independientes para que un identificador aparezca en consultas públicas.",
  "validationRules": "{\"min\":1,\"max\":100}",
  "reason": "Ajuste tras análisis de falsos positivos"
}
```

**Validaciones:**
- `key` debe seguir notación `categoria.subclave` (letras minúsculas, puntos, guiones bajos).
- `value` debe ser serializable al `type` indicado.
- Si `validationRules` está presente, el `value` debe cumplirlas.
- `isSecret = true` implica `isPublic = false` (validación automática).

**Respuesta 200 OK (actualización):**
```json
{
  "id": "cuid123",
  "key": "visibility.report_threshold",
  "value": 5,
  "type": "INTEGER",
  "updatedAt": "2026-07-11T22:00:00Z",
  "previousValue": 3
}
```

**Respuesta 201 Created (nuevo):**
```json
{
  "id": "cuid456",
  "key": "visibility.report_threshold",
  "value": 5,
  "type": "INTEGER",
  "createdAt": "2026-07-11T22:00:00Z"
}
```

**Permisos requeridos:** `config:write`

---

### 5.4.5 Eliminar un Parámetro

```http
DELETE /api/v1/config/:key
Authorization: Bearer {accessToken}
```

**Restricciones:**
- No se pueden eliminar parámetros `isSystem = true` (marcados como críticos en seed data).
- El sistema DEBE validar que el parámetro no esté siendo referenciado activamente por código crítico.

**Respuesta 204 No Content**

**Permisos requeridos:** `config:delete`

---

### 5.4.6 Revertir a Valor por Defecto

```http
POST /api/v1/config/:key/reset
Authorization: Bearer {accessToken}

{
  "reason": "Reversión por error de configuración"
}
```

**Comportamiento:**
- Busca el valor por defecto definido en el seed del sistema.
- Si no existe valor por defecto, retorna `409 Conflict`.
- Registra auditoría con `oldValue`, `newValue` y `reason`.

**Permisos requeridos:** `config:write`

---

## 5.5 Motor de Validación

### Tipos Soportados y Reglas

| Tipo | Representación en BD | Reglas de Validación | Ejemplo de `validationRules` |
|------|---------------------|---------------------|------------------------------|
| `STRING` | String literal | `minLength`, `maxLength`, `pattern` (regex) | `{"minLength":5,"maxLength":255}` |
| `INTEGER` | String parseable a int | `min`, `max` | `{"min":1,"max":100}` |
| `FLOAT` | String parseable a float | `min`, `max`, `precision` | `{"min":0.0,"max":1.0,"precision":2}` |
| `BOOLEAN` | `"true"` o `"false"` | Ninguna | `{}` |
| `JSON` | String JSON validado | `schema` (JSON Schema draft-07) | `{"schema":{...}}` |
| `STRING_ARRAY` | String JSON array | `minItems`, `maxItems`, `uniqueItems` | `{"minItems":1,"maxItems":10}` |

### Ejemplo: Validación de `report_threshold`

```typescript
// Input
const input = {
  value: "2",        // String porque viene de HTTP
  type: "INTEGER",
  validationRules: '{"min":1,"max":100}'
};

// Proceso
const rules = JSON.parse(input.validationRules);
const numericValue = parseInt(input.value, 10);

if (isNaN(numericValue)) throw new ValidationError("VALUE_NOT_INTEGER");
if (numericValue < rules.min) throw new ValidationError("VALUE_BELOW_MINIMUM");
if (numericValue > rules.max) throw new ValidationError("VALUE_ABOVE_MAXIMUM");

// OK: almacenar "2" como string en BD
```

---

## 5.6 Caché e Invalidación

### Estrategia de Caché

```typescript
// Pseudo-código del servicio de configuración
class ConfigService {
  private cache: Redis;
  private ttlSeconds = 60; // 1 minuto para parámetros públicos
  
  async get(key: string): Promise<ConfigValue> {
    // 1. Intentar lectura de caché
    const cached = await this.cache.get(`config:${key}`);
    if (cached) return JSON.parse(cached);
    
    // 2. Lectura de base de datos
    const value = await this.db.configParam.findUnique({ where: { key } });
    if (!value) throw new NotFoundError(`Config key '${key}' not found`);
    
    // 3. Si es secreto, descifrar
    if (value.isSecret) {
      value.value = await this.decrypt(value.value);
    }
    
    // 4. Guardar en caché (solo si no es secreto o el entorno lo permite)
    if (!value.isSecret) {
      await this.cache.setex(`config:${key}`, this.ttlSeconds, JSON.stringify(value));
    }
    
    return value;
  }
  
  async set(key: string, value: ConfigValue, reason: string): Promise<void> {
    // 1. Validar
    await this.validate(value);
    
    // 2. Si es secreto, cifrar
    if (value.isSecret) {
      value.value = await this.encrypt(value.value);
    }
    
    // 3. Actualizar BD dentro de transacción
    await this.db.$transaction(async (tx) => {
      const old = await tx.configParam.findUnique({ where: { key } });
      
      await tx.configParam.upsert({
        where: { key },
        create: { ...value, key },
        update: { ...value }
      });
      
      // 4. Registrar auditoría
      await tx.configAudit.create({
        data: {
          configParamId: old?.id ?? newId,
          changedBy: this.currentUserId,
          oldValue: old?.value ?? null,
          newValue: value.value,
          reason
        }
      });
    });
    
    // 5. Invalidar caché
    await this.cache.del(`config:${key}`);
    await this.cache.del(`config:public`); // Invalidar lista pública
  }
}
```

### Política de TTL por Tipo de Parámetro

| Tipo de Parámetro | TTL en Redis | Justificación |
|-------------------|-------------|---------------|
| `isPublic = true` | 60 segundos | Frecuentemente leídos por frontend no autenticado |
| `isPublic = false, isSecret = false` | 300 segundos | Leídos por backend en cada request autenticado |
| `isSecret = true` | 0 (sin caché) | Nunca cachear valores sensibles |

---

## 5.7 Interfaz de Administración

### Panel de Configuración (`PLATFORM_ADMIN`)

El panel de administración DEBE proporcionar:

1. **Vista de lista:** Tabla con todos los parámetros, filtrable por categoría y entorno.
2. **Indicadores visuales:**
   - 🔒 `isSecret`: Valor oculto, requiere click para revelar.
   - 🌐 `isPublic`: Visible sin autenticación.
   - ⚙️ `isSystem`: No editable, solo visualizable.
3. **Editor de valor:** Campo de input adaptado al tipo (toggle para boolean, number input para integer, textarea para JSON).
4. **Validación en tiempo real:** Feedback visual antes de guardar (ej. "El valor debe ser ≥ 1").
5. **Historial de cambios:** Timeline con quién cambió qué, cuándo y por qué.
6. **Botón de revertir:** Restaurar a valor por defecto con confirmación.

### Mockup del Panel

```
┌────────────────────────────────────────────────────────────────────────┐
│  Configuración del Sistema                              [+ Nuevo]     │
├────────────────────────────────────────────────────────────────────────┤
│  🔍 Buscar...    [Categoría ▼]    [Entorno ▼]    [Solo secretos □]   │
├────────────────────────────────────────────────────────────────────────┤
│  Clave                          │ Valor    │ Tipo   │ Cat.   │ Acciones│
├─────────────────────────────────┼──────────┼────────┼────────┼─────────┤
│  visibility.report_threshold    │ 3        │ INT    │ VIS    │ ✏️ 🗑️   │
│  security.max_login_attempts    │ ●●●●●    │ INT    │ SEC    │ ✏️      │
│  legal.privacy_policy_url       │ https:// │ STR    │ LEG    │ ✏️ 🗑️   │
│  system.maintenance_mode        │ OFF      │ BOOL   │ SYS    │ ✏️      │
│  ...                            │          │        │        │         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5.8 Parámetros Críticos del Sistema

Estos parámetros DEBEN existir siempre y tienen valores por defecto protegidos:

| Clave | Valor por Defecto | Tipo | Categoría | `isSystem` | Descripción |
|-------|-------------------|------|-----------|------------|-------------|
| `visibility.report_threshold` | `3` | INTEGER | VISIBILITY | ✅ | Umbral mínimo de reportes para visibilidad pública |
| `security.max_login_attempts` | `5` | INTEGER | SECURITY | ✅ | Intentos fallidos antes de bloqueo |
| `security.lockout_duration_minutes` | `30` | INTEGER | SECURITY | ✅ | Duración del bloqueo |
| `security.password_min_length` | `12` | INTEGER | SECURITY | ✅ | Longitud mínima de contraseña |
| `security.jwt_access_ttl_minutes` | `15` | INTEGER | SECURITY | ✅ | Vida del access token |
| `security.jwt_refresh_ttl_days` | `7` | INTEGER | SECURITY | ✅ | Vida del refresh token |
| `email.verification_ttl_hours` | `24` | INTEGER | EMAIL | ✅ | Validez del enlace de verificación |
| `system.maintenance_mode` | `false` | BOOLEAN | SYSTEM | ✅ | Modo mantenimiento global |

**Nota:** Los parámetros `isSystem = true` no pueden eliminarse. Su valor por defecto se reestablece con `POST /config/:key/reset`.

---

## 5.9 Consideraciones de Seguridad

1. **Cifrado de secretos:** Los valores con `isSecret = true` se cifran con AES-256-GCM usando una clave derivada de `CONFIG_ENCRYPTION_KEY` (variable de entorno). El IV se almacena junto al ciphertext.
2. **Auditoría inmutable:** Los registros de `ConfigAudit` no pueden modificarse ni eliminarse por ningún usuario, incluyendo `PLATFORM_ADMIN`.
3. **Validación de esquema:** Los valores `JSON` se validan contra su schema antes de almacenar para prevenir corrupción de datos.
4. **Rate limiting:** Los endpoints de escritura de configuración tienen límite de 10 req/min por `PLATFORM_ADMIN`.
5. **Notificación de cambios críticos:** Al modificar parámetros de seguridad (`category = SECURITY`), el sistema DEBE enviar notificación por email a todos los `PLATFORM_ADMIN` activos.

---

## 5.10 Integración con el Frontend

### Hook de Configuración Pública

```typescript
// frontend/src/shared/hooks/usePublicConfig.ts
import { useQuery } from '@tanstack/react-query';

export function usePublicConfig() {
  return useQuery({
    queryKey: ['config', 'public'],
    queryFn: async () => {
      const res = await fetch('/api/v1/config/public');
      return res.json();
    },
    staleTime: 60_000, // 1 minuto
  });
}

// Uso: conocer el umbral antes de que el usuario haga login
function ReportVisibilityNotice() {
  const { data } = usePublicConfig();
  const threshold = data?.['visibility.report_threshold']?.value ?? 3;
  
  return <p>Un identificador aparece públicamente tras {threshold} reportes independientes.</p>;
}
```

### Hook de Configuración Admin

```typescript
// frontend/src/modules/admin/hooks/useConfig.ts
export function useConfigKey(key: string) {
  return useQuery({
    queryKey: ['config', key],
    queryFn: () => api.get(`/config/${key}`).then(r => r.data),
    enabled: hasPermission('config:read'),
  });
}

export function useUpdateConfig() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ key, value, reason }: UpdateConfigInput) =>
      api.put(`/config/${key}`, { value, reason }),
    onSuccess: (_, { key }) => {
      queryClient.invalidateQueries({ queryKey: ['config', key] });
      queryClient.invalidateQueries({ queryKey: ['config', 'public'] });
    },
  });
}