# Data Model: SPEC-145 — `Profesor` mínimo

**Fecha**: 2026-08-03 · **Spec**: [spec.md](./spec.md) · **Research**: [research.md](./research.md)

## Cambios en `prisma/schema.prisma`

```prisma
// NUEVO — brief §7.2: mínimo funcional, sin overdiseño.
model Profesor {
  id        String   @id @default(cuid())
  colegioId String
  nombre    String
  apellidos String
  email     String?
  telefono  String?
  estado    String   @default("activo")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  colegio Colegio @relation(fields: [colegioId], references: [id])
  cursos  Curso[]

  @@index([colegioId, estado])
}

model Curso {
  id                String   @id @default(cuid())
  colegioId         String
  nombre            String
  grado             String?
  anioLectivo       String?
  estado            String   @default("activo")
  profesorTitularId String?  // NUEVO — aditivo; existentes quedan NULL (no se retro-asigna)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  colegio         Colegio      @relation(fields: [colegioId], references: [id])
  profesorTitular Profesor?    @relation(fields: [profesorTitularId], references: [id]) // NUEVO
  estudiantes     Estudiante[]

  @@index([colegioId, estado])
  @@unique([colegioId, nombre, grado, anioLectivo])
}

model Colegio {
  // …se añade la relación inversa:
  profesores Profesor[]  // NUEVO
}

enum AccionAudit {
  // …se añaden (ALTER TYPE … ADD VALUE, aditivo en PG16):
  COLEGIO_PROFESOR_CREADO
  COLEGIO_PROFESOR_EDITADO
  COLEGIO_PROFESOR_DESACTIVADO
}
```

## Migración (única, aditiva — SQL a inspeccionar por I-49)

```sql
ALTER TABLE "Curso" ADD COLUMN "profesorTitularId" TEXT;
CREATE TABLE "Profesor" (
    "id" TEXT NOT NULL, "colegioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL, "apellidos" TEXT NOT NULL,
    "email" TEXT, "telefono" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Profesor_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Profesor_colegioId_estado_idx" ON "Profesor"("colegioId", "estado");
ALTER TABLE "Profesor" ADD CONSTRAINT "Profesor_colegioId_fkey"
  FOREIGN KEY ("colegioId") REFERENCES "Colegio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Curso" ADD CONSTRAINT "Curso_profesorTitularId_fkey"
  FOREIGN KEY ("profesorTitularId") REFERENCES "Profesor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_PROFESOR_CREADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_PROFESOR_EDITADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_PROFESOR_DESACTIVADO';
```

**I-49 — candado**: si el SQL generado contiene CUALQUIER `DROP INDEX` / `DROP
TABLE` / `ALTER TYPE … DROP`, PARA y se reporta (drift de índices: trigram
`Ciudad`, vectoriales `Embedding*`, `AlertaColegio_patronInstitucionalId_idx`).

## Reglas de negocio

- **Baja = soft delete** (`estado = "inactivo"`): nunca borrado físico (§7.2). Los
  listados por default solo activos (filtro `estado`).
- **Sin retro-asignación**: los cursos existentes quedan con `profesorTitularId =
  NULL`.
- **On delete SET NULL** en `Curso.profesorTitularId`: si algún día se borra físico
  un profesor (no hay flujo que lo haga), el curso no queda huérfano roto.
- **Tenant §2.3**: todo acceso con `colegioId` de sesión (E-1/SPEC-134);
  asignación de titular valida que el profesor es del mismo colegio.
- **Duplicado**: `nombre + apellidos` activo duplicado en el mismo colegio → 409
  (patrón de estudiantes).
