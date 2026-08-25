# Implementation Plan: Middleware de vigencia + guardas por layout + banner ámbar EN_GRACIA

**Branch**: `work/002-PI-145` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/242-middleware-vigencia/spec.md`

---

## Summary

Implementar la guarda de vigencia del modelo SaaS en los layouts de dashboard de padres y colegios. La guarda consume el estado de `Suscripcion` (SPEC-213), permite el acceso cuando el estado es `ACTIVA`, inyecta un banner ámbar cuando es `EN_GRACIA`, y redirige a `/dashboard/<rol>/suscripcion` en cualquier otro caso (incluyendo la ausencia de suscripción). Se extiende el enum `EstadoSuscripcion` con `PENDIENTE_AUTORIZACION` de forma aditiva. No se introduce un `middleware.ts` global: las guardas viven en los Server Components de layout, manteniendo coherencia con el resto del proyecto. El encadenamiento con SPEC-241 se respeta: `/consentimiento`, `/perfil`, `/suscripcion` y `/reportar` nunca son bloqueados por vigencia.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Next.js 16.2.10 App Router, Prisma 5.22.0, `date-fns-tz`, Tailwind CSS 3.4 |
| **Storage** | PostgreSQL 16+ (Docker Compose) |
| **Testing** | Vitest + jsdom + `@testing-library/react`; Playwright E2E |
| **Target Platform** | Docker Compose en Mac Studio / VPS |
| **Project Type** | Web application (full-stack Next.js) |
| **Performance Goals** | Decisión de vigencia < 50 ms; redirección < 100 ms; banner sin CLS |
| **Constraints** | Sin `middleware.ts` global (D-72); sin tocar `src/lib/ai/**`; sin tocar módulos verticales; timezone Bogotá (D-69); migración aditiva |
| **Scale/Scope** | ~1 migración aditiva (enum), ~1 helper nuevo, ~2 layouts modificados, ~1 layout/reporte nuevo, tests unitarios + integración |

---

## Constitution Check

*GATE: Must pass before implementation.*

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto — sin multimedia | ✅ Pass | Solo lógica de guarda y banner de texto |
| §1.3 Presunción de inocencia | ✅ Pass | No afecta consulta pública |
| §1.4 Umbral parametrizable | ✅ Pass | No se modifica lógica de consulta pública |
| §2.1 Stack heredado (Next.js, Prisma, JWT manual) | ✅ Pass | Reutiliza `verifyToken`, layouts Server Components |
| §2.2 Roles (PARENT, SCHOOL_ADMIN, etc.) | ✅ Pass | Solo afecta `/dashboard/padre/**` y `/dashboard/colegio/**` |
| §2.3 Multi-tenant | ✅ Pass | `Suscripcion` ya está vinculada a usuario/colegio |
| §2.4 Modelo SaaS | ✅ Pass | Consume motor de vigencia de SPEC-213 |
| §3.1 TypeScript strict (no `any`) | ✅ Pass | Filtros Prisma tipados |
| §3.4 Códigos HTTP correctos | ✅ Pass | No expone stack traces; redirecciones por `redirect()` |
| §3.5 Logs y auditoría | ✅ Pass | `AuditLog` en `/reportar` sin suscripción activa |
| §3.6 Límites de tamaño | ✅ Pass | No recibe input de usuario en la guarda |
| §4.1 Singletons (Prisma, pg-boss) | ✅ Pass | No se toca |
| §4.2 Rutas API individuales | ✅ Pass | No se crean endpoints nuevos |
| §4.3 Paginación estándar | ✅ Pass | No aplica |
| §6.1 JWT en cookie httpOnly | ✅ Pass | Reutiliza cookies existentes |
| §6.3 Protección de datos sensibles | ✅ Pass | No se almacenan datos nuevos sensibles |

**Additional checks**:
- ✅ No se toca `src/lib/ai/**` (candado innegociable).
- ✅ No se tocan módulos verticales `comite/**`, `bandeja/**`, `alertas/**`, `cursos/**`, `expedientes/**`.
- ✅ Migración aditiva: solo agrega un valor al enum `EstadoSuscripcion`; cero DROP/rename.
- ✅ No se crean rutas paralelas ni clones de layout.

---

## Project Structure

### Documentation (this feature)

```text
specs/242-middleware-vigencia/
├── spec.md              # Feature specification
├── plan.md              # This file
├── data-model.md        # Detalle de migración aditiva del enum
├── quickstart.md        # Pasos de prueba manual
├── contracts/
│   └── vigencia.md      # Comportamiento de la guarda por rol/estado
└── tasks.md             # Tareas speckit (TDD ordenado)
```

### Source Code (repository root)

```text
002-2026-PROTECCION-INFANTIL/
├── prisma/
│   ├── schema.prisma                                    # + valor PENDIENTE_AUTORIZACION en EstadoSuscripcion
│   └── migrations/YYYYMMDDHHMMSS_vigencia_middleware/   # migración aditiva SQL
│       └── migration.sql
├── src/
│   ├── app/
│   │   ├── dashboard/
│   │   │   ├── padre/
│   │   │   │   └── layout.tsx                         # + guarda de vigencia + banner EN_GRACIA
│   │   │   ├── colegio/
│   │   │   │   └── layout.tsx                         # + guarda de vigencia (reemplaza/encadena verificarVigenciaColegio)
│   │   │   └── layout.tsx                             # sin cambios salvo encadenamiento si aplica
│   │   └── reportar/
│   │       └── layout.tsx                             # NUEVO: log de acceso sin suscripción activa
│   ├── components/
│   │   └── modules/
│   │       └── BannerVigencia.tsx                     # wrapper sobre Alerta (solo si no existe slot adecuado)
│   └── lib/
│       ├── pagos/
│       │   ├── vigencia-middleware.ts                 # helper puro: resolver estado, exenciones, redirección, banner
│       │   └── vigencia-middleware.test.ts            # tests unitarios por estado y frontera timezone
│       └── dal/repositories/
│           └── pagos-repository.ts                    # + obtenerSuscripcionActivaPorUsuarioId / obtenerSuscripcionPorUsuarioId
└── src/app/dashboard/padre/layout.test.tsx            # tests de integración de layout (si no existe)
```

**Structure Decision**: Las guardas se implementan en layouts Server Components, no en `middleware.ts`, para mantener el patrón vigente (`PadreLayout`, `ColegioLayout`) y evitar duplicar lógica de autenticación. Se reutiliza `Alerta` del design system para el banner ámbar. El helper `vigencia-middleware.ts` es puro de Next.js/Prisma y puede testearse unitariamente sin montar componentes.

---

## Implementation Phases

### Phase 0 — Preparación (sin cambios de producción)

- **T001 [P0]**: Leer en fuente `src/app/dashboard/padre/layout.tsx`, `src/app/dashboard/colegio/layout.tsx`, `src/lib/colegio/vigencia.ts`, `src/lib/dal/repositories/pagos-repository.ts`, `src/lib/dal/repositories/pagos-vigencia-repository.ts`, `src/components/ui/Alerta.tsx` (o equivalente) y `prisma/schema.prisma`.
- **T002 [P0]**: Confirmar que `date-fns-tz` está en `dependencies`; si no, agregarlo (sin version ranges).
- **T003 [P0]**: Ejecutar `npx tsc --noEmit`, `npm run lint` y `npm run test` en alcance base para conocer estado previo.

### Phase 1 — Schema y migración aditiva

- **T010 [P1]**: Editar `prisma/schema.prisma`: agregar `PENDIENTE_AUTORIZACION` al enum `EstadoSuscripcion`.
- **T011 [P1]**: Crear migración aditiva manual `prisma/migrations/YYYYMMDDHHMMSS_vigencia_middleware/migration.sql` con `ALTER TYPE "EstadoSuscripcion" ADD VALUE 'PENDIENTE_AUTORIZACION';`.
- **T012 [P1]**: Ejecutar `npx prisma migrate dev` localmente y regenerar cliente Prisma.
- **T013 [P1]**: Crear `specs/242-middleware-vigencia/data-model.md` documentando el cambio de enum.

### Phase 2 — Helper de vigencia (puro, testeable)

- **T020 [P2]**: Extender `PagosRepository` con:
  - `obtenerSuscripcionPorUsuarioId(usuarioId: string)` → última suscripción del usuario (cualquier estado).
  - `obtenerSuscripcionActivaPorUsuarioId(usuarioId: string)` → suscripción cuyo `estado` sea `ACTIVA` o `EN_GRACIA`, orden descendente por `fechaInicio`.
- **T021 [P2]**: Crear `src/lib/pagos/vigencia-middleware.ts` exportando funciones puras:
  - `resolverEstadoVigencia(suscripcion, ahoraBogota)` → retorna `ACTIVA | EN_GRACIA | SUSPENDIDA | CANCELADA | PENDIENTE_AUTORIZACION | SIN_SUSCRIPCION`.
  - `esRutaExenta(pathname: string, rol: RolUsuario)` → true para `/consentimiento`, `/perfil`, `/suscripcion`, `/reportar` (solo `PARENT`).
  - `redireccionSuscripcion(rol: RolUsuario)` → `/dashboard/padre/suscripcion` o `/dashboard/colegio/suscripcion`.
  - `debeMostrarBanner(estado)` → true solo para `EN_GRACIA`.
  - `mensajeParaEstado(estado)` → mensaje descriptivo neutro.
- **T022 [P2]**: Usar `date-fns-tz` (`toZonedTime`, `isPast`, `startOfDay`, etc.) para todas las comparaciones de fecha en `America/Bogota`; prohibido `new Date()` para decisiones de vigencia.
- **T023 [P2]**: Crear `src/lib/pagos/vigencia-middleware.test.ts` con tests unitarios para cada estado, rutas exentas y 3 escenarios de frontera de medianoche en Bogotá.

### Phase 3 — Integración en layouts

- **T030 [P3]**: Modificar `src/app/dashboard/padre/layout.tsx`:
  - Tras la guarda de sesión, cargar la suscripción activa del usuario con `PagosRepository`.
  - Si la ruta actual es exenta, permitir sin bloqueo.
  - Si `resolverEstadoVigencia` indica `ACTIVA`, continuar.
  - Si indica `EN_GRACIA`, inyectar `<Alerta>` ámbar en la parte superior del layout.
  - En cualquier otro estado, `redirect(redireccionSuscripcion("PARENT"))`.
- **T031 [P3]**: Modificar `src/app/dashboard/colegio/layout.tsx`:
  - Reemplazar o encadenar la llamada a `verificarVigenciaColegio` por la nueva guarda basada en `Suscripcion`.
  - Aplicar la misma lógica de exenciones, banner y redirección que en padre.
  - Si no existe suscripción, redirigir a `/dashboard/colegio/suscripcion`.
- **T032 [P3]**: Crear `src/components/modules/BannerVigencia.tsx` solo si `Alerta` no expone `variant="warning"` o equivalente; de lo contrario, usar `Alerta` directamente en los layouts.
- **T033 [P3]**: Asegurar que `/consentimiento` quede en la lista de rutas exentas antes de que SPEC-241 mergee, evitando doble redirect.

### Phase 4 — Guarda de `/reportar` y auditoría

- **T040 [P4]**: Crear `src/app/reportar/layout.tsx` (Server Component):
  - Lee cookie `__Host-token`/`token`; si no hay sesión, renderiza `children` (acceso anónimo).
  - Si el usuario autenticado es `PARENT`, carga su suscripción activa.
  - Si no tiene suscripción activa, escribe `AuditLog` con `accion: 'reporte-sin-suscripcion'` y `entidad: 'reporte'`; luego renderiza `children`.
- **T041 [P4]**: Verificar que `AuditLog.accion` acepte el valor `'reporte-sin-suscripcion'` (string); si no, extender aditivamente el enum `AccionAudit`.
- **T042 [P4]**: Test de integración para `src/app/reportar/layout.tsx`: usuario `PARENT` sin suscripción genera exactamente un `AuditLog`; usuario anónimo no genera log.

### Phase 5 — Página `/dashboard/<rol>/suscripcion` placeholder

- **T050 [P5]**: Crear `src/app/dashboard/padre/suscripcion/page.tsx` como placeholder mínimo (mensaje + logout).
- **T051 [P5]**: Crear `src/app/dashboard/colegio/suscripcion/page.tsx` como placeholder mínimo.
- **T052 [P5]**: Garantizar que estas páginas sean exentas de la guarda de vigencia (la propia guarda nunca redirige a sí misma).

### Phase 6 — Validación y cierre

- **T060 [P6]**: Ejecutar `npx tsc --noEmit`.
- **T061 [P6]**: Ejecutar `npm run lint`.
- **T062 [P6]**: Ejecutar `npm run test` (alcance 242 + suite completo documentando fallos ajenos).
- **T063 [P6]**: Ejecutar `npm run build`.
- **T064 [P6]**: Ejecutar `./scripts/dev-restart.sh`.
- **T065 [P6]**: Probar flujo con `quickstart.md`.
- **T066 [P6]**: Regenerar `docs/architecture/` si el cambio altera schema o navegación (SPEC-126), dejando `npm run arch:check` en verde.
- **T067 [P6]**: Crear `specs/242-middleware-vigencia/quickstart.md` y `specs/242-middleware-vigencia/tasks.md` con evidencia.

---

## Complexity Tracking

No se identifican violaciones a la constitución ni complejidad que requiera justificación adicional. El diff se limita a:

- 1 migración aditiva de enum (`EstadoSuscripcion` +1 valor).
- 1 helper puro de vigencia con tests unitarios.
- 2 layouts modificados (padre y colegio) + 1 layout nuevo (`/reportar`).
- 2 páginas placeholder de suscripción.
- 1 extensión mínima de `PagosRepository`.
- 1 registro de `AuditLog` en ruta pública.

**Decisiones técnicas documentadas**:

1. **No `middleware.ts` global**: las guardas viven en layouts Server Components, igual que `PadreLayout`/`ColegioLayout`. Esto evita duplicar autenticación y mantiene coherencia con SPEC-241.
2. **Fuente única de vigencia**: se consume `Suscripcion.estado` (SPEC-213). El helper solo recalcula el estado efectivo a partir de `fechaFin`/`fechaCorteProgramado` en `America/Bogota` como salvaguarda de frontera, sin reemplazar al worker de vigencia.
3. **Estado `PENDIENTE_AUTORIZACION`**: se agrega al enum `EstadoSuscripcion` aditivamente para representar una suscripción creada pero aún no activada por admin/pago.
4. **Banner ámbar**: se reutiliza `Alerta` del design system; solo se crea `BannerVigencia` si el componente base no soporta la variante warning.
5. **Exenciones explícitas**: `/consentimiento`, `/perfil`, `/suscripcion` y `/reportar` (solo `PARENT`) nunca se bloquean, evitando loops de redirección.
6. **AuditLog en `/reportar`**: se registra el acceso de un padre sin suscripción activa como traza de operación, no como bloqueo, respetando que la ruta sigue siendo pública.
