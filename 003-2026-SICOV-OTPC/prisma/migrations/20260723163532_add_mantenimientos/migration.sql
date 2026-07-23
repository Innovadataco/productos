-- CreateTable
CREATE TABLE "sicov"."tbl_tipo_mantenimientos" (
    "ttm_id" SERIAL NOT NULL,
    "ttm_nombre" VARCHAR(150),
    "ttm_estado" BOOLEAN DEFAULT true,
    "ttm_creado" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "ttm_actualizado" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_tipo_mantenimientos_pkey" PRIMARY KEY ("ttm_id")
);

-- CreateTable
CREATE TABLE "sicov"."tbl_archivo_programas" (
    "tap_id" SERIAL NOT NULL,
    "tap_nombre_original" VARCHAR(200),
    "tap_documento" VARCHAR(200),
    "tap_ruta" VARCHAR(200),
    "tap_tipo_id" INTEGER,
    "tap_usuario_id" INTEGER,
    "tap_estado" BOOLEAN DEFAULT true,
    "tap_creado" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "tap_actualizado" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_archivo_programas_pkey" PRIMARY KEY ("tap_id")
);

-- CreateTable
CREATE TABLE "sicov"."tbl_mantenimientos" (
    "tmt_id" SERIAL NOT NULL,
    "tmt_placa" VARCHAR(6),
    "tmt_fecha_diligenciamiento" TIMESTAMPTZ,
    "tmt_tipo_id" INTEGER,
    "tmt_usuario_id" BIGINT,
    "tmt_estado" BOOLEAN DEFAULT true,
    "tmt_procesado" BOOLEAN DEFAULT false,
    "tmt_mantenimiento_id" INTEGER,
    "tmt_creado" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "tmt_actualizado" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_mantenimientos_pkey" PRIMARY KEY ("tmt_id")
);

-- CreateTable
CREATE TABLE "sicov"."tbl_preventivos" (
    "tpv_id" SERIAL NOT NULL,
    "tpv_placa" VARCHAR(6),
    "tpv_fecha" DATE,
    "tpv_hora" VARCHAR(8),
    "tpv_nit" BIGINT,
    "tpv_razon_social" VARCHAR(200),
    "tpv_tipo_identificacion" INTEGER,
    "tpv_numero_identificacion" VARCHAR(255),
    "tpv_nombres_responsable" VARCHAR(255),
    "tpv_mantenimiento_id" INTEGER,
    "tpv_mantenimiento_id_externo" INTEGER,
    "tpv_detalle_actividades" TEXT,
    "tpv_estado" BOOLEAN DEFAULT true,
    "tpv_procesado" BOOLEAN DEFAULT false,
    "tpv_creado" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "tpv_actualizado" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_preventivos_pkey" PRIMARY KEY ("tpv_id")
);

-- CreateTable
CREATE TABLE "sicov"."tbl_correctivos" (
    "tcv_id" SERIAL NOT NULL,
    "tcv_placa" VARCHAR(6),
    "tcv_fecha" DATE,
    "tcv_hora" VARCHAR(8),
    "tcv_nit" BIGINT,
    "tcv_razon_social" VARCHAR(200),
    "tcv_tipo_identificacion" INTEGER,
    "tcv_numero_identificacion" VARCHAR(255),
    "tcv_nombres_responsable" VARCHAR(200),
    "tcv_mantenimiento_id" INTEGER,
    "tcv_mantenimiento_id_externo" INTEGER,
    "tcv_detalle_actividades" TEXT,
    "tcv_estado" BOOLEAN DEFAULT true,
    "tcv_procesado" BOOLEAN DEFAULT false,
    "tcv_creado" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "tcv_actualizado" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_correctivos_pkey" PRIMARY KEY ("tcv_id")
);

-- CreateTable
CREATE TABLE "sicov"."tbl_mantenimiento_jobs" (
    "tmj_id" SERIAL NOT NULL,
    "tmj_tipo" VARCHAR(20) NOT NULL,
    "tmj_mantenimiento_local_id" INTEGER,
    "tmj_detalle_id" INTEGER,
    "tmj_vigilado_id" VARCHAR(30) NOT NULL,
    "tmj_usuario_documento" VARCHAR(30) NOT NULL,
    "tmj_rol_id" INTEGER NOT NULL,
    "tmj_estado" VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    "tmj_reintentos" INTEGER NOT NULL DEFAULT 0,
    "tmj_ultimo_error" TEXT,
    "tmj_siguiente_intento" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "tmj_payload" JSON,
    "tmj_creado" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "tmj_actualizado" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_mantenimiento_jobs_pkey" PRIMARY KEY ("tmj_id")
);

-- CreateIndex
CREATE INDEX "tbl_archivo_programas_tap_usuario_id_tap_tipo_id_idx" ON "sicov"."tbl_archivo_programas"("tap_usuario_id", "tap_tipo_id");

-- CreateIndex
CREATE INDEX "tbl_mantenimientos_tmt_usuario_id_tmt_placa_tmt_tipo_id_idx" ON "sicov"."tbl_mantenimientos"("tmt_usuario_id", "tmt_placa", "tmt_tipo_id");

-- CreateIndex
CREATE INDEX "tbl_mantenimientos_tmt_procesado_idx" ON "sicov"."tbl_mantenimientos"("tmt_procesado");

-- CreateIndex
CREATE INDEX "tbl_preventivos_tpv_mantenimiento_id_idx" ON "sicov"."tbl_preventivos"("tpv_mantenimiento_id");

-- CreateIndex
CREATE INDEX "tbl_preventivos_tpv_procesado_idx" ON "sicov"."tbl_preventivos"("tpv_procesado");

-- CreateIndex
CREATE INDEX "tbl_correctivos_tcv_mantenimiento_id_idx" ON "sicov"."tbl_correctivos"("tcv_mantenimiento_id");

-- CreateIndex
CREATE INDEX "tbl_correctivos_tcv_procesado_idx" ON "sicov"."tbl_correctivos"("tcv_procesado");

-- CreateIndex
CREATE INDEX "tmj_estado_intento_idx" ON "sicov"."tbl_mantenimiento_jobs"("tmj_estado", "tmj_siguiente_intento");

-- CreateIndex
CREATE INDEX "tbl_mantenimiento_jobs_tmj_vigilado_id_idx" ON "sicov"."tbl_mantenimiento_jobs"("tmj_vigilado_id");

-- CreateIndex
CREATE INDEX "tbl_mantenimiento_jobs_tmj_mantenimiento_local_id_idx" ON "sicov"."tbl_mantenimiento_jobs"("tmj_mantenimiento_local_id");

-- AddForeignKey
ALTER TABLE "sicov"."tbl_archivo_programas" ADD CONSTRAINT "tbl_archivo_programas_tap_tipo_id_fkey" FOREIGN KEY ("tap_tipo_id") REFERENCES "sicov"."tbl_tipo_mantenimientos"("ttm_id") ON DELETE CASCADE ON UPDATE CASCADE;
