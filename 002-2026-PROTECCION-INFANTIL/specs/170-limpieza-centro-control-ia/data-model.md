# Data Model: SPEC-170 — Limpieza del Centro de Control IA

## Resumen de cambios

Esta spec NO crea nuevas tablas. Solo elimina tablas y enums del sistema de Experimentos (Fase 2) y posiblemente un parámetro de sistema obsoleto (Fase 3).

---

## Entidades eliminadas (Fase 2)

### Modelos

| Modelo | Uso previo | Motivo de eliminación |
|--------|------------|----------------------|
| `CasoEval` | Banco de casos curados para evaluación | Reemplazado por fixture versionado `fixtures/banco-curado-v2.jsonl` |
| `EvalRun` | Ejecución de un experimento/laboratorio | Sistema de Experimentos en desuso |
| `EvalResultado` | Resultado individual de un caso en un experimento | Sistema de Experimentos en desuso |

### Enums

| Enum | Valores | Motivo de eliminación |
|------|---------|----------------------|
| `CasoEvalFuente` | `SEMILLA`, `MANUAL_ADMIN`, `PRODUCCION_ANONIMIZADO` | Solo usado por `CasoEval` |
| `EvalRunEstado` | `PENDIENTE`, `EN_PROGRESO`, `COMPLETADA`, `FALLIDA`, `CANCELADA` | Solo usado por `EvalRun` |

### Migración sugerida

```sql
-- 20260816120000_retirar_experimentos/migration.sql
DROP TABLE IF EXISTS "EvalResultado";
DROP TABLE IF EXISTS "EvalRun";
DROP TABLE IF EXISTS "CasoEval";
DROP TYPE IF EXISTS "EvalRunEstado";
DROP TYPE IF EXISTS "CasoEvalFuente";
```

**Nota**: `DROP TABLE IF EXISTS` es seguro para tablas exclusivas de código muerto; no afecta datos de reportes, usuarios ni colegios.

---

## Parámetro eliminado (Fase 3, Opción 1 recomendada)

| Parámetro | Clave | Motivo de eliminación |
|-----------|-------|----------------------|
| Habilitación de rúbrica | `ia.rubrica.enabled` | Rúbrica es el único motor en uso; el switch ya no tiene sentido |

### Migración sugerida

```sql
DELETE FROM "ParametroSistema" WHERE clave = 'ia.rubrica.enabled';
```

---

## Entidades que NO se tocan

- `SimulacionRun` y `SimulacionResultado` (tablas de Simulación, ciclo activo de afinamiento).
- `RubricaConfig` y parámetros `ia.rubrica.*` (excepto `ia.rubrica.enabled` si aplica Opción 1).
- Todos los modelos de reportes, usuarios, colegios, identificadores, alertas, etc.
