# scripts/ADVISORY-LOCKS.md — Fuente única de verdad de los IDs de advisory lock

**SPEC-284 (002-PI-184 · cierra I-130, I-137)** · última revisión 2026-09-04 (SPEC-427 suma `pi-citas`)

Cada worker que necesita instancia única en Postgres usa `pg_try_advisory_lock(<id>)` con un entero
propio. Este archivo lista **todos** los IDs tomados. La compuerta `npm run locks:check` verifica que
esta tabla y los `scripts/*.mjs` estén 1:1.

## Tabla

| ID | Worker (archivo) | Servicio del compose | Qué protege | SPEC de origen |
|---|---|---|---|---|
| `123456789` | `scripts/worker-reportes.mjs` | `worker` | Clasificación IA de reportes | inicial |
| `123456790` | `scripts/monitor-probes.mjs` | `monitor` | Ciclos del probe de salud (SPEC-171) | SPEC-171 |
| `123456791` | `scripts/worker-analisis-score.mjs` | `pi-analisis-score` | Cálculo del score anti-abuso | SPEC-220 |
| `123456792` | `scripts/worker-vigencia-pagos.mjs` | `pi-vigencia` | Corte diario de vigencia de pagos | SPEC-213 |
| `123456793` | `scripts/worker-expediente-motor.mjs` | `pi-expediente-motor` | Motor de expedientes | SPEC-230 |
| `123456794` | `scripts/worker-analisis-reglas.mjs` | `pi-analisis-reglas` | Ejecutor de reglas de análisis | SPEC-232 |
| `123456795` | `scripts/worker-anomalias.mjs` | `pi-anomalias` | Detector de anomalías | SPEC-235 |
| `123456796` | `scripts/worker-senal-comunitaria.mjs` | `pi-senal-comunitaria` | Refresco de señal comunitaria pendiente | SPEC-284 (antes `123_456_790`) |
| `123456797` | `scripts/worker-sesiones.mjs` | `pi-sesiones` | Corte de sesiones expiradas | SPEC-284 · SPEC-290 |
| `123456798` | `scripts/worker-tasas.mjs` | — sin servicio (I-132 pendiente) | Actualización periódica de tasas (latente) | SPEC-284 (antes `123456790`) |
| `123456799` | `scripts/worker-analisis-expediente.mjs` | `pi-analisis-expediente` | Análisis IA capa 2 del expediente (fila de a uno) | SPEC-341 |
| `123456800` | `scripts/worker-citas.mjs` | `pi-citas` | Barredores de la cita profesional: recordatorio con código, 48 h, plazo de pago y autocierre | SPEC-427 (I-301) |
| `923456789` | `scripts/simulador-abuso.mjs` | `simulador-abuso` | Simulador de abuso (banco de pruebas) | inicial |
| `987654321` | `scripts/worker-notificaciones.mjs` | `pi-notificaciones` | Envío diferido de notificaciones | SPEC-186 |

**Total: 14 IDs · 14 archivos · sin colisiones.**

## Regla operativa

1. **Fuente única de verdad**. Este archivo lista todos los IDs. Ningún `ADVISORY_LOCK_ID` puede
   existir en `scripts/*.mjs` sin fila aquí, y ninguna fila aquí puede quedar sin worker vivo.

2. **Todo worker nuevo se registra ANTES de existir**. En el mismo PR que lo introduce se agrega la
   fila. Si aparece un worker sin fila, la compuerta `locks:check` bloquea el merge.

3. **Sin separadores `_` en el literal**. Se escribe `123456796`, no `123_456_790`. Un `_` engañó al
   `grep` de Jelkin y ocultó una colisión durante tres semanas (causa raíz de I-130). La compuerta
   normaliza igualmente, pero el estilo plano es obligatorio para no repetir el mismo error visual.

4. **Comentario junto al literal** en el archivo `.mjs`: una línea que explique de dónde viene el ID
   y por qué NO se escribe con `_`. Frena que alguien lo "corrija" pensando que es un descuido.

5. **La lógica de `pg_try_advisory_lock` / `pg_advisory_unlock` no se toca**. Este frente cambia
   números, no comportamiento.

6. **NO reclamar candados huérfanos**. Si un lock aparece tomado por un proceso vivo (huella con
   otro `pid` en `pg_locks`), NO es huérfano — es un ID mal asignado. La respuesta es agregarle un
   ID propio al worker que colisiona, nunca robarle el lock al vecino.

## Rango asignado

- **`123456789..123456800`**: pool principal de PI (workers de negocio).
- **`923456789`**: simulador de abuso (rango de banco de pruebas, no producción).
- **`987654321`**: notificaciones (histórico, se conserva por identidad).

El siguiente ID libre para un worker nuevo del pool principal es **`123456801`**.
