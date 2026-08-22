> # Research: SPEC-235 · Guías de acción parametrizables

**Date**: 2026-08-22
**Feature**: specs/235-guias-accion-parametrizables/spec.md

---

## Decisions

### D1: Patrón DAL Q-3

**Decision**: Todo acceso a `GuiaAccionCategoria` pasa por `src/lib/dal/repositories/guia-accion-repository.ts`, inyectando `DbClient` opcional para transacciones.

**Rationale**: El proyecto adoptó el patrón DAL (SPEC-053). Ejemplos existentes como `src/lib/dal/repositories/block-list.ts` y `audit-log.ts` reciben `tx?: Prisma.TransactionClient` y usan `this.db = tx ?? prisma`. Esto permite compartir unidad de trabajo y testear con transacciones.

**Components**:
- `src/lib/dal/repositories/block-list.ts`
- `src/lib/dal/repositories/audit-log.ts`
- `src/lib/dal/unit-of-work.ts`
- `src/lib/prisma.ts`

### D2: Migración aditiva con índice parcial

**Decision**: La unicidad parcial "solo una guía ACTIVA por categoría" se implementa con SQL manual en la migración, no en `schema.prisma`.

**Rationale**: Prisma no soporta `WHERE` en `@@unique`/`@@index`. El proyecto ya usa migraciones SQL manuales para enums y constraints avanzados. Es una migración `CREATE UNIQUE INDEX ... WHERE`, aditiva y no destructiva.

### D3: Rate-limit reutilizado

**Decision**: El endpoint público usa el rate-limit existente basado en PostgreSQL (`src/lib/rate-limit.ts`) con un scope nuevo.

**Rationale**: La constitución §6.4 y specs recientes (SPEC-184) usan rate-limit configurado por `ParametroSistema`. Reutilizarlo evita duplicar lógica y mantiene el comportamiento fail-open. El scope será `guias_accion_publica`.

### D4: Seed idempotente

**Decision**: El seed consulta existencia de guías antes de insertar las 8 guías preliminares.

**Rationale**: Especs recientes (SPEC-184, SPEC-190) enfatizan seed idempotente. El patrón estándar es `upsert` o `findFirst` + `create` condicional. Para guías, se prefiere no hacer `update` para no pisar contenido editado; solo se crean las faltantes.

### D5: JSON estructurado con validación Zod

**Decision**: Los arrays de pasos, botones y votos se almacenan como `Json` y se validan con Zod en las rutas API.

**Rationale**: El proyecto está migrando a Zod (constitución §6.2). Campos JSON estructurados se usan en `AuditLog.metadatos` y otros modelos. La validación Zod garantiza la forma sin sacrificar flexibilidad de almacenamiento.

### D6: Layout de configuración admin

**Decision**: La pantalla `/dashboard/admin/configuracion/guias-accion` reutiliza el layout existente de configuración (`/dashboard/admin/configuracion/*`).

**Rationale**: Mantiene coherencia de navegación y permisos. Especs anteriores (D-72) definen secciones "Ámbar" (administración) y "Cielo" (preview). El preview de guía puede compartir componente con la futura vista pública.

---

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Tablas relacionales para pasos y botones | Añadiría 2-3 tablas pequeñas con joins innecesarios; el contenido es de lectura frecuente y escritura controlada. |
| UUID de versión en lugar de secuencial | Más complejo para seed y para mostrar "v1/v2" internamente; el secuencial es suficiente. |
| Aprobación con tabla relacional `VotoGuiaAccion` | Sobre-diseño para un array simple de votos; se documenta como punto de extensión futuro. |
| Rate-limit en memoria | Rompe con el patrón de `src/lib/rate-limit.ts` y no es configurable por `ParametroSistema`. |
| Implementar la vista padre en esta spec | Fuera de scope; la vista pública es SPEC-232, las notificaciones SPEC-236. |
| Permitir que SCHOOL_ADMIN cree guías | Violía el alcance "ADMIN writes"; las guías son globales y requieren rol de plataforma. |

---

## Open Questions

1. **[PENDIENTE]** ¿El endpoint de preview debe devolver exactamente el mismo payload que el público, o incluye metadatos admin (estado, votos)?
   - **Propuesta**: mismo shape público + `estado` y `versionSecuencial` para contexto admin; no incluye `aprobadaPorComiteJson` detallado.
2. **[PENDIENTE]** ¿Al crear una nueva versión se copia el contenido de la guía activa anterior como punto de partida?
   - **Propuesta**: sí, el endpoint de "nueva versión" clona la última `ACTIVA` o `REEMPLAZADA` en `BORRADOR` con `versionSecuencial + 1`.
3. **[PENDIENTE]** ¿El seed debe publicar las guías como `ACTIVA` o como `PENDIENTE_APROBACION_COMITE`?
   - **Propuesta**: `ACTIVA` v1, dado que el comité puede no estar configurado en entornos iniciales; se marca explícitamente como contenido preliminar pendiente de revisión.

