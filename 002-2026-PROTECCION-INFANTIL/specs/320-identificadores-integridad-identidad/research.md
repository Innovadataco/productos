# Research / Decisiones de diseño — SPEC-320

Todas las incógnitas del Technical Context resueltas. No quedan `NEEDS CLARIFICATION`.

## R1 · §2.1-DECISIÓN — opción A (cerrada por el CEO)

- **Decisión**: `@@unique` duro **por-tabla dentro del colegio** (protege el duplicado exacto accidental) + cruce **entre-sujetos** dentro del colegio como **warn-con-override** en aplicación (dice a quién pertenece: nombre + rol; el rector decide).
- **Rationale (CEO, 2026-08-30)**: un profesor cuyo hijo estudia en el mismo colegio es la misma persona con el mismo Instagram, presente en dos sujetos dentro del colegio — caso legítimo y común. Un bloqueo duro cross-sujeto se lo rompería al rector. El warn-con-override respeta el texto del brief ("no lo bloquea en seco") y da red de BD donde es barata.
- **Alternativa rechazada**: opción B (bloqueo duro cross-sujeto vía tabla puente o índice compuesto denormalizado). Más segura pero contradice el brief y rompe el caso legítimo.

## R2 · Denormalización de `colegioId` en `IdentificadorAlumno` (H1)

- **Decisión**: agregar `colegioId String` a `IdentificadorEstudiante` (tabla física `IdentificadorAlumno`), con FK a `Colegio`, `@@index([colegioId, estado])`, y hacer que `crear()` del repo lo escriba. Backfill desde `Alumno.colegioId` para filas existentes.
- **Rationale**: uniformidad de la unicidad por colegio en los tres sujetos; el alumno es el sujeto más importante y hoy es el único sin la columna. Ver justificación escrita completa en plan.md (§H1) — deliberadamente redactada para que nadie la "limpie" pensando que es redundante.
- **Alternativa rechazada**: seguir resolviendo el tenant solo por la relación `estudiante.colegioId`. Impide un `@@unique` de BD por colegio en la tabla del identificador y deja al sujeto crítico sin red de BD.

## R3 · Nullable de `plataformaId` — que "sin plataforma" cuente como caso único (FR-004)

- **Problema**: en PostgreSQL un índice único trata cada `NULL` como distinto, así que `@@unique([..., plataformaId])` **no** impide dos filas con `plataformaId = NULL` y el mismo valor. Hoy `plataformaId` es nullable en las tres tablas.
- **Decisión**: PostgreSQL 16 soporta `NULLS NOT DISTINCT`. La protección dura por-tabla dentro del colegio se implementa con un **índice único crudo** (SQL aditivo en la migración, permitido por constitución §2.1) de la forma:
  `CREATE UNIQUE INDEX <tabla>_colegio_ident_key ON "<Tabla>" ("colegioId", "tipo", "valor", "plataformaId") NULLS NOT DISTINCT;`
  Con esto, dos identificadores sin plataforma y mismo `(colegioId, tipo, valor)` colisionan correctamente.
- **Representación en Prisma**: el índice crudo se gestiona en la migración; en el modelo el `@@unique` se documenta con comentario para evitar drift (Prisma 5.22 no emite `NULLS NOT DISTINCT`). Detalle operativo en data-model.md; la decisión final de representación (raw index sin `@@unique` en el modelo, o `@@unique` + índice raw que lo reemplaza) se toma en implement, pero **la semántica es NULLS NOT DISTINCT**.
- **Cruce entre-sujetos (warn)**: la consulta de aplicación mira por `(colegioId, valor)` en las tres tablas — no depende de plataforma, así que el nullable no la afecta. `valor` se compara normalizado (ya existe `normalizarIdentificador`).
- **Alternativa rechazada**: sentinel `plataformaId = 'SIN_PLATAFORMA'`. Requiere una fila real en `Plataforma` (es FK) y ensucia el catálogo. `COALESCE(plataformaId,'')` en índice funcional también sirve pero `NULLS NOT DISTINCT` es más limpio y nativo de PG16.

## R4 · Constraints de unicidad — diseño ASIMÉTRICO por sujeto (H3 + cierre PARA)

- **Hallazgo H3**: estudiante declara `@@unique([estudianteId, valor, tipo, plataformaId])` (valor antes de tipo), mientras profesor y acudiente usan `[sujetoId, tipo, valor, plataformaId]`.
- **Hallazgo clave (Fábrica, PARA)**: `AcudienteEstudiante` es `@@unique([estudianteId, orden, estado])` (schema:1257) → **una fila de acudiente por (estudiante, orden)**. Un padre con dos hijos en el colegio tiene DOS filas de acudiente y su mismo identificador va legítimamente en dos `IdentificadorAcudiente` del mismo colegio.
- **Decisión (asimétrica)**:
  - **Estudiante + Profesor** → constraint dura de BD **por colegio**: `UNIQUE (colegioId, tipo, valor, plataformaId) WHERE estado='activo'` NULLS NOT DISTINCT. Un alumno/profesor tiene una identidad por colegio; dos del colegio con el mismo identificador = bug I-213. Es la red de BD que pidió el CEO.
  - **Acudiente** → se **mantiene por-acudiente**: `UNIQUE (acudienteId, tipo, valor, plataformaId) WHERE estado='activo'` NULLS NOT DISTINCT. La BD no puede bloquear el padre-de-dos-hijos; el warn de aplicación cubre el cruce entre filas de acudiente.
  - **Todo cross-sujeto** → warn-con-override en aplicación por `(colegioId, valor)`.
