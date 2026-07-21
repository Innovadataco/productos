-- CreateTable
CREATE TABLE "sicov"."tbl_roles" (
    "rol_id" SERIAL NOT NULL,
    "rol_nombre" VARCHAR(30),
    "rol_estado" BOOLEAN,
    "rol_root" BOOLEAN DEFAULT false,
    "rol_creado" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "rol_actualizado" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_roles_pkey" PRIMARY KEY ("rol_id")
);

-- CreateTable
CREATE TABLE "sicov"."tbl_usuarios" (
    "usn_id" SERIAL NOT NULL,
    "usn_nombre" VARCHAR(200) NOT NULL,
    "usn_identificacion" VARCHAR(255),
    "usn_usuario" VARCHAR(255),
    "usn_clave" VARCHAR(255),
    "usn_clave_temporal" BOOLEAN DEFAULT true,
    "usn_telefono" VARCHAR(255),
    "usn_correo" VARCHAR(255),
    "usn_token_autorizado" VARCHAR(255),
    "usn_rol_id" INTEGER,
    "usn_administrador" INTEGER,
    "usn_estado" BOOLEAN DEFAULT true,
    "usn_creacion" TIMESTAMPTZ,
    "usn_actualizacion" TIMESTAMPTZ,

    CONSTRAINT "tbl_usuarios_pkey" PRIMARY KEY ("usn_id")
);

-- CreateTable
CREATE TABLE "sicov"."tbl_modulos" (
    "mod_id" SERIAL NOT NULL,
    "mod_nombre" VARCHAR(30),
    "mod_nombre_mostrar" VARCHAR(30),
    "mod_ruta" VARCHAR(100),
    "mod_orden" INTEGER,
    "mod_icono" VARCHAR(255),
    "mod_estado" BOOLEAN,
    "mod_creado" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "mod_actualizado" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_modulos_pkey" PRIMARY KEY ("mod_id")
);

-- CreateTable
CREATE TABLE "sicov"."tbl_submodulos" (
    "smod_id" SERIAL NOT NULL,
    "smod_nombre" VARCHAR(30),
    "smod_nombre_mostrar" VARCHAR(30),
    "smod_ruta" VARCHAR(100),
    "smod_modulo" INTEGER,
    "smod_icono" VARCHAR(255),
    "smod_estado" BOOLEAN DEFAULT true,
    "smod_creado" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "smod_actualizado" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_submodulos_pkey" PRIMARY KEY ("smod_id")
);

-- CreateTable
CREATE TABLE "sicov"."tbl_funcionalidades" (
    "fun_id" SERIAL NOT NULL,
    "fun_nombre" VARCHAR(30),
    "fun_estado" BOOLEAN,
    "fun_creado" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "fun_actualizado" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_funcionalidades_pkey" PRIMARY KEY ("fun_id")
);

-- CreateTable
CREATE TABLE "sicov"."tbl_roles_modulos" (
    "rom_id" SERIAL NOT NULL,
    "rom_rol_id" INTEGER,
    "rom_modulo_id" INTEGER,
    "rom_creado" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "rom_actualizado" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_roles_modulos_pkey" PRIMARY KEY ("rom_id")
);

-- CreateTable
CREATE TABLE "sicov"."tbl_roles_modulos_funcionalidades" (
    "rmf_id" SERIAL NOT NULL,
    "rmf_rol_id" INTEGER,
    "rmf_modulo_id" INTEGER,
    "rmf_funcionalidad_id" INTEGER,
    "rmf_creado" TIMESTAMPTZ,
    "rmf_actualizado" TIMESTAMPTZ,

    CONSTRAINT "tbl_roles_modulos_funcionalidades_pkey" PRIMARY KEY ("rmf_id")
);

-- CreateTable
CREATE TABLE "sicov"."tbl_usuarios_modulos" (
    "usm_id" SERIAL NOT NULL,
    "usm_usuario_id" INTEGER,
    "usm_modulo_id" INTEGER,
    "usm_estado" BOOLEAN DEFAULT true,
    "usm_creado" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "usm_actualizado" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_usuarios_modulos_pkey" PRIMARY KEY ("usm_id")
);

-- CreateTable
CREATE TABLE "sicov"."tbl_bloqueo_usuarios" (
    "blu_id" SERIAL NOT NULL,
    "blu_identificacion" VARCHAR(255),
    "blu_intentos_fallidos" INTEGER DEFAULT 0,
    "blu_bloqueado" BOOLEAN DEFAULT false,
    "blu_ultimo_intento" TIMESTAMPTZ,
    "blu_actualizacion" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "blu_creacion" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_bloqueo_usuarios_pkey" PRIMARY KEY ("blu_id")
);

-- CreateTable
CREATE TABLE "sicov"."tbl_proveedores_vigilados" (
    "tpv_id" SERIAL NOT NULL,
    "tpv_empresa" VARCHAR(255),
    "tpv_vigilado" VARCHAR(255),
    "tpv_token" UUID,
    "tpv_estado" BOOLEAN DEFAULT true,
    "tpv_fecha_inicial" DATE,
    "tpv_fecha_final" DATE,
    "tpv_documento" VARCHAR(255),
    "tpv_ruta" VARCHAR(255),
    "tpv_nombre_original" VARCHAR(255),
    "tpv_created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "tpv_updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_proveedores_vigilados_pkey" PRIMARY KEY ("tpv_id")
);

