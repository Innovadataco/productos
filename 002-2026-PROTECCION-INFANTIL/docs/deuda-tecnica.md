# Deuda técnica — Protección Infantil

> Inventario clasificado de deuda técnica del proyecto.
> Última actualización: 2026-07-19.

## Clasificación

| Categoría | Significado |
|-----------|-------------|
| **FIX AHORA hechos** | Problemas que ya fueron resueltos durante el desarrollo y no requieren acción futura. Se mantienen en el inventario para auditoría. |
| **NECESITA SPEC** | Brechas que requieren una especificación nueva o una sesión de decisión antes de implementarse. |
| **ACEPTADO** | Compromisos conscientes que se asumen como parte del diseño actual. No se actúa salvo que cambie el contexto. |

---

## FIX AHORA hechos

| # | Ítem | Contexto / riesgo que se cerró | Evidencia de cierre |
|---|------|--------------------------------|---------------------|
| F1 | Worker inestable y sin supervisión | El worker podía morir silenciosamente o reiniciarse en loop. | `scripts/worker-supervisor.mjs`, monitoreo de health y reintentos con backoff. |
| F2 | Seed con Prisma en lugar de SQL crudo | El seed original usaba SQL manual, era frágil ante cambios de schema. | `prisma/seed.ts` usa Prisma Client; verificado en ensayo de despliegue. |
| F3 | Warning de ESLint en build | Había warnings que ensuciaban la salida de build. | `npm run lint` queda con 0 errores y 1 warning preexistente conocido en `src/lib/sms.ts`. |
| F4 | Doble navegación en onboarding | El tour de onboarding aparecía en rutas donde no debía. | Onboarding limitado a home; middleware actualizado. |
| F5 | Proxy no exponía rutas de apelaciones | `/api/apeaciones` y `/apelar` devolvían 401/404 para usuarios públicos. | `src/proxy.ts` actualizado; verificado con `scripts/smoke-apelaciones.ts`. |
| F6 | Placeholder de `PARAM_ENCRYPTION_KEY` inválido | El ejemplo tenía 33 caracteres, fallando al cifrar. | `.env.example` y `.env.production.example` corregidos a exactamente 32 bytes. |
| F7 | `psql` no disponible en el host de despliegue | El checklist asumía `psql` local. | `docs/despliegue.md` v2.1 usa `docker exec <db> psql ...`. |
| F8 | Build de Next.js lee `.env` fijo | El build no respetaba `.env.ensayo` u otros nombres. | Documentado en `docs/despliegue.md` v2.1: usar `.env.production` o variables de entorno. |
| F9 | Checklist v2 desactualizado | Faltaban T7 (cifrado), Fase C (apelaciones), `SMS_PROVIDER`, `ADMIN_EMAIL` y jobs de mantenimiento. | `docs/despliegue-v2-checklist.md` y `docs/despliegue.md` v2.1 actualizados. |
| F10 | Secretos en respuestas de parámetros | Los endpoints de config devolvían valores planos. | Cifrado AES-256-GCM + endpoint `revelar` bajo rate-limit; listados devuelven `valor: null`. |

---

## NECESITA SPEC

> Los ítems de afinamiento del modelo (curaduría de fixture, umbral de revisión, peso de fuente, modelo de desempate, reducción de error silencioso) se rastrean también en [`specs/088-pendientes-afinamiento/registro.md`](../specs/088-pendientes-afinamiento/registro.md).

