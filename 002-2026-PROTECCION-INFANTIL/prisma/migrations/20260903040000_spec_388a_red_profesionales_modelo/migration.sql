-- SPEC-388a (A-75 · L1a) · Red de Profesionales — solo modelo. Migración aditiva:
-- 1 valor de enum nuevo · 4 enums nuevos · 5 tablas nuevas. Sin borrados ni
-- renombres — el orden solo importa por FK.

-- 1) Valor nuevo en enum existente (idempotente por si alguien ya lo agregó).
ALTER TYPE "RolUsuario" ADD VALUE IF NOT EXISTS 'PROFESIONAL';

-- 2) Enums nuevos del dominio.
CREATE TYPE "EstadoPerfilProfesional" AS ENUM ('BORRADOR', 'EN_REVISION', 'ACTIVO', 'RECHAZADO', 'VENCIDO', 'SUSPENDIDO');
CREATE TYPE "ResultadoVerificacion" AS ENUM ('APROBADO', 'RECHAZADO', 'MAS_INFORMACION');
CREATE TYPE "ModalidadCita" AS ENUM ('VIRTUAL', 'PRESENCIAL');
CREATE TYPE "UrgenciaSolicitud" AS ENUM ('ESTA_SEMANA', 'SIN_APURO');
CREATE TYPE "EstadoSolicitudCita" AS ENUM (
  'PAGADA_PENDIENTE', 'CONFIRMADA', 'CUMPLIDA',
  'NO_ASISTIO_PADRE', 'NO_ASISTIO_PROFESIONAL',
  'VENCIDA_SIN_RESPUESTA', 'REEMBOLSADA', 'SIN_CONFIRMAR',
  -- Brief v1.3 (aviso Calidad): la reprogramación es FILA NUEVA que hereda
  -- el pago; la solicitud original queda como REPROGRAMADA (terminal).
  'REPROGRAMADA'
);

