# Research: SPEC-226 — Ejecución de acciones automáticas (reglas modo EJECUTA)

## 1. Contexto del problema

El brief Análisis dinero-vs-valor (§8.2, §9) define reglas con modo `EJECUTA`: el sistema actúa solo. SPEC-221 construye el motor de detección/generación de recomendaciones, pero nada ejecuta la `accionEjecutable`. Sin esta spec:

- Una regla promovida a `EJECUTA` generaría recomendaciones que nadie ejecuta (falsa autonomía).
- No habría trazabilidad de qué acción se disparó, con qué parámetros ni desde qué regla (candado del instructivo: "Cada acción ejecutada queda en AuditLog con la regla origen").
- No habría freno anti-spam ni reversión (candados: "Rate-limit por regla", "Rollback manual posible en Recomendacion").

## 2. Incógnitas resueltas contra el código real

### 2.1 ¿Cómo se crea un bono programáticamente hoy?

- Modelo `BonoPromocional` en `prisma/schema.prisma:794` (campos: `nombre @unique`, `tipo TipoBono`, `valor`, `vigenciaInicio/Fin`, `aplicaARenovaciones`, `activo`, `creadoPorAdminId` — requerido).
- Enum `TipoBono` en `prisma/schema.prisma:299-303`: `DESCUENTO_PCT | DESCUENTO_FIJO_USD | MESES_GRATIS`.
- Repositorio: `PagosRepository.crearBonoPromocional(data)` en `src/lib/dal/repositories/pagos-repository.ts:325`.
- **Resolución**: el handler `CREAR_BONO` usa ese repositorio sin tocar el módulo Pagos. `creadoPorAdminId` se satisface con `regla.creadaPorAdminId` (el admin dueño de la regla queda como autor del bono — trazabilidad humana de una acción automática).

### 2.2 ¿Cómo se dispara una notificación sin violar el Motor Notificaciones?

- `src/lib/notificaciones/motor.ts:1-6` prohíbe explícitamente escribir en `Notificacion` desde fuera del módulo; la API pública es `programar(input)` (`motor.ts:79`) y `cancelar(input)` (`motor.ts:169`), re-exportadas en `src/lib/notificaciones/index.ts:4`.
- `programar` resuelve reglas activas por evento, opt-out por preferencia, plantillas por canal y reemplazo de programaciones duplicadas (`motor.ts:79-129`).
- Modelos: `Notificacion` (`prisma/schema.prisma:2279`), `NotificacionRegla` (`:2329`), `NotificacionPlantilla` (`:2311`, cuerpo Markdown), canales `EMAIL | IN_APP` (`:2272`).
- **Resolución**: `ENVIAR_NOTIFICACION` y `CREAR_ALERTA` solo llaman `programar()`; el rollback llama `cancelar()`. El seed añade el evento `analisis.alerta.admin` + regla + plantilla por upsert (aditivo, patrón de SPEC-236 con Motor Notif).

### 2.3 ¿Existe rate-limit parametrizable reutilizable para "por regla"?

- `src/lib/rate-limit.ts:56-71`: los scopes se configuran por `ParametroSistema` con claves `ratelimit.{scope}.window_seconds` y `ratelimit.{scope}.max_requests`; defaults por scope con fallback `{windowSeconds: 60, maxRequests: 30}`; store en tabla `RateLimit` (ventanas fijas, `rate-limit.ts:155-162`); fail-open con log si el store falla (I-28).
- **Resolución**: scope nuevo `analisis_accion` con `identifier = reglaId`. Cero cambios al limitador; solo seed de dos parámetros. No se toca el rate-limit del reporte público (candado del instructivo).

### 2.4 ¿Sirve el asignador de operadores existente?

- `asignarOperadorAReporte(reporteId)` en `src/lib/operadores/asignador.ts:88-145`: exige `Reporte` en `REVISION_MANUAL`/`POSIBLE_SPAM`, cupo por tenant y escribe `reporte.operadorId` con `AuditLog` (`OPERADOR_ASIGNADO`).
- **Resolución**: NO se reutiliza. El sujeto de esta acción es una `Recomendacion` de negocio (cliente/suscripción), no un `Reporte` de moderación. Se implementa selección propia (`operadorId` explícito o `menor_carga` contando `EjecucionAccion` vivas) y se notifica por Motor Notif.

### 2.5 ¿Cómo se audita con valores nuevos de AccionAudit?

- `AccionAudit` es enum Prisma (`prisma/schema.prisma:46+`); añadir valores es aditivo en PostgreSQL (`ALTER TYPE ... ADD VALUE`), patrón ya usado (ej. SPEC-182 añadió `RECONCILIACION_HUERFANOS`, schema:85-86). `logAudit` en `src/lib/audit.ts`.
- **Resolución**: tres valores aditivos: `ANALISIS_ACCION_EJECUTADA`, `ANALISIS_ACCION_FALLIDA`, `ANALISIS_ACCION_REVERTIDA`. Metadatos: `reglaId`, `reglaClave`, `recomendacionId`, `tipoAccion`, resultado — sin PII ni textos de reportes (Ley 1581, candado del instructivo).

### 2.6 ¿Hay patrón de endpoints admin para este módulo?