| # | Ítem | Contexto / riesgo | Disparador de revisión |
|---|------|--------------------|------------------------|
| N1 | **Proveedor SMS real** | Actualmente `SMS_PROVIDER=mock`. Para producción se requiere integrar Twilio/otro y verificar OTP real en staging. | Antes de activar Fase C en producción con teléfonos reales. |
| N2 | **Modelo de desempate** | `reportes.classification.modelo_desempate` está vacío. Se deshabilitó por no mejorar métricas en evaluaciones. | Cuando el Laboratorio IA demuestre una config de desempate que mejore la baseline. |
| N3 | **Backfill de scores históricos con peso de fuente** | `scoring.source_weight.enabled=false`. Al activarse, los scores viejos no se recalculan automáticamente. | Junto con la simulación post-despliegue que apruebe el owner. |
| N4 | **Hard-delete / purga física** | Solo existe soft-delete. Órdenes legales o GDPR pueden requerir eliminación física con prueba de destrucción. | Orden legal, auditoría de privacidad o cambio de retención. |
| N5 | **Automatización de jobs de mantenimiento** | Limpieza de fuentes requiere ejecutarse periódicamente; hoy son comandos manuales. (La parte de vencimiento de apelaciones quedó FUERA DE ALCANCE por decisión del CEO, 2026-07-24 — ver D-APE-1.) | Antes del primer despliegue productivo. |
| N6 | **Eval de PII administrable desde el panel** | El eval de PII sigue con fixture JSON (`scripts/eval-pii-fixture.json`) porque no encaja en `CasoEval`. | Si el owner requiere gestionar casos de PII desde el mismo UI de evals. |
| N7 | **Resolución de los 14 casos dudosos del fixture** | 14 casos de `fixtureVersion=11` tienen etiquetas discutibles; pueden mover la baseline. | Sesión de curaduría con el owner; luego re-correr baseline v3. |
| N8 | **Restauración de ejemplos purgados del dataset** | Al reactivar un reporte dado de baja por `REPORTE_FALSO`/`ORDEN_LEGAL`, su fila de `DatasetEntrenamiento` no se recupera automáticamente. | Si se habilita la reactivación de reportes purgados como flujo normal. |
| N9 | **Notificaciones automáticas** | Ni el reportante ni el titular del identificador reciben notificaciones de cambios de estado. | Requerimiento legal o de producto. |
| N10 | **Setup HTTPS/HSTS en producción** | `COOKIE_SECURE=true` y HSTS requieren certificado y dominio reales. | Definición de dominio/URL pública en sesión de despliegue. |

---

## NECESITA DECISIÓN

| ID | Ítem | Detalle | Requiere |
|----|------|---------|----------|
| D-APE-1 | **Mecanismo de apelación fuera de alcance** | El CEO sacó las apelaciones del alcance (2026-07-24) pero el código vivo sigue (flujo, pausa de visibilidad, job de vencimiento manual). Opciones: implementarlo bien, retirarlo, o enmendar §1.6 de la constitución. | CEO + revisión legal ANTES de producción (Ley 1581 / habeas data). NO automatizar ni tocar el flujo hasta decidir. |
| D-SEV-1 | **Escala de gravedad sin criterio** (`scoring.severity.*`) | Números (30/60/90) sin criterio documentado ni validación experta. Tras la 092 ya no decide de cara al usuario, pero sigue usándose internamente (priorización de bandeja). | NECESITA SPEC: definir el criterio de la escala con expertos. |

## FIX AHORA hechos

| # | Ítem | Contexto / por qué se acepta |
|---|------|------------------------------|
| A1 | **Soft-delete como único mecanismo de baja** | Mantiene trazabilidad de auditoría; se prioriza la capacidad de investigar sobre el ahorro de espacio. |
| A2 | **Modelos de IA solo locales (Ollama)** | Restricción R2: textos sensibles de menores no salen del entorno de confianza. |
| A3 | **Apelaciones: mecanismo FUERA DE ALCANCE (CEO, 2026-07-24)** | Ya no se acepta el riesgo: el mecanismo está fuera de alcance. Ver D-APE-1. |
| A4 | **Baseline de error silencioso 16.7 %** | Nueva línea base sobre `fixtureVersion=11`. No cumple el KPI de producto (<5 %); la mejora depende de correcciones reales de producción. |
| A5 | **Fingerprint server-side con IP truncada a /24** | Balance entre privacidad (no almacenar IP en claro) y utilidad anti-abuso. |
| A6 | **No reprocesar reportes existentes al cambiar modelo/config** | Decisión de diseño para evitar costos y efectos impredecibles; solo afecta reportes nuevos. |
| A7 | **OTP mock en desarrollo** | Se usa un provider mock que loguea el código; nunca se hardcodea proveedor real. |
| A8 | **Reactivación regenera embedding pero no restaura dataset purgado** | Por diseño: si el motivo fue `REPORTE_FALSO`/`ORDEN_LEGAL`, el ejemplo no vuelve al dataset RAG. |
| A9 | **Una corrida de eval a la vez** | Simplifica el scheduling y evita saturar Ollama; colas pg-boss serializan el trabajo. |
| A10 | **Retención de hashes de fuente limitada a 90 días** | Default configurable `anti_abuso.retencion_fuente_dias=90`; balance entre investigación y privacidad. |
| A11 | **Emparejamiento de nombres de país por normalización de texto** | El mapa usa comparación simple BD ↔ GeoJSON. Se acepta el riesgo de países no coloreados; se mitiga con la lista "Top países" y puntos de ciudad. |
| A12 | **GeoJSON de países en lugar de TopoJSON** | Se priorizó no agregar dependencias (`topojson-client`) y reutilizar `react-leaflet`. El tamaño (~251 KB) es aceptable para el bundle actual. |
| A13 | **Sin tests automatizados de componente para US1/US2/US3** | Los cambios se validaron con lint, types, tests existentes y pruebas manuales con curl. Se acepta agregar tests de componente en un lote de higiene posterior. |

