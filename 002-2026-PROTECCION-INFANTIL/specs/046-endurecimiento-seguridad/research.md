# Research: Endurecimiento de Seguridad (Spec 046)

**Date**: 2026-07-20
**Feature**: specs/046-endurecimiento-seguridad/spec.md

---

## 1. Inventario de PII

### 1.1 Modelos de datos (prisma/schema.prisma)

| Entidad | Campo | Tipo de dato | Tratamiento actual | Riesgo / Acción |
|---------|-------|--------------|--------------------|-----------------|
| `Usuario` | `email` | String único | Texto plano | Acceso restringido a admin / propietario; no exponer en respuestas públicas |
| `Usuario` | `nombre` | String opcional | Texto plano | Igual que email |
| `Usuario` | `passwordHash` | String | bcrypt | Nunca exponer |
| `CodigoVerificacion` | `email` | String | Texto plano | Transitorio; no exponer en APIs |
| `CodigoVerificacion` | `codigoHash` | String | bcrypt | OK |
| `TokenRecuperacion` | `email` | String | Texto plano | Transitorio; no exponer |
| `TokenRecuperacion` | `tokenHash` | String | hash | OK |
| `ParametroSistema` | `valor` | String | Cifrado con `param-encryption` si `esSecreto=true` | OK para secretos; plaintext para otros |
| `Reporte` | `texto` | String (Text) | Anonimizado tras procesamiento | No exponer en consulta pública; OK para operadores con permiso |
| `Reporte` | `textoOriginal` | String (Text) | Cifrado con `param-encryption` | Solo revelar con autorización estricta y audit (`TEXTO_ORIGINAL_REVELADO`) |
| `Reporte` | `identificador` | String | Texto plano | Es el sujeto de la consulta pública; bajo umbral de visibilidad |
| `Reporte` | `numeroSeguimiento` | String único | Texto plano | Solo para el reportante; no exponer en consulta pública |
| `Reporte` | `processingError` | String (Text) | Texto plano | Puede contener texto del reporte si no se sanitiza; **riesgo** |
| `IntegranteComite` | `nombres`, `apellidos` | String | Texto plano | Solo admin/comité; OK con permisos |
| `IntegranteComite` | `numeroIdentificacion` | String | Cifrado con `param-encryption` | OK |
| `IntegranteComite` | `email` | String | Texto plano | Acceso restringido |
| `ApelacionIdentificador` | `identificador` | String | Texto plano | Público bajo token |
| `ApelacionIdentificador` | `contacto` | String | Texto plano | Solo apelación/admin |
| `ApelacionIdentificador` | `motivoSolicitud` | String (Text) | Texto plano | No exponer en consulta pública |
| `ApelacionIdentificador` | `respuestaAdmin` | String (Text) | Texto plano | Solo admin |
| `ContactoConfianza` | `etiqueta`, `nota` | String/Text | Texto plano | Solo usuario propietario |
| `IdentificadorContacto` | `valor` | String | Texto plano | Solo usuario propietario |
| `AlertaSuscripcion` | `identificador` | String | Texto plano | Solo usuario propietario |
| `DatasetEntrenamiento` | `texto` | String (Text) | Debe ser anonimizado | **Crítico**: validar que nunca contenga PII cruda |
| `ClasificacionIA` | `rawResponse` | String (Text) | Texto plano | Puede contener texto del prompt/reporte; tratar como PII |
| `ClasificacionIA` | `piiDetectada` | String[] | Texto plano | Fragmentos de PII detectada; no exponer en APIs públicas |
| `AuditLog` | `metadatos`, `valorAnterior`, `valorNuevo` | Json/String | Texto plano | **Riesgo**: no deben contener texto de reporte ni PII |
| `FuenteReporte` | `ipHash`, `fingerprintHash` | String | Hash | OK |

### 1.2 Logs y salidas de API

