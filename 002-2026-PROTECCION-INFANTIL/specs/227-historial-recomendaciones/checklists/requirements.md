# Checklist de requisitos: SPEC-227

## User Stories

- [ ] US-1: Historial filtrable (regla, estado, categoría, cliente, rango Bogotá, ejecutada automática) con paginación estándar.
- [ ] US-2: Métricas de tuning globales y por regla (tasa aplicación/ignorada/expirada sobre resueltas, tiempo promedio de resolución, alerta por umbral).
- [ ] US-3: Export CSV pseudonimizado (sin PII, hash estable, tope 413, AuditLog).

## Functional Requirements

- [ ] FR-001: `GET /api/admin/analisis/recomendaciones` con auth + módulo + rate limit + paginación `{ items, pagination }`.
- [ ] FR-002: Filtros Zod compartidos; 400 en inválidos; fechas en día calendario `America/Bogota`.
- [ ] FR-003: Ítems con regla (`id`/`clave`/`nombre`), estado, fechas, prioridad, sujeto seguro.
- [ ] FR-004: `GET .../metricas` con totales, tasas, promedio y `porRegla` ordenado por tasa de ignorada desc.
- [ ] FR-005: Seed idempotente de `analisis.recomendaciones.tasa_ignorada_alerta_pct` (70) y `export_max_filas` (5000).
- [ ] FR-006: `GET .../export` CSV con columnas fijas y `Content-Disposition`.
- [ ] FR-007: `sujeto_hash` SHA-256 con sal de entorno, 16 hex; sin título/descripción/datos de contacto.
- [ ] FR-008: `AuditLog` de cada exportación (sin contenido).
- [ ] FR-009: Vista `/dashboard/admin/analisis/recomendaciones` con sistema visual heredado (vidrio Apple, ambar, radios 16/12/22, semáforo pino/ambar/rubi).
- [ ] FR-010: Terminología brief §3 ("Sugerencia", estados en criollo), tono neutral sin voseo.
- [ ] FR-011: Módulo `analisis_recomendaciones` en catálogo, backfill solo ADMIN, entrada de nav.
- [ ] FR-012: Lógica en DAL `analisis-recomendaciones.ts` con `Prisma.RecomendacionWhereInput` (sin `any`).
- [ ] FR-013: Tests de rutas, servicio DAL, CSV y componentes.
- [ ] FR-014: Sin cambios en `src/lib/ai/**`, motor de reglas ni rate limit público; solo lectura.

## Success Criteria

- [ ] SC-001: Lista < 500 ms p95 con 10 000 filas y filtros combinados.
- [ ] SC-002: Tasas exactas al punto porcentual contra dataset conocido.
- [ ] SC-003: Promedio solo sobre `resueltaEn` no nula; frontera Bogotá correcta.
- [ ] SC-004: CSV pasa verificación automática de ausencia de PII; hash estable.
- [ ] SC-005: 403 a no-ADMIN en los tres endpoints; sin entrada de nav.
- [ ] SC-006: Regla sobre umbral destacada visualmente.
- [ ] SC-007: Gate local del mega-lote verde y diff acotado al lote.

## Candados y restricciones

- [ ] NO se tocó `src/lib/ai/**` ni rate-limit del reporte público.
- [ ] Cero migraciones; cero escrituras en `Recomendacion`/`ReglaRecomendacion`.
- [ ] Migraciones/seed solo aditivos (parámetros + módulo por upsert).
- [ ] CSV sin PII de cliente (Ley 1581); sal solo en variable de entorno (I-22).
- [ ] Vista de solo lectura: la resolución de sugerencias queda en SPEC-221/226.
- [ ] Textos de UI sin voseo; terminología "Sugerencia/Regla/Pendiente/Aplicada/Ignorada/Expirada".
- [ ] Sin veredictos ni scores de personas: las métricas miden desempeño de reglas del sistema, no de clientes.

## Dependencias externas

- [ ] SPEC-221 (modelos + reglas semilla) implementada en `work/002-PI-mega-cola-restante` antes de esta spec.
- [ ] `ANALISIS_EXPORT_SALT` definida en el entorno de validación.
