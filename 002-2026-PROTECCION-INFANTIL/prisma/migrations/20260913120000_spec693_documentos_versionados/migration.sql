-- SPEC-693 (I-416) · Documentos versionados del profesional.
--
-- HOY: `DocumentoProfesional` tiene UN único por (perfil,requisito) y el repositorio
-- hace `upsert` sobre esa clave → subir un documento nuevo PISA el aprobado. Eso hace
-- imposible «el profesional sigue atendiendo con el anterior mientras revisan el nuevo».
--
-- MODELO NUEVO (D-121, Datos · CEO opción b): por (perfil,requisito) conviven una
-- versión VIGENTE (aprobada, la que respalda) y una EN_REVISION (pendiente). El
-- historial (SUPERSEDIDA/DEVUELTA) NO se borra. La unicidad «≤1 VIGENTE y ≤1
-- EN_REVISION por (perfil,requisito)» NO se expresa en el DSL de Prisma → va como DOS
-- índices únicos PARCIALES a mano (paso 3). Prisma NO los conoce: `migrate dev` puede
-- proponer borrarlos. El centinela de inserción real (23505) los custodia contra ese
-- drift — este archivo NO es la última línea de defensa, el candado sí.
--
-- Se escribe A MANO (no `migrate diff`): el diff de este repo arrastra decenas de
-- statements ajenos (timestamptz↔timestamp(3), índices vector/trgm, FKs de otras
-- tablas). Acá van SOLO los statements de SPEC-693, con los nombres EXACTOS que Prisma
-- genera (verificados con `migrate diff`) para no introducir drift nuevo.
--
-- ORDEN (Datos): (1) enums → (2) columna estado + backfill por fechas → (3) derogar el
-- único viejo + índice de lectura → (4) índices únicos parciales → (5) tablas de unión
-- y de renovación con sus FK. Nada destructivo sobre datos: el backfill solo CLASIFICA.

-- 1) Tipos enum nuevos. Deben existir antes de usarlos en columna/tabla.
CREATE TYPE "EstadoDocumento" AS ENUM ('EN_REVISION', 'VIGENTE', 'SUPERSEDIDA', 'DEVUELTA');
CREATE TYPE "ResultadoRevisionRenovacion" AS ENUM ('APROBADO', 'DEVUELTA');

-- 2) Columna `estado`. Default EN_REVISION: toda fila nueva entra como pendiente y solo
--    la vuelve VIGENTE una aprobación explícita. Luego backfill de las filas EXISTENTES.
ALTER TABLE "DocumentoProfesional"
    ADD COLUMN "estado" "EstadoDocumento" NOT NULL DEFAULT 'EN_REVISION';

-- Backfill POR FECHAS (Datos: no por estado del perfil). Un documento es la versión
-- VIGENTE si se subió EN O ANTES de la última verificación APROBADA de su perfil — es la
-- versión que esa aprobación respaldó. Si se subió DESPUÉS (o el perfil nunca tuvo una
-- aprobación) es una versión que aún no entró a ninguna aprobación → queda EN_REVISION
-- (el default, no se toca). El único viejo garantiza 1 fila por (perfil,requisito), así
-- que este UPDATE nunca produce dos VIGENTE en un mismo par: los índices del paso 4 no
-- pueden fallar por datos preexistentes.
UPDATE "DocumentoProfesional" d
   SET "estado" = 'VIGENTE'::"EstadoDocumento"
  FROM (
        SELECT "perfilProfesionalId", max("revisadoEn") AS "ultimaAprobacion"
          FROM "VerificacionProfesional"
         WHERE "resultado" = 'APROBADO'::"ResultadoVerificacion"
         GROUP BY "perfilProfesionalId"
       ) v
 WHERE v."perfilProfesionalId" = d."perfilProfesionalId"
   AND d."subidoEn" <= v."ultimaAprobacion";

-- 3) Derogar el único viejo (una fila por requisito) — ya no aplica, conviven versiones.
--    Índice de lectura compuesto en su lugar (mismo nombre que generaría Prisma).
DROP INDEX "DocumentoProfesional_perfilProfesionalId_requisitoClave_key";
CREATE INDEX "DocumentoProfesional_perfilProfesionalId_requisitoClave_idx"
    ON "DocumentoProfesional"("perfilProfesionalId", "requisitoClave");

