# Feature Specification: Dividir archivos grandes

**Feature Branch**: `[feature/001-scaffolding]`

**Created**: 2026-07-20

**Status**: CERRADA

**Input**: PROGRAMA DE SANEAMIENTO — reducir complejidad de archivos fuente con más de 400 líneas extrayendo sub-componentes y helpers sin cambiar comportamiento.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Dividir `IaEvalManager.tsx` (Priority: P1)

El componente `src/components/modules/ia/IaEvalManager.tsx` supera las 1000 líneas. Dificulta la revisión de código, las correcciones de la evaluación de IA y las pruebas unitarias. Se extraerán los tabs (`LaboratorioTab`, `CasosTab`, `HistorialTab`) y los componentes internos (`ExperimentCard`, `NuevoExperimentoForm`, `ExperimentoDashboard`, `MetricCard`, `ComparadorExperimentos`) en archivos independientes dentro de `src/components/modules/ia/eval/`.

**Why this priority**: Es el archivo más grande del proyecto y concentra toda la lógica del laboratorio de evaluación de IA. Dividirlo desbloquea cambios futuros en el clasificador y reduce riesgo de regresión.

**Independent Test**: Navegar al módulo de evaluación de IA, crear un experimento, ver el historial y gestionar casos del fixture. La UI debe comportarse igual que antes del refactor.

**Acceptance Scenarios**:

1. **Given** un administrador en `/dashboard/admin/ia/eval`, **When** cambia entre Laboratorio, Casos e Historial, **Then** cada tab renderiza sin errores y mantiene sus funciones.
2. **Given** un administrador en el tab Laboratorio, **When** crea un nuevo experimento, **Then** el formulario de configuración, confirmación y lanzamiento funciona igual que antes.
3. **Given** un experimento completado, **When** se abre su detalle, **Then** las métricas, gráficos y casos fallados se muestran igual que antes.
4. **Given** experimentos completados, **When** se usa el comparador, **Then** la tabla de métricas y la frontera se muestran igual que antes.

---

### User Story 2 — Dividir `AdminReporteDetalle.tsx` (Priority: P1)

El componente `src/components/modules/AdminReporteDetalle.tsx` supera las 800 líneas. Gestiona la carga, acciones de moderación (anonimizar, confirmar, corregir, baja, reactivar, revelar, escalar, validar anonimización) y el renderizado de un modal denso. Se extraerán secciones de UI y helpers en archivos independientes dentro de `src/components/modules/reporte-detalle/`.

**Why this priority**: El detalle de reporte es una de las pantallas más frecuentes para administradores y operadores. Reducir su tamaño facilita futuras mejoras en el flujo de revisión manual.

**Independent Test**: Abrir el detalle de un reporte, ejecutar cada acción disponible (anonimizar, confirmar, corregir, baja, reactivar, revelar, escalar, validar) y verificar que el estado y las notificaciones se actualizan igual que antes.

**Acceptance Scenarios**:

1. **Given** un reporte en estado `REQUIERE_ANONIMIZACION`, **When** el admin edita el texto y confirma, **Then** el reporte se anonimiza y el estado cambia a `CLASIFICADO`.
2. **Given** un reporte con clasificación, **When** el admin corrige la categoría, **Then** se registra la corrección y el estado cambia a `CORREGIDO`.
3. **Given** un reporte en estado `REVISION_MANUAL`, **When** el admin confirma la categoría, **Then** se registra la confirmación.
4. **Given** un reporte activo, **When** el admin da de baja y reactiva, **Then** ambas transiciones se ejecutan correctamente.
5. **Given** un reporte con texto original, **When** el admin revela el original, **Then** el texto se muestra auditado.
6. **Given** un reporte escpable, **When** el admin escala al comité, **Then** se crea la solicitud de escalamiento.

---

### User Story 3 — Dividir `procesar/route.ts` (Priority: P1)

El endpoint `src/app/api/reportes/procesar/route.ts` supera las 600 líneas. Orquesta el procesamiento de reportes: validación, embedding, deduplicación, clasificación, PII, anonimización, guardas de seguridad, transiciones y alertas. Se extraerán helpers puros en `src/lib/procesamiento-reporte/` dejando en `route.ts` solo el handler HTTP y la secuencia de alto nivel.

**Why this priority**: El procesamiento de reportes es el core del producto. Un archivo más pequeño y helpers testables reduce el riesgo de cambios en la lógica de IA y seguridad.

**Independent Test**: Ejecutar la suite de tests de `src/app/api/reportes/procesar/route.test.ts` y el quickstart de procesamiento. Todos los escenarios de clasificación, anonimización, duplicados, errores transitorios y alertas deben pasar.

**Acceptance Scenarios**:

