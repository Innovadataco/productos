> # Lote Nocturno 022-027 — Reporte consolidado

**Fecha**: 2026-07-18
**Rama**: `feature/001-scaffolding`
**Objetivo**: implementar las specs 022-027 en orden, con tests verdes, commits y despliegue.

---

## Estado del lote

| Spec | Título | Estado | Commit principal |
|------|--------|--------|------------------|
| 022 | Expediente interno de transiciones | ✅ COMPLETA | `85398cc` |
| 027 | Motor de encolamiento | ✅ COMPLETA | `137423a` |
| 025 | Anonimización reforzada + encriptación | ✅ COMPLETA | `7bbe701` |
| 023 | Estados de cara al usuario + SLA | ✅ COMPLETA | `a441c42` |
| 024 | Rol Comité de Validación + escalamiento | ✅ COMPLETA | `8703591` |
| 026 | Pipeline de spam | ✅ COMPLETA | `75df38d` |

Todas las specs fueron implementadas, testeadas y pusheadas. No hubo specs bloqueadas.

---

## Migraciones aplicadas

| Migración | Descripción |
|-----------|-------------|
| `20260718000000_add_transicion_reporte` | Enum `ResponsableTransicion` + tabla `TransicionReporte` + relaciones (Spec 022) |
| `20260718094450_add_reintento_reporte` | Tabla `ReintentoReporte` + relación en `Reporte` (Spec 027) |
| `20260718100846_add_anonimizacion_validacion` | Campos `anonimizacionValidadaPorId/En` en `Reporte` + valores en `AccionAudit` (Spec 025) |
| `20260718104515 → 20260718190000_add_rol_comite_validacion` | `COMITE_VALIDACION` en `RolUsuario`, `esComite` en `PerfilOperador`, `comiteId` en `Reporte`, tabla `SolicitudComite` (Spec 024). Renombrada manualmente para corregir orden de aplicación. |
| `20260718111049_add_spam_categoria` | `SPAM` en `CategoriaConducta` (Spec 026) |

Todas las migraciones se aplicaron con `prisma migrate dev` o `prisma migrate deploy`; nunca se usó `db push`.

---

## Resultados de la suite final

| Check | Resultado |
|-------|-----------|
| `npm run lint` | ✅ 0 errores; 1 warning preexistente en `src/lib/sms.ts` |
| `npx tsc --noEmit` | ✅ sin errores |
| `npm run build` | ✅ build exitosa |
| `npm run test` | ✅ **343 tests / 68 archivos** |
| `smoke-e2e.ts` | ✅ pasó (construcción + procesamiento worker + cola admin) |
| `smoke-apelaciones.ts` | ✅ pasó (Fase C completa) |
| `npm run smoke-e2e` | ⚠️ no existe en `package.json`; se ejecutó el script `scripts/smoke-e2e.ts` directamente |

---

## Commits del lote (más recientes primero)

```text
bf55ecc fix(smoke): apelaciones crea reporte anónimo sin cookie de admin
935e885 fix(027): procesamiento de reportes idempotente ante reintentos y concurrencia
e5d376e docs(lote-nocturno-022-027): reporte consolidado de implementación de specs 022-027
afa9edf SPEC-026: cierre.md con resumen y hash de commit
75df38d SPEC-026: endpoints y UI de revisión de spam
38ea88e SPEC-026: quitar heurística de contenido y ajustar clasificador para SPAM
5e25223 SPEC-026: schema, migración, seed y ajustes de tipos para SPAM
a7cbce6 docs(024): cierre de implementación Spec 024
8703591 test(024): tests integración comité y ajuste status 201 en creación de operadores
c31cf08 feat(024): UI bandeja del comité, navegación y acción escalar
070d6f6 feat(024): endpoints de escalamiento y bandeja del comité
4cb16a4 feat(024): endpoints operadores y reportes-revision soportan COMITE_VALIDACION
e34c105 feat(024): helpers auth/permisos/transiciones para rol COMITE_VALIDACION
34fb683 feat(024): schema + migración rol COMITE_VALIDACION, SolicitudComite y relaciones
4597fb8 docs(023): cierre.md con resumen, archivos tocados y resultados de tests
a441c42 feat(023): seccion UI en panel de configuracion para ui.sla_horas_procesamiento
3c05d2d feat(023): UI seguimiento y mis-reportes muestran estados simplificados + SLA
3b855a5 feat(023): endpoints seguimiento y mis-reportes filtran eliminados y exponen estado visual + SLA
c6c6c7d feat(023): agrega parametro ui.sla_horas_procesamiento en seed y utilidades de test
1b6019a feat(023): helper puro mapEstadoUsuario + mensaje SLA + tests unitarios
041563e spec-025: cierre.md con resumen, archivos y resultados de tests
7bbe701 spec-025: tests para cifrado, fugas PII, revelar original, validar anonimización y regex
3da413a spec-025: UI de detalle protege texto original; regex de auto-identificación del denunciante
cfba151 spec-025: endpoints revelar-original (admin) y validar-anonimización (operador/admin); cierra fugas PII en detalle
3c40e89 spec-025: cifrar textoOriginal en creación, procesamiento y anonimización manual
056515a spec-025: add anonimizacionValidadaPorId, anonimizacionValidadaEn y AccionAudit values
117ec80 docs(027): cierre.md con resumen, archivos y resultados de tests
137423a feat(027): worker registra intentos, fallback a revisión manual y drenaje de pendientes
... (commits anteriores de 027/022)
```

