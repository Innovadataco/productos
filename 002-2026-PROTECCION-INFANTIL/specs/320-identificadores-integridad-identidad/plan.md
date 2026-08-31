# Implementation Plan: Identificadores — integridad + identidad (SPEC-320)

**Branch**: `work/pi-SPEC-320-identificadores-integridad-identidad` | **Date**: 2026-08-30 | **Spec**: [spec.md](spec.md)

**Radicado**: 002-PI-220 · A-58 (SPEC-A) · I-213

**Input**: Feature specification from `specs/320-identificadores-integridad-identidad/spec.md`

## Summary

Tres migraciones en secuencia sobre el módulo de colegios de Protección Infantil, todas habilitadas por el reset a cero de la campaña (se borra la data después del deploy):

1. **§2.1 Unicidad del identificador por colegio, cruzando los tres sujetos** (opción A, cerrada por el CEO): `@@unique` duro por-tabla dentro del colegio + validación de aplicación que, al detectar el mismo valor en **otra persona del mismo colegio** (estudiante/profesor/acudiente), avisa a quién pertenece y deja al rector decidir (warn con override). Requiere denormalizar `colegioId` en `IdentificadorAlumno` (H1) y resolver el nullable de `plataformaId`.
2. **§2.2 Documento de identidad del profesor obligatorio** sin nullable de transición ni backfill: `tipoDocumento`, `numeroDocumento`, `anioNacimiento`, `sexo`, `telefono`, `email`, todos obligatorios; llave `(colegioId, tipoDocumento, numeroDocumento)` única. Bonus: normalizar `buscarPorNombreApellidosEnColegio`.
3. **§2.3 Catálogo único de tipos de documento** en BD, patrón `Plataforma` (`clave @unique`, `nombre`, `categoria`, `esActiva`), sembrado idempotente con la norma colombiana; consumido por los tres sujetos; migra los **6** sitios del vocabulario comité + el enum estudiante + las etiquetas hardcode.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node.js >= 22

**Primary Dependencies**: Next.js 16.2.10 (App Router, API Routes), Prisma 5.22.0, PostgreSQL 16 + pgvector, Zod, Vitest

**Storage**: PostgreSQL (Prisma; migraciones aditivas en `prisma/migrations/`)

**Testing**: Vitest + jsdom (unit/integración de API con `Request` nativo, `.env.test`, `fileParallelism: false`); Playwright E2E fuera de alcance de esta SPEC

**Target Platform**: Servidor Linux (Docker); producción híbrida VPS + motor en la Mac

**Project Type**: Web app (Next.js full-stack, un solo proyecto)

**Performance Goals**: N/A (operaciones CRUD de admin, no ruta caliente del motor)

**Constraints**: Migraciones aditivas y no destructivas salvo la unificación de vocabulario prevista; verificar estado de datos antes de cada migración; secretos solo por env; el motor de producción corre en la misma máquina — no correr suite pesada sin coordinar turno de builds.

**Scale/Scope**: 3 migraciones Prisma + 1 catálogo nuevo + 1 tabla extendida (Profesor) + 3 tablas de identificador tocadas; ~11 callsites de validación; seed idempotente. Datos de producción: casi vacíos (Jelkin a mitad de prueba; SELECT de duplicados = 0).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio (constitution) | Cumplimiento |
|---|---|
| §1.2 Solo texto (sin multimedia) | ✅ No se toca ingreso de contenido; solo datos estructurados de identidad. |
| §2.1 Stack heredado (Prisma/PostgreSQL, raw SQL solo en migraciones) | ✅ Cambios de esquema vía Prisma; el índice parcial de plataforma-nullable, si se usa, va como SQL crudo aditivo en migración. |
| §2.3 Multi-tenant (`tenantId`/`colegioId` en entidades de negocio) | ✅ Refuerza el principio: FR-005 agrega `colegioId` a la tabla de identificadores de estudiante, alineándola con las otras dos. |
| §3.1 TS estricto, sin `any` | ✅ Filtros Prisma tipados; sin `any`. |
| §4.5 Convenciones Prisma (`@@index` en FK, `@map` para tablas) | ✅ Se preservan `@@map("Alumno")`/`@map("alumnoId")`; nuevos índices en las llaves. |
| §8 Migraciones aditivas, nunca `migrate reset` | ✅ Aditivas; la unificación de vocabulario transforma datos existentes de forma controlada y verificada, no borra. |
| AGENTS.md: leer `docs/architecture/` antes de tocar `src/`; `arch:check` verde si cambia el schema | ⚠️ **Gate activo**: esta SPEC cambia el schema → regenerar artefactos de arquitectura y dejar `npm run arch:check` verde en el mismo PR. Se incluye como tarea. |
| AGENTS.md: índices críticos fuera de schema | ✅ No se toca ninguno de los 5 índices HNSW/GIN; si el §2.1 añade un `CREATE INDEX` parcial crudo, NO es de los 5 críticos (no altera `verify-hnsw-indexes.ts`). |