1. **Given** un reporte `PENDIENTE`, **When** el worker lo procesa, **Then** pasa a `CLASIFICADO` o a un estado final coherente.
2. **Given** un reporte con PII, **When** el worker detecta datos personales, **Then** anonimiza y guarda el texto original cifrado.
3. **Given** un reporte anónimo duplicado, **When** supera el umbral de similitud, **Then** se marca como `DUPLICADO`.
4. **Given** un error transitorio, **When** falla el embedding o la anonimización, **Then** el reporte queda en `PROCESANDO` y la respuesta es reintentable.
5. **Given** un error no transitorio, **When** falla el procesamiento, **Then** el reporte pasa a `REVISION_MANUAL` y se envía alerta.
6. **Given** un reporte ya en estado final, **When** se reenvía al worker, **Then** no se reprocesa y se retorna el estado actual.

---

### User Story 4 — Dividir los demás archivos > 400 líneas (Priority: P2)

Una vez divididos los tres archivos principales, se abordarán el resto de archivos fuente que superen las 400 líneas: `src/lib/circulo-confianza.ts`, `src/app/dashboard/admin/comite/gestion/GestionPageClient.tsx`, `src/app/dashboard/circulo-confianza/page.tsx`, `src/app/dashboard/admin/operadores/gestion/page.tsx`, `src/components/modules/ConfigPanel.tsx`, `src/lib/ai/eval-runner.ts`, `src/components/modules/AuditLogViewer.tsx`, `src/lib/ai/classifier.ts`.

**Why this priority**: Reduce deuda técnica acumulada y mejora la mantenibilidad general, pero no bloquea funcionalidad crítica.

**Independent Test**: `npm run test`, `npm run lint` y `npm run build` pasan tras cada extracción.

**Acceptance Scenarios**:

1. **Given** un archivo de la lista, **When** se extraen componentes/helpers, **Then** el archivo padre queda bajo las 400 líneas y el comportamiento es idéntico.
2. **Given** la base de código, **When** se ejecutan `tsc --noEmit`, `npm run lint` y `npm run test`, **Then** no hay errores ni tests fallidos.

---

### Edge Cases

- ¿Qué ocurre si un sub-componente extraído recibe un tipo ligeramente diferente? El compilador TypeScript debe rechazarlo; el refactor no cambia tipos ni interfaces.
- ¿Qué pasa si un helper extraído muta el reporte de forma no esperada? El test `route.test.ts` lo detecta; se revierte el cambio.
- ¿Cómo se garantiza que no se pierde un `useEffect` o `useCallback`? Se comparan las dependencias y se ejecutan tests de renderizado después de cada extracción.
- ¿Qué sucede si un archivo extraído no se importa correctamente? `npm run build` falla y se corrige antes de continuar.
- ¿Cómo se maneja un test que falla tras un refactor? Se revierte el cambio de ese archivo, se verifica que los tests vuelven a verde, y se continúa con otro archivo.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE mantener el comportamiento exacto de los archivos refactorizados. Cualquier cambio observable en tests o UI es regresión.
- **FR-002**: El sistema DEBE extraer sub-componentes y helpers en archivos independientes con nombres descriptivos.
- **FR-003**: El sistema DEBE mantener los exports originales (`IaEvalManager`, `AdminReporteDetalle`, `POST`) para no romper imports existentes.
- **FR-004**: El sistema DEBE dejar los archivos padre bajo las 400 líneas siempre que sea posible sin fragmentar excesivamente.
- **FR-005**: El sistema DEBE ejecutar `tsc --noEmit`, `npm run lint` y `npm run test` después de cada extracción, con resultados verdes antes de continuar.
- **FR-006**: El sistema DEBE agrupar archivos extraídos en subcarpetas temáticas (`eval/`, `reporte-detalle/`, `procesamiento-reporte/`).
- **FR-007**: El sistema DEBE preservar comentarios, nombres de variables y lógica; solo se cambia la estructura física del código.
- **FR-008**: El sistema DEBE documentar en `cierre.md` los archivos tocados, el cambio de líneas y los resultados de pruebas.

### Key Entities

- **IaEvalManager**: Componente raíz de evaluación de IA. Se descompone en `IaEvalTabs` + tabs + sub-componentes.
- **AdminReporteDetalle**: Modal de detalle y acciones de reporte. Se descompone en `ReporteDetalleHeader`, `ReporteInfoGrid`, `ClasificacionPanel`, `AccionesPanel`, etc.
- **ProcesarRoute**: Handler POST de procesamiento de reportes. Se descompone en helpers de validación, embedding, clasificación, PII/anonimización, guardas, transiciones y alertas.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `IaEvalManager.tsx` queda bajo 400 líneas tras la extracción de tabs y sub-componentes.
- **SC-002**: `AdminReporteDetalle.tsx` queda bajo 400 líneas tras la extracción de secciones de UI.
- **SC-003**: `procesar/route.ts` queda bajo 400 líneas tras la extracción de helpers.
- **SC-004**: El 100% de los tests existentes de los archivos refactorizados pasa antes y después de cada extracción.
- **SC-005**: `npm run build`, `npm run lint` y `tsc --noEmit` no reportan errores tras cada refactor.
- **SC-006**: Cada User Story tiene un commit independiente con evidencia de tests verdes.