---

## Archivos principales tocados por spec

### Spec 022
- `prisma/schema.prisma`, `prisma/migrations/20260718000000_add_transicion_reporte/`
- `src/lib/reporte-transiciones.ts`, `src/lib/reporte-transiciones.test.ts`
- `src/app/api/admin/reportes/[id]/transiciones/route.ts` + test
- Integración en `procesar`, `confirmar`, `correcciones`, `anonimizar`, `reporte-lifecycle`

### Spec 027
- `prisma/schema.prisma`, `prisma/migrations/20260718094450_add_reintento_reporte/`
- `src/lib/queue.ts`, `src/lib/reporte-reintentos.ts`, `src/lib/queue.test.ts`
- `src/app/api/reportes/fallback/route.ts` + test
- `scripts/worker-reportes.mjs`
- `src/app/api/reportes/route.ts`, `src/app/api/reportes/procesar/route.ts`
- `src/components/modules/AdminReporteDetalle.tsx`

### Spec 025
- `prisma/schema.prisma`, `prisma/migrations/20260718100846_add_anonimizacion_validacion/`
- `src/app/api/admin/reportes/[id]/revelar-original/route.ts` + test
- `src/app/api/admin/reportes/[id]/validar-anonimizacion/route.ts` + test
- `src/app/api/admin/reportes-revision/[id]/route.ts` + test
- `src/lib/ai/pii-patterns.ts` + test
- `src/components/modules/AdminReporteDetalle.tsx`

### Spec 023
- `src/lib/reporte-estados-usuario.ts` + test
- `src/app/api/reportes/seguimiento/[numero]/route.ts` + test
- `src/app/api/reportes/mis-reportes/route.ts` + test
- `src/components/modules/SeguimientoClient.tsx`, `MisReportesList.tsx`
- `src/components/modules/ConfigPanel.tsx`
- `prisma/seed.ts`, `src/lib/reporte-test-utils.ts`

### Spec 024
- `prisma/schema.prisma`, `prisma/migrations/20260718190000_add_rol_comite_validacion/`
- `src/lib/auth.ts`, `src/lib/operadores/permisos.ts`, `src/lib/reporte-transiciones.ts`
- `src/app/api/admin/operadores/route.ts`, `src/app/api/admin/reportes/[id]/escalar/route.ts`
- `src/app/api/admin/comite/*` (pendientes, mias, asignar, resolver, reasignar) + test
- `src/app/dashboard/admin/comite/page.tsx`, `src/components/modules/ComiteBandeja.tsx`, `ComiteSolicitudDetalle.tsx`
- `src/components/modules/AdminNav.tsx`, `AdminReporteDetalle.tsx`

### Spec 026
- `prisma/schema.prisma`, `prisma/migrations/20260718111049_add_spam_categoria/`
- `src/lib/ai/classifier.ts`, `src/lib/scoring.ts`
- `src/app/api/reportes/route.ts`, `src/app/api/reportes/procesar/route.ts` + tests
- `src/app/api/admin/spam/pendientes/route.ts` + test
- `src/app/api/admin/spam/[id]/resolver/route.ts` + test
- `src/components/modules/SpamRevisionPanel.tsx`, `src/app/dashboard/admin/spam/page.tsx`
- `scripts/eval-classifier-*.ts` (8 archivos)
- `prisma/seed.ts` (ejemplos de spam)

---

## Deuda técnica y pendientes

### Cerrada en este lote
- Ninguna deuda crítica quedó sin documentar; los únicos atajos fueron documentados explícitamente.

### Pendiente documentada para revisión futura

