# Plan · SPEC-444 — Los identificadores del padre se validaban como uuid

## Análisis en fuente

| Archivo | Qué se sacó |
|---|---|
| `prisma/schema.prisma` | **Cero** `@default(uuid())` en todo el esquema. Todos los ids son `cuid()`. Es la premisa del arreglo. |
| `src/lib/schemas/base.ts:11-13` | `cuidIdSchema` ya existía. `materiaIdSchema` es una unión cuid∪uuid, documentada por SPEC-173 (H02) por dato heredado real de `Materia`. |
| `api/padre/citas/route.ts:20-25` | 4 apariciones. El `POST` completo muere en el `.parse()`, antes de tocar el service. |
| `api/padre/citas/[id]/reasignar/route.ts:15-16` | 2 apariciones. |
| `api/padre/citas/[id]/reprogramar/route.ts:13` | 1 aparición. |
| `api/admin/estadisticas/clasificacion/route.ts:13` | 1 aparición, fuera del camino del padre: el filtro por operador del panel de estadísticas. Entra igual — es el mismo defecto. |
| `src/lib/api-handler.ts:32-41` | `ZodError` → **400**. Confirma que el síntoma reportado es exactamente este esquema. |
| Base de desarrollo | Cero ids con forma de UUID en las 5 tablas involucradas. |

## Decisión

`cuidIdSchema` a secas, **no** una unión con uuid. Una unión sería tolerar una forma de id que **ningún modelo genera**: aflojaría la validación para cubrir un caso que la evidencia dice que no existe. `materiaIdSchema` se queda como está porque ahí el dato heredado **sí** existe en producción.

El candado de clase se amplía de `src/app/api/**` (lo pedido) a todo `src/`: los esquemas compartidos de `src/lib/schemas/**` alimentan rutas, y limitar el barrido dejaba abierta la misma puerta por otro lado.

## Riesgo

| Riesgo | Cómo se acota |
|---|---|
| Que exista un uuid heredado en producción en alguna de las 5 tablas y el arreglo rompa un caso vivo | Ningún modelo genera uuid y la base de desarrollo no tiene ninguno. **`SolicitudCita` tiene 0 filas en prod**: no hay caso vivo que romper. Se le pide al CEO la confirmación en prod como parte de su verificación. |
| Que el arreglo sea aflojar a `z.string()` | Contraprueba obligatoria: `"abc"` → 400 y el service no se llama. Probada muriendo. |
| Que el defecto vuelva por una ruta nueva | Candado de clase sobre todo `src/`, con allowlist justificada. Probado muriendo. |
| Que cambie la premisa (que algún modelo pase a uuid) | Tercer test: falla si aparece `@default(uuid())` en el esquema. Avisa en vez de mentir. |
