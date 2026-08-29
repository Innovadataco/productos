# Cierre del Lote Pre-Despliegue — Verificación final + Ensayo general

**Fecha:** 2026-07-17  
**Alcance:** T1 (bandeja de decisiones), T2 (verificación funcional), T3 (ensayo general de despliegue), T4 (kit de despliegue).  
**Regla:** nada se ejecutó contra producción real. R1-R7 vigentes.

---

# TAREA 1 — BANDEJA DE DECISIONES DEL OWNER

## 1.a) DECISIONES TOMADAS del lote nocturno

| Decisión | Qué se implementó | Reversible cómo |
|---|---|---|
| Anti-abuso Fase A: peso de fuente + score ajustado | Señal de fuente, score desagregado, simulación en seco; flag `scoring.source_weight.enabled=false` | Volver flag a `false` (ya está) y recalcular scores si se activó |
| Anti-abuso Fase B: rate limits compuestos | `report_fingerprint` duro (429), `report_identificador` suave (`REVISION_MANUAL`/`POSIBLE_SPAM`) | Ajustar/bajar límites en parámetros `ratelimit.*`; no hay migración irreversible |
| Apelaciones Fase C: una apelación activa por identificador | Schema + API pública/admin + UI + job de vencimiento + OTP SMS mock | Revertir migración `20260718110000_add_apelaciones_fase_c` y eliminar endpoints/UI |
| Pausa de visibilidad en primera apelación (7 días) | `anti_abuso.apelacion_pausa_dias`, pausa automática y restauración | Cambiar parámetro; vencimiento restaura visibilidad |
| Rechazo bloquea re-apelación | `derechoApelar=false` tras `RECHAZADA`; rehabilitación solo admin | Admin puede rehabilitar desde el panel |
| Curación del fixture: 5 cambios con evidencia fuerte | 3 → `EXTORSION`, 2 → `DOXING`; `fixtureVersion` → 11 | Revertir las 5 etiquetas en `CasoEval` y volver a `fixtureVersion` anterior |
| Baseline v2 = nueva línea de base (16.7 % error silencioso) | `eval-results/baseline-v2-1784277977350.json` sobre `fixtureVersion=11` | N/A (es una medición, no un cambio de modelo) |
| Cifrado de parámetros `esSecreto` (AES-256-GCM) | `param-encryption.ts`, `parametros.ts`, endpoint `revelar`, ConfigPanel enmascarado | Rollback con `scripts/migrate-param-secretos.ts` (auto en fallo) o restaurar backup |
| Endpoints nunca exponen secretos | `valor: null` en listados/detalles de parámetros secretos | Volver a devolver valor (no recomendado) |
| Proxy público para apelaciones | `/api/apeaciones` y `/apelar` agregados a `PUBLIC_ROUTES` en `src/proxy.ts` | Quitar de la lista (rompe el flujo público) |

## 1.b) Los 14 casos dudosos del fixture (decidible caso por caso)

> **No se aplicó ninguno.** El owner decide. Mi recomendación es solo referencia.