---

## Disparador de revisión

Revisar y, de ser necesario, actualizar este documento cuando ocurra cualquiera de los siguientes eventos:

1. **Cierre de un lote o spec**: agregar ítems nuevos y reclasificar los cerrados.
2. **Incidente de producción**: si una deuda aceptada o pendiente contribuye al incidente, evaluar pasarla a `FIX AHORA` o `NECESITA SPEC`.
3. **Decisión del owner**: cualquier cambio en flags, proveedores o políticas de retención.
4. **Trimestral**: revisión programada para detectar deuda obsoleta o que dejó de aplicar.
5. **Antes de cada despliegue**: verificar que ningún ítem `NECESITA SPEC` bloquee el release.

## Deuda registrada en el barrido del 2026-07-24 (spec 094)

| ID | Ítem | Detalle | Estado |
|----|------|---------|--------|
| D-094-1 | Parámetros muertos: `security.password_min_length`, `system.maintenance_mode`, `reportes.worker.max_retries`, `reportes.worker.stalled_threshold_minutes` | Sembrados pero NADIE los lee (verificado con grep en `src/` y `scripts/`). | PENDIENTE: eliminar del seed o implementar lectura. |
| D-094-2 | `security.jwt_ttl_hours` sembrado pero `JWT_TTL = "24h"` QUEMADO en `src/lib/auth.ts:20` | Viola ADR_004: el TTL debe leerse del parámetro. | PENDIENTE (spec de saneamiento de parámetros). |
| D-094-3 | Patrón "sembrado pero nadie lee" (`reportes.spam.min_text_length`) | El valor estaba quemado en 3 lugares (2 componentes + Zod). Corregido en spec 092-US5 (front y backend leen el parámetro). | CORREGIDA en 092; patrón documentado para futuros parámetros. |
| D-094-4 | Patrón "condicional escondido mantiene viva una interfaz vieja" | `LandingHero` (totalReportes<=2) mantuvo vivo el formato pre-089 con fuga de ciudad y "(undefined)". Corregido en el cierre de la 091. | CORREGIDA en 091; patrón a vigilar en refactors de UI (eliminar ramas, no acumularlas). |
| D-094-5 | Dos bancos de evaluación divergentes | `CasoEval` en BD: 110 casos `fixtureVersion=1` (eval-runner). Banco de simulación: 200 casos `fixtureVersion=2` (`scripts/simulacion/simulacion-50-casos-eval.json`). No hay fuente única. | PENDIENTE: decidir fuente única y re-sembrar/reconciliar (requiere decisión de ZEUS; no se re-sembra solo). |
| D-094-6 | Usuarios de prueba del seed | El seed crea usuarios de prueba (`soporte@innovadataco.com` etc.); deben eliminarse antes de producción. | PENDIENTE antes del despliegue productivo. |
| D-094-7 | `calcularRanking` / `riesgo-consulta.ts` en código | Se conservan para priorización operativa interna (declarado en cierre de la 089); no se exponen en superficie pública. | DECLARADA (intencional). |
