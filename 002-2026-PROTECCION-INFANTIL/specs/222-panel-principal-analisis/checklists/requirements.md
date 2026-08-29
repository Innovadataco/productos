# Checklist de requisitos: SPEC-222

> Estado: implementación completa. Los items verificados por gate local están
> marcados; los que dependen de la corrida de integración (BD compartida, los
> corre el coordinador) o de validación manual del quickstart quedan sin
> marcar hasta esa verificación.

## User Stories

- [x] US-1: Top 5 decisiones hoy.
  - [ ] Máximo 5 recomendaciones `PENDIENTE` no expiradas, orden `prioridad DESC, generadaEn ASC`. *(test integración escrito; corre el coordinador)*
  - [ ] "Marcar como aplicada" → `APLICADA` + `AuditLog` + sale del Top 5. *(resolver de SPEC-221 reutilizado; test integración)*
  - [ ] "Ignorar" → `IGNORADA` + motivo opcional + `AuditLog`. *(test integración)*
  - [x] Estado vacío neutral sin recomendaciones. *(test unitario UI)*
  - [ ] `403` para rol no ADMIN. *(test integración escrito)*
- [x] US-2: Matriz de dispersión dinero-vs-valor.
  - [ ] X = monto neto USD del período, Y = `scoreTotal` del snapshot vigente. *(test integración)*
  - [x] 4 cuadrantes con cortes (mediana o parámetro) y etiquetas neutras. *(test unitario de helpers)*
  - [x] Colores `pino`/`ambar`/`rubi`/neutral por cuadrante.
  - [x] Click en punto → `/dashboard/admin/pagos/cliente/[id]`.
  - [x] Nota de clientes sin score; tooltip sin PII de reportes.
- [x] US-3: 7 granularidades con drill-down.
  - [ ] País (default), Ciudad, Colegio, Padre, Plan, Cohorte, Canal. *(test integración)*
  - [x] Drill País → Ciudad → Colegio → Cliente con breadcrumb.
  - [ ] Cohorte por mes Bogotá con % retenidos. *(test integración)*
  - [x] Canal con precedencia referido → bono → freemium convertido → directo. *(test unitario)*
  - [ ] Bucket "Sin ciudad" para padres. *(test integración)*
- [x] US-4: KPIs base.
  - [ ] MAU, MRR, churn, LTV, % renovaciones, % conversión freemium, % referidos. *(test integración)*
  - [x] Deltas vs período anterior; cortes Bogotá; "—" sin datos. *(test unitario de helpers)*
- [x] US-5: Panel de anomalías.
  - [ ] Orden severidad → fecha; badges de color; "Revisar" al sujeto. *(test integración)*
  - [x] Estado vacío controlado si SPEC-225 no está desplegada (guard P2021/P2022 → `disponible: false`).
- [x] US-6: Filtros globales persistentes.
  - [x] Período/estado/tipoTitular en querystring, sobreviven a granularidad y drill.
  - [x] Rango custom validado (`desde <= hasta`). *(test unitario de schema)*

## Functional Requirements

- [x] FR-001: Tab literal en `EstadisticasSubNav` (ya sembrado por SPEC-218, H-1); proxy sin cambios (área admin ya abierta a roles internos; ADMIN-only se fuerza en página y rutas).
- [x] FR-002: Página server + client `"use client"`.
- [x] FR-003 a FR-010: 6 endpoints según `contracts/222-panel-analisis.md` (el resolver es el de SPEC-221 extendido con `accion`, H-2).
- [x] FR-011: `verifyAuth` + `assertModulo("estadisticas")` + rol ADMIN + rate limit `admin_read` + Zod en los 5 GET nuevos (el resolver de SPEC-221 no tenía rate limit; se mantiene como está, ver desviaciones).
- [x] FR-012: Agregaciones en DAL (`analisis-panel.ts` + `analisis-panel-repository.ts`); rutas sin `prisma`.
- [x] FR-013: Dispersión con recharts + tokens heredados.
- [x] FR-014: Cards Top 5 con acciones y enlaces `tel:`/`mailto:` condicionales.
- [x] FR-015: Cero PII de reportes en responses y UI.
- [x] FR-016: `AuditLog` en cada resolución (TX del repositorio de SPEC-221).
- [x] FR-017: Filtros en querystring persistentes.
- [x] FR-018: Precedencia de canal documentada y testeada.
- [x] FR-019: Tests unitarios (corridos, verdes) e integración (escritos; los corre el coordinador).
- [x] FR-020: Tono neutral, sin voseo, lenguaje estadístico.

## Success Criteria

- [ ] SC-001: Panel completo < 3 s (p95) con 1 000 suscripciones. *(sin medición de perf local)*
- [ ] SC-002: Endpoints de agregación < 800 ms, sin N+1. *(sin N+1 por diseño: 1 query base + 1 groupBy; sin medición de perf)*
- [ ] SC-003: Agregados correctos vs fixture conocido. *(test integración escrito; corre el coordinador)*
- [ ] SC-004: Drill-down con filtros conservados en el 100% de transiciones. *(quickstart manual)*
- [ ] SC-005: Resolución excluye del Top 5 + `AuditLog` + `409` concurrente. *(test integración de SPEC-221 + alias `accion`)*
- [ ] SC-006: Test de contrato sin campos de reportes/PII. *(assert en test de dispersión; corre el coordinador)*
- [ ] SC-007: Anomalías en estado vacío sin error si SPEC-225 pendiente. *(guard implementado; SPEC-225 ya está integrada en la rama)*
- [ ] SC-008: Gate local verde + `arch:check` verde. *(tsc/lint/unit/tokens verdes; arch:check lo corre el coordinador — no se añadió href nuevo)*

## Candados y restricciones

- [x] NO se tocó `src/lib/ai/**` ni el rate-limit.
- [x] NO se tocó `/dashboard/admin/pagos/analitica` (SPEC-218) — su contenido convive en el mismo tab.
- [x] Cero migraciones: `AccionAudit.RECOMENDACION_RESUELTA` ya existía (SPEC-221); solo seeds aditivos `ParametroSistema`.
- [x] Sin PII de reportes en agregados: nunca texto de reporte, identificador de menor ni denunciante.
- [x] Score de valor solo visible a ADMIN (no se expone al cliente).
- [x] Terminología del brief (criollo cerrado §3): "Score de valor", "Sugerencia", "Anomalía", "Cohorte".
- [x] Sin IA: 100% SQL agregado + heurísticas.
- [x] Textos de UI sin voseo.

## Dependencias externas

- [x] SPEC-220 (ScoreCliente + parámetros + job) integrada en la rama.
- [x] SPEC-221 (Recomendacion + worker de reglas + resolver) integrada en la rama.
- [x] SPEC-225 (Anomalia) integrada en la rama (guard de degradación igualmente implementado).