| Caso | Etiqueta actual | Propuesta mayoritaria (4 corridas) | Justificación en una línea | Mi recomendación |
|---|---|---|---|---|
| `cmrobzjvw009u1148sfumdtm2` — me espía todo el día | `CONTACTO_INSISTENTE` | `DOXING` (2/4) | Vigilancia/acoso insistente sin publicación de datos | **Mantener** |
| `cmrobzjvw00a11148a103xb8w` — video en ducha | `SOLICITUD_MATERIAL` | `COMPARTIMIENTO_SEXUAL` (2/4) | Pide video íntimo; es solicitud, no envío | **Mantener** |
| `cmrobzjvw00aj1148q1mxqeej` — casting pide video en traje de baño | `SUPLANTACION_IDENTIDAD` | `SOLICITUD_MATERIAL` (4/4) | La conducta central es pedir material íntimo | **Cambiar** a `SOLICITUD_MATERIAL` |
| `cmrobzjvw00ak1148jw5syjf6` — compañero pide fotos de tareas | `SUPLANTACION_IDENTIDAD` | `SOLICITUD_MATERIAL` (3/4) | Suplantación clara; fotos de tareas no son material íntimo | **Mantener** |
| `cmrobzjvw00al1148r378s4oi` — prima pide número de padres | `SUPLANTACION_IDENTIDAD` | `OTRO` (4/4) | Suplantación para extraer datos; OTRO es demasiado genérico | **Mantener** |
| `cmrobzjvw00am1148qz91peo0` — profesor pide datos de familia | `SUPLANTACION_IDENTIDAD` | `DOXING` (3/4) | Suplantación clara; no hay publicación de datos (doxing) | **Mantener** |
| `cmrobzjvw00ao1148ox9qhplg` — canal TV pide video en bikini | `SUPLANTACION_IDENTIDAD` | `SOLICITUD_MATERIAL` (4/4) | Conducta central: pedido de material íntimo | **Cambiar** a `SOLICITUD_MATERIAL` |
| `cmrobzjvw00ax11483ozrks1j` — carro recoge en la escuela | `SOLICITUD_ENCUENTRO` | `OTRO` (4/4) | Encuentro/pasaje es solicitud de encuentro | **Mantener** |
| `cmrobzjvw00b31148xivzo9n3` — describe actos sexuales | `COMPARTIMIENTO_SEXUAL` | `SOLICITUD_MATERIAL` (3/4) | Envío de contenido sexual sin pedido explícito | **Mantener** |
| `cmrobzjvw00b61148h895yn14` — pasa CSAM en grupo | `COMPARTIMIENTO_SEXUAL` | `OTRO` (3/4) | Compartir CSAM en grupo encaja en compartimiento sexual | **Mantener** |
| `cmrobzjvw00b811486nhhmdhv` — describe actos en chat | `COMPARTIMIENTO_SEXUAL` | `SOLICITUD_MATERIAL` (2/4) | Igual que el anterior | **Mantener** |
| `cmrobzjvx00c71148huipq72v` — manda mi foto privada a desconocidos | `DIFUSION_NO_CONSENTIDA` | `COMPARTIMIENTO_SEXUAL` (4/4) | Si la foto es íntima, es difusión no consentida | **Mantener** (si es íntima) |
| `cmrobzjvx00cc1148knp6kk72` — foto privada a desconocidos | `DIFUSION_NO_CONSENTIDA` | `OTRO` (2/4) | Igual que el anterior | **Mantener** (si es íntima) |
| `cmrobzjvx00cl1148lv8epzfr` — publica dónde vivo y horario | `DOXING` | `OTRO` (4/4) | Publicación de ubicación/horarios = doxing claro | **Mantener** |

**Resumen de mi recomendación:** cambiar **2** (`...aj...` y `...ao...`), mantener **12**.

## 1.c) Flags pendientes y condición de activación

| Flag | Estado actual | Condición de activación documentada |
|---|---|---|
| `scoring.source_weight.enabled` | `false` | Activar solo tras simulación post-despliegue sobre datos reales de producción, documentada y aprobada por el owner |
| `reportes.classification.modelo_desempate` | `""` (deshabilitado) | Activar tras evaluación en Laboratorio IA con mejora demostrada en fixture |
| `SMS_PROVIDER` | `mock` | Cambiar a proveedor real solo cuando esté integrado y verificado el OTP en staging |
| `COOKIE_SECURE` | `false` (dev) | `true` cuando la app se sirva por HTTPS en producción |
| `DISABLE_RATE_LIMIT` | sin definir | Solo tests E2E; **nunca** en producción |
| `NEXT_PUBLIC_DISABLE_ONBOARDING` | sin definir | `true` solo para tests/demos |
| `anti_abuso.apelacion_pausa_dias` | `7` | Ajustable por parámetro; no requiere despliegue |
| `scoring.source_weight.*` (sub-parámetros) | defaults seed | Solo efectivos cuando el flag maestro se active |

---

# TAREA 2 — VERIFICACIÓN FUNCIONAL DEL TRABAJO NOCTURNO

## 2.a) Fase C de punta a punta (automatizada: `scripts/smoke-apelaciones.ts`)

Secuencia observada (local, app en 5005 + worker):

