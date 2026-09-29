-- SPEC-753 (D-121 de Datos) · Las dos encuestas de SERVICIO que CRUZAN + el
-- incidente de contradicción con su reloj legal (REPORTE-070). Es la capa de DATOS
-- del artefacto de esquema de Dev-3 (HEAD 6087908c1): Datos aporta esta migración,
-- los CHECK VALIDADOS (Prisma es ciego a ellos), el orden de borrado y el poblador;
-- Dev-3 construye el service del cruce sobre estas tablas.
--
-- ADITIVA: crea 7 enums + 2 tablas nuevas con sus índices y FK. No toca datos
-- existentes. `EncuestaPrimeraCita` (297 filas demo) QUEDA hasta su retiro en otra SPEC.
--
-- Disciplina §5 (lección #717, a diferencia del #429 rechazado): FK **Cascade**
-- (nunca RESTRICT: la encuesta/el incidente son satélites de la cita y se van con
-- ella, sin 23503 crudo al usuario) y toda restricción **VALIDADA**, jamás NOT VALID.
-- Las tablas nacen vacías, así que un `ADD CONSTRAINT ... CHECK` aquí queda VÁLIDO
-- sin filas que recorrer (no hace falta NOT VALID + VALIDATE en dos pasos).
--
-- El bloque CreateEnum/CreateTable/CreateIndex/AddForeignKey es BYTE-EXACTO a lo que
-- Prisma genera para estos modelos (`migrate diff --from-empty --to-schema-datamodel`);
-- lo único que Prisma no ve son los dos CHECK del final.

-- CreateEnum
CREATE TYPE "OrigenEncuestaCita" AS ENUM ('PADRE', 'PROFESIONAL');

-- CreateEnum
CREATE TYPE "RazonNoSesion" AS ENUM ('NO_ME_CONECTE', 'OTRA_PARTE_NO_CONECTO', 'PROBLEMA_TECNICO', 'OTRA');

-- CreateEnum
CREATE TYPE "OperadorConvoco" AS ENUM ('SI', 'NO', 'NO_HUBO_OPERADOR');

-- CreateEnum
CREATE TYPE "InicioSesion" AS ENUM ('A_TIEMPO', 'CON_RETRASO', 'NO_COMENZO');

-- CreateEnum
CREATE TYPE "EnlaceFunciono" AS ENUM ('SI', 'CON_PROBLEMAS', 'NO_FUNCIONO');

-- CreateEnum
CREATE TYPE "DuracionSesion" AS ENUM ('MENOS_15', 'ENTRE_15_30', 'ENTRE_30_45', 'MAS_45');

-- CreateEnum
CREATE TYPE "PreguntaEncuesta" AS ENUM ('SE_REALIZO', 'OPERADOR', 'INICIO', 'ENLACE', 'DURACION');

-- CreateTable
CREATE TABLE "EncuestaCita" (
    "id" TEXT NOT NULL,
    "solicitudId" TEXT NOT NULL,
    "origen" "OrigenEncuestaCita" NOT NULL,
    "seRealizo" BOOLEAN NOT NULL,
    "razonNoRealizo" "RazonNoSesion",
    "operador" "OperadorConvoco" NOT NULL,
    "inicio" "InicioSesion" NOT NULL,
    "enlace" "EnlaceFunciono" NOT NULL,
    "duracion" "DuracionSesion" NOT NULL,
    "respondidaEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EncuestaCita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidenteContradiccionEncuesta" (
    "id" TEXT NOT NULL,
    "solicitudId" TEXT NOT NULL,
    "pregunta" "PreguntaEncuesta" NOT NULL,
    "padreValor" TEXT NOT NULL,
    "profesionalValor" TEXT NOT NULL,
    "detectadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reclamadoEn" TIMESTAMPTZ(6) NOT NULL,
    "venceEn" TIMESTAMPTZ(6) NOT NULL,
    "resueltoEn" TIMESTAMPTZ(6),
    "resueltoPor" TEXT,

    CONSTRAINT "IncidenteContradiccionEncuesta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EncuestaCita_origen_respondidaEn_idx" ON "EncuestaCita"("origen", "respondidaEn");

-- CreateIndex
CREATE UNIQUE INDEX "EncuestaCita_solicitudId_origen_key" ON "EncuestaCita"("solicitudId", "origen");

-- CreateIndex
CREATE INDEX "IncidenteContradiccionEncuesta_resueltoEn_venceEn_idx" ON "IncidenteContradiccionEncuesta"("resueltoEn", "venceEn");

-- CreateIndex
CREATE UNIQUE INDEX "IncidenteContradiccionEncuesta_solicitudId_pregunta_key" ON "IncidenteContradiccionEncuesta"("solicitudId", "pregunta");

-- AddForeignKey
ALTER TABLE "EncuestaCita" ADD CONSTRAINT "EncuestaCita_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "SolicitudCita"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidenteContradiccionEncuesta" ADD CONSTRAINT "IncidenteContradiccionEncuesta_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "SolicitudCita"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ────────────────────────────────────────────────────────────────────────────
-- CHECK VALIDADOS (D-121 de Datos). Prisma es CIEGO a ellos: no los declara en el
-- modelo ni los borra en un `migrate dev` futuro, así que viven SOLO en la BD y los
-- prueba el candado de inserción real
-- (src/lib/profesional/cita/encuestas-cita-cruce-datos.candado.test.ts). Un CHECK
-- sin candado NO está verificado.
-- ────────────────────────────────────────────────────────────────────────────

-- (1) EncuestaCita · coherencia razón↔seRealizo en forma IFF (HUECO 2 del dictamen).
--     La razón de no-sesión está presente si y SÓLO si la sesión NO se realizó. Sin
--     este CHECK el TIPO deja representables dos filas incoherentes: seRealizo=true
--     con razón (dio la cita pero explica por qué no), y seRealizo=false sin razón
--     (no se dio y no se sabe por qué). `razonNoRealizo IS NOT NULL` y `seRealizo`
--     son ambos boolean NO-NULL → el predicado nunca es NULL, así que el IFF se
--     enforce estricto (un CHECK pasa con TRUE o NULL; acá NULL no ocurre).
ALTER TABLE "EncuestaCita"
  ADD CONSTRAINT "EncuestaCita_razon_sii_no_realizo_check"
  CHECK (("razonNoRealizo" IS NOT NULL) = ("seRealizo" = false));

-- (2) IncidenteContradiccionEncuesta · el plazo legal vence DESPUÉS del reclamo.
--     `venceEn` = `reclamadoEn` + 15 días hábiles lo calcula el service; este CHECK
--     es el PISO invariante: nunca un plazo que venza antes o en el mismo instante
--     del reclamo (eso dejaría el incidente VENCIDO_A_FAVOR_PADRE desde su
--     nacimiento, por `estadoEfectivoIncidente`). Ambas columnas NOT NULL → nunca NULL.
ALTER TABLE "IncidenteContradiccionEncuesta"
  ADD CONSTRAINT "IncidenteContradiccionEncuesta_vence_gt_reclamado_check"
  CHECK ("venceEn" > "reclamadoEn");
