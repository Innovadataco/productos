# Contract: Eval Harness Report

## Overview

Formato de salida del evaluador de clasificación para comparar baseline contra futuras fases.

## Shape

```typescript
interface EvalReport {
  metadata: {
    model: string;
    fixture: string;        // path al fixture usado
    totalExamples: number;
    timestamp: string;      // ISO 8601
    phase?: string;         // "baseline" | "F1" | "F2" | ...
  };

  summary: {
    accuracy: number;                 // 0.0 - 1.0
    precisionAutoClasificados: number; // KPI principal
    errorSilencioso: number;           // 1 - precisionAutoClasificados
    revisionManualRate: number;        // 0.0 - 1.0
    latencyP50Ms: number;
    latencyP95Ms: number;
  };

  byNoise: {
    clean: {
      accuracy: number;
      precisionAutoClasificados: number;
      errorSilencioso: number;
      revisionManualRate: number;
      count: number;
    };
    noisy: {
      accuracy: number;
      precisionAutoClasificados: number;
      errorSilencioso: number;
      revisionManualRate: number;
      count: number;
    };
  };

  perCategory: Record<CategoriaConducta, {
    precision: number;
    recall: number;
    f1: number;
    support: number;
  }>;

  confusionMatrix: Record<CategoriaConducta, Record<CategoriaConducta, number>>;

  details: Array<{
    text: string;
    expected: CategoriaConducta;
    predicted: CategoriaConducta;
    confidence: number;
    estado: string;
    latencyMs: number;
    correct: boolean;
    ruido: boolean;
    secundariaEsperada?: CategoriaConducta;
  }>;
}
```

## Métricas centrales

- **`precisionAutoClasificados`**: de los casos cuyo estado final fue `CLASIFICADO`, porcentaje cuya categoría principal coincide con la etiqueta dorada.
- **`errorSilencioso`**: complemento (`1 - precisionAutoClasificados`). Representa reportes incorrectos que pasan a producción sin revisión humana.
- **`revisionManualRate`**: porcentaje de reportes que terminan en `REVISION_MANUAL` (incluyendo errores de red/timeout).

## Storage

Los reportes se guardan en `eval-results/` con nombre `{phase}-{timestamp}.json`.
