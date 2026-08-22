# Plan — SPEC-235 · Guías de acción parametrizables

## Decisiones de diseño

### D1: Modelo global sin `tenantId`

**Decisión**: `GuiaAccionCategoria` no lleva `tenantId`.

**Rationale**: las guías son contenido editorial de la plataforma, no datos de una institución. Aplican a todos los usuarios. Esto simplifica el endpoint público y evita duplicar contenido por colegio.

### D2: Versionado secuencial simple

**Decisión**: `versionSecuencial` es un entero autoincremental manual por categoría, no un UUID ni semver.

**Rationale**: el usuario final no ve el número; sirve para trazabilidad interna y para que el seed sepa si ya existe una v1. La nueva versión copia el contenido de la guía activa anterior (opcional) o se crea desde cero, y suma 1 al máximo existente de la categoría.

### D3: Estado como enum Prisma + índice parcial SQL

**Decisión**: usar `EstadoGuiaAccion` enum nativo de Prisma, pero la restricción de unicidad parcial se crea con SQL manual en la migración.

**Rationale**: Prisma no genera índices únicos condicionales. La migración manual es aditiva, no destructiva, y garantiza la regla de negocio a nivel de base de datos.

### D4: JSON validados con Zod, almacenados como Json

**Decisión**: `pasosJson`, `botonesAccionJson` y `aprobadaPorComiteJson` son tipo `Json` de Prisma; la validación estructural ocurre en las rutas API con Zod.

**Rationale**: evita tablas relacionales pequeñas con muchos joins para estructuras fijas y de lectura frecuente. La validación Zod impide datos corruptos y permite mensajes de error claros.

### D5: Aprobación por comité con votos en JSON

**Decisión**: los votos se guardan en `aprobadaPorComiteJson` en lugar de una tabla relacional aparte.

**Rationale**: la entidad de aprobación es simple (usuario, email, nombre, timestamp) y su ciclo de vida está acotado a la guía. Evita una tabla adicional y un join. Si en el futuro se requieren aprobaciones complejas (comentarios, adjuntos), se puede normalizar.

### D6: Reemplazo de guía activa en la misma transacción

**Decisión**: al publicar la nueva guía (`ACTIVA`), la guía activa anterior de la misma categoría pasa a `REEMPLAZADA` dentro de la misma transacción.

**Rationale**: mantiene la invariante "una sola ACTIVA" y evita ventanas donde no haya guía activa o haya dos. El índice único parcial refuerza la atomicidad.

### D7: Rate-limit público con scope propio

**Decisión**: el endpoint público usa el rate-limit existente de PostgreSQL con un scope nuevo `guias_accion_publica`.

**Rationale**: reutiliza la infraestructura de rate-limit del proyecto (fail-open, configurable por `ParametroSistema`) sin introducir dependencias nuevas.

### D8: Seed idempotente conservador

**Decisión**: el seed solo crea las 8 guías v1 si NO existe ninguna guía `ACTIVA` (o cualquier guía) para esa categoría. Si existe, no sobrescribe.

**Rationale**: protege el contenido editado por los administradores y el comité contra reejecuciones accidentales del seed.

### D9: Panel admin con layout config existente

**Decisión**: `/dashboard/admin/configuracion/guias-accion` reutiliza el layout de configuración admin; `/dashboard/admin/comite/guias-pendientes` se añade como sección en la bandeja del comité.

**Rationale**: consistencia visual y de permisos; no se inventa nueva navegación. El preview comparte componente con la vista pública futura (SPEC-232).

---

## Herramientas

- **Reutilizar**: `PrismaClient` singleton, patrón DAL Q-3, `ParametroSistema`, `AuditLog`, `rate-limit.ts`, `errors.ts` (`AppError`), Zod, layout de configuración admin, componentes de UI existentes.
- **Nueva**: `src/lib/dal/repositories/guia-accion-repository.ts`, validadores Zod para guías, helpers de transición de estado.

## Dependencias

- Requiere el rol `COMITE_VALIDACION` existente (SPEC-024).
- Requiere el patrón DAL Q-3 y `unit-of-work.ts` (SPEC-053).
- Requiere `ParametroSistema` para el umbral de aprobación.
- La vista padre que consumirá el endpoint público se implementa en SPEC-232; esta spec solo entrega la API y el contenido.
- Las notificaciones al comité de guías pendientes se implementan en SPEC-236; esta spec no las dispara.

## Fases

1. **Schema y migración**: crear `EstadoGuiaAccion`, modelo `GuiaAccionCategoria`, relación inversa en `Usuario`, valores de `AccionAudit`, índice único parcial SQL, parámetro `padre.comite.miembros_minimos_aprobacion`.
2. **DAL**: implementar `GuiaAccionRepository` con operaciones CRUD, transiciones, conteo de votos, reemplazo de activa, consulta pública.
3. **Validadores Zod**: schemas para creación, edición, pasos, botones y votos.
4. **Endpoints admin**: POST, PATCH, enviar-comite, aprobar, rechazar, preview.
5. **Endpoint público**: `GET /api/publico/guia-accion/categoria/[cat]` con rate-limit.
6. **UI admin**: pantalla de configuración de guías (listado, editor, preview) y sección de aprobación en comité.
7. **Seed**: 8 guías ACTIVA v1 idempotentes, con regla D-80 en GROOMING y marca de contenido preliminar.
8. **Tests**: unitarios del repositorio/DAL, integración de endpoints, test del índice parcial, test de transiciones, test de aprobación multi-miembro, test de rate-limit, test de seed idempotente.
9. **Cierre**: artefactos Spec-Kit, gate local, commit y señal.

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Índice parcial no se crea correctamente y permiten dos guías ACTIVA | Alto | Migración SQL manual revisada; test de integración que fuerza la colisión y espera `P2002`/409. |
| Transición de estados incorrecta publica una guía sin votos suficientes | Alto | Servicio centraliza `transicionarEstadoGuia`; assert previo al umbral; tests de estado. |
| Seed sobrescribe contenido aprobado por el comité | Medio | Seed consulta existencia antes de insertar; test de idempotencia que verifica no overwrite. |
| Rate-limit falla y bloquea todo el tráfico público | Medio | Fail-open heredado de `rate-limit.ts`; log de advertencia. |
| JSON de pasos/botones crece desordenado | Bajo | Zod estricto con tipos literales; test de validación de estructura. |
| Confusión con Comité de Convivencia del colegio | Medio | Documentar explícitamente que la aprobación es rol `COMITE_VALIDACION` de plataforma, no `COMITE_CONVIVENCIA`. |
