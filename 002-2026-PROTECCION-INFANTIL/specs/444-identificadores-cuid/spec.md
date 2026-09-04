# SPEC-444 · Los identificadores del padre se validaban como uuid — cierra I-310

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-04 · **Dev**: Dev 02 (`idc-80`) · **Origen**: **I-310**

**Impacto en arquitectura:** ninguno en el modelo de datos. Corrige una convención de validación equivocada en el borde de la API y la vuelve verificable con un candado de clase. Sin migración, sin endpoints nuevos, sin cambios de contrato.

---

## El defecto

Cuatro rutas validaban identificadores de PI con `z.string().uuid()`. **Todos los modelos de PI generan el id con `@default(cuid())`** — el barrido de `prisma/schema.prisma` del 04-09-2026 no encontró **un solo** `@default(uuid())`.

Un cuid nunca pasa un validador de uuid. El resultado no era un caso borde: era **400 permanente**.

`POST /api/padre/citas` **nunca funcionó**. En producción `SolicitudCita` tiene **0 filas**. Un padre que intentaba pedir una cita recibía «datos inválidos» por mandar exactamente el identificador que la aplicación le había entregado.

Es degradación silenciosa de manual: el CI verde, el código plausible, y la funcionalidad muerta desde el día uno.

---

## El barrido, con veredicto por aparición

Lo pidió el radicado: `grep -rn "z\.string()\.uuid()" src/` → **9 apariciones**.

| # | Archivo:línea | Campo | Modelo | Veredicto |
|---|---|---|---|---|
| 1 | `api/padre/citas/route.ts:20` | `profesionalId` | `PerfilProfesional` · cuid | **Corregida** → `cuidIdSchema` |
| 2 | `api/padre/citas/route.ts:21` | `franjaId` | `FranjaDisponible` · cuid | **Corregida** |
| 3 | `api/padre/citas/route.ts:24` | `expedienteCompartidoId` | `Expediente` · cuid | **Corregida** |
| 4 | `api/padre/citas/route.ts:25` | `pagoHeredadoDeId` | `SolicitudCita` · cuid | **Corregida** |
| 5 | `api/padre/citas/[id]/reasignar/route.ts:15` | `nuevoProfesionalId` | `PerfilProfesional` · cuid | **Corregida** |
| 6 | `api/padre/citas/[id]/reasignar/route.ts:16` | `nuevaFranjaId` | `FranjaDisponible` · cuid | **Corregida** |
| 7 | `api/padre/citas/[id]/reprogramar/route.ts:13` | `nuevaFranjaId` | `FranjaDisponible` · cuid | **Corregida** |
| 8 | `api/admin/estadisticas/clasificacion/route.ts:13` | `operadorId` | `Usuario` · cuid | **Corregida** — el filtro por operador del panel de estadísticas tampoco podía usarse. |
| 9 | `lib/schemas/base.ts:13` | `materiaIdSchema` | `Materia` | **Correcta, se deja** — SPEC-173 (H02): `Materia` tiene ids **mixtos en producción**, uuid heredado de antes de la migración + cuid nuevo. Es la única unión legítima y queda declarada en el candado. |

**Evidencia que sostiene los veredictos:**
- `prisma/schema.prisma`: **cero** modelos con `@default(uuid())`.
- Base de desarrollo: **cero** ids con forma de UUID en `Usuario` (106 filas), `PerfilProfesional`, `FranjaDisponible`, `Expediente` y `SolicitudCita`.

---

## El arreglo

Las 8 apariciones pasan a `cuidIdSchema`, que ya existía en `src/lib/schemas/base.ts`. **No se afloja a `z.string()`**: un identificador basura tiene que seguir siendo 400, y hay contraprueba que lo exige.

---

## Candados

**1 · Reproducción negativa, de conducta** (`src/app/api/padre/citas/identificadores-cuid.test.ts`). Ejercita los tres handlers del padre con un **cuid real tomado de la base** y afirma dos cosas: que **no** responde 400 y que **el servicio recibió el id**. No mira el texto del esquema.

**2 · Contraprueba, en el mismo archivo.** `"abc"` sigue siendo 400 **y el servicio no se llama**. El arreglo no puede ser aflojar la validación.

**3 · Candado de clase** (`src/lib/schemas/identificadores.candado.test.ts`). Barre **todo `src/`** —el radicado pedía `src/app/api/**`; se amplió porque los esquemas compartidos alimentan rutas y el defecto se escapaba por ahí— y falla si aparece un `z.string().uuid()` que no esté declarado con su razón. Incluye dos guardas más: que la única excepción declarada siga siendo necesaria, y que **el esquema de Prisma siga sin generar uuid** — si esa premisa cambia, el candado avisa en vez de mentir.

---

## Verificación

**9 tests verdes.** Probados **muriendo**, en las dos direcciones:

| Mutación en la fuente | Qué se pone rojo |
|---|---|
| Volver las 3 rutas a `z.string().uuid()` | **4 rojos**: los tres «acepta un cuid real» + el candado de clase, que caza los 3 archivos. La contraprueba sigue verde. |
| Aflojar las 3 rutas a `z.string()` | **3 rojos**: las tres contrapruebas. La reproducción negativa sigue verde. |

Los dos defectos posibles producen rojos **distintos y complementarios**: ninguna mitad tapa a la otra.

`tsc` limpio · `lint` 0 errores.

> **Verde en CI ≠ funciona.** El cierre real de I-310 es que un padre pida una cita en producción y `SolicitudCita` deje de tener 0 filas. Eso lo verifica el CEO tras el despliegue.