```
[1/9] Login de admin                              ✅ Admin autenticado
[2/9] Crear identificador visible con reportes    ✅ 3 reportes
[3/9] Apelación NICK y pausa                      ✅ RECIBIDA, pausaHasta set, esVisiblePublicamente=false
[4/9] Apelación en bandeja admin                  ✅ visible en /api/admin/apeaciones
[5/9] Apelación SMS + OTP mock                    ✅ OTP verificado (hash invertido por fuerza bruta de 6 dígitos)
[6/9] Resolver ACEPTADA + baja REPORTE_FALSO      ✅ 3 reportes eliminados=true, audit APELACION_RESUELTA
[7/9] Otra apelación + vencimiento (pausaHasta en pasado + job)  ✅ estado=VENCIDA, visibilidadRestaurada=true
[8/9] Auditoría                                   ✅ APELACION_VENCIDA registrada
[9/9] Limpieza                                    ✅ completada
🟢 SMOKE APELACIONES PASÓ
```

**Corrección aplicada durante la verificación:** el proxy (`src/proxy.ts`) no exponía `/api/apeaciones` ni `/apelar` como públicos; sin ese cambio el flujo devolvía 401/404. Corregido y verificado.

## 2.b) Cifrado de parámetros `esSecreto`

Evidencia (script `scripts/verify-encryption.ts`, ejecutado y limpiado):

```
Parámetro creado/verificado
PATCH status: 200            (valor devuelto: null)
Valor en BD: enc:{"iv":"306fe8d121a1bab349d...  esSecreto: true
Está cifrado: true
Descifrado interno: nuevo-secreto-123
Revelar status: 200          body: {"valor":"nuevo-secreto-123"}
```

- Valor **no legible** en BD (`enc:...`).
- La app lo lee bien (descifrado interno OK).
- `POST /api/config/parametros/:clave/revelar` funciona bajo rate-limit `admin_read`; ConfigPanel con Revelar/Ocultar.
- **Corrección aplicada:** `PARAM_ENCRYPTION_KEY` del ejemplo tenía longitud inválida (no 32 bytes) y el valor con comillas en `.env` no era aceptado; corregido placeholder a `change-me-32-bytes-param-key-123` (32 bytes) y documentado.

## 2.c) Mapas/gráficos del dashboard público

- API `/api/estadisticas-publicas`: solo totales y agregados (por plataforma, país, ciudad, nivel de riesgo, categoría, últimos identificadores de riesgo). Sin textos, sin PII, sin direcciones exactas.
- Captura: `docs/evidence/dashboard-publico-2026-07-17.png` (verificada visualmente: tarjetas agregadas, dona autenticados/anónimos, barras por país/ciudad; subtítulo “Datos agregados por ciudad. No incluye direcciones exactas ni datos personales.”).

## 2.d) Suite completa

| Comando | Resultado |
|---|---|
| `npm run lint` | 0 errores (1 warning preexistente en `src/lib/sms.ts`) |
| `npx tsc --noEmit` | ✅ sin errores |
| `npm run build` | ✅ |
| `npm test` | ✅ 193 tests, 41 archivos |
| `scripts/smoke-e2e.ts` | ✅ PASÓ |
| `scripts/smoke-apelaciones.ts` | ✅ PASÓ |

---

# TAREA 3 — ENSAYO GENERAL DEL DESPLIEGUE

Entorno desechable: BD nueva `proteccion_ensayo` (mismo contenedor pgvector), app en puerto 5006, worker con `.env.ensayo`. **No se tocó `proteccion_infantil`.**

| Paso | Comando | Resultado | Tiempo |
|---|---|---|---|
| Crear BD ensayo | `CREATE DATABASE proteccion_ensayo` | ✅ | < 1 s |
| Migraciones (24) | `npx prisma migrate deploy` | ✅ todas aplicadas | < 1 s |
| Índices pgvector | `SELECT ... FROM pg_indexes` | ✅ 2 índices HNSW `vector_cosine_ops` | — |
| Seed | `node --env-file=.env.ensayo --import tsx prisma/seed.ts` | ✅ admin + parámetros + 110 casos | < 1 s |
| Build | `npm run build` | ✅ | ~6 s |
| App 5006 | `npx next start -p 5006` | ✅ health 200 | < 1 s |
| Worker ensayo | `node --env-file=.env.ensayo --import tsx scripts/worker-reportes.mjs` | ✅ colas creadas, Ollama OK | ~2 s |
| Smoke E2E vs ensayo | `node --env-file=.env.ensayo --import tsx scripts/smoke-e2e.ts` | ✅ 1 reporte procesado punta a punta con `ornith:9b` (PII anonimizada, votos, embedding, cola admin) | ~12 s |
| Limpieza | `DROP DATABASE proteccion_ensayo` + kill procesos 5006 | ✅ | < 1 s |
| Dev intacto | health 5005 + worker + smoke verde | ✅ | — |

