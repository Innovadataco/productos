# Implementation Plan: Padre v2 · Modelos Expediente + Evento (SPEC-230 / 002-PI-130)

**Branch**: `[work/002-pi-130]` | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)

**Input**: Instructivo 002-PI-130 — alcance exacto de modelos `Expediente` / `EventoExpediente`, enums, extensión de `TipoRevisionComite`, seed de 18 parámetros `padre.*` y repositorio DAL.

---

## Summary

Depositar la capa de datos del expediente padre en `prisma/schema.prisma` de forma 100% aditiva, crear la migración correspondiente, sembrar los 18 parámetros de configuración `padre.*` de manera idempotente e implementar el repositorio DAL `expediente-repository.ts` con transacciones atómicas para garantizar orden secuencial monotónico de eventos. Esta SPEC **no** incluye UI, endpoints públicos, motor de scoring ni cambios en `src/lib/ai/**` ni en el modelo `Reporte`.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Next.js 16.2.10 App Router, Prisma 5.22.0, `jose`, `bcryptjs` |
| **Storage** | PostgreSQL 16+ con pgvector (Docker Compose) |
| **Testing** | Vitest + jsdom + `@testing-library/react` |
| **Target Platform** | Docker Compose en Mac Studio / VPS |
| **Project Type** | Web application (full-stack Next.js) |
| **Performance Goals** | Creación de expediente < 200 ms; listado de expedientes paginado < 150 ms |
| **Constraints** | Migraciones aditivas sin DROP/rename; frontera DAL Q-3; sin tocar `src/lib/ai/**`; sin modificar modelo `Reporte`; todos los `DateTime` de momento con `@db.Timestamptz(6)` (timezone Bogotá) |
| **Scale/Scope** | 2 modelos nuevos, 2 enums nuevos, 1 valor de enum extendido, 18 parámetros sembrados, 1 repositorio DAL, tests unitarios + seed |

---

## Constitution Check

*GATE: Must pass antes de escribir código. Re-check tras diseño.*

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto — sin multimedia | ✅ Pass | `Expediente`/`EventoExpediente` solo almacenan texto, identificadores y metadatos JSON. |
| §1.3 Presunción de inocencia | ✅ Pass | No hay veredictos en el modelo; el identificador se describe estadísticamente. |
| §1.4 Umbral parametrizable en BD | ✅ Pass | Los 18 parámetros `padre.*` se configuran en `ParametroSistema`. |
| §1.5 IA local / no scoring de personas | ✅ Pass | No se toca `src/lib/ai/**`; el score de gravedad se calcula sobre conductas, no sobre individuos. |
| §1.6 Disputas (Ley 1581) | ✅ Pass | El expediente es auditado; futura apelación puede derivar en anonimización/cierre. |
| §2.1 Stack heredado | ✅ Pass | Prisma + PostgreSQL + App Router; sin cambios de stack. |
| §3.1 TypeScript strict (no `any`) | ✅ Pass | Tipos Prisma explícitos; filtros dinámicos con `Prisma.ExpedienteWhereInput`. |
| §3.4 Códigos HTTP correctos | ✅ Pass | Aplica a futuros endpoints; repository retorna errores canónicos vía `AppError`. |
| §3.5 Logs y auditoría | ✅ Pass | Mutaciones críticas registrarán `AuditLog`; logs no incluyen texto de reporte. |
| §4.1 Singletons (Prisma) | ✅ Pass | Repository reutiliza singleton de `src/lib/prisma.ts`. |
| §4.3 Paginación estándar | ✅ Pass | `listarExpedientesDePadre` implementará `page`/`pageSize`. |
| §6.3 Protección de datos sensibles | ✅ Pass | El texto del evento es texto plano descriptivo; identificadores se manejan igual que en `Reporte`. |

**Re-check post-design**: All gates still pass. No violations.

---

## Project Structure

### Documentation (this feature)

```text
specs/230-padre-v2-modelos-expediente-evento/
├── spec.md              # Feature specification (P1/P2 stories, FRs, ACs)
├── plan.md              # This file
├── data-model.md        # Modelo de datos exacto
├── quickstart.md        # Guía de validación local
├── contracts/           # (vacío en esta fase; no hay endpoints públicos)
└── checklists/
    └── requirements.md  # Quality checklist
```

### Source Code (repository root)

```text
002-2026-PROTECCION-INFANTIL/
├── prisma/
│   ├── schema.prisma              # Modelos Expediente, EventoExpediente, enums
│   ├── migrations/                # Migración aditiva generada + ajustada manual
│   └── seed.ts                    # Bloque seedParametrosPadre() con 18 upserts
├── src/
│   └── lib/
│       └── dal/
│           └── repositories/
│               ├── expediente-repository.ts      # DAL principal
│               └── expediente-repository.test.ts # Tests unitarios + TX
└── vitest.config.ts
```

**Structure Decision**: Single Next.js project, full-stack App Router. El repositorio DAL es la única capa que importa Prisma para estas entidades; servicios/endpoints futuros importan el repositorio.

---

## Design Decisions

### 1. Orden secuencial monotónico dentro de un expediente

`EventoExpediente.ordenSecuencial` se garantiza mediante una transacción PostgreSQL que:

1. Bloquea la fila del `Expediente` (`SELECT ... FOR UPDATE` vía `prisma.expediente.update` trivial o `findUnique` con select).
2. Calcula el siguiente orden como `MAX(ordenSecuencial) + 1` para ese `expedienteId`.
3. Inserta el `EventoExpediente` (y el `Reporte` vinculado si aplica) dentro de la misma transacción.

