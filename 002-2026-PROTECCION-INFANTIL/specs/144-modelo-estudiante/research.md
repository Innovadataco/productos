# Research: SPEC-144 — Rename `Alumno → Estudiante` sin migración destructiva

**Fecha**: 2026-08-03 · **Spec**: [spec.md](./spec.md)

## D-R1 · Cómo renombrar modelos Prisma sin tocar la base física

**Decisión**: `@@map` en modelos/enum + `@map` en campos/valores de enum.

**Hechos verificados en el repo**:
- Tabla física `"Alumno"` creada en
  `prisma/migrations/20260721060000_add_colegio_cursos_alumnos/migration.sql` (CREATE
  TABLE "Alumno", CREATE TABLE "IdentificadorAlumno", CREATE TYPE
  "EtiquetaRelacionAlumno" AS ENUM ('ALUMNO','MADRE','PADRE','PRIMO','TUTOR','OTRO')).
- Hoy el schema NO usa `@@map` en estos modelos: el nombre físico = nombre del modelo.
- Prisma 5.22 soporta `@map` en valores de enum y `@@map` en enums (estable desde
  4.x). Con mapeo, el diff de `migrate dev` NO renombra nada físico.

**Consecuencia**: el rename es un cambio de SOLO código + schema Prisma; la única
migración nueva contiene los `ADD COLUMN` de la expansión (US2). Cero `DROP`, cero
`ALTER ... RENAME`, cero pérdida.

**Alternativa rechazada**: migración con `ALTER TABLE "Alumno" RENAME TO
"Estudiante"` — innecesaria (el brief §7.1 manda conservar la tabla física) y
cascada de renames físicos sin beneficio.

## D-R2 · Backfill idempotente = la propia migración

**Decisión**: `apellidos String @default("")` y el resto nullable; NO script de
backfill aparte.

**Por qué**: el brief §7.1 exige "los existentes reciben `apellidos = ""` y NULLs;
segunda corrida = no-op". Un `ADD COLUMN ... NOT NULL DEFAULT ''` hace exactamente
eso, en PostgreSQL ≥ 11 como operación metadata-only (el default constante no
reescribe la tabla → sin lock largo sobre datos en caliente). La idempotencia y la
reversibilidad (`migrate reset && migrate deploy`) quedan garantizadas por
construcción, no por disciplina de script.

## D-R3 · `documentoTipo`: String + Zod, no enum de BD

**Decisión (recomendación D3)**: `documentoTipo String?` con set cerrado validado en
la capa API (`TI`, `CC`, `CE`, `PASAPORTE`, `OTRO`).

**Por qué**: el enum existente `TipoIdentificacionIntegrante`
(`CEDULA_CIUDADANIA`, `CEDULA_EXTRANJERIA`, `PASAPORTE`, `OTRO`) pertenece al módulo
de comité y NO incluye TI (tarjeta de identidad) — el documento típico del menor en
Colombia. Crear un enum de BD nuevo para un catálogo que puede crecer (registro civil,
NES) añade fricción migratoria sin beneficio: la validación vive en Zod (constitución
§3.6, objetivo Zod ya adoptado).

## D-R4 · Acudientes: tabla hija vs columnas planas (pendiente D1 de ZEUS)

**Recomendación**: modelo hijo `AcudienteEstudiante` con `@@unique([estudianteId,
orden])`, `orden` ∈ {1, 2}.

| Criterio | Tabla hija (A) | Planas ×2 (B) |
|---|---|---|
| Tope de 2 acudientes | constraint de BD | validación manual |
| Lectura en vista de curso (SPEC-147) | `include` en la misma query (sin N+1) | nada que unir |
| Columnas en `"Alumno"` | 0 nuevas | 8 nuevas |
| Soft delete/auditoría futura (Ley 1581) | natural | incómodo |
| Fidelidad al brief §7.1 ("campos del acudiente principal") | requiere interpretación | literal |

El brief nombra los campos pero no fija el modelado → decisión de ZEUS en compuerta.

## D-R5 · Alcance de la cascada de código

**Inventario verificado (2026-08-03)**: 29 archivos en `src/` con identificadores
`Alumno|IdentificadorAlumno|EtiquetaRelacionAlumno` + `scripts/arch/generar-modelo-datos.ts`.
Bloques:

1. **DAL** (`src/lib/dal/repositories/`): `alumno.ts`, `identificador-alumno.ts`,
   `alerta-colegio.ts` (+ tests). Se renombran archivos a `estudiante.ts` /
   `identificador-estudiante.ts` (la terminología gobierna el código, brief §7.1).
2. **Rutas API colegio** (`src/app/api/colegio/`): `alumnos/[id]/*`,
   `cursos/[id]/alumnos`, `identificadores/[id]/*`, `carga/*` (+ tests A/B tenant).
3. **Rutas API admin** (`src/app/api/admin/colegios/[id]/cursos/**`, tests).
4. **Lib colegio**: `alertas.ts`, `patrones.ts`, `carga/{parser,validator,importer,
   sesion-roster}.ts`, `permisos.ts` (+ tests).
5. **Componentes/páginas**: `AlumnoDetallePageClient.tsx`,
   `CursoDetallePageClient.tsx`, `EstructuraColegioClient.tsx` — SOLO tipos/props; el
   rename de archivos de página lo hace SPEC-146 al reemplazarlas.
6. **Test utils / e2e**: `reporte-test-utils.ts`, `test-utils.ts`,
   `e2e/journeys/*`.
7. **Seed**: `prisma/seed.ts` si referencia el modelo (verificar en implementación).

**Regla**: cero identificadores viejos fuera de strings de mapeo y docstrings
históricos (SC-003). Las migraciones viejas NO se editan.

## D-R6 · Lo que NO cambia

- Paths de URL (D2 recomendado): `/api/colegio/alumnos/*` quedan; SPEC-146/147
  introducen las rutas/pantallas nuevas con redirects.
- Comportamiento del worker, `alertas.ts` (resolución) y `patrones.ts` (agregación):
  mismo flujo, nombres nuevos.
- Validación de identificadores (E.164, tipos, plataforma): intacta.
