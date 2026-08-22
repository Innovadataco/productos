-- SPEC-210 (002-PI-110): modelos base del módulo de pagos.
-- Migración aditiva pura: solo CREATE TYPE, CREATE TABLE, ADD COLUMN,
-- CREATE INDEX y ADD FOREIGN KEY. Cero DROP COLUMN / DROP TABLE.

-- Enums
CREATE TYPE "TipoTitular" AS ENUM ('COLEGIO', 'PADRE');
CREATE TYPE "EstadoSuscripcion" AS ENUM ('ACTIVA', 'EN_GRACIA', 'SUSPENDIDA', 'CANCELADA');
CREATE TYPE "DuracionPlan" AS ENUM ('MES_1', 'MES_2', 'MES_3', 'MES_6', 'MES_12');
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE_AUTORIZACION', 'AUTORIZADO', 'RECHAZADO');
CREATE TYPE "MetodoPago" AS ENUM ('TRANSFERENCIA', 'NEQUI', 'DAVIPLATA', 'PSE_MANUAL', 'EFECTIVO', 'CHEQUE', 'OTRO');
CREATE TYPE "TipoBono" AS ENUM ('DESCUENTO_PCT', 'DESCUENTO_FIJO_USD', 'MESES_GRATIS');
CREATE TYPE "FuenteTasa" AS ENUM ('API', 'ADMIN_MANUAL');

-- Enriquecer el placeholder Plan aditivamente. Los campos legacy (nombre,
-- descripcion, precio, creadoEn) se conservan sin tocar.
ALTER TABLE "Plan"
    ADD COLUMN "tipoTitular" "TipoTitular" NOT NULL,
    ADD COLUMN "duracion" "DuracionPlan" NOT NULL,
    ADD COLUMN "anio" INTEGER NOT NULL,
    ADD COLUMN "precioBaseUSD" DOUBLE PRECISION NOT NULL,
    ADD COLUMN "descuentoAnualPct" DOUBLE PRECISION,
    ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "creadoPorAdminId" TEXT NOT NULL,
    ADD COLUMN "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Tablas del módulo de pagos
