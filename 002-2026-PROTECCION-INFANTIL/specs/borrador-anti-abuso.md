# Borrador — Defensas anti-abuso

> **Este documento es material de decisión, no una spec oficial.** No implementar sin revisión y aprobación del equipo.

## 1. Ponderación de señal de fuente en el score

### Problema
Hoy el scoring (`src/lib/scoring.ts`) trata todos los reportes con el mismo peso, salvo un componente genérico de `reportesAutenticados`. Un atacante puede:
- Enviar muchos reportes anónimos contra un identificador inocente para forzar visibilidad pública.
- Crear cuentas falsas para simular "reportes autenticados".
- Reutilizar el mismo dispositivo/IP sin que el sistema lo detecte.

### Diseño propuesto
Agregar una **señal de fuente** (`fuenteConfianza`) que modere el peso de cada reporte en el score. Factores iniciales:

| Señal | Peso base | Notas |
|-------|-----------|-------|
| `esAnonimo === false` | 1.0 | Usuario autenticado con email verificado. |
| `esAnonimo === true` | 0.6-0.7 | Anónimo, pero no descalificado. |
| Cuenta recién creada (< 7 días) | ×0.5 | Reduce impacto de cuentas falsas. |
| Mismo dispositivo/IP en ráfaga | ×0.3 | Detectar coordinación desde pocas fuentes. |
| Historial de reportes confirmados por admin | ×1.2-1.5 | Recompensar fuentes confiables. |
| Historial de reportes descartados (falsos) | ×0.2 | Penalizar fuentes maliciosas. |

El score se calcularía como:
```
scoreAjustado = Σ (pesoCategoria × pesoRecencia × pesoFuente)
```

### Tablas / campos nuevos propuestos
1. **`FuenteReporte`** (nueva tabla, 1:1 con `Reporte` opcional):
   - `id`, `reporteId`, `ipHash` (SHA-256 truncado, no IP en claro), `fingerprintHash`, `cuentaDiasAntiguedad`, `reportesPrevios`, `reportesConfirmados`, `reportesDescartados`, `pesoAplicado`.
2. **`Reporte.fuenteConfianza`** (nuevo campo `Float?`, nullable para históricos).
3. **`IdentificadorReportado.scoreAnonimo`**, **`scoreAutenticado`**, **`scoreAjustado`** (campos separados para transparencia).
4. Extender `ParametroSistema` con:
   - `scoring.source_weight.anonymous`
   - `scoring.source_weight.authenticated`
   - `scoring.source_weight.new_account_factor`
   - `scoring.source_weight.burst_factor`
   - `scoring.source_weight.confirmed_factor`
   - `scoring.source_weight.discarded_factor`

### Esfuerzo estimado
- **Medio-alto**: 3-5 días.
- Incluye migración de schema, ajuste de `calcularScore`, recálculo de scores existentes, tests, y panel admin para auditar pesos.

### Riesgos
- **Falso positivo:** un usuario real anónimo en una red compartida (misma IP) podría ver reducido su peso.
- **Complejidad:** más parámetros que calibrar; requiere evaluación de no-regresión F7.
- **Privacidad:** almacenar hashes de IP/fingerprint debe documentarse en política de privacidad.

---

## 2. Proceso de descargo/apelación del identificador reportado

### Problema
Actualmente un identificador puede volverse públicamente visible sin que la persona afectada tenga mecanismo para contradecir o contextualizar los reportes. Esto abre a:
- Daño reputacional irreversible por reportes falsos o maliciosos.
- Posibles demandas o conflictos legales.
- Pérdida de confianza en la plataforma.

### Diseño propuesto
Implementar un **flujo de descargo/apelación** con estados y doble vía (reportado y admin).

#### Estados propuestos
```
SIN_APELACION
PENDIENTE_REVISION
DESCARGO_PRESENTADO
EN_REVISION_ADMIN
APELACION_ACEPTADA   -> ocultar visibilidad pública del identificador
APELACION_RECHAZADA  -> mantener visibilidad y registrar motivo
```

#### Qué ve el reportado
Una página pública `/apelar/[identificador]` (sin login) accesible mediante un **token único** enviado al email/contacto verificado del identificador, o mediante un formulario de contacto si no hay verificación.

- Resumen anonimizado de los reportes (cantidad, categorías, rangos de fechas).
- No ve texto original ni datos de quienes reportaron.
- Puede subir evidencia de descargo (texto, documentos).
- Puede solicitar corrección de información o baja por orden legal.

#### Qué ve el admin
En el dashboard admin una nueva pestaña "Apelaciones":
- Lista de apelaciones pendientes con prioridad.
- Vista del identificador, score actual, cantidad de reportes, historial de descargos.
- Botones: Aceptar / Rechazar / Solicitar más información / Escalar legal.
- Al aceptar: se oculta la visibilidad pública, se registra motivo en `AuditLog`, se notifica al reportado.
- Al rechazar: se registra motivo, se mantiene visibilidad.

