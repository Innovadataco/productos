-- CreateTable
CREATE TABLE "sicov"."tbl_api_llamadas" (
    "apl_id" SERIAL NOT NULL,
    "apl_usuario_id" INTEGER NOT NULL,
    "apl_rol_id" INTEGER,
    "apl_nit_efectivo" VARCHAR(30),
    "apl_operacion" VARCHAR(60) NOT NULL,
    "apl_modo" VARCHAR(10) NOT NULL,
    "apl_metodo" VARCHAR(10),
    "apl_endpoint" VARCHAR(255),
    "apl_request" JSONB,
    "apl_respuesta" JSONB,
    "apl_status" INTEGER,
    "apl_duracion_ms" INTEGER,
    "apl_error" TEXT,
    "apl_creado" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_api_llamadas_pkey" PRIMARY KEY ("apl_id")
);

-- CreateIndex
CREATE INDEX "tbl_api_llamadas_apl_creado_idx" ON "sicov"."tbl_api_llamadas"("apl_creado");

-- CreateIndex
CREATE INDEX "tbl_api_llamadas_apl_operacion_idx" ON "sicov"."tbl_api_llamadas"("apl_operacion");

-- CreateIndex
CREATE INDEX "tbl_api_llamadas_apl_modo_idx" ON "sicov"."tbl_api_llamadas"("apl_modo");
