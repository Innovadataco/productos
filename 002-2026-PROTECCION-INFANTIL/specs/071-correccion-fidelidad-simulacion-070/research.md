# Research: Corrección de fidelidad de la simulación (Spec 071)

**Date**: 2026-07-20
**Feature**: specs/071-correccion-fidelidad-simulacion-070/spec.md

---

## Decisions

### D1: Fuente de verdad de los campos de entrada

**Decision**: El `crearReporteSchema` en `src/lib/validators.ts` es la fuente de verdad de los campos que debe aceptar un caso de simulación.

**Rationale**: El principio rector del 071 es que un reporte de simulación debe ser indistinguible de uno creado por el formulario anónimo. El único lugar donde esos campos están definidos es `crearReporteSchema`:

```typescript
export const crearReporteSchema = z.object({
    identificador: z.string().min(3).max(100),
    plataforma: z.string().min(1),
    texto: z.string().min(20).max(5000),
    fechaIncidente: z.string().datetime().refine(
        (val) => new Date(val) <= new Date(),
        { message: "La fecha del incidente no puede ser futura" }
    ),
    ciudad: z.string().min(1).max(100),
    pais: z.string().min(1).max(100),
    paisId: z.string().optional(),
    ciudadId: z.string().optional(),
    otraPlataforma: z.string().max(100).optional(),
    edadVictima: z.number().int().min(0).max(120).optional(),
});
```

**Componentes**: `casoSimulacionSchema` debe extender `crearReporteSchema` y añadir `categoriaEsperada` opcional. El parser debe validar cada caso con este esquema combinado.

### D2: Rechazo de formato legacy del 070

**Decision**: No se soportarán archivos CSV/JSON que solo tengan los campos antiguos (`texto`, `plataforma`, `identificador`). El sistema rechazará el archivo con un mensaje que indique los campos faltantes.

**Rationale**: Mantener el formato legacy duplicaría la lógica de validación y permitiría que los usuarios sigan probando con datos incompletos, lo que invalida el propósito de la corrección. El 071 es una corrección de fidelidad, no una feature paralela.

**Components**: El parser devolverá un error claro si faltan `fechaIncidente`, `ciudad` o `pais` en el archivo.

### D3: Ubicación como texto libre en simulación

**Decision**: El parser aceptará `ciudad` y `pais` como texto libre; no requerirá `paisId` ni `ciudadId` ni `otraPlataforma`.

**Rationale**: El formulario anónimo permite escribir ciudad/país manualmente sin seleccionar del dropdown. Exigir IDs geográficos en la simulación complicaría innecesariamente la entrada y no añadiría fidelidad al caso manual. `otraPlataforma` se omite porque `plataforma` ya debe ser una clave válida de plataforma existente; si se desea simular una plataforma "otra", se debe crear la plataforma primero.

**Components**: `casoSimulacionSchema` usa `ciudad` y `pais` como strings requeridos; no incluye `paisId`, `ciudadId`, `otraPlataforma`.

### D4: Continuidad ante fallos de un caso

**Decision**: Un caso fallido no detendrá la corrida. Se registrará el error, se continuará con los siguientes casos, y al final se reportará cuántos casos fallaron en las métricas agregadas.

**Rationale**: El pipeline real puede fallar por múltiples razones (duplicado, timeout de Ollama, error en embeddings). Si la corrida se detiene ante el primer fallo, las métricas de latencia y acierto no reflejarán el comportamiento real del sistema. La continuidad es más fiel a la producción.

**Components**: El executor actual cambia el estado de `SimulacionRun` a `FALLIDA` y retorna en `crearReporteSimulacion`/`runSimulacionBatchCreator`. La corrección propone:
- Capturar errores por caso individual.
- No cambiar el estado global a `FALLIDA` por un caso fallido.
- Al finalizar, contar fallos en las métricas (por ejemplo, `casosFallidos`) y reflejarlos en la UI.
- Mantener `FALLIDA` solo para errores de la corrida misma (no encontrar `SimulacionRun`, `casosJson` vacío, etc.).

### D5: Override de modelo por job (ya implementado, se mantiene)

