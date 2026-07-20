# Research — Spec 041: Cierre de blindaje + saneamiento

## Hallazgos

### US1 — Índices HNSW y despliegue de migraciones

- **Índices verificados**: `scripts/verify-hnsw-indexes.ts` ya existe y verifica `EmbeddingReporte_vector_idx` y `EmbeddingDataset_vector_idx`.
- **Ejecución contra la base de datos**: ambos índices están presentes y usan `USING hnsw`.
- **Método de despliegue**: `package.json` define `"db:migrate": "prisma migrate deploy"`. No se requiere cambio.
- **Auditoría de scripts**: `grep` en `scripts/` no encuentra `migrate dev`, `migrate reset` ni `db push`.
- **Riesgo residual**: si alguna migración futura dropea o recrea índices, `npm run db:verify:hnsw` fallará y el deploy debe abortarse hasta corregir.

### US2 — Error crudo en `Reporte.processingError`

- **Endpoint `/api/reportes/procesar`**: en el `catch` (línea ~595), actualizaba `processingError: errMsg`, donde `errMsg` es el mensaje crudo del error (ej. "Ollama no disponible tras 3 reintentos" o "Fallo determinístico del pipeline"). El spec 037 ya había sanitizado el `motivo` y los `metadatos` de la transición, pero no el campo `processingError` del reporte.
- **Endpoint `/api/reportes/fallback`**: recibía `error` en el body del worker y persistía `processingError: errorMsg`. El motivo de transición también incluía el mensaje crudo.
- **Impacto**: cualquier usuario con acceso al modelo `Reporte` podía ver detalles de fallas de infraestructura o proveedores.

## Referencias

- `scripts/verify-hnsw-indexes.ts`
- `package.json`
- `src/app/api/reportes/procesar/route.ts`
- `src/app/api/reportes/fallback/route.ts`
- `src/app/api/reportes/fallback/route.test.ts`
- `AGENTS.md`
- Spec 035 (correcciones de blindaje crítico)
- Spec 037 (seguridad y limpieza)
