-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('DUENO', 'FAMILIA');

-- CreateEnum
CREATE TYPE "TipoFuente" AS ENUM ('TRII_CAJA', 'TRII_ORDENES', 'TRII_DIVIDENDOS', 'AV_CERTIFICACION', 'AV_LOTES');

-- CreateEnum
CREATE TYPE "EstadoCarga" AS ENUM ('VALIDANDO', 'CARGADO', 'RECHAZADO', 'REVERTIDO');

-- CreateEnum
CREATE TYPE "TipoInstrumento" AS ENUM ('ACCION', 'FIC');

-- CreateEnum
CREATE TYPE "Moneda" AS ENUM ('COP');

-- CreateEnum
CREATE TYPE "TipoMovimientoCaja" AS ENUM ('DEPOSITO', 'RETIRO');

-- CreateEnum
CREATE TYPE "EstadoMovimiento" AS ENUM ('APROBADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "LadoOrden" AS ENUM ('COMPRA', 'VENTA');

-- CreateEnum
CREATE TYPE "EstadoOrden" AS ENUM ('APROBADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoDividendo" AS ENUM ('ORDINARIO', 'EXTRAORDINARIO', 'FRACCION_ESCISION');

-- CreateEnum
CREATE TYPE "CategoriaAjusteCaja" AS ENUM ('APORTE_FIC', 'FRACCION_ESCISION', 'GMF', 'RETENCION', 'INTERES', 'CUSTODIA', 'OTRO');

-- CreateEnum
CREATE TYPE "FuenteAjuste" AS ENUM ('MANUAL', 'EXTRACTO', 'CERTIFICACION', 'INFERIDO');

-- CreateEnum
CREATE TYPE "OrigenLote" AS ENUM ('COMPRA', 'ESCISION');

-- CreateEnum
CREATE TYPE "FuenteCosto" AS ENUM ('TRII_ORDEN', 'AV_PORTAL');

-- CreateEnum
CREATE TYPE "MetodoAsignacion" AS ENUM ('FIFO', 'ESPECIFICA');

-- CreateEnum
CREATE TYPE "TipoEventoCorporativo" AS ENUM ('ESCISION');

-- CreateEnum
CREATE TYPE "TipoMovimientoFondo" AS ENUM ('CONSTITUCION', 'APORTE', 'RETIRO', 'AJUSTE');

-- CreateEnum
CREATE TYPE "EstadoPrecio" AS ENUM ('VERIFICADO', 'NO_VERIFICADO');

-- CreateEnum
CREATE TYPE "ResultadoConciliacion" AS ENUM ('CUADRA', 'NO_CUADRA', 'PARCIAL');

-- CreateEnum
CREATE TYPE "TipoControl" AS ENUM ('FRACCION', 'CANTIDAD', 'VALOR', 'EFECTIVO', 'FONDO', 'PRECIO', 'COSTO_LOTE');

-- CreateEnum
CREATE TYPE "ResultadoControl" AS ENUM ('CUADRA', 'NO_CUADRA', 'PENDIENTE_LIQUIDACION');

-- CreateTable
CREATE TABLE "usuario" (
    "id" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL,
    "telegramChatId" BIGINT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carga_archivo" (
    "id" TEXT NOT NULL,
    "tipoFuente" "TipoFuente" NOT NULL,
    "nombreArchivo" TEXT NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "fechaCorte" DATE,
    "estado" "EstadoCarga" NOT NULL,
    "filasTotal" INTEGER,
    "filasNuevas" INTEGER,
    "filasRepetidas" INTEGER,
    "errores" JSONB,
    "cargadoPorId" TEXT NOT NULL,
    "cargadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revertidaPorId" TEXT,
    "revertidaEn" TIMESTAMPTZ(6),

    CONSTRAINT "carga_archivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fila_fuente" (
    "id" TEXT NOT NULL,
    "tipoFuente" "TipoFuente" NOT NULL,
    "claveNatural" CHAR(64) NOT NULL,
    "ocurrencia" SMALLINT NOT NULL,
    "primeraCargaId" TEXT NOT NULL,
    "primeraFilaNo" INTEGER NOT NULL,
    "crudo" JSONB NOT NULL,

    CONSTRAINT "fila_fuente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fila_de_carga" (
    "cargaId" TEXT NOT NULL,
    "filaNo" INTEGER NOT NULL,
    "filaFuenteId" TEXT NOT NULL,

    CONSTRAINT "fila_de_carga_pkey" PRIMARY KEY ("cargaId","filaNo")
);

-- CreateTable
CREATE TABLE "instrumento" (
    "id" TEXT NOT NULL,
    "tipo" "TipoInstrumento" NOT NULL,
    "nemotecnico" TEXT,
    "simboloTrii" TEXT,
    "codigoFic" TEXT,
    "nombre" TEXT NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'COP',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "notaCosto" TEXT,

    CONSTRAINT "instrumento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simbolo_precio" (
    "id" TEXT NOT NULL,
    "instrumentoId" TEXT NOT NULL,
    "proveedor" TEXT NOT NULL DEFAULT 'yahoo',
    "simbolo" TEXT NOT NULL,
    "vigenteDesde" DATE NOT NULL,
    "vigenteHasta" DATE,
    "verificadoEn" DATE,
    "verificadoContra" TEXT,

    CONSTRAINT "simbolo_precio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendario_bvc" (
    "dia" DATE NOT NULL,
    "esHabil" BOOLEAN NOT NULL,
    "nota" TEXT,

    CONSTRAINT "calendario_bvc_pkey" PRIMARY KEY ("dia")
);

-- CreateTable
CREATE TABLE "movimiento_caja" (
    "id" TEXT NOT NULL,
    "filaFuenteId" TEXT NOT NULL,
    "ocurridoEn" TIMESTAMPTZ(6) NOT NULL,
    "fecha" DATE NOT NULL,
    "tipo" "TipoMovimientoCaja" NOT NULL,
    "estado" "EstadoMovimiento" NOT NULL,
    "monto" DECIMAL(20,4) NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'COP',

    CONSTRAINT "movimiento_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orden" (
    "id" TEXT NOT NULL,
    "filaFuenteId" TEXT NOT NULL,
    "ejecutadaEn" TIMESTAMPTZ(6) NOT NULL,
    "fechaOperacion" DATE NOT NULL,
    "fechaLiquidacion" DATE NOT NULL,
    "instrumentoId" TEXT NOT NULL,
    "lado" "LadoOrden" NOT NULL,
    "estado" "EstadoOrden" NOT NULL,
    "cantidadCompletada" BIGINT NOT NULL,
    "cantidadSolicitada" BIGINT,
    "cantidadPendiente" BIGINT NOT NULL DEFAULT 0,
    "precioUnitario" DECIMAL(20,6) NOT NULL,
    "totalInvertido" DECIMAL(20,4) NOT NULL,
    "comision" DECIMAL(20,4) NOT NULL,
    "totalEstimado" DECIMAL(20,4) NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'COP',

    CONSTRAINT "orden_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dividendo" (
    "id" TEXT NOT NULL,
    "filaFuenteId" TEXT NOT NULL,
    "fechaPago" DATE NOT NULL,
    "instrumentoId" TEXT NOT NULL,
    "tipo" "TipoDividendo" NOT NULL DEFAULT 'ORDINARIO',
    "montoNeto" DECIMAL(20,4) NOT NULL,
    "montoBruto" DECIMAL(20,4),
    "retencion" DECIMAL(20,4),
    "tasaRetencion" DECIMAL(9,6),
    "decretadoId" TEXT,
    "eventoId" TEXT,
    "moneda" "Moneda" NOT NULL DEFAULT 'COP',

    CONSTRAINT "dividendo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dividendo_decretado" (
    "id" TEXT NOT NULL,
    "instrumentoId" TEXT NOT NULL,
    "tipo" "TipoDividendo" NOT NULL,
    "valorPorAccion" DECIMAL(20,6) NOT NULL,
    "fechaPago" DATE NOT NULL,
    "fuente" TEXT NOT NULL,
    "nota" TEXT,

    CONSTRAINT "dividendo_decretado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajuste_caja" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "monto" DECIMAL(20,4) NOT NULL,
    "categoria" "CategoriaAjusteCaja" NOT NULL,
    "fuente" "FuenteAjuste" NOT NULL,
    "motivo" TEXT NOT NULL,
    "referenciaEvidencia" TEXT,
    "creadoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "moneda" "Moneda" NOT NULL DEFAULT 'COP',
    "eventoId" TEXT,

    CONSTRAINT "ajuste_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evento_corporativo" (
    "id" TEXT NOT NULL,
    "tipo" "TipoEventoCorporativo" NOT NULL,
    "fecha" DATE NOT NULL,
    "origenId" TEXT NOT NULL,
    "destinoId" TEXT NOT NULL,
    "razon" DECIMAL(20,10),
    "fechaPagoFraccion" DATE,
    "montoFraccion" DECIMAL(20,4),
    "nota" TEXT,

    CONSTRAINT "evento_corporativo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lote" (
    "id" TEXT NOT NULL,
    "instrumentoId" TEXT NOT NULL,
    "origen" "OrigenLote" NOT NULL,
    "ordenId" TEXT,
    "eventoId" TEXT,
    "loteOrigenId" TEXT,
    "fechaCompra" DATE NOT NULL,
    "fechaLiquidacion" DATE NOT NULL,
    "cantidad" BIGINT NOT NULL,
    "costoUnitario" DECIMAL(20,6) NOT NULL,
    "costoTotal" DECIMAL(20,4) NOT NULL,
    "comision" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "fuenteCosto" "FuenteCosto" NOT NULL,

    CONSTRAINT "lote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignacion_venta" (
    "id" TEXT NOT NULL,
    "ordenVentaId" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "cantidad" BIGINT NOT NULL,
    "costoBase" DECIMAL(20,4) NOT NULL,
    "metodo" "MetodoAsignacion" NOT NULL DEFAULT 'FIFO',
    "bloqueada" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "asignacion_venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fila_lote_av" (
    "id" TEXT NOT NULL,
    "cargaId" TEXT NOT NULL,
    "filaFuenteId" TEXT NOT NULL,
    "fechaCorte" DATE NOT NULL,
    "instrumentoId" TEXT NOT NULL,
    "fechaCompra" DATE NOT NULL,
    "cantidad" BIGINT NOT NULL,
    "precioCompra" DECIMAL(20,6) NOT NULL,
    "precioValoracion" DECIMAL(20,6),
    "valorMercado" DECIMAL(20,4),
    "loteId" TEXT,

    CONSTRAINT "fila_lote_av_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificacion" (
    "id" TEXT NOT NULL,
    "cargaId" TEXT NOT NULL,
    "fechaCorte" DATE NOT NULL,
    "saldoEfectivo" DECIMAL(20,4) NOT NULL,

    CONSTRAINT "certificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificacion_posicion" (
    "certificacionId" TEXT NOT NULL,
    "instrumentoId" TEXT NOT NULL,
    "cantidad" BIGINT NOT NULL,
    "precioValoracion" DECIMAL(20,6) NOT NULL,
    "valorMercado" DECIMAL(20,4) NOT NULL,
    "referenciaPdf" TEXT,

    CONSTRAINT "certificacion_posicion_pkey" PRIMARY KEY ("certificacionId","instrumentoId")
);

-- CreateTable
CREATE TABLE "certificacion_fondo" (
    "certificacionId" TEXT NOT NULL,
    "instrumentoId" TEXT NOT NULL,
    "encargo" TEXT NOT NULL,
    "saldo" DECIMAL(20,4) NOT NULL,
    "unidades" DECIMAL(24,8),

    CONSTRAINT "certificacion_fondo_pkey" PRIMARY KEY ("certificacionId","instrumentoId")
);

-- CreateTable
CREATE TABLE "movimiento_fondo" (
    "id" TEXT NOT NULL,
    "fondoId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "unidades" DECIMAL(24,8) NOT NULL,
    "monto" DECIMAL(20,4),
    "tipo" "TipoMovimientoFondo" NOT NULL,
    "fuente" "FuenteAjuste" NOT NULL,
    "ajusteCajaId" TEXT,

    CONSTRAINT "movimiento_fondo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "valor_unidad_fondo" (
    "id" TEXT NOT NULL,
    "fondoId" TEXT NOT NULL,
    "fechaValor" DATE NOT NULL,
    "valorUnidad" DECIMAL(20,8) NOT NULL,
    "valorFondo" DECIMAL(24,4),
    "fuente" TEXT NOT NULL DEFAULT 'sfc:qhpu-8ixx',
    "traidoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reemplazadoEn" TIMESTAMPTZ(6),

    CONSTRAINT "valor_unidad_fondo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "precio_cierre" (
    "id" TEXT NOT NULL,
    "instrumentoId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "precio" DECIMAL(20,6) NOT NULL,
    "fuente" TEXT NOT NULL,
    "estado" "EstadoPrecio" NOT NULL,
    "fuenteReferencia" TEXT,
    "precioReferencia" DECIMAL(20,6),
    "desviacionPct" DECIMAL(9,6),
    "traidoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reemplazadoEn" TIMESTAMPTZ(6),
    "moneda" "Moneda" NOT NULL DEFAULT 'COP',

    CONSTRAINT "precio_cierre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conciliacion" (
    "id" TEXT NOT NULL,
    "certificacionId" TEXT NOT NULL,
    "fechaCorte" DATE NOT NULL,
    "calculadaEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "versionCalculo" TEXT NOT NULL,
    "resultado" "ResultadoConciliacion" NOT NULL,

    CONSTRAINT "conciliacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "control_conciliacion" (
    "id" TEXT NOT NULL,
    "conciliacionId" TEXT NOT NULL,
    "tipo" "TipoControl" NOT NULL,
    "instrumentoId" TEXT,
    "esperado" DECIMAL(24,6),
    "real" DECIMAL(24,6),
    "diferencia" DECIMAL(24,6),
    "tolerancia" DECIMAL(9,6),
    "resultado" "ResultadoControl" NOT NULL,
    "codigoMotivo" TEXT,
    "detalle" JSONB,

    CONSTRAINT "control_conciliacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE INDEX "carga_archivo_tipoFuente_sha256_idx" ON "carga_archivo"("tipoFuente", "sha256");

-- CreateIndex
CREATE UNIQUE INDEX "fila_fuente_tipoFuente_claveNatural_ocurrencia_key" ON "fila_fuente"("tipoFuente", "claveNatural", "ocurrencia");

-- CreateIndex
CREATE INDEX "fila_de_carga_filaFuenteId_idx" ON "fila_de_carga"("filaFuenteId");

-- CreateIndex
CREATE UNIQUE INDEX "instrumento_nemotecnico_key" ON "instrumento"("nemotecnico");

-- CreateIndex
CREATE UNIQUE INDEX "instrumento_simboloTrii_key" ON "instrumento"("simboloTrii");

-- CreateIndex
CREATE UNIQUE INDEX "instrumento_codigoFic_key" ON "instrumento"("codigoFic");

-- CreateIndex
CREATE INDEX "simbolo_precio_instrumentoId_proveedor_idx" ON "simbolo_precio"("instrumentoId", "proveedor");

-- CreateIndex
CREATE UNIQUE INDEX "movimiento_caja_filaFuenteId_key" ON "movimiento_caja"("filaFuenteId");

-- CreateIndex
CREATE INDEX "movimiento_caja_fecha_idx" ON "movimiento_caja"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "orden_filaFuenteId_key" ON "orden"("filaFuenteId");

-- CreateIndex
CREATE INDEX "orden_instrumentoId_fechaOperacion_idx" ON "orden"("instrumentoId", "fechaOperacion");

-- CreateIndex
CREATE UNIQUE INDEX "dividendo_filaFuenteId_key" ON "dividendo"("filaFuenteId");

-- CreateIndex
CREATE INDEX "dividendo_instrumentoId_fechaPago_idx" ON "dividendo"("instrumentoId", "fechaPago");

-- CreateIndex
CREATE INDEX "dividendo_decretado_instrumentoId_fechaPago_idx" ON "dividendo_decretado"("instrumentoId", "fechaPago");

-- CreateIndex
CREATE INDEX "ajuste_caja_fecha_idx" ON "ajuste_caja"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "lote_ordenId_key" ON "lote"("ordenId");

-- CreateIndex
CREATE INDEX "lote_instrumentoId_fechaCompra_id_idx" ON "lote"("instrumentoId", "fechaCompra", "id");

-- CreateIndex
CREATE INDEX "asignacion_venta_loteId_idx" ON "asignacion_venta"("loteId");

-- CreateIndex
CREATE UNIQUE INDEX "asignacion_venta_ordenVentaId_loteId_key" ON "asignacion_venta"("ordenVentaId", "loteId");

-- CreateIndex
CREATE UNIQUE INDEX "fila_lote_av_filaFuenteId_key" ON "fila_lote_av"("filaFuenteId");

-- CreateIndex
CREATE INDEX "fila_lote_av_fechaCorte_instrumentoId_idx" ON "fila_lote_av"("fechaCorte", "instrumentoId");

-- CreateIndex
CREATE UNIQUE INDEX "certificacion_cargaId_key" ON "certificacion"("cargaId");

-- CreateIndex
CREATE UNIQUE INDEX "certificacion_fechaCorte_key" ON "certificacion"("fechaCorte");

-- CreateIndex
CREATE UNIQUE INDEX "movimiento_fondo_ajusteCajaId_key" ON "movimiento_fondo"("ajusteCajaId");

-- CreateIndex
CREATE INDEX "movimiento_fondo_fondoId_fecha_idx" ON "movimiento_fondo"("fondoId", "fecha");

-- CreateIndex
CREATE INDEX "valor_unidad_fondo_fondoId_fechaValor_idx" ON "valor_unidad_fondo"("fondoId", "fechaValor");

-- CreateIndex
CREATE INDEX "precio_cierre_instrumentoId_fecha_idx" ON "precio_cierre"("instrumentoId", "fecha");

-- CreateIndex
CREATE INDEX "conciliacion_fechaCorte_idx" ON "conciliacion"("fechaCorte");

-- CreateIndex
CREATE INDEX "control_conciliacion_conciliacionId_idx" ON "control_conciliacion"("conciliacionId");

-- AddForeignKey
ALTER TABLE "carga_archivo" ADD CONSTRAINT "carga_archivo_cargadoPorId_fkey" FOREIGN KEY ("cargadoPorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fila_fuente" ADD CONSTRAINT "fila_fuente_primeraCargaId_fkey" FOREIGN KEY ("primeraCargaId") REFERENCES "carga_archivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fila_de_carga" ADD CONSTRAINT "fila_de_carga_cargaId_fkey" FOREIGN KEY ("cargaId") REFERENCES "carga_archivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fila_de_carga" ADD CONSTRAINT "fila_de_carga_filaFuenteId_fkey" FOREIGN KEY ("filaFuenteId") REFERENCES "fila_fuente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simbolo_precio" ADD CONSTRAINT "simbolo_precio_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "instrumento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_caja" ADD CONSTRAINT "movimiento_caja_filaFuenteId_fkey" FOREIGN KEY ("filaFuenteId") REFERENCES "fila_fuente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden" ADD CONSTRAINT "orden_filaFuenteId_fkey" FOREIGN KEY ("filaFuenteId") REFERENCES "fila_fuente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden" ADD CONSTRAINT "orden_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "instrumento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dividendo" ADD CONSTRAINT "dividendo_filaFuenteId_fkey" FOREIGN KEY ("filaFuenteId") REFERENCES "fila_fuente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dividendo" ADD CONSTRAINT "dividendo_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "instrumento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dividendo" ADD CONSTRAINT "dividendo_decretadoId_fkey" FOREIGN KEY ("decretadoId") REFERENCES "dividendo_decretado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dividendo" ADD CONSTRAINT "dividendo_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "evento_corporativo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dividendo_decretado" ADD CONSTRAINT "dividendo_decretado_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "instrumento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajuste_caja" ADD CONSTRAINT "ajuste_caja_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajuste_caja" ADD CONSTRAINT "ajuste_caja_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "evento_corporativo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_corporativo" ADD CONSTRAINT "evento_corporativo_origenId_fkey" FOREIGN KEY ("origenId") REFERENCES "instrumento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_corporativo" ADD CONSTRAINT "evento_corporativo_destinoId_fkey" FOREIGN KEY ("destinoId") REFERENCES "instrumento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote" ADD CONSTRAINT "lote_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "instrumento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote" ADD CONSTRAINT "lote_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "orden"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote" ADD CONSTRAINT "lote_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "evento_corporativo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote" ADD CONSTRAINT "lote_loteOrigenId_fkey" FOREIGN KEY ("loteOrigenId") REFERENCES "lote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_venta" ADD CONSTRAINT "asignacion_venta_ordenVentaId_fkey" FOREIGN KEY ("ordenVentaId") REFERENCES "orden"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_venta" ADD CONSTRAINT "asignacion_venta_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fila_lote_av" ADD CONSTRAINT "fila_lote_av_cargaId_fkey" FOREIGN KEY ("cargaId") REFERENCES "carga_archivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fila_lote_av" ADD CONSTRAINT "fila_lote_av_filaFuenteId_fkey" FOREIGN KEY ("filaFuenteId") REFERENCES "fila_fuente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fila_lote_av" ADD CONSTRAINT "fila_lote_av_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "instrumento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fila_lote_av" ADD CONSTRAINT "fila_lote_av_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "lote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificacion" ADD CONSTRAINT "certificacion_cargaId_fkey" FOREIGN KEY ("cargaId") REFERENCES "carga_archivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificacion_posicion" ADD CONSTRAINT "certificacion_posicion_certificacionId_fkey" FOREIGN KEY ("certificacionId") REFERENCES "certificacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificacion_posicion" ADD CONSTRAINT "certificacion_posicion_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "instrumento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificacion_fondo" ADD CONSTRAINT "certificacion_fondo_certificacionId_fkey" FOREIGN KEY ("certificacionId") REFERENCES "certificacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificacion_fondo" ADD CONSTRAINT "certificacion_fondo_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "instrumento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_fondo" ADD CONSTRAINT "movimiento_fondo_fondoId_fkey" FOREIGN KEY ("fondoId") REFERENCES "instrumento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_fondo" ADD CONSTRAINT "movimiento_fondo_ajusteCajaId_fkey" FOREIGN KEY ("ajusteCajaId") REFERENCES "ajuste_caja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valor_unidad_fondo" ADD CONSTRAINT "valor_unidad_fondo_fondoId_fkey" FOREIGN KEY ("fondoId") REFERENCES "instrumento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precio_cierre" ADD CONSTRAINT "precio_cierre_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "instrumento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conciliacion" ADD CONSTRAINT "conciliacion_certificacionId_fkey" FOREIGN KEY ("certificacionId") REFERENCES "certificacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_conciliacion" ADD CONSTRAINT "control_conciliacion_conciliacionId_fkey" FOREIGN KEY ("conciliacionId") REFERENCES "conciliacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_conciliacion" ADD CONSTRAINT "control_conciliacion_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "instrumento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- 008 · Reglas que Prisma no expresa (MODELO-DATOS-FASE-1 §4). Escritas a mano.
-- Las verifica tests/integracion/reglas-base.test.ts: si una migración futura de
-- Prisma las borra, esa prueba se pone roja.
-- ============================================================================

-- CHECK: montos, cantidades y coherencia
ALTER TABLE "fila_fuente"       ADD CONSTRAINT "fila_fuente_ocurrencia_chk"      CHECK ("ocurrencia" >= 1);
ALTER TABLE "movimiento_caja"   ADD CONSTRAINT "movimiento_caja_monto_chk"       CHECK ("monto" > 0);
ALTER TABLE "orden"             ADD CONSTRAINT "orden_cantidades_chk"            CHECK ("cantidadCompletada" >= 0 AND "cantidadPendiente" >= 0);
ALTER TABLE "orden"             ADD CONSTRAINT "orden_montos_chk"                CHECK ("precioUnitario" > 0 AND "totalInvertido" >= 0 AND "comision" >= 0 AND "totalEstimado" >= 0);
ALTER TABLE "dividendo"         ADD CONSTRAINT "dividendo_neto_chk"              CHECK ("montoNeto" > 0);
ALTER TABLE "dividendo"         ADD CONSTRAINT "dividendo_bruto_chk"             CHECK ("montoBruto" IS NULL OR ("retencion" IS NOT NULL AND "montoBruto" - "retencion" = "montoNeto"));
ALTER TABLE "dividendo"         ADD CONSTRAINT "dividendo_fraccion_chk"          CHECK (("tipo" = 'FRACCION_ESCISION') = ("eventoId" IS NOT NULL));
ALTER TABLE "dividendo_decretado" ADD CONSTRAINT "dividendo_decretado_valor_chk" CHECK ("valorPorAccion" > 0);
ALTER TABLE "ajuste_caja"       ADD CONSTRAINT "ajuste_caja_monto_chk"           CHECK ("monto" <> 0);
ALTER TABLE "ajuste_caja"       ADD CONSTRAINT "ajuste_caja_fraccion_chk"        CHECK (("categoria" = 'FRACCION_ESCISION') = ("eventoId" IS NOT NULL));
ALTER TABLE "lote"              ADD CONSTRAINT "lote_cantidad_chk"               CHECK ("cantidad" > 0 AND "costoUnitario" >= 0 AND "costoTotal" >= 0 AND "comision" >= 0);
ALTER TABLE "lote"              ADD CONSTRAINT "lote_origen_chk"                 CHECK (
  ("origen" = 'COMPRA'   AND "ordenId" IS NOT NULL AND "eventoId" IS NULL AND "loteOrigenId" IS NULL) OR
  ("origen" = 'ESCISION' AND "ordenId" IS NULL AND "eventoId" IS NOT NULL AND "loteOrigenId" IS NOT NULL)
);
ALTER TABLE "asignacion_venta"  ADD CONSTRAINT "asignacion_venta_cantidad_chk"   CHECK ("cantidad" > 0 AND "costoBase" >= 0);
ALTER TABLE "instrumento"       ADD CONSTRAINT "instrumento_tipo_chk"            CHECK (
  ("tipo" = 'ACCION' AND "nemotecnico" IS NOT NULL) OR ("tipo" = 'FIC' AND "codigoFic" IS NOT NULL)
);
ALTER TABLE "valor_unidad_fondo" ADD CONSTRAINT "valor_unidad_fondo_valor_chk"   CHECK ("valorUnidad" > 0);
ALTER TABLE "precio_cierre"     ADD CONSTRAINT "precio_cierre_precio_chk"        CHECK ("precio" > 0);
ALTER TABLE "simbolo_precio"    ADD CONSTRAINT "simbolo_precio_vigencia_chk"     CHECK ("vigenteHasta" IS NULL OR "vigenteHasta" > "vigenteDesde");

-- Un solo dato vigente por día y fuente (los reemplazados quedan como historia)
CREATE UNIQUE INDEX "valor_unidad_fondo_vigente_key" ON "valor_unidad_fondo" ("fondoId", "fechaValor") WHERE "reemplazadoEn" IS NULL;
CREATE UNIQUE INDEX "precio_cierre_vigente_key"      ON "precio_cierre" ("instrumentoId", "fecha", "fuente") WHERE "reemplazadoEn" IS NULL;

-- Vigencias de símbolos que no se solapan por instrumento y proveedor
ALTER TABLE "simbolo_precio" ADD CONSTRAINT "simbolo_precio_sin_solape_excl"
  EXCLUDE USING gist ("instrumentoId" WITH =, "proveedor" WITH =, daterange("vigenteDesde", "vigenteHasta", '[)') WITH &&);

-- Solo inserción: los hechos importados no se editan ni se borran.
-- Corregir = revertir la carga completa (función propia en la SPEC de importación).
CREATE FUNCTION "inv_solo_insercion"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La tabla % es de solo inserción: los hechos importados no se editan ni se borran', TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "fila_fuente_solo_insercion"     BEFORE UPDATE OR DELETE ON "fila_fuente"     FOR EACH ROW EXECUTE FUNCTION "inv_solo_insercion"();
CREATE TRIGGER "fila_de_carga_solo_insercion"   BEFORE UPDATE OR DELETE ON "fila_de_carga"   FOR EACH ROW EXECUTE FUNCTION "inv_solo_insercion"();
CREATE TRIGGER "movimiento_caja_solo_insercion" BEFORE UPDATE OR DELETE ON "movimiento_caja" FOR EACH ROW EXECUTE FUNCTION "inv_solo_insercion"();
CREATE TRIGGER "orden_solo_insercion"           BEFORE UPDATE OR DELETE ON "orden"           FOR EACH ROW EXECUTE FUNCTION "inv_solo_insercion"();
CREATE TRIGGER "dividendo_solo_insercion"       BEFORE UPDATE OR DELETE ON "dividendo"       FOR EACH ROW EXECUTE FUNCTION "inv_solo_insercion"();
