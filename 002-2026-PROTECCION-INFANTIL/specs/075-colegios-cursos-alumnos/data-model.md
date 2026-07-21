# Data Model: Colegios · Fase 2 — Cursos, Alumnos e Identificadores

## Nuevas entidades

```prisma
model Curso {
  id          String   @id @default(cuid())
  colegioId   String
  nombre      String
  grado       String?
  anioLectivo String?
  estado      String   @default("activo")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  colegio Colegio   @relation(fields: [colegioId], references: [id])
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

  curso         Curso               @relation(fields: [cursoId], references: [id])
  colegio       Colegio             @relation(fields: [colegioId], references: [id])
  identificadores IdentificadorAlumno[]

  @@index([cursoId, estado])
  @@index([colegioId, estado])
}

enum EtiquetaRelacionAlumno {
  ALUMNO
  MADRE
  PADRE
  PRIMO
  TUTOR
  OTRO
}

model IdentificadorAlumno {
  id              String                  @id @default(cuid())
  alumnoId        String
  tipo            String                  // telefono, email, nick, usuario
  valor           String
  plataformaId    String?
  etiquetaRelacion EtiquetaRelacionAlumno @default(ALUMNO)
  estado          String                  @default("activo")
  createdAt       DateTime                @default(now())
  updatedAt       DateTime                @updatedAt

  alumno     Alumno      @relation(fields: [alumnoId], references: [id])
  plataforma Plataforma? @relation(fields: [plataformaId], references: [id])

  @@unique([alumnoId, valor, tipo, plataformaId])
  @@index([alumnoId, estado])
}
```

## Cambios en entidades existentes

- `Colegio` recibe relaciones inversas: `cursos Curso[]`, `alumnos Alumno[]`.
- `Plataforma` recibe relación inversa: `identificadoresAlumno IdentificadorAlumno[]`.

## Notas

- Soft delete: `estado` puede ser `activo` o `inactivo`. No se borra físicamente.
- `Alumno.colegioId` denormalizado para validar aislamiento sin join a Curso.
- `IdentificadorAlumno` no almacena `colegioId`; se valida vía `alumno.curso.colegioId` o `alumno.colegioId`.
- `EtiquetaRelacionAlumno` como enum Prisma para evitar valores arbitrarios.