- Patrón de rutas admin de pagos: `src/app/api/admin/pagos/bonos/route.ts:13-44` — `verifyAuth("ADMIN")` + `assertModulo` + `checkRateLimit` + validación Zod (`withValidation`/schemas) + `errorToResponse` con códigos canónicos.
- **Resolución**: los endpoints `aplicar`/`revertir` siguen ese patrón exacto bajo `/api/admin/analisis/recomendaciones/[id]/`.

### 2.7 ¿Existe ya algo del módulo Análisis en el schema?

- `SesionLog` ya existe (`prisma/schema.prisma:640`, SPEC-INFRA-SESSION-LOG). NO existen `ReglaRecomendacion` ni `Recomendacion` (búsqueda en schema: 0 coincidencias) — las entrega SPEC-221 en la misma rama.
- **Resolución**: esta spec referencia los campos de `ReglaRecomendacion`/`Recomendacion` según brief §5.3/§5.4 y ajusta en implementación si SPEC-221 difiere; la relación inversa `Recomendacion.ejecuciones` es aditiva.

## 3. Opciones consideradas

### 3.1 Invocación del ejecutor

| Opción | Pros | Contras | Decisión |
|--------|------|---------|----------|
| In-process desde worker SPEC-221 | Simple, TX única, retry por tick | Caída del proceso interrumpe el tick (TX revierte) | Sí |
| Job pg-boss por acción | Retry granular, desacopla | Cola + consumidor + reconciliación nuevas para bajo volumen | No |
| Worker propio con advisory lock | Aislado | Duplica infra de SPEC-221 sin necesidad | No |

### 3.2 Trazabilidad de la ejecución

| Opción | Pros | Contras | Decisión |
|--------|------|---------|----------|
| Tabla `EjecucionAccion` propia | Historial N:1, rollback limpio, desacopla de SPEC-221 | Una tabla más | Sí |
| Campos JSON en `Recomendacion` | Sin tabla nueva | Sin historial, acopla dos specs en paralelo | No |
| Solo `AuditLog` | Cero modelo nuevo | AuditLog no está pensado para consulta operativa ni rollback | No |

### 3.3 Rollback

| Opción | Pros | Contras | Decisión |
|--------|------|---------|----------|
| `revertir()` por handler (efecto inverso específico) | Preciso por tipo, honesto con límites (email enviado no se des-envía) | Hay que implementar 4 reversiones | Sí |
| Rollback genérico "marcar revertida" | Trivial | Falso: el bono/la notificación seguiría activa | No |

## 4. Referencias y dependencias

- **SPEC-221** (misma rama): `ReglaRecomendacion`, `Recomendacion`, worker de evaluación, dedup `(reglaId, sujetoId)` — punto de invocación del ejecutor.
- **SPEC-216** (prod): `BonoPromocional` + `PagosRepository.crearBonoPromocional`.
- **SPEC-201..204** (prod): Motor Notificaciones, `programar()`/`cancelar()`, catálogo eventos/plantillas.
- **SPEC-224** (misma rama): promoción `RECOMIENDA → EJECUTA` con confirmación fuerte (gobierna el flag `modo`).
- **SPEC-227** (misma rama): historial de recomendaciones (consumirá `EjecucionAccion` para métricas).
- **SPEC-236**: patrón de referencia para seed aditivo de eventos Motor Notif, `AccionAudit` aditivos y quickstart con timezone Bogotá.
- `INSTRUCTIVO-002-PI-127` (radicación) y `BRIEF-ANALISIS-DINERO-VS-VALOR.md` §8/§9 (fuente de alcance y anatomía de acciones).
- `.specify/memory/constitution.md`: sin PII en agregados, lenguaje descriptivo, IA local (este módulo no usa IA).

## 5. Lecciones de specs anteriores

- SPEC-236: TX por transición + evento publicado post-TX (fail-open hacia notificaciones) funciona bien; se copia el patrón.
- SPEC-216: bonos con `nombre @unique` — el handler debe generar nombres determinísticos únicos (`<prefijo>-<sujeto>-<fecha>`) para evitar colisiones en reintentos.
- SPEC-201: el Motor Notif ya loguea "sin reglas activas" (`motor.ts:82`); el ejecutor no debe tratar `programadas = 0` como fallo.
- I-28 (rate-limit): el limitador es fail-open; el ejecutor no debe asumir que el límite siempre se aplica — el tope duro real es la dedup de SPEC-221.

## 6. Preguntas abiertas (para clarify con ZEUS si es necesario)

1. `asignar_operador` v1 persiste la asignación en `EjecucionAccion.resultado.operadorId` y notifica al operador por email/in-app, pero no hay bandeja del operador para recomendaciones (la vista es de SPEC-227, orientada a admin). ¿Se acepta como v1 o se requiere una vista mínima del operador en esta spec? **Propuesta: aceptar como v1 (la notificación lleva el enlace al panel admin/operador), documentar como deuda.**
2. `crear_alerta` con destinatarios "todos los ADMIN activos" si `analisis.acciones.alertas_destinatarios` está vacío — ¿correcto o debe ser solo el CEO? **Propuesta: todos los ADMIN activos (hoy es el CEO y su equipo directo, brief §1).**
3. ¿El prefijo del nombre de bono automático (`RET-`) es fijo o parametrizable? **Propuesta: fijo `AUT-<reglaClave>-` para trazabilidad directa.**