---

## Assumptions

- El comportamiento actual es correcto; el objetivo es reorganizar, no optimizar ni corregir bugs.
- Los tests existentes cubren los caminos principales de los archivos a refactorizar.
- No se agregan nuevas dependencias ni se cambia la configuración de compilación.
- No se modifica la lógica de negocio, ni se alteran contratos de API, ni se cambian nombres de rutas.
- El quickstart del proyecto sigue funcionando igual tras el refactor.
- No se tocan SPEC-050 ni SPEC-060 ni sus archivos.

---

## Implementación (documentado el 2026-07-20)

### Objetivo alcanzado
Dividir los archivos fuente más grandes del proyecto mediante refactor puro, manteniendo el comportamiento exacto y tests verdes entre cada extracción.

### Archivos refactorizados

| Archivo original | Líneas antes | Líneas después | Sub-componentes/helpers extraídos |
|------------------|--------------|----------------|-----------------------------------|
| `src/components/modules/ia/IaEvalManager.tsx` | 1095 | 40 | `src/components/modules/ia/eval/{types,format,LaboratorioTab,CasosTab,HistorialTab,ExperimentCard,NuevoExperimentoForm,ExperimentoDashboard,MetricCard,ComparadorExperimentos}` |
| `src/components/modules/AdminReporteDetalle.tsx` | 814 | 156 | `src/components/modules/reporte-detalle/{types,useReporteDetalle,ReporteDetalleHeader,ReporteDetalleInfo,TextoOriginalPanel,AccionesReporte}` |
| `src/app/api/reportes/procesar/route.ts` | 627 | 177 | `src/app/api/reportes/procesar/helpers/{errors,seguridad,embedding,duplicados,parametros,rafagas,clasificacion,anonimizacion,guardas,finalizacion}` |
| `src/components/modules/ConfigPanel.tsx` | 494 | 299 | `src/components/modules/config-panel/{types,ParamInput,ParamRow,ConfigSection,TimelineSection}` |
| `src/components/modules/AuditLogViewer.tsx` | 452 | 122 | `src/components/modules/audit-log/{types,AuditFilters,AuditTable}` |

### Tests ejecutados
- `npx tsc --noEmit`: ✅ sin errores
- `npm run lint`: ✅ sin errores
- `npm run test`: ✅ 94 test files, 540 tests passed
- `npm run test -- src/app/api/reportes/procesar/route.test.ts`: ✅ 16 tests passed
- `npm run build`: ✅ compiló sin errores
- `./scripts/dev-restart.sh`: ✅ healthcheck OK, un solo worker, db OK

### Decisiones de diseño
- Se mantuvieron los exports originales (`IaEvalManager`, `AdminReporteDetalle`, `POST`) para no romper imports existentes.
- Los archivos extraídos se agruparon por dominio en subcarpetas temáticas.
- No se modificó lógica de negocio, contratos de API ni schema de Prisma.
- Cada extracción se validó con `tsc`, `lint` y `test` antes del commit siguiente.

### Deuda técnica
- Los siguientes archivos > 400 líneas quedan pendientes para un siguiente ciclo de saneamiento:
  - `src/lib/circulo-confianza.ts` (862 líneas)
  - `src/app/dashboard/admin/comite/gestion/GestionPageClient.tsx` (708 líneas)
  - `src/app/dashboard/circulo-confianza/page.tsx` (649 líneas)
  - `src/app/dashboard/admin/operadores/gestion/page.tsx` (564 líneas)
  - `src/lib/ai/eval-runner.ts` (464 líneas)
  - `src/lib/ai/classifier.ts` (444 líneas)
- La deuda se documenta porque se priorizó la estabilidad y el comportamiento idéntico sobre la granularidad extrema.

### Migraciones
- Ninguna. El refactor es puramente de código fuente.

### Commits
- `0d4c5fa` SPEC-052 US1: dividir IaEvalManager.tsx en sub-componentes
- `d7e6623` SPEC-052 US2: dividir AdminReporteDetalle.tsx en sub-componentes
- `cd9d838` SPEC-052 US3: dividir procesar/route.ts en helpers
- `4143db8` SPEC-052 US4: dividir ConfigPanel y AuditLogViewer

