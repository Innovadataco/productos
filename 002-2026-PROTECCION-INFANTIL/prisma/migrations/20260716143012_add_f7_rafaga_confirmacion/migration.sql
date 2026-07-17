-- AlterTable
ALTER TABLE "CorreccionAdmin" ADD COLUMN     "confirmada" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Reporte" ADD COLUMN     "esRafaga" BOOLEAN NOT NULL DEFAULT false;
