# Plan · SPEC-595 — Bandeja: pendientes vs procesados

## Enfoque

Separación server-side (fuente de verdad en la query) + dos pestañas en el único componente de bandeja (compartido por ADMIN/OPERADOR/COMITE_VALIDACION). Detalle de procesados en modal solo-lectura que reutiliza `ReporteDetalleInfo` sin tocar la lógica de revelado/auditoría/emails (zona del agente paralelo SPEC-592/594).

## Cambios por capa

1. **Contrato** (`src/lib/validators.ts`): `seccion: z.enum(["pendientes","procesados"]).default("pendientes")` en `reportesRevisionQuerySchema`.
2. **API** (`route.ts`): construir `where` base como hoy; la condición de sección va en `where.AND` (OR de estados terminales / `CLASIFICADO` con corrección para procesados; complemento para pendientes). Respuesta con `secciones: { pendientes, procesados }` vía `contarBandejaRevision` (sin la condición de sección, con el resto de filtros).
3. **DAL** (`reporte.ts`): `contarBandejaRevision(where): Promise<number>` (E-8: la ruta no toca prisma).
4. **UI** (`AdminReportesTable.tsx`): estado `seccion` desde `searchParams` (default `pendientes`); dos pestañas con contadores de la respuesta; `buildQueryString` incluye `seccion`; en procesados se omite «Ver proceso» y cualquier acción futura, solo «Ver detalle» abre `ReporteDetalleSoloLectura`; diferenciación visual (sección apagada + etiqueta «Solo visualización»).
5. **UI** (`ReporteDetalleSoloLectura.tsx`): fetch `GET /api/admin/reportes-revision/[id]` propio, `Modal` con aviso de solo visualización + `ReporteDetalleInfo`.

## Estados

| Sección | Estados |
|---|---|
| Pendientes | PENDIENTE, PROCESANDO, REVISION_MANUAL, REQUIERE_ANONIMIZACION, CLASIFICADO sin `clasificacion.correccion` |
| Procesados | CORREGIDO, DUPLICADO, POSIBLE_SPAM, CLASIFICADO con `clasificacion.correccion` |

## Testing

- API (route.test.ts): sembrar reportes en cada estado + corrección; verificar sección default, filtrado por sección, coexistencia con `estado`/`categoria`, presencia de `secciones`.
- Componente (AdminReportesTable.test.tsx): pestañas y contadores, ausencia de «Ver proceso» en procesados, apertura del modal solo-lectura.
- Nuevo: ReporteDetalleSoloLectura.test.tsx (mock fetch; campos visibles; sin botones de acción).

## Riesgos

- BD de test compartida con el agente paralelo → BD privada `proteccion_infantil_test_595` (migrate deploy + seed, `.env.test` local sin commitear).
- Conflicto de merge futuro con SPEC-592/594 en `reporte-detalle/`: mis cambios son un archivo nuevo + imports, sin tocar `AdminReporteDetalle`, `useReporteDetalle` ni `AccionesReporte`.