### Tablas / campos nuevos propuestos
1. **`ApelacionIdentificador`** (nueva tabla):
   - `id`, `identificador`, `plataformaId`, `tokenAcceso` (hash), `estado`, `motivoSolicitud`, `evidenciaUrl`, `respuestaAdmin`, `adminId`, `creadoEn`, `actualizadoEn`.
2. **`ApelacionMensaje`** (nueva tabla, 1:N con `ApelacionIdentificador`):
   - Para thread de mensajes entre reportado y admin.
3. **`IdentificadorReportado.enApelacion`** (`Boolean @default(false)`).
4. **`IdentificadorReportado.visibleAplicandoApelacion`** (`Boolean` para previsualizar qué pasaría si se acepta).
5. Extender `AccionAudit` con `APELACION_ACEPTADA`, `APELACION_RECHAZADA`, `APELACION_CREADA`.

### Esfuerzo estimado
- **Alto**: 7-10 días.
- Incluye UI pública de apelación, panel admin, flujo de tokens seguros, notificaciones por email, tests y documentación legal.

### Riesgos
- **Tiempo de respuesta:** si no se atienden rápido, el daño reputacional ya está hecho.
- **Abuso del descargo:** agresores podrían usar el mecanismo para limpiar su reputación. Requiere revisión humana obligatoria.
- **Legal:** la comunicación con el reportado puede generar obligaciones de transparencia según jurisdicción.

---

## 3. Endurecimiento de rate limiting por fuente

### Problema
Hoy el rate limit se aplica por IP o por usuario autenticado (`scope: report`). Un atacante puede:
- Rotar IPs (botnet, proxy) para evadir el límite por IP.
- Crear muchas cuentas para evadir el límite por usuario.
- Enviar reportes coordinados contra el mismo identificador desde múltiples fuentes.

### Diseño propuesto
Agregar **rate limits adicionales y compuestos**:

| Scope | Límite | Descripción |
|-------|--------|-------------|
| `report` | 5/hora por IP | Actual. Mantener. |
| `report_auth` | 10/hora por usuario | Para usuarios autenticados. |
| `report_identificador` | 10/hora por `(identificador, plataforma)` | Evita ráfagas coordinadas contra una víctima. |
| `report_fingerprint` | 5/hora por fingerprint | Difícil de evadir rotando IPs. |
| `register` | 5/hora por IP | Actual. Mantener. |
| `seguimiento` | 30/min por IP | Nuevo: evita fuerza bruta de números de seguimiento. |

Además, en el endpoint `/api/reportes`:
- Detectar si varios reportes contra el mismo identificador llegan desde IPs diferentes en una ventana corta.
- Si se supera el umbral `report_identificador`, marcar reportes subsiguientes como `POSIBLE_SPAM` o `REVISION_MANUAL` en lugar de rechazarlos (para no perder reportes legítimos).

### Tablas / campos nuevos propuestos
1. Nuevas claves en `ParametroSistema`:
   - `ratelimit.report_auth.window_seconds`
   - `ratelimit.report_auth.max_requests`
   - `ratelimit.report_identificador.window_seconds`
   - `ratelimit.report_identificador.max_requests`
   - `ratelimit.report_fingerprint.window_seconds`
   - `ratelimit.report_fingerprint.max_requests`
   - `ratelimit.seguimiento.window_seconds`
   - `ratelimit.seguimiento.max_requests`
2. **`Reporte.fingerprintHash`** (nuevo campo `String?`, índice) para deduplicación y rate limit por dispositivo.
3. Opcional: tabla `ReporteFuente` para historial de reportes por IP/fingerprint (ya contemplada en la sección 1).

### Esfuerzo estimado
- **Medio**: 3-4 días.
- Incluye ajuste de `checkRateLimit`, fingerprint básico en frontend, tests de rate limit, y seed de parámetros.

### Riesgos
- **Falsos positivos:** redes públicas o NAT compartido pueden bloquear reportes legítimos.
- **Fingerprinting:** técnicas básicas pueden ser evadidas; técnicas agresivas pueden generar problemas de privacidad.
- **UX:** usuarios legítimos pueden confundirse si ven mensajes de "demasiados reportes".

---

## Resumen comparativo

| Defensa | Esfuerzo | Riesgo principal | Dependencias |
|---------|----------|------------------|--------------|
| Ponderación de fuente | 3-5 días | Falsos positivos por IP compartida | Schema scoring, panel admin |
| Descargo/apelación | 7-10 días | Abuso del mecanismo | UI pública, email, legal |
| Rate limit por fuente | 3-4 días | Bloqueo de reportes legítimos | Rate-limit, fingerprint |

## Recomendación de orden

1. **Rate limit por fuente** (impacto inmediato, menor riesgo).
2. **Ponderación de fuente** (mejora calidad del score, requiere calibración).
3. **Descargo/apelación** (mayor esfuerzo y riesgo legal, pero necesario para escalabilidad y confianza).
