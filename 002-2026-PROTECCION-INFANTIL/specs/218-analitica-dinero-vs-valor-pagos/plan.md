# Plan de implementación: SPEC-218 — Analítica dinero-vs-valor (002-PI-118)

## Resumen

Construir el tab "Dinero vs Valor" en el área de estadísticas del admin, con 4 widgets y KPIs. Reutilizar componentes de charts existentes, implementar queries agregadas en `PagosRepository`, caché 60s, responsive y sin IA.

## Contexto técnico

- Next.js App Router + React Server Components por defecto.
- Tailwind CSS 3.4; tokens `ambar`.
- Recharts o componentes internos de `/dashboard/admin/estadisticas/operacion/*`.
- DAL: `PagosRepository`.

## Constitution Check

- ✅ Sin multimedia.
- ✅ Presunción de inocencia no aplica.
- ✅ IA local no se toca.
- ✅ Sin IA en analítica (D-67/D-75).
- ✅ Canales oficiales no afectados.
- ✅ Disputas no afectadas.
- ✅ No se modifica texto original de reportes.

## Estructura del proyecto

### Documentación
```text
specs/218-analitica-dinero-vs-valor-pagos/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── tasks.md
├── contracts/
│   └── 218-analitica.md
└── checklists/
    └── requirements.md
```

### Código (preliminar)
```text
src/app/dashboard/admin/estadisticas/dinero-vs-valor/page.tsx
src/components/modules/admin/pagos/analitica/KpiPagosCards.tsx
src/components/modules/admin/pagos/analitica/WidgetVencimientosSemana.tsx
src/components/modules/admin/pagos/analitica/WidgetMoraLarga.tsx
src/components/modules/admin/pagos/analitica/WidgetPadresPagantesColegiosCaidos.tsx
src/components/modules/admin/pagos/analitica/WidgetCrecimientoPaisCiudad.tsx
src/lib/dal/repositories/pagos-repository.ts      # queries analíticas
src/lib/pagos/analitica.service.ts
src/lib/pagos/analitica.service.test.ts
```

## Cambios de código

### 1. Queries analíticas en `PagosRepository`

Agregar métodos:
- `obtenerVencimientosEstaSemana()`.
- `obtenerMoraLarga(diasMinimos)`.
- `obtenerPadresPagantesColegiosNoRenovados()`.
- `obtenerCrecimientoPorPaisCiudad()`.
- `obtenerKpiPagos()`.

Todas retornan DTOs planos; sin N+1.

### 2. Servicio `analitica.service.ts`

- Orquesta llamadas al repo.
- Aplica caché por widget 60s.
- Calcula deltas y anomalías (>25%).

### 3. Componentes UI

- Reutilizar `BarChart`, `DonutChart`, `KpiCard` existentes.
- 4 widgets como componentes separados.
- Fila de KPIs superior.
- Responsive grid.

### 4. Página

`src/app/dashboard/admin/estadisticas/dinero-vs-valor/page.tsx`:
- Server Component que llama a `analitica.service.ts`.
- Renderiza KPIs + widgets.

### 5. Tests

- Tests de agregación con fechas Bogotá.
- Tests de cálculo de anomalías.
- Tests de componentes (renderizado condicional).

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Componentes de charts no existen | Validar existencia; si faltan, usar recharts o implementar mínimo compatible. |
| Relación padre-colegio imprecisa | Preferir relación explícita del modelo; documentar fallback por dominio de email. |
| Caché en memoria en serverless | En v1 es aceptable; en producción evaluar Redis. |

## Criterios de aceptación técnica

- Gate local completo verde.
- `arch:check` verde.
- Tests de agregación pasan.
- Responsive verificado.
