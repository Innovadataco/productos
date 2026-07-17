# Plan de implementación — Spec 011 Centro de Control IA

## Condiciones de aprobación (R1-R7)
1. Texto original de reporte nunca se modifica/persiste alterado.
2. PII/textos no salen del entorno local; sandbox no loguea texto; AuditLog solo registra "quién probó y cuándo".
3. Guardas determinísticas no reclasifican, solo escalan estado/prioridad.
4. Migraciones con `prisma migrate dev`, nunca `db push`.
5. No tocar pipeline de `EmbeddingReporte`.
6. Cada bloque termina con lint, tsc, build y tests verdes.
7. Spec consume el pipeline, no lo modifica. Si se toca (ej. `rag_top_k`), correr eval F7 de 110 ejemplos.

## Fases

### 1. Preparación
- Agregar `reportes.classification.rag_top_k` (default 3) a `prisma/seed.ts`.
- Agregar parámetros de rate limit `ratelimit.ia_sandbox.*` a seed.
- Actualizar `src/lib/reporte-test-utils.ts` con `rag_top_k`.
- Ejecutar seed y verificar tests.

### 2. Backend sandbox
- Crear `src/lib/ai/sandbox.ts`:
  - `SandboxOverrides` y `SandboxTrace`.
  - `ejecutarSandbox(texto, overrides?)` que corra embedding → RAG → votos → PII → anonimización → guardas → decisión.
  - Sin persistencia.
- Crear `src/app/api/admin/ia/sandbox/route.ts`:
  - POST `/api/admin/ia/sandbox`.
  - `verifyAuth(RolUsuario.ADMIN)`.
  - Rate limit scope `ia_sandbox`.
  - Soportar `comparar=true` (2 ejecuciones).
  - Manejar `AppError` para devolver 401/403 correctos.

### 3. Componentes UI base
- `src/components/ui/Slider.tsx`.
- `src/components/ui/Badge.tsx`.
- Actualizar `src/components/modules/AdminNav.tsx` con link a Centro de Control IA.

### 4. Página y paneles
- `src/app/dashboard/admin/ia/page.tsx` con tabs.
- `src/components/modules/ia/IaDocsPanel.tsx`: diagrama de pipeline, demos de votos, gauge de confianza, precisión observada.
- `src/components/modules/ia/IaPlayground.tsx`: entrada de texto, sliders de overrides, analizar/comparar, resultado.
- `src/components/modules/ia/IaTraceTimeline.tsx`: trace etapa por etapa.

### 5. Integración
- Desde Configuración, posibilidad de abrir el playground con query params de overrides.
- El playground carga la configuración actual como valores por defecto.

### 6. Tests
- Crear `src/app/api/admin/ia/sandbox/route.test.ts`:
  - Rechaza sin auth.
  - Rechaza no admin.
  - Ejecuta sandbox.
  - Aplica overrides.
  - Modo comparar.
  - No persiste reportes.

### 7. Validación y no-regresión
- `npx tsc --noEmit`.
- `npm run lint`.
- `npm run build`.
- `npm test`.
- Eval F7 de 110 ejemplos para verificar que `rag_top_k` no regrese.

### 8. Cierre
- Actualizar `IMPLEMENTATION-REPORT.md`.
- Crear `specs/011-centro-control-ia/report.md`.
- Deploy (al finalizar).

## Riesgos y mitigaciones
| Riesgo | Mitigación |
|--------|------------|
| Sandbox consuma recursos de Ollama excesivamente | Rate limit estricto por admin; modo comparar cuenta 2 ejecuciones. |
| Texto de prueba filtrado en logs | Nunca loguear `texto`; solo registrar quién probó y cuándo. |
| Fuga de PII en UI | Mostrar PII detectada solo al admin autenticado; no persistir. |
| Regresión por `rag_top_k` | Correr eval F7 antes de cerrar. |

## Definición de terminado
- Todos los criterios de aceptación del spec están marcados.
- Lint, tsc, build y tests verdes.
- Eval F7 sin regresión.
- Documentación actualizada.
