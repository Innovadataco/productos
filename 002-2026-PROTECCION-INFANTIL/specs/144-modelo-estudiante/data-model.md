# Data Model: SPEC-144 — `Estudiante` expandido

**Fecha**: 2026-08-03 · **Spec**: [spec.md](./spec.md) · **Research**: [research.md](./research.md)

## Antes (estado actual, verificado 2026-08-03)

```prisma
enum EtiquetaRelacionAlumno {
  ALUMNO
  MADRE
  PADRE
  PRIMO
  TUTOR
  OTRO
}

model Curso {
  id          String   @id @default(cuid())
  colegioId   String
  nombre      String
  grado       String?
  anioLectivo String?
  estado      String   @default("activo")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  colegio Colegio  @relation(fields: [colegioId], references: [id])
  alumnos Alumno[]

  @@index([colegioId, estado])
  @@unique([colegioId, nombre, grado, anioLectivo])
}

model Alumno {
  id        String   @id @default(cuid())
  cursoId   String
  colegioId String
  nombre    String
  estado    String   @default("activo")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  curso           Curso               @relation(fields: [cursoId], references: [id])
  colegio         Colegio             @relation(fields: [colegioId], references: [id])
  identificadores IdentificadorAlumno[]

  @@index([cursoId, estado])
  @@index([colegioId, estado])
}

model IdentificadorAlumno {
  id               String                  @id @default(cuid())
  alumnoId         String
  tipo             String
  valor            String
  plataformaId     String?
  etiquetaRelacion EtiquetaRelacionAlumno @default(ALUMNO)
  estado           String                  @default("activo")
  createdAt        DateTime                @default(now())
  updatedAt        DateTime                @updatedAt

  alumno     Alumno      @relation(fields: [alumnoId], references: [id])
  plataforma Plataforma? @relation(fields: [plataformaId], references: [id])
  alertas    AlertaColegio[]

  @@unique([alumnoId, valor, tipo, plataformaId])
  @@index([alumnoId, estado])
}
```

## Después (propuesto)

```prisma
enum EtiquetaRelacionEstudiante {
  ESTUDIANTE @map("ALUMNO")
  MADRE
  PADRE
  PRIMO
  TUTOR
  OTRO

  @@map("EtiquetaRelacionAlumno")
}

model Curso {
  id          String   @id @default(cuid())
  colegioId   String
  nombre      String
  grado       String?
  anioLectivo String?
  estado      String   @default("activo")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  colegio     Colegio      @relation(fields: [colegioId], references: [id])
  estudiantes Estudiante[]

  @@index([colegioId, estado])
  @@unique([colegioId, nombre, grado, anioLectivo])
}

model Estudiante {
  id              String   @id @default(cuid())
  cursoId         String
  colegioId       String
  nombre          String
  apellidos       String   @default("")              // NUEVO — obligatorio al alta (API)
  documentoTipo   String?                            // NUEVO — set Zod: RC|TI|CC|CE|PASAPORTE|OTRO (D3)
  documentoNumero String?                            // NUEVO
  estado          String   @default("activo")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  curso           Curso                     @relation(fields: [cursoId], references: [id])
  colegio         Colegio                   @relation(fields: [colegioId], references: [id])
  identificadores IdentificadorEstudiante[]
  acudientes      AcudienteEstudiante[]                // NUEVO — tabla hija (D1)

  @@index([cursoId, estado])
  @@index([colegioId, estado])
  @@map("Alumno")
}

// NUEVO (D1 = tabla hija, aprobado por ZEUS). El acudiente NUNCA se consulta por
// su id suelto: siempre a través del estudiante ya acotado por colegioId (E-1).
model AcudienteEstudiante {
  id           String   @id @default(cuid())
  estudianteId String                                // tabla nueva: sin @map (nada que conservar)
  orden        Int                                // 1 = principal, 2 = secundario
  nombre       String
  relacion     String                             // "madre" | "padre" | "tía" | … (texto libre corto)
  telefono     String?
  email        String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  estudiante Estudiante @relation(fields: [estudianteId], references: [id])

  @@unique([estudianteId, orden])                 // máximo 2 por estudiante
  @@index([estudianteId])
}

model IdentificadorEstudiante {
  id               String                       @id @default(cuid())
  estudianteId     String                       @map("alumnoId")
  tipo             String
  valor            String
  plataformaId     String?
  etiquetaRelacion EtiquetaRelacionEstudiante   @default(ESTUDIANTE)
  estado           String                       @default("activo")
  createdAt        DateTime                     @default(now())
  updatedAt        DateTime                     @updatedAt

  estudiante Estudiante  @relation(fields: [estudianteId], references: [id])
  plataforma Plataforma? @relation(fields: [plataformaId], references: [id])
  alertas    AlertaColegio[]

  @@unique([estudianteId, valor, tipo, plataformaId])
  @@index([estudianteId, estado])
  @@map("IdentificadorAlumno")
}
```

## Relaciones que cambian de nombre (mismo físico)

| Modelo | Antes | Después | Físico conservado |
|---|---|---|---|
| `Colegio` | `alumnos Alumno[]` | `estudiantes Estudiante[]` | relación, sin columna |
| `Curso` | `alumnos Alumno[]` | `estudiantes Estudiante[]` | relación, sin columna |
| `AlertaColegio` | `identificadorAlumnoId` / `identificadorAlumno` | `identificadorEstudianteId @map("identificadorAlumnoId")` / `identificadorEstudiante` | columna `"identificadorAlumnoId"` + `@@unique` existente |
| `Plataforma` | `identificadoresAlumno IdentificadorAlumno[]` | `identificadoresEstudiante IdentificadorEstudiante[]` | relación, sin columna |

## Migración nueva (única, aditiva)

```sql
-- ÚNICOS cambios físicos (el rename es 100% @@map/@map, diff estructural vacío):
ALTER TABLE "Alumno" ADD COLUMN "apellidos" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Alumno" ADD COLUMN "documentoTipo" TEXT;
ALTER TABLE "Alumno" ADD COLUMN "documentoNumero" TEXT;
-- + CREATE TABLE "AcudienteEstudiante" (…) con FK, @@unique y @@index (D1).
```

- Metadata-only en PG16 (default constante, sin rewrite) → sin lock apreciable.
- Backfill idempotente por construcción (D-R2): los existentes quedan con
  `apellidos = ''` y NULLs; no hay UPDATE de datos; `migrate reset && migrate
  deploy` lo recrea todo.

## Reglas de negocio sobre el modelo

- **Alta**: `nombre` + `apellidos` obligatorios (validación API/Zod, no BD — el
  default `""` existe para el backfill de históricos, no para permitir altas sin
  apellidos).
- **Acudientes**: máximo 2 por estudiante (`orden` 1|2 + unique). Teléfono/email
  opcionales; si no hay NINGÚN dato de contacto, las pantallas mostrarán badge
  ámbar "Sin contactos" (SPEC-147). El acudiente NUNCA se consulta por id suelto:
  solo a través del estudiante ya acotado por `colegioId` (condición D1) — es PII de
  un tercero; aislarla facilita purga y auditoría (BL-1).
- **Multi-tenant §2.3**: `Estudiante` y `AcudienteEstudiante` se leen/escriben SIEMPRE
  con `colegioId` de sesión (patrón E-1/SPEC-134); `AcudienteEstudiante` hereda el
  tenant a través de `estudiante.colegioId` (verificación por join/include, nunca por
  id suelto).
- **I-29**: ningún campo de score/riesgo existe ni se expone aquí.
