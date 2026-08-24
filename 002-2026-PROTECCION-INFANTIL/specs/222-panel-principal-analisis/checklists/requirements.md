# Checklist de requisitos: SPEC-222

## User Stories

- [ ] US-1: Top 5 decisiones hoy.
  - [ ] Máximo 5 recomendaciones `PENDIENTE` no expiradas, orden `prioridad DESC, generadaEn ASC`.
  - [ ] "Marcar como aplicada" → `APLICADA` + `AuditLog` + sale del Top 5.
  - [ ] "Ignorar" → `IGNORADA` + motivo opcional + `AuditLog`.
  - [ ] Estado vacío neutral sin recomendaciones.
  - [ ] `403` para rol no ADMIN.
- [ ] US-2: Matriz de dispersión dinero-vs-valor.
  - [ ] X = monto neto USD del período, Y = `scoreTotal` del snapshot vigente.
  - [ ] 4 cuadrantes con cortes (mediana o parámetro) y etiquetas neutras.
  - [ ] Colores `pino`/`ambar`/`rubi`/neutral por cuadrante.
  - [ ] Click en punto → `/dashboard/admin/pagos/cliente/[id]`.
  - [ ] Nota de clientes sin score; tooltip sin PII de reportes.
- [ ] US-3: 7 granularidades con drill-down.
  - [ ] País (default), Ciudad, Colegio, Padre, Plan, Cohorte, Canal.
  - [ ] Drill País → Ciudad → Colegio → Cliente con breadcrumb.
  - [ ] Cohorte por mes Bogotá con % retenidos.
  - [ ] Canal con precedencia referido → bono → freemium convertido → directo.
  - [ ] Bucket "Sin ciudad" para padres.
- [ ] US-4: KPIs base.
  - [ ] MAU, MRR, churn, LTV, % renovaciones, % conversión freemium, % referidos.
  - [ ] Deltas vs período anterior; cortes Bogotá; "—" sin datos.
- [ ] US-5: Panel de anomalías.
  - [ ] Orden severidad → fecha; badges de color; "Revisar" al sujeto.
  - [ ] Estado vacío controlado si SPEC-225 no está desplegada.
- [ ] US-6: Filtros globales persistentes.
  - [ ] Período/estado/tipoTitular en querystring, sobreviven a granularidad y drill.
  - [ ] Rango custom validado (`desde <= hasta`).

## Functional Requirements

- [ ] FR-001: Tab literal en `EstadisticasSubNav` + regla de proxy para ADMIN.
- [ ] FR-002: Página server + client `"use client"`.
- [ ] FR-003 a FR-010: 6 endpoints según `contracts/222-panel-analisis.md`.
- [ ] FR-011: `verifyAuth` + `assertModulo("estadisticas")` + rol ADMIN + rate limit `admin_read` + Zod en todos.
- [ ] FR-012: Agregaciones en DAL (`analisis-panel.ts` + repositorios); rutas sin `prisma`.
- [ ] FR-013: Dispersión con recharts + tokens heredados.
- [ ] FR-014: Cards Top 5 con acciones y enlaces `tel:`/`mailto:` condicionales.
- [ ] FR-015: Cero PII de reportes en responses y UI.
- [ ] FR-016: `AuditLog` en cada resolución.
- [ ] FR-017: Filtros en querystring persistentes.
- [ ] FR-018: Precedencia de canal documentada y testeada.
- [ ] FR-019: Tests unitarios/integración de servicio y rutas.
- [ ] FR-020: Tono neutral, sin voseo, lenguaje estadístico.

## Success Criteria

- [ ] SC-001: Panel completo < 3 s (p95) con 1 000 suscripciones.
- [ ] SC-002: Endpoints de agregación < 800 ms, sin N+1.
- [ ] SC-003: Agregados correctos vs fixture conocido.
- [ ] SC-004: Drill-down con filtros conservados en el 100% de transiciones.
- [ ] SC-005: Resolución excluye del Top 5 + `AuditLog` + `409` concurrente.
- [ ] SC-006: Test de contrato sin campos de reportes/PII.
- [ ] SC-007: Anomalías en estado vacío sin error si SPEC-225 pendiente.
- [ ] SC-008: Gate local verde + `arch:check` verde.

## Candados y restricciones

- [ ] NO se tocó `src/lib/ai/**` ni el rate-limit.
- [ ] NO se tocó `/dashboard/admin/pagos/analitica` (SPEC-218).
- [ ] Cero migraciones destructivas; migración posible solo aditiva (enum `AuditLog`, seeds `ParametroSistema`).
- [ ] Sin PII de reportes en agregados: nunca texto de reporte, identificador de menor ni denunciante.
- [ ] Score de valor solo visible a ADMIN (no se expone al cliente).
- [ ] Terminología del brief (criollo cerrado §3): "Score de valor", "Sugerencia", "Anomalía", "Cohorte".
- [ ] Sin IA: 100% SQL agregado + heurísticas.
- [ ] Textos de UI sin voseo.

## Dependencias externas

- [ ] SPEC-220 (ScoreCliente + parámetros + job) integrada en la rama.
- [ ] SPEC-221 (Recomendacion + worker de reglas) integrada en la rama.
- [ ] SPEC-225 (Anomalia) integrada, o degradación elegante verificada.