**Total del ensayo: < 1 minuto** (sin contar descargas de imágenes/modelos).

### Desvíos del checklist v2 → v2.1 (corregidos en `docs/despliegue.md`)

1. `psql` no está en el host: usar `docker exec <db> psql ...`.
2. El build de Next.js lee `.env`, no `.env.<nombre>`: usar `.env.production` o variables del sistema.
3. `worker-supervisor.mjs` lee siempre `.env`: para entornos alternativos lanzar `worker-reportes.mjs` con `--env-file`.
4. El proxy debía exponer `/api/apeaciones` y `/apelar` (corregido en este lote).
5. `PARAM_ENCRYPTION_KEY` debe medir exactamente 32 bytes; placeholder corregido.
6. `ADMIN_EMAIL` y `SMS_PROVIDER` no estaban documentados: agregados a los ejemplos.
7. El smoke E2E requiere `NEXT_PUBLIC_APP_URL` y `DATABASE_URL` coherentes.
8. No hay jobs programados para limpieza anti-abuso ni vencimiento de apelaciones: comandos listos para cron en `docs/despliegue.md` (Paso 9).

---

# TAREA 4 — KIT DE DESPLIEGUE LISTO PARA LA SESIÓN

- **`.env.production.example`** — completo, con cada variable comentada y cómo generar los secretos (`openssl rand -base64 48`, `openssl rand -base64 32`, etc.). Incluye `ANTI_ABUSO_SALT`, `PARAM_ENCRYPTION_KEY`, `SMS_PROVIDER`, `ADMIN_EMAIL/ADMIN_PASSWORD`, `API_BASE_URL`, fallbacks de modelos IA.
- **`docs/despliegue.md`** — checklist v2.1 definitivo, paso a paso con comando + verificación + rollback por paso, tiempos medidos del ensayo, desvíos corregidos y sección **“Decisiones de la sesión”** (backfill de scores sí/no, dominio/URL pública, proveedor SMS real o mock, flags que arrancan apagados, quién corre migrate/seed, HTTPS/HSTS).
- **`docs/despliegue-v2-checklist.md`** — actualizado: T7 y Fase C marcadas como implementadas, `SMS_PROVIDER`/`ADMIN_EMAIL` agregados, job de vencimiento disponible.
- **`scripts/smoke-apelaciones.ts`** — nuevo smoke E2E de apelaciones (extensión del smoke pedida en T2a).
- **`scripts/verify-encryption.ts`** — verificación manual de cifrado (T2b).
- **`docs/evidence/dashboard-publico-2026-07-17.png`** — captura del dashboard público (T2c).

---

# VEREDICTO

**El despliegue según `docs/despliegue.md` funciona de punta a punta en < 1 minuto** (verificado en ensayo: 24 migraciones, seed, build, app + worker, índices HNSW y un reporte procesado con `ornith:9b`). Lo que hubo que corregir durante el lote quedó incorporado en el checklist v2.1:

- Proxy público para `/api/apeaciones` y `/apelar`.
- Placeholder de `PARAM_ENCRYPTION_KEY` con longitud válida (32 bytes) y manejo sin comillas.
- Documentación de `psql` vía docker, `--env-file` para worker alternativo, variables faltantes (`SMS_PROVIDER`, `ADMIN_EMAIL`, `API_BASE_URL`).
- Smoke de apelaciones automatizado (`scripts/smoke-apelaciones.ts`).

**Pendientes de decisión del owner (una sola pasada):**
1. Aprobar/ajustar las decisiones de la tabla 1.a.
2. Decidir los 14 casos dudosos (tabla 1.b; mi recomendación: cambiar 2, mantener 12). **No se aplicó ninguno.**
3. Definir en sesión: backfill de scores, dominio/URL pública, proveedor SMS real, flags que arrancan apagados, responsable de migrate/seed, HTTPS/HSTS.

Fin del lote. No se arranca nada más.
