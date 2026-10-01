# SPEC-795 · Sumar meses sobre el instante crudo — la CLASE

**Feature Branch**: `work/pi-SPEC-795-addmonths-zona-bogota`
**Created**: 2026-09-30
**Status**: DESARROLLO
**Base**: `main` (nace de la medición de SPEC-794)

Impacto en arquitectura: **aditivo, sin cambio de modelo ni de esquema.** Corrige aritmética de calendario en 4 cálculos de facturación/vigencia para que **toda suma de meses pase por el día calendario America/Bogotá y CLAMPE** (date-fns `addMonths`), nunca desborde (`Date.setMonth` nativo) ni recorte sobre el calendario UTC crudo. Método único del hermano freemium (FR-003): `toZonedTime → addMonths → fromZonedTime`. NO toca el motor, el proxy, la navegación ni el modelo de datos. Dos PRs por CLASE de defecto.

## Primera tarea: MEDIR (hecha) — los 4 sitios, reproducido con código corriendo (TZ=UTC)

| sitio | base | defecto medido | dirección |
|---|---|---|---|
| `referido:276` | `referidor.fechaFin` (fin-de-día Bogotá en subs freemium = `…04:59:59.999Z`) | `addMonths` sobre instante crudo recorta en calendario UTC → **−1 día** (30-oct→ fin 29-nov en vez de 30-nov) | pierde (debemos) |
| `admin-autorizar-solicitud:146` · `admin-activacion-manual:176` | `fechaPagoReal ?? ahoraBogota()` | (a) `fechaPagoReal` crudo en ventana UTC≠Bogotá → **−1 día**; (b) `ahoraBogota()` sin `fromZonedTime` → **−5h** siempre (duración OK, expira 5h antes) | pierde (debemos) |
| `vigencia-colegio:53` (+ `periodo.ts calcularFinServicio`) | `new Date()` / `inicio` | `Date.setMonth` NATIVO **DESBORDA** (31-ene +1 → 03-mar en vez de 28-feb) → **gana 1–3 días**; independiente de zona; afecta ambas ramas | gana (nos cuesta) |

**Oráculos (hallazgo):** ninguno de los 4 tests cazaba su defecto. Sites 1/3 con oráculo **TAUTOLÓGICO** (el esperado se calcula con el mismo `addMonths` del servicio → incapaz de fallar) sobre fecha de mitad de mes; site 2 no asevera la `fechaFin` de la recompensa; site 4 con fecha mitad de mes y solo `getUTCMonth`.

**Exposición en producción:** CERO (medido por el CEO: todo sembrado — 51/51 colegios, 133/133 pagos, 112/120 subs). Estos arreglos son **preventivos**; NO hay migración de datos.

## Decisión (CEO) — DOS PRs por CLASE

- **PR 1 · SITIO 4 solo** (este). Clase «desborde»: `setMonth` → método Bogotá-aware que CLAMPA. Cubre `calcularFinDesdeDuracionPlan` (MES_2/MES_3) **y** `calcularFinServicio` de `periodo.ts` (MENSUAL/SEMESTRAL/ANUAL — su otro llamador es `admin/colegios/route.ts`). Primero porque nos cuesta plata, dispara para todos y no depende de la corrección de zona.
- **PR 2 · SITIOS 1, 2 y 3** (la clase de zona). Un solo método (`toZonedTime → addMonths → fromZonedTime`).
- **Sub-defecto (b) `ahoraBogota()`**: NO es un helper compartido — está **DUPLICADO local** en 8 archivos. En sites 1/3 su único uso es la base del `addMonths`; se cierra dentro de PR 2 (base `new Date()` + método completo deja la copia local muerta). Mapa entregado al CEO.

## Candados (regla dura)

- Fronteras **28/29/30/31** cruzando meses de distinta longitud, **fechas fijas**, nada que dependa de cuándo corre.
- **El esperado es un LITERAL, nunca una llamada** a la función bajo prueba ni a su primitiva (mata el oráculo tautológico). Vale también para reescribir oráculos existentes.
- Site 4: control positivo = el **desborde** (31-ene +1 = 28-feb; el test cae si vuelve `setMonth`).

## Fuera de alcance

Migración de datos guardados (no hay datos reales que migrar). Si al arreglar aparece evidencia de exposición viva → es hallazgo y se para.
