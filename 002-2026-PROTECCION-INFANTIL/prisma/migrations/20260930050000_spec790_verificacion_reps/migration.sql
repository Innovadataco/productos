-- SPEC-790 · Tabla VerificacionReps: registro APPEND-ONLY del hecho de verificar el REPS de un
-- profesional (una fila por chequeo). El estado vigente del profesional se DERIVA de la última fila; NO
-- hay columna de estado mutable (una cacheada deriva contra la realidad). Aditiva, no destructiva.
--   · verificadoEn NOT NULL sin default, INMUTABLE por trigger (cuándo verificamos NOSOTROS — la prueba).
--   · CHECK VALIDADO: resultado='VIGENTE' => vigenteHasta IS NOT NULL (un VIGENTE sin fecha deja la
--     compuerta abierta para siempre — INCONSTRUIBLE, no una regla).
--   · profesionalId RESTRICT: la fila-prueba no desaparece si el profesional se da de baja (PerfilProfesional
--     se gestiona por estado, no se borra). verificadoPorId SetNull: el actor se vacía; el rastro durable
--     vive en verificadoPorSnapshot.
--   · Índice compuesto profesionalId + verificadoEn DESC: la consulta CALIENTE «última verificación» que
--     corre en CADA compuerta. NO parcial (no dejar al planner, y evitar la trampa del índice con WHERE).

-- CreateEnum
CREATE TYPE "FuenteVerificacionReps" AS ENUM ('API', 'ARCHIVO', 'MANUAL_ADMIN');

-- CreateEnum
CREATE TYPE "EstadoReps" AS ENUM ('VIGENTE', 'VENCIDA', 'NO_ENCONTRADA', 'SIN_VERIFICAR');

-- CreateEnum
CREATE TYPE "ModalidadReps" AS ENUM ('PRESENCIAL', 'TELEMEDICINA');

-- CreateTable
CREATE TABLE "VerificacionReps" (
    "id" TEXT NOT NULL,
    "profesionalId" TEXT NOT NULL,
    "verificadoEn" TIMESTAMPTZ(6) NOT NULL,
    "fuente" "FuenteVerificacionReps" NOT NULL,
    "resultado" "EstadoReps" NOT NULL,
    "vigenteHasta" TIMESTAMPTZ(6),
    "modalidades" "ModalidadReps"[],
    "verificadoPorId" TEXT,
    "verificadoPorSnapshot" TEXT,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificacionReps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerificacionReps_profesionalId_verificadoEn_idx" ON "VerificacionReps"("profesionalId", "verificadoEn" DESC);

-- AddForeignKey
ALTER TABLE "VerificacionReps" ADD CONSTRAINT "VerificacionReps_profesionalId_fkey" FOREIGN KEY ("profesionalId") REFERENCES "PerfilProfesional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificacionReps" ADD CONSTRAINT "VerificacionReps_verificadoPorId_fkey" FOREIGN KEY ("verificadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CHECK · resultado VIGENTE exige vigenteHasta (imposibilidad estructural, no regla). VALIDADO: la tabla
-- nace vacía, valida trivialmente. Prisma es ciego al CHECK -> candado de inserción.
ALTER TABLE "VerificacionReps" ADD CONSTRAINT "VerificacionReps_vigente_exige_vigencia_check" CHECK (
    "resultado" <> 'VIGENTE' OR "vigenteHasta" IS NOT NULL
);

-- INMUTABILIDAD de verificadoEn (transición -> TRIGGER, no CHECK). Append-only: la fila no se actualiza,
-- y verificadoEn —la prueba de CUÁNDO verificamos— jamás se reescribe. Cualquier cambio del valor lanza.
CREATE OR REPLACE FUNCTION "verificacionReps_verificadoEn_inmutable"()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'VerificacionReps.verificadoEn es inmutable (SPEC-790): es la prueba de cuándo verificamos el REPS; la fila es append-only y no se reescribe';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "verificacionReps_verificadoEn_inmutable_trg"
    BEFORE UPDATE ON "VerificacionReps"
    FOR EACH ROW
    WHEN (OLD."verificadoEn" IS DISTINCT FROM NEW."verificadoEn")
    EXECUTE FUNCTION "verificacionReps_verificadoEn_inmutable"();