**Sin violaciones que justificar.** Complexity Tracking vacío.

## Project Structure

### Documentation (this feature)

```text
specs/320-identificadores-integridad-identidad/
├── plan.md              # Este archivo
├── spec.md              # Especificación
├── research.md          # Decisiones de diseño (Fase 0)
├── data-model.md        # Modelo de datos (Fase 1)
├── quickstart.md        # Guía de validación (Fase 1)
├── contracts/           # Contratos de endpoints (Fase 1)
│   └── catalogo-tipos-documento.md
├── checklists/
│   └── requirements.md
└── tasks.md             # (lo genera /speckit-tasks)
```

### Source Code (repository root: `002-2026-PROTECCION-INFANTIL/`)

```text
prisma/
├── schema.prisma                         # Profesor (+campos), IdentificadorAlumno (+colegioId), TipoDocumento (nuevo), @@unique reordenados
├── migrations/                           # 3 migraciones aditivas nuevas (una por §)
└── seed.ts                               # seed idempotente del catálogo de tipos de documento

src/lib/dal/repositories/
├── identificador-estudiante.ts           # buscarDuplicado (unicidad exacta) + crear() escribe colegioId; nueva búsqueda cross-sujeto
├── identificador-acudiente.ts            # idem (ya tiene colegioId)
├── identificador-profesor.ts             # idem (ya tiene colegioId)
├── profesor.ts                           # crear() con identidad; buscarPorNombreApellidosEnColegio normalizado; unicidad documento
└── tipo-documento.ts                     # NUEVO repo del catálogo (patrón plataforma.ts)

src/lib/colegio/
├── identificador-unicidad.ts             # NUEVO servicio: chequeo cross-sujeto (colegioId,valor) → a quién pertenece (nombre+rol)
├── normalizacion.ts                      # normalización de nombres (insensible a mayúsculas/acentos)
└── alertas.ts                            # SOLO LECTURA en esta SPEC (cross-tenant correcto); se beneficia indirectamente

src/lib/schemas/index.ts                  # documentoTipo pasa a validarse contra catálogo; profesor schema con identidad
src/lib/dal/types/comite.ts              # tipoIdentificacion referido al catálogo unificado

src/app/api/colegio/
├── alumnos/[id]/identificadores/route.ts            # usa el servicio de unicidad cross-sujeto
├── identificadores/[id]/route.ts                    # idem (edición estudiante)
├── acudientes/[id]/identificadores/route.ts         # idem
├── acudientes/[id]/identificadores/[identificadorId]/route.ts  # idem (edición acudiente)
├── profesores/[id]/identificadores/route.ts         # idem
├── identificadores-profesor/[id]/route.ts           # idem (edición profesor)
├── profesores/route.ts                              # alta profesor con identidad + unicidad documento
├── cursos/unificado/route.ts                        # carga unificada — unicidad cross-sujeto
└── admin/tipos-documento/…                          # NUEVO CRUD del catálogo (patrón admin existente)

src/lib/colegio/carga/importer.ts         # carga masiva — unicidad cross-sujeto + colegioId en creación
```

**Structure Decision**: Un solo proyecto Next.js full-stack (Option 1). La lógica de unicidad cross-sujeto se centraliza en un servicio nuevo (`identificador-unicidad.ts`) que los 8 callsites de validación consumen, en lugar de duplicar la consulta en cada `route.ts` (candado 22 v5: un solo lugar, todos los callsites apuntan a él).

## Fase 0 — Decisiones de diseño

Ver [research.md](research.md). Resumen de las decisiones cerradas:

- **§2.1-DECISIÓN = opción A** (CEO, 2026-08-30), **diseño ASIMÉTRICO** (cerrado con Fábrica en el PARA):
  - **Estudiante + Profesor** → constraint dura de BD por colegio: `UNIQUE (colegioId, tipo, valor, plataformaId) WHERE estado='activo'` NULLS NOT DISTINCT (la red que pidió el CEO; dos personas del colegio con el mismo identificador = bug I-213).
  - **Acudiente** → se mantiene por-acudiente `UNIQUE (acudienteId, tipo, valor, plataformaId) WHERE estado='activo'` NULLS NOT DISTINCT. **Excepción documentada**: `AcudienteEstudiante` es por (estudiante, orden), así que un padre-de-dos-hijos tiene dos filas de acudiente en el mismo colegio y su mismo identificador va legítimamente en ambas — la BD no puede bloquearlo.
  - **Todo cross-sujeto** → warn-con-override en aplicación por `(colegioId, valor)`. Nunca bloquea en seco.