| Severidad | Ítem | Spec | Notas |
|-----------|------|------|-------|
| Baja | UI de timeline de transiciones en detalle de caso | 022 | El endpoint existe; falta componente visual. Esfuerzo bajo. |
| Baja | Alerta cuando jobs pendientes superen umbral crítico | 027 | Queda para fase de monitoreo. |
| Baja | Notificación por email al comité ante nuevas solicitudes | 024 | Mejora futura; la bandeja cubre los escenarios. |
| Baja | Dashboard de métricas del comité | 024 | No requerido por el quickstart. |
| Media | Refinamiento de regex de auto-identificación del denunciante | 025 | Cubre casos comunes; se propone evaluar Presidio como tercera capa en SPEC-050. |
| Media | Evaluación de integración de Presidio para PII | 025 | Debe probarse en el laboratorio de IA antes de activar. |
| Baja | `SCHOOL_ADMIN` no puede revelar original ni validar anonimización | 025 | Política de tenant a revisar. |
| Baja | Warning preexistente de eslint en `src/lib/sms.ts` | General | No relacionado con este lote. |

### Atajo técnico documentado
- Renombrado manual de la migración `20260718104515_add_rol_comite_validacion` a `20260718190000...` para corregir orden de aplicación en el shadow database. El SQL no cambió; el renombrado se hizo en `_prisma_migrations` de los entornos locales. En producción esto no debería repetirse: la migración ya tiene el nombre correcto en el repo.

---

## Decisiones de producto tomadas durante la implementación

1. **Baja de spam confirmado**: se usa `motivoBaja = RETIRO_LIMPIEZA` y se registra el ejemplo en `DatasetEntrenamiento` con `fuente = spam_revisado`.
2. **Corrección por comité**: se reutiliza `CorreccionAdmin.adminId` para guardar el responsable del comité; el audit y la transición indican que fue el comité.
3. **Exclusividad OPERADOR/COMITE**: se valida en el endpoint de creación y se usa `esComite` como flag de filtrado. No se permite cambiar de rol vía PATCH.
4. **Revelación de texto original**: solo `ADMIN` puede hacerlo; `OPERADOR` valida anonimización pero no ve el original.
5. **Backpressure**: nuevos reportes quedan en `PENDIENTE` sin encolar si se alcanza `worker.max_pendientes`; se drenan cuando baja la carga.

---

## Correcciones post-implementación (validación en vivo)

Durante el despliegue y la ejecución de los smoke tests se detectó y corrigió una condición de carrera en el procesamiento de reportes (Spec 027):

- **Problema**: `POST /api/reportes/procesar` fallaba con `Unique constraint failed on (reporteId)` en `EmbeddingReporte`/`ClasificacionIA` cuando el worker y el smoke test procesaban el mismo reporte concurrentemente, o cuando pg-boss reintentaba un job. Esto dejaba el reporte en `REVISION_MANUAL` y rompía el smoke test.
- **Causa**: el endpoint insertaba embedding y clasificación sin verificar si ya existían, y asumía que el estado anterior siempre era `PROCESANDO` en la transición final.
- **Fix** (commit `935e885`):
  - Verificar existencia de `EmbeddingReporte` antes de insertar.
  - Envolver `ClasificacionIA.create` en try/catch `P2002` y reutilizar la clasificación existente.
  - Leer el estado actual del reporte dentro de la transición final; si ya está en estado final, devolverlo sin duplicar transición.
- **Fix de smoke test** (commit `bf55ecc`): `scripts/smoke-apelaciones.ts` crea el primer reporte sin enviar la cookie de admin, para que el endpoint lo trate como anónimo tras el bloqueo de usuarios internos de la Spec 021.

Resultado: ambos smoke tests (`smoke-e2e.ts` y `smoke-apelaciones.ts`) pasan contra la app desplegada en `:5005`.

---

## Despliegue

- Build de producción generada exitosamente (`npm run build`).
- App reiniciada en `http://localhost:5005` (PID 64752).
- Worker reiniciado vía `npm run worker` (supervisor + worker de pg-boss). Ollama health: OK.
- Validación en vivo:
  - `GET /api/health/worker` → `{"status":"ok","workerAlive":true,"dbOk":true}`.
  - `scripts/smoke-e2e.ts` → ✅ pasó.
  - `scripts/smoke-apelaciones.ts` → ✅ pasó.

---

## Veredicto

El lote 022-027 está implementado, testeado, desplegado y validado en vivo. Suite verde (343 tests), smoke tests verdes, todos los artefactos de cierre publicados y la deuda técnica residual documentada.
