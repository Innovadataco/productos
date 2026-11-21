-- CreateEnum
CREATE TYPE "AccionPlan" AS ENUM ('COMPRAR', 'VENDER', 'NO_ACTUAR');

-- CreateEnum
CREATE TYPE "CondicionRegla" AS ENUM ('NINGUNA', 'CIERRE_BAJO', 'CIERRE_SOBRE', 'MONTO_ORDEN_BAJO', 'LIBRE');

-- CreateTable
CREATE TABLE "plan_version" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "vigenteDesde" DATE NOT NULL,
    "motivo" TEXT NOT NULL,
    "aprobadaPorId" TEXT NOT NULL,
    "creadaEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regla_plan" (
    "id" TEXT NOT NULL,
    "planVersionId" TEXT NOT NULL,
    "instrumentoId" TEXT,
    "condicion" "CondicionRegla" NOT NULL,
    "nivel" DECIMAL(20,6),
    "accion" "AccionPlan" NOT NULL,
    "cantidad" BIGINT,
    "plazoHasta" DATE,
    "detalle" TEXT NOT NULL,

    CONSTRAINT "regla_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision" (
    "id" TEXT NOT NULL,
    "planVersionId" TEXT NOT NULL,
    "reglaId" TEXT,
    "instrumentoId" TEXT NOT NULL,
    "accion" "AccionPlan" NOT NULL,
    "cantidad" BIGINT,
    "excepcion" BOOLEAN NOT NULL DEFAULT false,
    "motivo" TEXT NOT NULL,
    "decididaPorId" TEXT NOT NULL,
    "fechaDecision" DATE NOT NULL,
    "registradaEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reemplazaId" TEXT,

    CONSTRAINT "decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enlace_decision_orden" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "reemplazaId" TEXT,
    "motivo" TEXT,
    "creadoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enlace_decision_orden_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_version_version_key" ON "plan_version"("version");

-- CreateIndex
CREATE INDEX "regla_plan_planVersionId_idx" ON "regla_plan"("planVersionId");

-- CreateIndex
CREATE INDEX "regla_plan_instrumentoId_idx" ON "regla_plan"("instrumentoId");

-- CreateIndex
CREATE UNIQUE INDEX "regla_plan_id_planVersionId_key" ON "regla_plan"("id", "planVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "decision_reemplazaId_key" ON "decision"("reemplazaId");

-- CreateIndex
CREATE INDEX "decision_instrumentoId_fechaDecision_idx" ON "decision"("instrumentoId", "fechaDecision");

-- CreateIndex
CREATE INDEX "decision_planVersionId_idx" ON "decision"("planVersionId");

-- CreateIndex
CREATE INDEX "decision_reglaId_planVersionId_idx" ON "decision"("reglaId", "planVersionId");

-- CreateIndex
CREATE INDEX "enlace_decision_orden_ordenId_idx" ON "enlace_decision_orden"("ordenId");

-- CreateIndex
CREATE INDEX "enlace_decision_orden_decisionId_idx" ON "enlace_decision_orden"("decisionId");

-- CreateIndex
CREATE UNIQUE INDEX "enlace_decision_orden_id_ordenId_key" ON "enlace_decision_orden"("id", "ordenId");

-- CreateIndex
CREATE UNIQUE INDEX "enlace_decision_orden_reemplazaId_ordenId_key" ON "enlace_decision_orden"("reemplazaId", "ordenId");

-- AddForeignKey
ALTER TABLE "plan_version" ADD CONSTRAINT "plan_version_aprobadaPorId_fkey" FOREIGN KEY ("aprobadaPorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "regla_plan" ADD CONSTRAINT "regla_plan_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "plan_version"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "regla_plan" ADD CONSTRAINT "regla_plan_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "instrumento"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "decision" ADD CONSTRAINT "decision_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "plan_version"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "decision" ADD CONSTRAINT "decision_reglaId_planVersionId_fkey" FOREIGN KEY ("reglaId", "planVersionId") REFERENCES "regla_plan"("id", "planVersionId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "decision" ADD CONSTRAINT "decision_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "instrumento"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "decision" ADD CONSTRAINT "decision_decididaPorId_fkey" FOREIGN KEY ("decididaPorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "decision" ADD CONSTRAINT "decision_reemplazaId_fkey" FOREIGN KEY ("reemplazaId") REFERENCES "decision"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "enlace_decision_orden" ADD CONSTRAINT "enlace_decision_orden_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "orden"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "enlace_decision_orden" ADD CONSTRAINT "enlace_decision_orden_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "decision"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "enlace_decision_orden" ADD CONSTRAINT "enlace_decision_orden_reemplazaId_ordenId_fkey" FOREIGN KEY ("reemplazaId", "ordenId") REFERENCES "enlace_decision_orden"("id", "ordenId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "enlace_decision_orden" ADD CONSTRAINT "enlace_decision_orden_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ============================================================================
-- 008 · Fase B (plan, reglas y decisiones): reglas que Prisma no expresa. Escritas a mano.
-- Las verifica tests/integracion/plan.test.ts; la lista de disparadores, también
-- tests/integracion/reglas-base.test.ts. Si una migración futura las borra, esas pruebas se ponen rojas.
-- ============================================================================

-- CHECK: textos con contenido y de 2000 caracteres como máximo (MAX_TEXTO del dominio), niveles y
-- cantidades coherentes
ALTER TABLE "plan_version" ADD CONSTRAINT "plan_version_version_chk" CHECK ("version" >= 1);
ALTER TABLE "plan_version" ADD CONSTRAINT "plan_version_motivo_chk" CHECK ("motivo" ~ '[^[:space:]]' AND char_length("motivo") <= 2000);
-- El nivel va solo con las condiciones que se calculan (cierre o monto por orden), y es positivo.
ALTER TABLE "regla_plan"   ADD CONSTRAINT "regla_plan_nivel_chk"     CHECK (
  ("condicion" IN ('NINGUNA', 'LIBRE')) = ("nivel" IS NULL) AND ("nivel" IS NULL OR "nivel" > 0)
);
ALTER TABLE "regla_plan"   ADD CONSTRAINT "regla_plan_cantidad_chk"  CHECK ("cantidad" IS NULL OR "cantidad" > 0);
ALTER TABLE "regla_plan"   ADD CONSTRAINT "regla_plan_detalle_chk"   CHECK ("detalle" ~ '[^[:space:]]' AND char_length("detalle") <= 2000);
-- «No actuar» se mide sobre su cantidad: sin ella no hay resultado. En compra o venta mide la orden.
ALTER TABLE "decision"     ADD CONSTRAINT "decision_cantidad_chk"    CHECK (
  ("cantidad" IS NULL OR "cantidad" > 0) AND ("accion" <> 'NO_ACTUAR' OR "cantidad" IS NOT NULL)
);
ALTER TABLE "decision"     ADD CONSTRAINT "decision_motivo_chk"      CHECK ("motivo" ~ '[^[:space:]]' AND char_length("motivo") <= 2000);
-- Una excepción siempre cita la regla de la que se aparta.
ALTER TABLE "decision"     ADD CONSTRAINT "decision_excepcion_chk"   CHECK (NOT "excepcion" OR "reglaId" IS NOT NULL);
ALTER TABLE "decision"     ADD CONSTRAINT "decision_reemplazo_chk"   CHECK ("reemplazaId" IS NULL OR "reemplazaId" <> "id");
ALTER TABLE "enlace_decision_orden" ADD CONSTRAINT "enlace_decision_orden_motivo_chk" CHECK ("motivo" IS NULL OR char_length("motivo") <= 2000);
-- Una corrección de enlace exige motivo y no se reemplaza a sí misma.
ALTER TABLE "enlace_decision_orden" ADD CONSTRAINT "enlace_decision_orden_reemplazo_chk" CHECK (
  "reemplazaId" IS NULL OR ("reemplazaId" <> "id" AND "motivo" IS NOT NULL AND "motivo" ~ '[^[:space:]]')
);

-- Un solo enlace raíz por orden. Con la FK compuesta (reemplazaId, ordenId) y la unicidad de
-- (reemplazaId, ordenId), la cadena de cada orden es lineal: un solo enlace vigente.
CREATE UNIQUE INDEX "enlace_decision_orden_raiz_key" ON "enlace_decision_orden" ("ordenId") WHERE "reemplazaId" IS NULL;

-- Solo inserción, con la misma función y la misma salida de reversión que los hechos importados.
CREATE TRIGGER "plan_version_solo_insercion"          BEFORE UPDATE OR DELETE ON "plan_version"          FOR EACH ROW EXECUTE FUNCTION "inv_solo_insercion"();
CREATE TRIGGER "regla_plan_solo_insercion"            BEFORE UPDATE OR DELETE ON "regla_plan"            FOR EACH ROW EXECUTE FUNCTION "inv_solo_insercion"();
CREATE TRIGGER "decision_solo_insercion"              BEFORE UPDATE OR DELETE ON "decision"              FOR EACH ROW EXECUTE FUNCTION "inv_solo_insercion"();
CREATE TRIGGER "enlace_decision_orden_solo_insercion" BEFORE UPDATE OR DELETE ON "enlace_decision_orden" FOR EACH ROW EXECUTE FUNCTION "inv_solo_insercion"();
