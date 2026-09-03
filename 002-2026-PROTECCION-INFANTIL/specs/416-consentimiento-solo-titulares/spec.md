# SPEC-416 · El consentimiento se le pide solo a titulares del dato — cierra I-118

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: PI-1 (`idc-32`) · **Origen**: I-118 · Calidad cazó en producción · brief CEO (`idc-59`) 17:2x. **Prioridad sobre SPEC-413 y SPEC-411** — el Verificador recién desplegado (SPEC-408) no puede operar hasta esto.

## Para qué

**El bug (I-118)**: [`middleware.ts:194`](../../middleware.ts:194) (paso 4) aplica el guard de consentimiento a todos los roles sin filtrar. Resultado: cualquier request de `VERIFICADOR`, `PROFESIONAL`, `ADMIN`, `OPERADOR`, `COMITE_VALIDACION` o `COMITE_CONVIVENCIA` responde `403 CONSENTIMIENTO_REQUERIDO` si `estado.requiereConsentimiento === true`. El Verificador recién desplegado en SPEC-408 no puede operar.

**El motivo de fondo — CEO 17:2x**: no es sólo un bloqueo molesto, es **contaminación de prueba legal**. `audit_consentimientos` existe para demostrar que un titular consintió. Meterle firmas de empleados internos (ADMIN/OPERADOR/COMITE/VERIFICADOR) o del prestador de servicio (PROFESIONAL) **degrada su valor probatorio** — un abogado defensor puede argumentar que el audit es ruidoso.

## Qué trae

### 1) Middleware — filtro por rol

En [`middleware.ts:194`](../../middleware.ts:194), el paso 4 pregunta primero por rol y solo después evalúa el flag:

```ts
const rolTitularConsentimiento = sesion.rol === "PARENT" || sesion.rol === "SCHOOL_ADMIN";
if (rolTitularConsentimiento && estado.requiereConsentimiento && !esExentaConsentimiento(pathname)) { ... }
```

**Titulares del dato:** `PARENT` (padre) y `SCHOOL_ADMIN` (rector) — son quienes generan/aportan los datos personales que la ley protege.

**Exentos** (no titulares — no pueden consentir por otros): `VERIFICADOR`, `ADMIN`, `OPERADOR`, `COMITE_VALIDACION`, `COMITE_CONVIVENCIA` (empleados internos); `PROFESIONAL` (prestador de servicio).

### 2) Defensa en profundidad — cookie emitter también filtra

En [`sesion-estado-emitter.ts`](../../src/lib/routing/sesion-estado-emitter.ts), la marca `requiereConsentimiento` **ni siquiera se embebe en la cookie** para roles no titulares. Aunque mañana alguien olvide el filtro del middleware, el flag no existe en la sesión de un interno.

```ts
const requiereConsentimiento =
    rol === "PARENT" || rol === "SCHOOL_ADMIN" ? requiereConsentimientoRaw : false;
```

Dos guardas independientes cierran el hueco por partida doble — I-211 nos enseñó que estos guardianes pueden estar muertos meses sin que nadie lo vea; el candado en cascada minimiza esa ventana.

### 3) Test-candado bi-direccional (regla del CEO: no aflojar los titulares)

**En `middleware.test.ts`** (paso 4 del middleware):
- `(g-416-parent)` — PARENT sin consentimiento → **sigue** redirect a `/consentimiento` (307). Titulares intactos.
- `(g-416-school)` — SCHOOL_ADMIN sin consentimiento → **sigue** redirect a `/consentimiento` (307).
- `(g-416-exento)` — parametrizado sobre `VERIFICADOR`, `ADMIN`, `OPERADOR`, `COMITE_VALIDACION`, `COMITE_CONVIVENCIA`, `PROFESIONAL`: con `requiereConsentimiento=true` en la cookie, el middleware NO redirige a `/consentimiento` — pasa.
- `(g-416-api)` — VERIFICADOR sobre `/api/admin/verificacion-profesionales`: NO 403, `x-middleware-next: 1`.

**En `sesion-estado-emitter.test.ts`** (fuente que emite la cookie):
- PARENT/SCHOOL_ADMIN con `requiereConsentimiento=true` del helper → `true` en cookie.
- Cada uno de los 6 no titulares con `requiereConsentimiento=true` del helper → **forzado a `false`** en cookie.

## Candados

- **La regla del CEO se afirma en las dos direcciones** — igual valen los tests que garantizan que PARENT/SCHOOL_ADMIN siguen bloqueados que los que garantizan que el resto pasa. Sin esa mitad, el fix afloja el candado legal (I-211 en frío).
- **Doble filtro** (emitter + middleware): si mañana un middleware nuevo olvida la regla o si se cambia el emitter, la otra puerta sigue en pie.
- **Motivo escrito en el código** — dos comentarios largos citando la orden del CEO y el motivo probatorio, para que un Dev nuevo no revierta "por limpieza".

## Verificación

- `npm run test:unit` → **2192/2192** (149/149 en el pool de routing incluyendo los 9 nuevos + los del emitter).
- `npx tsc --noEmit` verde.
- `npm run arch:check` VERDE completo (a/b/c/d/d-bis/e/f).
- `npm run tokens:check` VERDE (piso 1079).
- **Regresión operativa** (para Calidad post-deploy):
  1. Login como VERIFICADOR → `/dashboard/admin/verificacion` carga sin 403.
  2. Login como PROFESIONAL → `/perfil-profesional/verificacion` carga sin 403.
  3. Login como PARENT sin consentimiento → sigue cayendo en `/consentimiento` (no aflojado).
  4. `audit_consentimientos` no muestra firmas de VERIFICADOR/ADMIN/OPERADOR/COMITE/PROFESIONAL post-deploy.

## Impacto en arquitectura:

El guard de consentimiento pasa de **universal** a **por rol** dentro del middleware; el emitter refleja lo mismo en la cookie. La regla de negocio ("titulares del dato consienten; otros no") queda escrita explícita en el código, con comentarios que citan al CEO y a la razón legal — no es una convención tácita.

Cualquier nuevo rol futuro se declara explícitamente titular o no. La allowlist es tan corta que se puede leer de un vistazo: `PARENT || SCHOOL_ADMIN`. El resto es exento, por defecto.

## Fuera de alcance

- **Purgar del `audit_consentimientos` las firmas contaminadas** que pudo haber generado el bug antes del fix. Se puede evaluar tras el deploy con una consulta puntual — no bloquea este PR.
- Editar `requiereConsentimientoActual` para que rechace usuarios internos: **no vale la pena** porque el helper también se usa fuera de la cookie (p. ej. `estado-colegio.ts`) y podría cambiar semántica en usos legítimos. El filtro por rol vive donde se aplica, no en la fuente.

## Referencias

- **I-118** · cazado por Calidad recorriendo producción · CEO 03-09 17:2x.
- **SPEC-241** (002-PI-144) — introducción del muro de consentimiento.
- **SPEC-408** — Verificador cuya operación estaba bloqueada por este bug.
- **I-211** — lección: guardianes muertos meses sin que nadie los vea.
- **I-274** — separación de poderes por rol (mismo espíritu: reglas por rol explícitas).
- [`middleware.ts:194`](../../middleware.ts:194) · [`sesion-estado-emitter.ts`](../../src/lib/routing/sesion-estado-emitter.ts) · [`vigencia-cookie.ts`](../../src/lib/routing/vigencia-cookie.ts).
- Worktree: `.worktrees/pi-SPEC-416` desde `origin/main 9e63fb1d1`.