-- CreateTable
CREATE TABLE "sicov"."tbl_despachos_solicitudes" (
    "des_sol_id" SERIAL NOT NULL,
    "des_sol_payload" JSON NOT NULL,
    "des_sol_nit_vigilado" VARCHAR(20) NOT NULL,
    "des_sol_usuario_id" VARCHAR(20) NOT NULL,
    "des_sol_fuente" VARCHAR(10) NOT NULL DEFAULT 'WEB',
    "des_sol_procesado" BOOLEAN NOT NULL DEFAULT false,
    "des_sol_id_despacho_externo" INTEGER,
    "des_sol_respuesta_externa" JSON,
    "des_sol_error_externo" TEXT,
    "des_sol_estado" VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    "des_sol_reintentos" INTEGER NOT NULL DEFAULT 0,
    "des_sol_rol_id" INTEGER,
    "des_sol_siguiente_intento" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "des_sol_fecha_creacion" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "des_sol_fecha_actualizacion" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_despachos_solicitudes_pkey" PRIMARY KEY ("des_sol_id")
);

-- CreateTable
CREATE TABLE "sicov"."tbl_estados" (
    "est_id" SERIAL NOT NULL,
    "est_nombre" VARCHAR(150),
    "est_estado" BOOLEAN DEFAULT true,

    CONSTRAINT "tbl_estados_pkey" PRIMARY KEY ("est_id")
);

-- CreateTable
CREATE TABLE "sicov"."tbl_logs_errores" (
    "log_id" SERIAL NOT NULL,
    "log_mensaje" VARCHAR(1024) NOT NULL,
    "log_stack_trace" TEXT,
    "log_usuario" VARCHAR(255),
    "log_endpoint" VARCHAR(255),
    "log_creacion" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_logs_errores_pkey" PRIMARY KEY ("log_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tbl_usuarios_usn_identificacion_key" ON "sicov"."tbl_usuarios"("usn_identificacion");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_usuarios_usn_usuario_key" ON "sicov"."tbl_usuarios"("usn_usuario");

-- CreateIndex
CREATE INDEX "tbl_usuarios_usn_rol_id_idx" ON "sicov"."tbl_usuarios"("usn_rol_id");

-- CreateIndex
CREATE INDEX "tbl_usuarios_usn_administrador_idx" ON "sicov"."tbl_usuarios"("usn_administrador");

-- CreateIndex
CREATE INDEX "tbl_usuarios_usn_estado_idx" ON "sicov"."tbl_usuarios"("usn_estado");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_usuarios_modulos_usm_usuario_id_usm_modulo_id_key" ON "sicov"."tbl_usuarios_modulos"("usm_usuario_id", "usm_modulo_id");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_bloqueo_usuarios_blu_identificacion_key" ON "sicov"."tbl_bloqueo_usuarios"("blu_identificacion");

-- CreateIndex
CREATE INDEX "tbl_proveedores_vigilados_tpv_documento_idx" ON "sicov"."tbl_proveedores_vigilados"("tpv_documento");

-- CreateIndex
CREATE INDEX "tbl_proveedores_vigilados_tpv_estado_idx" ON "sicov"."tbl_proveedores_vigilados"("tpv_estado");

-- CreateIndex
CREATE INDEX "des_sol_estado_intento_idx" ON "sicov"."tbl_despachos_solicitudes"("des_sol_estado", "des_sol_siguiente_intento");

-- CreateIndex
CREATE INDEX "tbl_despachos_solicitudes_des_sol_nit_vigilado_idx" ON "sicov"."tbl_despachos_solicitudes"("des_sol_nit_vigilado");

-- AddForeignKey
ALTER TABLE "sicov"."tbl_usuarios" ADD CONSTRAINT "tbl_usuarios_usn_rol_id_fkey" FOREIGN KEY ("usn_rol_id") REFERENCES "sicov"."tbl_roles"("rol_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sicov"."tbl_submodulos" ADD CONSTRAINT "tbl_submodulos_smod_modulo_fkey" FOREIGN KEY ("smod_modulo") REFERENCES "sicov"."tbl_modulos"("mod_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sicov"."tbl_roles_modulos" ADD CONSTRAINT "tbl_roles_modulos_rom_rol_id_fkey" FOREIGN KEY ("rom_rol_id") REFERENCES "sicov"."tbl_roles"("rol_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sicov"."tbl_roles_modulos" ADD CONSTRAINT "tbl_roles_modulos_rom_modulo_id_fkey" FOREIGN KEY ("rom_modulo_id") REFERENCES "sicov"."tbl_modulos"("mod_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sicov"."tbl_roles_modulos_funcionalidades" ADD CONSTRAINT "tbl_roles_modulos_funcionalidades_rmf_rol_id_fkey" FOREIGN KEY ("rmf_rol_id") REFERENCES "sicov"."tbl_roles"("rol_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sicov"."tbl_roles_modulos_funcionalidades" ADD CONSTRAINT "tbl_roles_modulos_funcionalidades_rmf_modulo_id_fkey" FOREIGN KEY ("rmf_modulo_id") REFERENCES "sicov"."tbl_modulos"("mod_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sicov"."tbl_roles_modulos_funcionalidades" ADD CONSTRAINT "tbl_roles_modulos_funcionalidades_rmf_funcionalidad_id_fkey" FOREIGN KEY ("rmf_funcionalidad_id") REFERENCES "sicov"."tbl_funcionalidades"("fun_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sicov"."tbl_usuarios_modulos" ADD CONSTRAINT "tbl_usuarios_modulos_usm_usuario_id_fkey" FOREIGN KEY ("usm_usuario_id") REFERENCES "sicov"."tbl_usuarios"("usn_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sicov"."tbl_usuarios_modulos" ADD CONSTRAINT "tbl_usuarios_modulos_usm_modulo_id_fkey" FOREIGN KEY ("usm_modulo_id") REFERENCES "sicov"."tbl_modulos"("mod_id") ON DELETE CASCADE ON UPDATE CASCADE;