CREATE TABLE "Suscripcion" (
    "id" TEXT NOT NULL,
    "tipoTitular" "TipoTitular" NOT NULL,
    "colegioId" TEXT,
    "usuarioId" TEXT,
    "estado" "EstadoSuscripcion" NOT NULL,
    "planActualId" TEXT NOT NULL,
    "contratoPDFUrl" TEXT,
    "fechaInicio" TIMESTAMPTZ(6) NOT NULL,
    "fechaFin" TIMESTAMPTZ(6) NOT NULL,
    "fechaCorteProgramado" TIMESTAMPTZ(6),
    "esFreemium" BOOLEAN NOT NULL DEFAULT false,
    "freemiumFechaFin" TIMESTAMPTZ(6),
    "codigoReferidoPropio" TEXT NOT NULL,
    "codigoReferidoUsado" TEXT,
    "monedaLocal" TEXT NOT NULL DEFAULT 'COP',
    "paisCliente" TEXT NOT NULL DEFAULT 'CO',
    "suspendidaEn" TIMESTAMPTZ(6),
    "canceladaEn" TIMESTAMPTZ(6),
    "canceladaPorUsuario" BOOLEAN,
    "motivoCancelacion" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Suscripcion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Pago" (
    "id" TEXT NOT NULL,
    "suscripcionId" TEXT NOT NULL,
    "duracionCubierta" "DuracionPlan" NOT NULL,
    "montoBaseUSD" DOUBLE PRECISION NOT NULL,
    "descuentoAplicadoUSD" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "montoNetoUSD" DOUBLE PRECISION NOT NULL,
    "tasaCambioAplicada" DOUBLE PRECISION NOT NULL,
    "montoLocalPagado" DOUBLE PRECISION NOT NULL,
    "monedaLocal" TEXT NOT NULL,
    "metodoDeclarado" "MetodoPago" NOT NULL,
    "comprobanteAdjuntoUrl" TEXT NOT NULL,
    "comprobanteMimeType" TEXT NOT NULL,
    "comprobanteHashSha256" TEXT NOT NULL,
    "fechaReporte" TIMESTAMPTZ(6) NOT NULL,
    "fechaAutorizacion" TIMESTAMPTZ(6),
    "estado" "EstadoPago" NOT NULL,
    "motivoRechazo" TEXT,
    "autorizadoPorAdminId" TEXT,
    "codigoReferidoUsado" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BonoPromocional" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoBono" NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "vigenciaInicio" TIMESTAMPTZ(6) NOT NULL,
    "vigenciaFin" TIMESTAMPTZ(6) NOT NULL,
    "usosMaximosTotales" INTEGER,
    "usosMaximosPorCliente" INTEGER NOT NULL DEFAULT 1,
    "aplicaANuevos" BOOLEAN NOT NULL DEFAULT true,
    "aplicaARenovaciones" BOOLEAN NOT NULL DEFAULT false,
    "aplicaSoloA" "TipoTitular",
    "combinableConCodigoPersonal" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "descripcion" TEXT,
    "creadoPorAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BonoPromocional_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BonoAplicado" (
    "id" TEXT NOT NULL,
    "bonoId" TEXT NOT NULL,
    "suscripcionId" TEXT NOT NULL,
    "pagoId" TEXT,
    "aplicadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descuentoUSD" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "BonoAplicado_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CodigoReferidoUso" (
    "id" TEXT NOT NULL,
    "codigoReferidoUsuarioId" TEXT NOT NULL,
    "suscripcionReferidaId" TEXT NOT NULL,
    "fechaRegistro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaActivacion" TIMESTAMPTZ(6),
    "recompensaOtorgada" BOOLEAN NOT NULL DEFAULT false,
    "recompensaOtorgadaEn" TIMESTAMPTZ(6),
    "tipoRecompensa" TEXT,
    "anio" INTEGER NOT NULL,
    "requiereRevisionAdmin" BOOLEAN NOT NULL DEFAULT false,
    "revisadaPorAdminId" TEXT,
    "revisionOK" BOOLEAN,

    CONSTRAINT "CodigoReferidoUso_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TasaCambio" (
    "id" TEXT NOT NULL,
    "monedaOrigen" TEXT NOT NULL,
    "monedaDestino" TEXT NOT NULL,
    "tasa" DOUBLE PRECISION NOT NULL,
    "fecha" TIMESTAMPTZ(6) NOT NULL,
    "fuente" "FuenteTasa" NOT NULL,
    "apiUrl" TEXT,
    "ingresadoPorAdminId" TEXT,
    "motivoManual" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TasaCambio_pkey" PRIMARY KEY ("id")
);

-- Índices
CREATE UNIQUE INDEX "Suscripcion_codigoReferidoPropio_key" ON "Suscripcion"("codigoReferidoPropio");
CREATE INDEX "Suscripcion_estado_fechaFin_idx" ON "Suscripcion"("estado", "fechaFin");
CREATE INDEX "Suscripcion_tipoTitular_estado_idx" ON "Suscripcion"("tipoTitular", "estado");

CREATE INDEX "Pago_suscripcionId_createdAt_idx" ON "Pago"("suscripcionId", "createdAt");
CREATE INDEX "Pago_estado_fechaReporte_idx" ON "Pago"("estado", "fechaReporte");

CREATE UNIQUE INDEX "BonoPromocional_nombre_key" ON "BonoPromocional"("nombre");
CREATE INDEX "BonoPromocional_activo_vigenciaInicio_vigenciaFin_idx" ON "BonoPromocional"("activo", "vigenciaInicio", "vigenciaFin");

CREATE INDEX "BonoAplicado_bonoId_aplicadoEn_idx" ON "BonoAplicado"("bonoId", "aplicadoEn");

CREATE UNIQUE INDEX "CodigoReferidoUso_codigoReferidoUsuarioId_suscripcionReferi_key" ON "CodigoReferidoUso"("codigoReferidoUsuarioId", "suscripcionReferidaId");
CREATE INDEX "CodigoReferidoUso_codigoReferidoUsuarioId_anio_idx" ON "CodigoReferidoUso"("codigoReferidoUsuarioId", "anio");

CREATE INDEX "TasaCambio_monedaDestino_fecha_idx" ON "TasaCambio"("monedaDestino", "fecha");

CREATE UNIQUE INDEX "Plan_tipoTitular_duracion_anio_key" ON "Plan"("tipoTitular", "duracion", "anio");
CREATE INDEX "Plan_activo_anio_idx" ON "Plan"("activo", "anio");

-- Foreign keys
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_creadoPorAdminId_fkey" FOREIGN KEY ("creadoPorAdminId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Suscripcion" ADD CONSTRAINT "Suscripcion_colegioId_fkey" FOREIGN KEY ("colegioId") REFERENCES "Colegio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Suscripcion" ADD CONSTRAINT "Suscripcion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Suscripcion" ADD CONSTRAINT "Suscripcion_planActualId_fkey" FOREIGN KEY ("planActualId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Pago" ADD CONSTRAINT "Pago_suscripcionId_fkey" FOREIGN KEY ("suscripcionId") REFERENCES "Suscripcion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_autorizadoPorAdminId_fkey" FOREIGN KEY ("autorizadoPorAdminId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BonoPromocional" ADD CONSTRAINT "BonoPromocional_creadoPorAdminId_fkey" FOREIGN KEY ("creadoPorAdminId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BonoAplicado" ADD CONSTRAINT "BonoAplicado_bonoId_fkey" FOREIGN KEY ("bonoId") REFERENCES "BonoPromocional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BonoAplicado" ADD CONSTRAINT "BonoAplicado_suscripcionId_fkey" FOREIGN KEY ("suscripcionId") REFERENCES "Suscripcion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BonoAplicado" ADD CONSTRAINT "BonoAplicado_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "Pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CodigoReferidoUso" ADD CONSTRAINT "CodigoReferidoUso_codigoReferidoUsuarioId_fkey" FOREIGN KEY ("codigoReferidoUsuarioId") REFERENCES "Suscripcion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CodigoReferidoUso" ADD CONSTRAINT "CodigoReferidoUso_suscripcionReferidaId_fkey" FOREIGN KEY ("suscripcionReferidaId") REFERENCES "Suscripcion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CodigoReferidoUso" ADD CONSTRAINT "CodigoReferidoUso_revisadaPorAdminId_fkey" FOREIGN KEY ("revisadaPorAdminId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TasaCambio" ADD CONSTRAINT "TasaCambio_ingresadoPorAdminId_fkey" FOREIGN KEY ("ingresadoPorAdminId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
