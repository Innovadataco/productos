-- SPEC-584 (Fases 2 y 3) · Control de acceso auditado al texto cifrado del reporte.
--
-- ADITIVA: no toca tablas ni columnas existentes. Dos tablas nuevas:
--
-- 1. `LecturaReporte` — auditoría de CADA visualización de un campo cifrado
--    (texto | textoOriginal) de un reporte o evento de expediente. Guarda QUIÉN
--    (usuario de plataforma o actor externo con su código temporal), QUÉ campo vio
--    y el sha-256 del contenido visto — NUNCA el texto literal (decisión 1a del
--    dueño, 2026-09-07).
-- 2. `CodigoAccesoContenido` — código temporal de acceso externo: el padre dueño
--    del reporte lo solicita (vigencia 30 min para canjear), un profesional o el
--    mismo padre autenticado lo canjea UNA sola vez y el canje abre una sesión de
--    visualización de 15 min. En reposo viven SOLO hashes (código y token de sesión).
--
-- `LecturaReporte.reporteId`/`eventoId` identifican al dueño del contenido
-- (exactamente uno; la frontera DAL lo garantiza al resolver el contenidoId).

-- Valores de auditoría del ciclo de vida del código temporal.
ALTER TYPE "AccionAudit" ADD VALUE 'CODIGO_ACCESO_SOLICITADO';
ALTER TYPE "AccionAudit" ADD VALUE 'CODIGO_ACCESO_CANJEADO';

-- Auditoría de lectura del texto.
CREATE TABLE "LecturaReporte" (
    "id" TEXT NOT NULL,
    "reporteId" TEXT,
    "eventoId" TEXT,
    "contenidoId" TEXT NOT NULL,
    "campo" TEXT NOT NULL,
    "tipoActor" TEXT NOT NULL,
    "usuarioId" TEXT,
    "rol" TEXT,
    "codigoAccesoId" TEXT,
    "hashContenido" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LecturaReporte_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LecturaReporte_reporteId_creadoEn_idx" ON "LecturaReporte"("reporteId", "creadoEn");
CREATE INDEX "LecturaReporte_usuarioId_idx" ON "LecturaReporte"("usuarioId");

-- Código temporal de acceso externo (solo el hash en reposo).
CREATE TABLE "CodigoAccesoContenido" (
    "id" TEXT NOT NULL,
    "reporteId" TEXT NOT NULL,
    "codigoHash" TEXT NOT NULL,
    "solicitadoPorId" TEXT NOT NULL,
    "vigenteHasta" TIMESTAMPTZ(6) NOT NULL,
    "canjeadoEn" TIMESTAMPTZ(6),
    "canjeadoPorId" TEXT,
    "sesionExpiraEn" TIMESTAMPTZ(6),
    "sesionTokenHash" TEXT,
    "ipSolicitud" TEXT,
    "ipCanje" TEXT,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodigoAccesoContenido_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CodigoAccesoContenido_codigoHash_key" ON "CodigoAccesoContenido"("codigoHash");
CREATE UNIQUE INDEX "CodigoAccesoContenido_sesionTokenHash_key" ON "CodigoAccesoContenido"("sesionTokenHash");
CREATE INDEX "CodigoAccesoContenido_reporteId_idx" ON "CodigoAccesoContenido"("reporteId");

ALTER TABLE "LecturaReporte" ADD CONSTRAINT "LecturaReporte_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "Reporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LecturaReporte" ADD CONSTRAINT "LecturaReporte_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "EventoExpediente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LecturaReporte" ADD CONSTRAINT "LecturaReporte_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LecturaReporte" ADD CONSTRAINT "LecturaReporte_codigoAccesoId_fkey" FOREIGN KEY ("codigoAccesoId") REFERENCES "CodigoAccesoContenido"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CodigoAccesoContenido" ADD CONSTRAINT "CodigoAccesoContenido_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "Reporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CodigoAccesoContenido" ADD CONSTRAINT "CodigoAccesoContenido_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CodigoAccesoContenido" ADD CONSTRAINT "CodigoAccesoContenido_canjeadoPorId_fkey" FOREIGN KEY ("canjeadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
