# Contract: Classification Result

## Overview

Resultado devuelto por el pipeline de clasificación tras procesar un reporte.

## Shape

```typescript
type CategoriaConducta =
  | "CONTACTO_INSISTENTE"
  | "SOLICITUD_MATERIAL"
  | "OFRECIMIENTO_REGALOS"
  | "SUPLANTACION_IDENTIDAD"
  | "SOLICITUD_ENCUENTRO"
  | "COMPARTIMIENTO_SEXUAL"
  | "OTRO"
  | "EXTORSION"
  | "CONTENIDO_GENERADO_IA"
  | "DIFUSION_NO_CONSENTIDA"
  | "DOXING";

interface ClassificationResult {
  // Categoría principal (la de mayor score)
  categoria: CategoriaConducta;

  // Confianza real basada en votación (0.0 - 1.0)
  confianza: number;

  // Multi-label: categorías secundarias ordenadas por score descendente
  categoriasSecundarias?: Array<{
    categoria: CategoriaConducta;
    score: number; // 0.0 - 1.0
  }>;

  // Detalle de cada voto (solo para auditoría interna)
  votos?: Array<{
    categoria: CategoriaConducta;
    score: number;
  }>;

  // Indica si se usó modelo de desempate
  usoCascada: boolean;
  modeloCascada?: string;

  // PII
  contienePii: boolean;
  piiDetectada: string[];

  // Estado derivado
  estado: "CLASIFICADO" | "REVISION_MANUAL" | "REQUIERE_ANONIMIZACION";

  // Indica si el agresor aparenta ser otro adolescente/par del entorno escolar
  posibleAgresorPar: boolean;

  // Métricas
  metrics: {
    modelo: string;
    latenciaMs: number;
    promptTokens?: number;
    responseTokens?: number;
  };

  // Respuesta cruda del modelo (para debugging)
  rawResponse: string;
}
```

## Invariants

- `categoria` siempre pertenece al enum de categorías válidas.
- `confianza` es un número entre 0 y 1 calculado como `votosGanador / totalVotos`.
- `usoCascada === true` implica `modeloCascada` definido.
- `contienePii === true` si la capa determinística O la capa LLM detectaron PII.
