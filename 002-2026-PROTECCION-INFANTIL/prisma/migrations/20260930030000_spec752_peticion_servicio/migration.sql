-- SPEC-752 · Tabla PeticionServicio: la puerta de PQR / canal de continuidad (motivos CERRADOS, in-app).
-- Dev-3 dibujó el modelo en schema.prisma; ésta es la migración de Datos (D-121). Aditiva, no destructiva.
--   · venceEn NOT NULL + CHECK VALIDADO venceEn > creadoEn: el reloj INTERNO no puede faltar ni mentir.
--   · usuarioId Cascade (in-app, cuelga del usuario); solicitudId SetNull (contexto de cita, sobrevive).
--   · solicitudHabeasDataId @unique SetNull → el ENLACE al caso legal de habeas data (SPEC-772), del lado
--     de la PQR a propósito: el Cascade de usuarioId borra la PQR SIN huérfanar la SolicitudHabeasData,
--     que sobrevive como PRUEBA. La bandeja DERIVA la urgencia legal del venceEn de esa solicitud; NO copia.
-- 752 es uniformemente INTERNO: ningún término legal vive acá (habeas data en 772, reversión en Pago/788).

-- CreateEnum
CREATE TYPE "MotivoPeticionServicio" AS ENUM ('DATOS_PERSONALES', 'PAGO_O_COBRO', 'CITA', 'SERVICIO_PLATAFORMA', 'OTRA');

-- CreateTable
CREATE TABLE "PeticionServicio" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "motivo" "MotivoPeticionServicio" NOT NULL,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "venceEn" TIMESTAMPTZ(6) NOT NULL,
    "resueltoEn" TIMESTAMPTZ(6),
    "resueltoPor" TEXT,
    "solicitudId" TEXT,
    "solicitudHabeasDataId" TEXT,
    "pagoId" TEXT,

    CONSTRAINT "PeticionServicio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PeticionServicio_solicitudHabeasDataId_key" ON "PeticionServicio"("solicitudHabeasDataId");

-- CreateIndex
CREATE UNIQUE INDEX "PeticionServicio_pagoId_key" ON "PeticionServicio"("pagoId");

-- CreateIndex
CREATE INDEX "PeticionServicio_resueltoEn_venceEn_idx" ON "PeticionServicio"("resueltoEn", "venceEn");

-- CreateIndex
CREATE INDEX "PeticionServicio_usuarioId_creadoEn_idx" ON "PeticionServicio"("usuarioId", "creadoEn" DESC);

-- CreateIndex
CREATE INDEX "PeticionServicio_solicitudId_idx" ON "PeticionServicio"("solicitudId");

-- AddForeignKey
ALTER TABLE "PeticionServicio" ADD CONSTRAINT "PeticionServicio_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeticionServicio" ADD CONSTRAINT "PeticionServicio_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "SolicitudCita"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeticionServicio" ADD CONSTRAINT "PeticionServicio_solicitudHabeasDataId_fkey" FOREIGN KEY ("solicitudHabeasDataId") REFERENCES "SolicitudHabeasData"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey · enlace al PAGO del reclamo de reversión (SPEC-788). SetNull del lado de la PQR: el
-- Cascade de usuarioId borra la PQR sin tocar el Pago, que sobrevive como prueba durable.
ALTER TABLE "PeticionServicio" ADD CONSTRAINT "PeticionServicio_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "Pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CHECK · el vencimiento INTERNO va DESPUÉS de la creación (venceEn = creadoEn + plazo hábil, plazo ≥ 1).
-- VALIDADO (nunca NOT VALID): la tabla nace vacía en esta migración, así valida trivialmente y queda como
-- candado duro de INSERT/UPDATE. Prisma es ciego al CHECK; el candado lo prueba por inserción real.
ALTER TABLE "PeticionServicio" ADD CONSTRAINT "PeticionServicio_vence_gt_creado_check" CHECK ("venceEn" > "creadoEn");
