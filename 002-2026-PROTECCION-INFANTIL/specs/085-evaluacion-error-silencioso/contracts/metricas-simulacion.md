# Contracts — 085-evaluacion-error-silencioso

## metricasJson (SimulacionRun) — claves nuevas

```jsonc
{
  // ... claves existentes (accuracy, aciertos, fallos, omitidos, porCategoria,
  // matrizConfusion, falsosNegativos, latencia*, usoDesempate, distribucionEstados, casosFallidos)
  "erroresSilenciosos": {
    "count": 2,
    "casos": [{ "indice": 1, "identificador": "SIM-x-001", "esperado": "SOLICITUD_ENCUENTRO", "asignado": "CONTACTO_INSISTENTE", "confianza": 1.0, "deltaSeveridad": -60 }]
  },
  "subestimaciones": { "count": 2, "severidadPerdida": 125 },
  "esps": 375,
  "umbralRevision": 1.0
}
```

- `erroresSilenciosos`: fallos con `confianza >= umbral_revision` (métrica principal).
- `subestimaciones.severidadPerdida`: Σ|Δsev| negativo sobre TODOS los fallos.
- `esps`: Σ|Δsev| sobre silenciosos, subestimaciones ×3 (ADR_006).

## POST /api/admin/ia/simulaciones/comparar

Sin cambio de request (`{ ids: string[] }`). En `runs[]` del response se añaden:

```jsonc
{ "erroresSilenciosos": 0, "subestimaciones": 0, "esps": 0 }
```

`advertencia` ahora también cubre procedencia: si las runs comparadas usan bancos con `fuente` distinta (o sin procedencia mezclada), devuelve "Las corridas usan bancos de procedencia distinta; comparar resultados entre bancos no es válido."

## Banco de simulación (archivo)

Formato aceptado por el parser (`parsearArchivoSimulacion`): array plano (legacy) **o** `{ fixtureVersion: number, casos: [...] }`. Campos opcionales por caso: `secundariaEsperada`, `fuente`.

## POST /api/admin/ia/simulaciones (creación)

Sin cambios de contrato (`modelos[]`, `archivo`, `formato`). El límite `CASO_MAXIMO = 200` admite exactamente el banco ampliado.