- **Índice PARCIAL `WHERE estado='activo'`**: verificado que las tres tablas de identificador tienen `estado` (Estudiante schema:1355, Profesor:1310, Acudiente:1286). El parcial evita que una fila inactiva/histórica bloquee una nueva activa.
- **Excepción de acudiente documentada en data-model §3.3** para que nadie la "unifique" a colegio y rompa al padre de dos hijos.

## R5 · Migración de campos `NOT NULL` del profesor → truncate, no temp-default (§2.2 · cierre PARA)

- **Problema**: agregar columnas `NOT NULL` sin default a `Profesor` (2 filas hoy) falla en Postgres; el reset-piloto corre **después** del deploy.
- **NO usar temp-default constante**: violaría el UNIQUE `(colegioId, tipoDocumento, numeroDocumento)` si dos filas comparten colegio; descartado.
- **Dependencia encontrada (verificada en schema:1391)**: `IdentificadorProfesor` es referenciado por `AlertaColegio.identificadorProfesorId`. Un truncate de `Profesor` arrastra `IdentificadorProfesor` → `AlertaColegio` — más de lo que parece.
- **Dos opciones en mesa, decide el CEO (pendiente)**:
  - **(1) Truncate**: el CEO trunca `Profesor` + hijas en la ventana de deploy antes de la migración (que asume tabla vacía). Destructivo; arrastra `AlertaColegio`.
  - **(2) Placeholder por-fila (propuesta de Fábrica, más limpia)**: la migración hace `UPDATE Profesor SET numeroDocumento='MIGR-'||id, <otros campos con valor por-fila>` (valor único por fila → no choca con el UNIQUE) y **recién ahí** `SET NOT NULL`. Cero truncate, cero toque a FKs, los 2 profesores de prueba sobreviven editables hasta el reset. Es el patrón estándar de NOT NULL sobre tabla con filas — **no** el temp-default constante descartado.
- **Estado**: §2.2 en pausa; **la migración de identidad no se implementa hasta el veredicto del CEO** (Fábrica lo trae en minutos). El diseño/código no-migración de US2 sí puede prepararse.
- **Rationale**: ambas opciones dejan el esquema final "obligatorio, sin nullable de transición"; la (2) evita el borrado de datos mientras Jelkin prueba.

## R6 · Vocabularios de tipo de documento — 3 fuentes, 6+ sitios (H2)

- **Fuentes actuales**:
  1. Estudiante — Zod `documentoTipoEstudianteSchema` (`src/lib/schemas/index.ts:244`): `RC|TI|CC|CE|PASAPORTE|OTRO`.
  2. Comité — enum Prisma `TipoIdentificacionIntegrante` (`schema.prisma:419`): `CEDULA_CIUDADANIA|CEDULA_EXTRANJERIA|PASAPORTE|OTRO`, **re-declarado en 6 sitios**: `schema.prisma:419`, `schemas/index.ts:415`, `admin/comite/integrantes/route.ts:10`, `admin/comite/integrantes/[id]/route.ts:10`, `colegio/comite/integrantes/[id]/route.ts:17`, `dal/types/comite.ts:25,35`.
  3. Etiquetas de UI hardcode — `DOCUMENTO_TIPO_OPCIONES` (`src/components/modules/colegio/unificado/tipos.ts:52`).
- **Mapa de equivalencia**: `CC` ≡ `CEDULA_CIUDADANIA` ("Cédula de ciudadanía"); `CE` ≡ `CEDULA_EXTRANJERIA`.
- **Decisión**: un catálogo `TipoDocumento` (patrón `Plataforma`) con `clave @unique` como fuente única. Seed idempotente con la norma colombiana: registro civil (`RC`), tarjeta de identidad (`TI`), cédula de ciudadanía (`CC`), cédula de extranjería (`CE`), pasaporte (`PA`), PEP/PPT (`PEP`), NIT (`NIT`), otro (`OTRO`). Los tres sujetos validan contra el catálogo (clave), y los 6 sitios del vocabulario comité se migran a esa clave. Claves elegidas para coincidir con el vocabulario más corto ya usado por estudiante, mapeando el comité.
- **Alternativa rechazada**: mantener el enum Prisma del comité y solo agregar catálogo para estudiante/profesor. Deja dos vocabularios y no cumple FR-014.

## R7 · Normalización de búsqueda de nombres (FR-011)

- **Decisión**: `buscarPorNombreApellidosEnColegio` (`profesores/route.ts:113` → repo `profesor.ts`) pasa a comparar insensible a mayúsculas y acentos. Reutilizar el patrón de normalización existente (`Ciudad_nombreNormalizado_trgm_idx` / helpers de normalización) o comparar con `mode: "insensitive"` + normalización de acentos en aplicación. Es un bonus de bajo riesgo dentro de §2.2.
