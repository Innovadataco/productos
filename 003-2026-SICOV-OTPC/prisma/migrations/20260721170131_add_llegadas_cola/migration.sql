-- CreateTable
CREATE TABLE "sicov"."tbl_llegadas_solicitudes" (
    "lle_sol_id" SERIAL NOT NULL,
    "lle_sol_payload" JSON NOT NULL,
    "lle_sol_nit_vigilado" VARCHAR(20) NOT NULL,
    "lle_sol_usuario_id" VARCHAR(20) NOT NULL,
    "lle_sol_fuente" VARCHAR(10) NOT NULL DEFAULT 'WEB',
    "lle_sol_tipo_llegada" INTEGER NOT NULL,
    "lle_sol_id_despacho" INTEGER,
    "lle_sol_placa" VARCHAR(10) NOT NULL,
    "lle_sol_procesado" BOOLEAN NOT NULL DEFAULT false,
    "lle_sol_id_llegada_externo" INTEGER,
    "lle_sol_respuesta_externa" JSON,
    "lle_sol_error_externo" TEXT,
    "lle_sol_estado" VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    "lle_sol_reintentos" INTEGER NOT NULL DEFAULT 0,
    "lle_sol_rol_id" INTEGER,
    "lle_sol_siguiente_intento" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "lle_sol_fecha_creacion" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "lle_sol_fecha_actualizacion" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_llegadas_solicitudes_pkey" PRIMARY KEY ("lle_sol_id")
);

-- CreateIndex
CREATE INDEX "lle_sol_estado_intento_idx" ON "sicov"."tbl_llegadas_solicitudes"("lle_sol_estado", "lle_sol_siguiente_intento");

-- CreateIndex
CREATE INDEX "tbl_llegadas_solicitudes_lle_sol_nit_vigilado_idx" ON "sicov"."tbl_llegadas_solicitudes"("lle_sol_nit_vigilado");
