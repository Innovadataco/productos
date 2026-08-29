# Research — SPEC-218

## Módulos vivos a reutilizar

| Módulo | Ubicación | Uso |
|---|---|---|
| Componentes de charts | `/dashboard/admin/estadisticas/operacion/*` | BarChart, DonutChart, KPI cards. |
| `PagosRepository` | SPEC-210 | Queries analíticas. |
| `date-fns-tz` | D-69 | Agrupación por mes Bogotá. |
| Sub-nav estadísticas | SPEC-179 | Añadir tab. |

## APIs externas

Ninguna.

## Riesgos técnicos

1. **Charts internos**: necesitamos verificar que existan y sus props. Si no, usar `recharts` si ya es dependencia.
2. **Relación padre-colegio**: el BRIEF menciona "email domain o vinculación". Verificar si existe `Colegio` ↔ `Usuario`.
3. **Rendimiento**: queries sobre tablas grandes; índices y caché mitigan.

## Dependencias rotas identificadas

- **SPEC-212**: si el stub de analítica no existe, se crea desde cero.
- **Componentes de charts**: si no existen, se debe crear deuda técnica o usar librería.