| Ubicación | Riesgo de fuga | Medida |
|-----------|----------------|--------|
| `console.error` en `reportes/procesar` | Puede incluir `reporte.texto` si se loguea con error | Nunca loguear `reporte.texto` ni `textoOriginal` en errores |
| Respuesta de `/api/consulta` | No incluye texto del reporte; solo agregados | Verificado en código actual |
| Respuesta de `/api/consulta/detalle` | No incluye texto del reporte | Verificado en código actual |
| Respuesta de `/api/admin/reportes/[id]/revelar-original` | Descifra `textoOriginal` bajo permiso | OK con autorización |
| Respuesta de `/api/admin/dataset-entrenamiento` | Filtra `textoAnonimizado=true` | OK, pero verificar que el texto no contenga PII residual |
| Respuesta de errores en API | Filtrar `Error.message` | US5 |

### 1.3 Minimización aplicada

- `Reporte.texto` se anonimiza antes de clasificación final.
- `Reporte.textoOriginal` se cifra con AES-256-GCM.
- `DatasetEntrenamiento.texto` se anonimiza antes de insertar (con backfill si falla).
- `ParametroSistema.valor` se cifra si `esSecreto=true`.
- `IntegranteComite.numeroIdentificacion` se cifra.
- `FuenteReporte` almacena hashes, no IPs/fingerprint raw.
- `AuditLog` para correcciones solo registra metadatos de categoría, nunca texto.

---

## 2. CSP actual y hardening

### 2.1 CSP actual (next.config.ts)

```
default-src 'self'
script-src 'self' 'unsafe-inline' 'unsafe-eval'
style-src 'self' 'unsafe-inline'
img-src 'self' data: blob:
font-src 'self'
connect-src 'self'
frame-ancestors 'none'
base-uri 'self'
form-action 'self'
```

### 2.2 Problemas identificados

- `script-src 'unsafe-eval'` permite `eval()` y `Function()`, reduciendo la protección contra XSS.
- `script-src 'unsafe-inline'` permite scripts inline arbitrarios; debe reemplazarse por nonces.
- `style-src 'unsafe-inline'` es aceptable para estilos inline de CSS-in-JS, pero debe documentarse.
- Faltan directivas: `manifest-src`, `worker-src`, `media-src`, `upgrade-insecure-requests`.

### 2.3 Solución aplicada

- Mantener la CSP en `next.config.ts` para evitar incompatibilidades con Next.js 16/Turbopack y la generación de scripts en tiempo de desarrollo.
- Eliminar `unsafe-eval` en producción; condicionarlo solo para `next dev` (Turbopack/HMR lo requiere).
- Mantener `unsafe-inline` en `script-src` documentando el riesgo residual: el producto no usa scripts inline arbitrarios en tiempo de ejecución, pero Next.js/Turbopack puede generar bloques inline durante el desarrollo. En producción, la política es `script-src 'self' 'unsafe-inline'` (sin nonce), que sigue siendo más restrictiva que el valor original que incluía `unsafe-eval`.
- **Añadir `manifest-src 'self'`, `worker-src 'self'`, `media-src 'self'`**.
- **No añadir `upgrade-insecure-requests` ni HSTS por entorno**: ambos headers se gobiernan mediante la variable de entorno `ENABLE_HTTPS_HEADERS` (default `false`). Solo se emiten cuando se configure explícitamente a `true` en despliegues reales con HTTPS. Esto evita bloqueos de estilos/scripts y grabación de HSTS en entornos de acceso por HTTP (Mac, Tailscale, LAN).
- Conservar `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`.

**Nota sobre nonces**: se evaluó la opción de mover la CSP a `src/lib/proxy.ts` con nonces por petición. Next.js 16 no inyecta automáticamente el nonce en los scripts generados por Turbopack, lo que rompe la carga de scripts en desarrollo y en los tests e2e. Por eso se descartó para esta fase y se optó por la CSP condicional en `next.config.ts`.

---

## 3. Paginación

### 3.1 Endpoints revisados