-- 3) PerfilProfesional (1:1 con Usuario).
CREATE TABLE "PerfilProfesional" (
  "id"                       TEXT PRIMARY KEY,
  "usuarioId"                TEXT NOT NULL UNIQUE,
  "nombreVisible"            TEXT NOT NULL,
  "fotoUrl"                  TEXT,
  "tituloProfesional"        TEXT NOT NULL,
  "especialidades"           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "ciudadId"                 TEXT NOT NULL,
  "atiendeVirtual"           BOOLEAN NOT NULL DEFAULT FALSE,
  "atiendePresencial"        BOOLEAN NOT NULL DEFAULT FALSE,
  "aniosExperiencia"         INTEGER NOT NULL,
  "presentacion"             TEXT NOT NULL,
  "tarifaConsultaCOP"        INTEGER NOT NULL,
  "duracionMinutos"          INTEGER NOT NULL,
  "emiteFactura"             BOOLEAN NOT NULL DEFAULT FALSE,
  "estado"                   "EstadoPerfilProfesional" NOT NULL DEFAULT 'BORRADOR',
  "numeroTarjetaProfesional" TEXT,
  "datosFacturacion"         JSONB,
  "creadoEn"                 TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn"            TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "PerfilProfesional_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PerfilProfesional_ciudadId_fkey"  FOREIGN KEY ("ciudadId")  REFERENCES "Ciudad"("id")  ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "PerfilProfesional_estado_ciudadId_idx" ON "PerfilProfesional" ("estado", "ciudadId");

-- 4) VerificacionProfesional (historial).
CREATE TABLE "VerificacionProfesional" (
  "id"                     TEXT PRIMARY KEY,
  "perfilProfesionalId"    TEXT NOT NULL,
  "revisadoPorId"          TEXT NOT NULL,
  "revisadoEn"             TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "checklist"              JSONB NOT NULL,
  "resultado"              "ResultadoVerificacion" NOT NULL,
  "autorizacionArchivoUrl" TEXT NOT NULL,
  "venceEn"                TIMESTAMPTZ(6) NOT NULL,
  "creadoEn"               TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerificacionProfesional_perfilProfesionalId_fkey" FOREIGN KEY ("perfilProfesionalId") REFERENCES "PerfilProfesional"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "VerificacionProfesional_revisadoPorId_fkey"       FOREIGN KEY ("revisadoPorId")       REFERENCES "Usuario"("id")           ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "VerificacionProfesional_perfilProfesionalId_revisadoEn_idx" ON "VerificacionProfesional" ("perfilProfesionalId", "revisadoEn" DESC);
CREATE INDEX "VerificacionProfesional_venceEn_idx" ON "VerificacionProfesional" ("venceEn");

-- 5) FranjaDisponible.
CREATE TABLE "FranjaDisponible" (
  "id"            TEXT PRIMARY KEY,
  "profesionalId" TEXT NOT NULL,
  "inicio"        TIMESTAMPTZ(6) NOT NULL,
  "fin"           TIMESTAMPTZ(6) NOT NULL,
  "modalidad"     "ModalidadCita" NOT NULL,
  "tomada"        BOOLEAN NOT NULL DEFAULT FALSE,
  "creadoEn"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FranjaDisponible_profesionalId_fkey" FOREIGN KEY ("profesionalId") REFERENCES "PerfilProfesional"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "FranjaDisponible_profesionalId_tomada_inicio_idx" ON "FranjaDisponible" ("profesionalId", "tomada", "inicio");

-- 6) SolicitudCita.
CREATE TABLE "SolicitudCita" (
  "id"                     TEXT PRIMARY KEY,
  "padreUsuarioId"         TEXT NOT NULL,
  "profesionalId"          TEXT NOT NULL,
  "franjaId"               TEXT NOT NULL UNIQUE,
  "presentacion"           TEXT NOT NULL,
  "urgencia"               "UrgenciaSolicitud" NOT NULL,
  "estado"                 "EstadoSolicitudCita" NOT NULL DEFAULT 'PAGADA_PENDIENTE',
  "venceEn"                TIMESTAMPTZ(6) NOT NULL,
  "expedienteCompartidoId" TEXT,
  -- Brief v1.3: la reprogramación es fila nueva. `solicitudPreviaId` apunta
  -- a la anterior (para el historial); `pagoHeredadoDeId` a la que ya se
  -- cobró (para no volver a cobrar). Se auto-referencian; ambos opcionales.
  "solicitudPreviaId"      TEXT,
  "pagoHeredadoDeId"       TEXT,
  "montoConsulta"          INTEGER NOT NULL,
  "montoServicio"          INTEGER NOT NULL,
  "montoTotal"             INTEGER NOT NULL,
  "porcentajeServicio"     INTEGER NOT NULL,
  "creadoEn"               TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn"          TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "SolicitudCita_padreUsuarioId_fkey"         FOREIGN KEY ("padreUsuarioId")         REFERENCES "Usuario"("id")           ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SolicitudCita_profesionalId_fkey"          FOREIGN KEY ("profesionalId")          REFERENCES "PerfilProfesional"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SolicitudCita_franjaId_fkey"               FOREIGN KEY ("franjaId")               REFERENCES "FranjaDisponible"("id")  ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SolicitudCita_expedienteCompartidoId_fkey" FOREIGN KEY ("expedienteCompartidoId") REFERENCES "Expediente"("id")        ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "SolicitudCita_solicitudPreviaId_fkey"      FOREIGN KEY ("solicitudPreviaId")      REFERENCES "SolicitudCita"("id")     ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "SolicitudCita_pagoHeredadoDeId_fkey"       FOREIGN KEY ("pagoHeredadoDeId")       REFERENCES "SolicitudCita"("id")     ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "SolicitudCita_profesionalId_estado_creadoEn_idx" ON "SolicitudCita" ("profesionalId", "estado", "creadoEn" DESC);
CREATE INDEX "SolicitudCita_padreUsuarioId_estado_creadoEn_idx" ON "SolicitudCita" ("padreUsuarioId", "estado", "creadoEn" DESC);
CREATE INDEX "SolicitudCita_estado_venceEn_idx" ON "SolicitudCita" ("estado", "venceEn");

-- 7) EncuestaPrimeraCita.
CREATE TABLE "EncuestaPrimeraCita" (
  "id"           TEXT PRIMARY KEY,
  "solicitudId"  TEXT NOT NULL UNIQUE,
  "seDioLaCita"  BOOLEAN NOT NULL,
  "puntaje"      INTEGER NOT NULL,
  "volveria"     BOOLEAN NOT NULL,
  "comentario"   TEXT,
  "respondidaEn" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "EncuestaPrimeraCita_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "SolicitudCita"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
