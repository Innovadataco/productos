# Runbook — Drift del catálogo de módulos/permisos (guardianes pi-monitor)

Procedimiento SEGURO para llevar de rojo→verde los guardianes de drift del catálogo de
permisos cuando disparan en producción. Pensado para el responsable del despliegue (CEO),
que ejecuta en la ventana de escrituras gated. **Solo lectura en el diagnóstico; la
corrección es un paso `--confirm` explícito.**

## 1. Qué vigilan los guardianes (SPEC-739 / SPEC-745)

`prisma/seed-modulos-grants.ts` es **aditivo y nunca borra**: deriva de `CATALOGO_MODULOS`
(`src/lib/permisos-catalogo.ts`), así que cuando un SPEC **retira** un módulo del catálogo
del código, su fila deja de sembrarse pero **la fila ya existente sobrevive** en una BD de
larga vida, con permisos que ya no gatean ninguna pantalla (el toggle del admin *miente*
sobre la conducta). Dos señales BLANDAS de `pi-monitor` lo hacen visible (observan, nunca
bloquean el deploy):

| Señal (pi-monitor) | Qué marca en rojo | SPEC |
|---|---|---|
| `modulos_huerfanos` | filas de `ModuloPermisible` cuya `clave` **∉ `CATALOGO_MODULOS`** | SPEC-739 (#696) |
| `grants_modulos_muertos` | grants **activos** (`PermisoModulo.activo=true`) a un módulo ∉ catálogo | SPEC-745 (#699) |

Ambas pueden **arrancar en rojo** tras un despliegue que retira un módulo — es el *surface*
esperado, no un fallo. Se limpian corriendo el corrector en la ventana gated.

**Implicación estructural (clave para la verificación):** un grant muerto EXIGE una fila de
módulo muerta (`PermisoModulo.moduloId` es FK no-nula). Por eso, si **no hay módulos
huérfanos**, tampoco puede haber grants a módulos muertos: verificar `modulos_huerfanos`
verde ⟹ `grants_modulos_muertos` verde.

## 2. El corrector definitivo: `retirar-modulos-permiso-huerfanos.ts`

**Borra la fila del módulo + sus grants** (borrado explícito en una transacción con
`AuditLog`) para una lista **deliberada** de claves retiradas por SPECs. Como borra la fila
Y los grants, **limpia LOS DOS guardianes de una** (`modulos_huerfanos` y
`grants_modulos_muertos`).

Claves deliberadas actuales (ver `CLAVES_A_RETIRAR` en el script): `profesional_verificacion`,
`profesional_citaciones`, `padre`, `ia_eval`, `apelaciones`.

> **Lista deliberada, no «todo lo desconocido»:** una clave desconocida podría ser un módulo
> **nuevo que falta AGREGAR** al catálogo, no uno a borrar. Si el guardián/dry-run muestra una
> clave que **no** está en esa lista, **NO se borra**: es una decisión (agregar al catálogo o
> agregar a la lista del corrector).

Guardas de seguridad (en el código, por cada clave):
- **Dry-run por defecto** — solo escribe con `--confirm`.
- **Interlock con el catálogo** — si la clave **volvió** a `CATALOGO_MODULOS`, aborta esa
  clave (nunca borra un módulo que el código todavía conoce).
- **Guarda de topología** — aborta si la fila tuviera submódulos (FK `onDelete: Restrict`).
- **Transacción + AuditLog** — borra grants explícito + fila; queda auditado.
- **Idempotente** — si la fila ya no está, no hace nada.
- **Aislado por clave** — la falla de una no frena a las demás; **exit ≠ 0** si alguna falla.
- **Aborta ante cualquier flag ≠ `--confirm`** (nada de flags mudos).

## 3. Procedimiento (ventana gated)

Desde el directorio del repo en el VPS (el mismo desde donde se corre `deploy-prod.sh`,
`/opt/proteccion-infantil/repo/002-2026-PROTECCION-INFANTIL`). Abreviatura:

```bash
COMPOSE="docker compose --env-file .env.production -f docker-compose.prod.yml"
```

Los scripts corren en el contenedor `app` (la env ya está inyectada; **sin** `--env-file`,
igual que `seed` en `deploy-prod.sh`).

**Paso 1 — DRY-RUN (no escribe nada):**

```bash
$COMPOSE exec -T app node --import tsx scripts/retirar-modulos-permiso-huerfanos.ts
```

**Paso 2 — Revisar la salida.** Debe listar **solo** un subconjunto de las 5 claves
esperadas. Si aparece **cualquier otra clave → PARAR** (posible módulo nuevo a agregar; ver
§2).

**Paso 3 — APLICAR:**

```bash
$COMPOSE exec -T app node --import tsx scripts/retirar-modulos-permiso-huerfanos.ts --confirm
```

**Paso 4 — VERIFICAR (verde por exit code, derivado del catálogo):**

```bash
$COMPOSE exec -T app node --import tsx scripts/barrer-claves-modulo-desconocidas.ts
```

Resultado esperado: imprime `VERDE` y **exit 0** = 0 módulos huérfanos. Por la implicación
estructural (§1), esto verifica **ambos** guardianes.

Chequeo extra directo de `grants_modulos_muertos` (SQL, opcional):

```bash
$COMPOSE exec -T db psql -U proteccion -d proteccion_infantil -tAc \
  "SELECT count(*) FROM \"PermisoModulo\" pm JOIN \"ModuloPermisible\" m ON pm.\"moduloId\"=m.id \
   WHERE pm.activo AND m.clave IN ('profesional_verificacion','profesional_citaciones','padre','ia_eval','apelaciones');"
```

Resultado esperado: `0`.

## 4. Corrector legacy: `revocar-grants-modulos-muertos.ts` (normalmente NO hace falta)

Corrector más antiguo (SPEC-285): pone `activo=false` a los grants de `{ia_eval,
apelaciones, padre}` y **conserva la fila** (restaurable por admin). Idempotente y no
destructivo; **sin dry-run** (aplica al correr).

- Sus 3 claves son **subconjunto** de las 5 del corrector de huérfanos, y **solo revoca**
  (no borra la fila) → **no limpia** `modulos_huerfanos`. Tras correr el corrector de
  huérfanos, sus filas ya no existen y este imprime «nada que revocar».
- Úselo únicamente si el objetivo es **revocar-pero-conservar** esas 3 filas (otra
  filosofía). Para llevar los guardianes a verde, el corrector de huérfanos (§2) es
  suficiente y definitivo.

```bash
$COMPOSE exec -T app node --import tsx scripts/revocar-grants-modulos-muertos.ts
```

## 5. Referencias

- Guardianes: `src/lib/monitoreo/probes.ts` (`probeModulosHuerfanos`, `probeGrantsModulosMuertos`)
  → `scripts/monitor-probes.mjs`.
- Fuente única de «lo que el código conoce»: `CATALOGO_MODULOS` en `src/lib/permisos-catalogo.ts`
  (helpers puros `clavesModuloHuerfanas`, `grantsAModulosMuertos`).
- Detector read-only (verificación): `scripts/barrer-claves-modulo-desconocidas.ts`.
- Correctores: `scripts/retirar-modulos-permiso-huerfanos.ts` (borra fila + grants),
  `scripts/revocar-grants-modulos-muertos.ts` (revoca, conserva fila).
- SPEC-725 (barrido/corrector), SPEC-739 (guardián de módulos), SPEC-745 (guardián de grants).