| Endpoint | Parámetro | Tope actual | Acción |
|----------|-----------|-------------|--------|
| `/api/admin/dataset-entrenamiento` | `pageSize` | 100 | Confirmar y centralizar |
| `/api/config/parametros` | `pageSize` | 100 | Confirmar y centralizar |
| `/api/reportes/mis-reportes` | `pageSize` | 100 | Confirmar y centralizar |
| `/api/admin/comite/pendientes` | `limit` | 100 (Zod) | Sin cambios |
| `/api/admin/estadisticas/clasificacion` | `pageSize` | 100 (Zod) | Sin cambiones |
| `/api/admin/audit-logs` | `pageSize` | 100 (Zod) | Sin cambios |
| `/api/consulta`, `/api/consulta/detalle` | `take: 1000` | No paginado | Fuera de alcance (agregación fija) |

### 3.2 Solución

- Crear `src/lib/pagination.ts` con `MAX_PAGE_SIZE = 100` y `clampPageSize()`.
- Reutilizar en los tres endpoints.
- Asegurar que `pageSize` en la respuesta JSON sea el valor efectivo después del clamp.

---

## 4. Sanitización de errores

### 4.1 Rutas que filtraban `Error.message` crudo

- `src/app/api/circulo-confianza/[id]/route.ts` (PATCH)
- `src/app/api/circulo-confianza/route.ts` (POST)
- `src/app/api/health/worker/route.ts`
- `src/app/api/admin/ia/modelos/route.ts`
- `src/app/api/admin/ia/ollama/probar/route.ts`
- `src/app/api/admin/ia/evals/route.ts`
- `src/app/api/admin/ia/experimentos/route.ts`
- `src/app/api/auth/verificar/solicitar/route.ts` (exponía `emailError` en dev)
- `src/app/api/auth/recuperar/solicitar/route.ts` (exponía `emailError` en dev)

### 4.2 Solución

- Añadir `safeErrorMessage(error, fallback)` en `src/lib/errors.ts`.
- Para excepciones no controladas: log interno + respuesta genérica "Error interno".
- Para `AppError`: respuesta controlada con `error.toJSON()`.
- Para errores de email en desarrollo: mantener `devCode`/`devToken` pero no exponer `emailError`.

---

## 5. Plan de rotación de `PARAM_ENCRYPTION_KEY`

### 5.1 Estado actual

- `param-encryption.ts` usa una única clave `PARAM_ENCRYPTION_KEY`.
- El formato cifrado es `enc:{iv, tag, v}` sin versionado.
- No hay mecanismo para múltiples claves activas.

### 5.2 Estrategia propuesta

1. **Versionado**: cambiar el prefijo a `enc:vN:{...}` donde `N` es un entero incremental.
2. **Múltiples claves**: soportar `PARAM_ENCRYPTION_KEY` (actual) y `PARAM_ENCRYPTION_KEY_V<N>` para futuras versiones.
3. **Descifrado transparente**: `decryptParameter` detecta la versión y usa la clave correspondiente.
4. **Re-cifrado offline**: script `scripts/rotate-param-encryption-key.ts` que:
   - Lee todos los `ParametroSistema` con `esSecreto=true` y `textoOriginal` de `Reporte` con prefix `enc:`.
   - Descifra con la clave antigua.
   - Cifra con la nueva clave.
   - Actualiza en transacción.
   - Verifica ida/vuelta; si falla, hace rollback.
5. **Rollback**: backup de BD antes de la rotación; script de rollback que restaura valores originales.
6. **Compatibilidad**: valores sin versión (`enc:...`) se siguen tratando como v1 para compatibilidad.

### 5.3 Tareas plan-only

- No se implementa código productivo en esta fase.
- Se documenta el plan completo en `research.md` y `tasks.md`.
- Se identifican archivos a modificar: `src/lib/param-encryption.ts`, `scripts/rotate-param-encryption-key.ts`, `docs/runbook.md`.

---

## 6. Decisiones

- **No tocar SPEC-050 ni SPEC-060**: cumplido.
- **No migraciones destructivas**: cumplido.
- **CSP con nonce en middleware**: mejor opción que headers estáticos para soportar nonces.
- **pageSize centralizado**: mejora la consistencia y auditabilidad.
- **Test e2e de anonimización**: cubre el riesgo más crítico de fuga de PII.