La restricción `@@unique([expedienteId, ordenSecuencial])` actúa como candado de última línea. Esto previene huecos ocasionales por rollback y evita condiciones de carrera entre eventos concurrentes sobre el mismo expediente.

### 2. `crearExpediente` vs `agregarEvento`

- **`crearExpediente`**: abre un expediente nuevo vinculado a un padre (`Usuario` con rol `PARENT`) y un identificador reportado. Estado inicial `ACTIVO`, score `VERDE`, `numEventos = 0`.
- **`agregarEvento`**: append atómico de un evento. Recibe los datos del evento y, cuando no se recibe `reporteId`, los datos necesarios para crear un `Reporte` respetando el modelo existente (sin modificarlo). Incrementa `Expediente.numEventos` y actualiza `ultimoEventoEn`.

### 3. Corte y escalado de un expediente

Esta SPEC **modela** los estados (`ACTIVO`, `CONSOLIDANDO`, `PENDIENTE_COMITE`, `EN_APROBACION_PADRE`, `EN_ACLARACION`, `CERRADO`, `ESCALADO`) y los parámetros que gobernarán las transiciones, pero **no implementa** la máquina de estados. Las reglas de negocio (auto-cierre por inactividad, consolidación al alcanzar `consolidacion_min_reportes`, escalado por score rojo, etc.) se implementarán en una SPEC posterior que consuma estos modelos y parámetros.

### 4. Hidratación async de `categoriaDetectada` y `confianzaClasificacion`

`EventoExpediente.categoriaDetectada` y `confianzaClasificacion` son opcionales y se dejan en `null` al crear el evento. Cuando el worker de IA (existente, fuera del alcance) finaliza la clasificación del `Reporte` vinculado, invocará un método del repositorio (p. ej. `hidratarClasificacionEvento`) para actualizar únicamente esos dos campos. De este modo el motor IA en `src/lib/ai/**` no se modifica ni depende del nuevo modelo.

### 5. Relación con `Reporte` sin alterar su semántica

El modelo `EventoExpediente` incluye `reporteId String?` con una relación Prisma hacia `Reporte`. Para que Prisma valide la clave foránea, el modelo `Reporte` debe exponer la relación inversa `eventos EventoExpediente[]`. Esta adición **no modifica columnas** de la tabla `reportes` ni cambia campos existentes del modelo; solo declara la relación inversa. De este modo se cumple el candado "no alterar el modelo `Reporte`" en el sentido de no cambiar su estructura de negocio.

### 6. Frontera DAL (Q-3)

`src/lib/dal/repositories/expediente-repository.ts` es el único punto de acceso a Prisma para `Expediente` y `EventoExpediente`. Ni endpoints ni servicios importarán `@/lib/prisma` directamente. Se expondrán tipos de entrada/salida estrictos (preferiblemente derivados de `Prisma.ExpedienteCreateInput`, `Prisma.EventoExpedienteCreateInput` y selects tipados).

### 7. Seed idempotente anti-I-100

Los 18 parámetros `padre.*` se siembran con `prisma.parametroSistema.upsert` usando `update: { ... }` explícito. Esto permite que futuros cambios de default se propaguen al reejecutar `npx prisma db seed`, sin duplicar filas ni perder el valor actual si ya fue modificado por un administrador.

### 8. Hallazgo preliminar: enum `TipoRevisionComite`

El instructivo asume que `TipoRevisionComite` ya existe y debe extenderse con `ALTER TYPE ADD VALUE`. En la rama base local no se encontró dicho enum en `prisma/schema.prisma`. Durante la implementación se verificará en `origin/feature/001-scaffolding` antes de generar la migración. Si efectivamente no existe, la migración deberá crearlo aditivamente y luego agregar `CONSOLIDACION_EXPEDIENTE`; ZEUS debe confirmar este desvío mínimo en la compuerta.

---

## Scope Summary

### Schema Prisma

- Nuevos enums:
  - `EstadoExpediente`: `ACTIVO`, `CONSOLIDANDO`, `PENDIENTE_COMITE`, `EN_APROBACION_PADRE`, `EN_ACLARACION`, `CERRADO`, `ESCALADO`.
  - `ScoreGravedad`: `VERDE`, `AMARILLO`, `ROJO`.
- Extender enum existente:
  - `TipoRevisionComite` con `CONSOLIDACION_EXPEDIENTE` mediante `ALTER TYPE ... ADD VALUE`.
- Nuevos modelos:
  - `Expediente` con self-referencia opcional, relaciones a `Usuario`, `EventoExpediente[]`.
  - `EventoExpediente` con FK opcional a `Reporte`, índice único `[expedienteId, ordenSecuencial]`.
- Relaciones inversas mínimas en `Usuario` (`expedientes Expediente[]`) y `Reporte` (`eventos EventoExpediente[]`).

### Seed

18 parámetros `padre.*` en `ParametroSistema` con tipos/categorías adecuados y `esPublico = false`.

### Repository

`src/lib/dal/repositories/expediente-repository.ts` con:

- `crearExpediente(data)`
- `agregarEvento(data)` — transacción atómica que crea `EventoExpediente` y `Reporte` (cuando no se recibe `reporteId`) con `ordenSecuencial` monotónico.
- `listarExpedientesDePadre(padreUsuarioId, paginación)`
- `obtenerExpedientePorId(id)`

### Tests

- Tests unitarios/integración del repositorio (creación, eventos, orden monotónico, listado paginado).
- Test de idempotencia del seed (ejecutar dos veces, verificar cero duplicados y propagación de `update`).

---

## Complexity Tracking

No constitution violations. No complexity justification needed.