-- 4) Unicidad real por índices ÚNICOS PARCIALES: ≤1 VIGENTE y ≤1 EN_REVISION por
--    (perfil,requisito). SUPERSEDIDA/DEVUELTA son historial: múltiples permitidas.
--    Sin precedente en el repo (Datos, D-121). El cast explícito del literal al enum
--    evita depender de la coerción implícita de Postgres. Si el backfill hubiera dejado
--    dos VIGENTE en un par, este CREATE fallaría FUERTE — es también un post-check.
CREATE UNIQUE INDEX "DocumentoProfesional_perfil_requisito_vigente_uniq"
    ON "DocumentoProfesional"("perfilProfesionalId", "requisitoClave")
    WHERE "estado" = 'VIGENTE'::"EstadoDocumento";
CREATE UNIQUE INDEX "DocumentoProfesional_perfil_requisito_en_revision_uniq"
    ON "DocumentoProfesional"("perfilProfesionalId", "requisitoClave")
    WHERE "estado" = 'EN_REVISION'::"EstadoDocumento";

-- 5a) Tabla de unión: qué VERSIÓN de documento revisó cada verificación (FK real, no
--     JSON de ids). AMBOS FK con onDelete: Cascade EXPLÍCITO (Datos, checkpoint 2): el
--     default de Prisma es Restrict y trabaría (a) el borrado en cascada perfil→doc y
--     (b) la purga demo que borra `VerificacionProfesional`.
CREATE TABLE "VerificacionDocumento" (
    "id" TEXT NOT NULL,
    "verificacionId" TEXT NOT NULL,
    "documentoProfesionalId" TEXT NOT NULL,

    CONSTRAINT "VerificacionDocumento_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VerificacionDocumento_documentoProfesionalId_idx"
    ON "VerificacionDocumento"("documentoProfesionalId");
CREATE UNIQUE INDEX "VerificacionDocumento_verificacionId_documentoProfesionalId_key"
    ON "VerificacionDocumento"("verificacionId", "documentoProfesionalId");
ALTER TABLE "VerificacionDocumento" ADD CONSTRAINT "VerificacionDocumento_verificacionId_fkey"
    FOREIGN KEY ("verificacionId") REFERENCES "VerificacionProfesional"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerificacionDocumento" ADD CONSTRAINT "VerificacionDocumento_documentoProfesionalId_fkey"
    FOREIGN KEY ("documentoProfesionalId") REFERENCES "DocumentoProfesional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5b) Registro de re-revisión de RENOVACIÓN (aprobar/devolver un documento nuevo de un
--     profesional YA ACTIVO). Los dos invariantes del CEO son ESTRUCTURALES: la tabla NO
--     tiene `venceEn` ni FK a `PerfilProfesional`, así que por FORMA no puede extender la
--     vigencia ni mover el estado del perfil. doc FK Cascade (se limpia con el perfil);
--     revisadoPor FK RESTRICT (el default: preserva quién revisó — seguro porque el
--     perfil se borra antes que Usuario en la purga, las filas ya cayeron por cascada).
CREATE TABLE "RevisionRenovacion" (
    "id" TEXT NOT NULL,
    "documentoProfesionalId" TEXT NOT NULL,
    "revisadoPorId" TEXT NOT NULL,
    "revisadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resultado" "ResultadoRevisionRenovacion" NOT NULL,
    "observacion" TEXT,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevisionRenovacion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RevisionRenovacion_documentoProfesionalId_idx"
    ON "RevisionRenovacion"("documentoProfesionalId");
CREATE INDEX "RevisionRenovacion_revisadoPorId_idx"
    ON "RevisionRenovacion"("revisadoPorId");
ALTER TABLE "RevisionRenovacion" ADD CONSTRAINT "RevisionRenovacion_documentoProfesionalId_fkey"
    FOREIGN KEY ("documentoProfesionalId") REFERENCES "DocumentoProfesional"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevisionRenovacion" ADD CONSTRAINT "RevisionRenovacion_revisadoPorId_fkey"
    FOREIGN KEY ("revisadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