- **H1 · denormalización de `colegioId` en `IdentificadorAlumno`**: obligatoria y con justificación escrita (abajo). `crear()` de estudiante empieza a escribir `colegioId`.
- **plataformaId nullable**: `NULLS NOT DISTINCT` (PG16, índice único crudo aditivo). Ver research.md §R3.
- **Índices parciales `WHERE estado='activo'`**: verificado que las tres tablas tienen `estado` (Estudiante:1355, Profesor:1310, Acudiente:1286).
- **H3 · orden del `@@unique` de estudiante**: el reorden queda absorbido por la nueva constraint `(colegioId, tipo, valor, plataformaId)` de estudiante — cambio explícito de constraint en la migración, no efecto lateral.

### Justificación de la denormalización de `colegioId` (H1) — para que nadie la "limpie" en 6 meses

> `IdentificadorAlumno` (tabla física de `IdentificadorEstudiante`) hoy **no tiene `colegioId`**: el tenant viaja por la relación `estudiante.colegioId`. Las tablas de acudiente y profesor **sí** lo llevan denormalizado. Para que la unicidad **por colegio** del identificador (la llave del producto) sea uniforme y aplicable con una protección de BD sobre las tres tablas, el alumno —el sujeto más importante— necesita `colegioId` en su propia fila. Sin él, el alumno queda sin red de base de datos para la unicidad por colegio y depende solo de la validación de aplicación, más frágil. **No es redundante: es la columna que habilita el `@@unique` por colegio en la tabla del sujeto más crítico.** El momento más barato para agregarla es ahora (se arranca de cero, sin backfill).

## Fase 1 — Modelo, contratos, validación

- [data-model.md](data-model.md): esquema de `TipoDocumento`, `Profesor` extendido, las tres tablas de identificador con la unicidad nueva, y el mapa de migración de vocabularios.
- [contracts/catalogo-tipos-documento.md](contracts/catalogo-tipos-documento.md): endpoints admin del catálogo + shape de la respuesta de "a quién pertenece" en el warn de unicidad.
- [quickstart.md](quickstart.md): los 5 ejercicios de evidencia §6, ejecutables en producción.

## Orden de las tres migraciones

1. **Migración A (§2.3 catálogo primero)**: crea `TipoDocumento`, siembra idempotente, migra vocabularios existentes (unificación `CC`↔`CEDULA_CIUDADANIA`). Va primero porque §2.2 referencia el catálogo. **Verificar datos antes**: enumerar valores distintos de tipo de documento presentes en estudiante y comité.
2. **Migración B (§2.1 unicidad)**: agrega `colegioId` a `IdentificadorAlumno`, backfill de `colegioId` desde `Alumno` para filas existentes (aunque hoy sean ~0), reordena los tres `@@unique` a la forma normalizada por-colegio, resuelve el nullable de plataforma. **Verificar datos antes**: Fábrica ya corrió el SELECT de duplicados (0); re-verificar al desencolar.
3. **Migración C (§2.2 identidad profesor)**: agrega los campos obligatorios a `Profesor` y la llave `(colegioId, tipoDocumento, numeroDocumento)`, `NOT NULL`. **Estrategia PENDIENTE del veredicto del CEO** (ver abajo). **Verificar datos antes** según la opción elegida.

> **⚠️ Migración C — estrategia en decisión (CEO), §2.2 en pausa**: Postgres no admite columnas `NOT NULL` sin default sobre una tabla con filas, y `IdentificadorProfesor` es referenciado por `AlertaColegio.identificadorProfesorId` (schema:1391), así que un truncate arrastra `AlertaColegio`. Dos opciones: **(1) truncate** de `Profesor`+hijas en la ventana de deploy (lo corre el CEO; destructivo, arrastra alertas); **(2) placeholder por-fila** — la migración hace `UPDATE ... SET numeroDocumento='MIGR-'||id` (valor único por fila, no choca con el UNIQUE) y luego `SET NOT NULL`, sin truncate ni tocar FKs, los 2 profesores de prueba sobreviven editables. **NO** es el temp-default constante descartado (ese chocaba con el unique). Fábrica trae el veredicto; **la migración de identidad NO se implementa hasta esa confirmación**. §2.3 catálogo y §2.1 unicidad avanzan sin esperar.

## Complexity Tracking

*(Sin violaciones de constitución — sección vacía.)*