**Decision**: Se mantiene el mecanismo aprobado del 070: `sendReporte(reporteId, { modeloClasificacion })`.

**Rationale**: El usuario confirmó en la corrección del plan que el override debe ser por job, no por parámetro temporal. Esta decisión ya está implementada y no se toca.

**Components**:
- `src/lib/queue.ts`: `sendReporte` acepta opciones con `modeloClasificacion`.
- `scripts/worker-reportes.mjs`: lee `job.data.modeloClasificacion` y lo propaga en el body de `POST /api/reportes/procesar`.
- `src/app/api/reportes/procesar/helpers/parametros.ts`: `cargarParametrosClasificacion` recibe el override sin tocar `ParametroSistema`.

### D6: Verificación de fidelidad en quickstart

**Decision**: El `quickstart.md` incluirá un paso de verificación de fidelidad comparando un reporte real y uno de simulación con datos idénticos.

**Rationale**: La fidelidad no puede ser una suposición; debe ser verificable. El quickstart es el lugar natural para documentar la prueba.

**Components**: Comandos `curl` para crear un reporte real y otro de simulación, y query Prisma/SQL para comparar ambos en BD.

---

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Mantener formato legacy del 070 | Duplicaría lógica y permitiría datos incompletos, contradiciendo el principio rector |
| Requerir `paisId`/`ciudadId` en el set de simulación | Añadiría complejidad sin mejorar la fidelidad; el formulario anónimo acepta texto libre |
| Incluir `otraPlataforma` en el set de simulación | `plataforma` ya es clave válida; la simulación no necesita simular plataformas inexistentes |
| Detener la corrida ante el primer fallo | No es fiel al pipeline real, donde los fallos individuales se manejan sin detener el sistema |
| Cambiar el modelo `Reporte` para marcar simulaciones | No es necesario; `FuenteReporte` y el prefijo `SIM-` ya identifican el origen |
| Usar parámetro temporal para el modelo (Opción B) | Rechazado explícitamente en la corrección del plan del 070; riesgo de contaminar producción |

---

## Open Questions (0 remaining)

All NEEDS CLARIFICATION resolved. El esquema de entrada se define como `crearReporteSchema + categoriaEsperada`, la continuidad ante fallos se decide, y el override por job se mantiene.

---

## Verification against the actual codebase

### Gap verified: `casoSimulacionSchema` vs `crearReporteSchema`

- `src/lib/schemas/simulacion.ts` (línea 9-14) define solo:
  ```typescript
  texto: z.string().min(20).max(5000),
  plataforma: z.string().min(1),
  identificador: z.string().min(3).max(100),
  categoriaEsperada: z.string().max(100).optional(),
  ```
- Falta: `fechaIncidente`, `ciudad`, `pais`, `edadVictima`.

### Gap verified: executor inventa datos

- `src/lib/simulacion/executor.ts` (líneas 42-44):
  ```typescript
  fechaIncidente: new Date(),
  ciudad: "Simulación",
  pais: "Simulación",
  ```
- No se pasa `edadVictima`.

### Gap verified: pipeline real se invoca, pero con datos incompletos

- `src/lib/simulacion/executor.ts` crea el `Reporte` directamente y luego llama `sendReporte` con el override de modelo. El pipeline real se invoca, pero los datos de entrada no son fieles al formulario anónimo.

### Model `SimulacionReporte` already supports `categoriaEsperada`

- `prisma/schema.prisma` (línea 880): `categoriaEsperada String?` — no requiere cambios.

### Model `Reporte` supports all real fields

- `prisma/schema.prisma` (líneas 425-433): `fechaIncidente`, `ciudad`, `pais`, `edadVictima`, `paisId`, `ciudadId`, `otraPlataforma` — no requiere cambios para la corrección.

---

## Notes

- El `crearSimulacionSchema` (modelo, archivo, formato) no cambia; solo cambia el contenido esperado del archivo.
- El endpoint `POST /api/admin/ia/simulaciones` ya valida el input y llama al parser; no requiere cambios de interfaz.
- La UI de carga de archivos (`NuevaSimulacionForm`) probablemente requiera actualizar el ejemplo de archivo mostrado al usuario; esto se documenta en `tasks.md` como tarea de UI ligera.
