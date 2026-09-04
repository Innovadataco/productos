# Plan · SPEC-438 — La fecha y la hora del hecho

## Análisis en fuente (candado 15 v5)

| Archivo | Qué se sacó |
|---|---|
| `validators.ts:22` | `fechaIncidente` **ya era obligatoria** en el esquema. El agujero no estaba en la validación. |
| `ReporteWizard.tsx:146-148` | **Acá estaba el defecto**: el ternario que mandaba `new Date()` con el campo vacío. |
| `ReporteWizard.tsx:322-329` | La guardia del paso 2 pedía país, ciudad y texto — **no la fecha**. Es lo que el formulario declaraba y lo que el radicado denuncia. |
| `FechaHoraIncidente.tsx` | Ya resuelve el tope en hora local (A-74 · P1). Ahí entra la franja, sin romper su contrato. |
| `ejecutar-analisis.ts:140-148` | Donde se arma `HechoPadre` para el modelo: es el punto por donde la marca tiene que llegar al análisis. |
| `lectura-capa1.ts` / SPEC-431 | La lección de I-247 b: la franja se calcula en hora de Bogotá, en un solo lugar. |

## Decisiones

| Decisión | Por qué |
|---|---|
| Columna `horaAproximada`, no un enum de franja | Lo que el análisis necesita saber es **si la hora es confiable**, no cuál franja eligió. La franja ya queda implícita en la hora guardada. |
| Hora representativa al CENTRO del bloque | 18:00 en punto para «noche» deja el hecho en la frontera con la tarde y lo puede clasificar mal. |
| El helper es puro y compartido | La conversión a hora de Bogotá vive en UN lugar, importable y probable con tabla. Es exactamente lo que faltó en I-247 b. |
| Sin `Reporte`, `horaAproximada = true` | Si la fecha es la del evento, no se puede afirmar precisión. Es más honesto asumir estimación que precisión. |
| Una sola emisión (`onChange(valor, aproximada)`) | Con dos callbacks, el segundo llegaba con el `fechaIncidente` viejo del closure y **pisaba la fecha recién elegida**. |
| Los datos viejos no se tocan | Reescribir una fecha con valor probatorio es decisión del CEO, no de una migración. |

## Riesgos

| Riesgo | Cómo se acota |
|---|---|
| Que el relleno vuelva | Candado sobre los 4 archivos del camino de creación, con contraprueba de la forma exacta que tenía. |
| Que la franja caiga en el bloque equivocado | Tabla de casos contra `Intl` con zona real, incluido el caso de I-247 b. |
| Que la marca no llegue al modelo | Candado sobre el payload + la consulta, y test de conducta en base. |
