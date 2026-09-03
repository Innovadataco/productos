-- SPEC-380 (PR B · C4/D-100) — 4º sujeto: integrantes del comité vigilados.
-- ADITIVA: nueva tabla `IdentificadorIntegranteComite` (mismo shape que los
-- otros identificadores) + FK y unique en `AlertaColegio`. Sin backfill: los
-- registros previos no tienen integrantes vigilados.

-- 1. Identificadores del integrante (soft delete por estado, tenant por colegio).
CREATE TABLE "IdentificadorIntegranteComite" (
    "id"           TEXT NOT NULL,
    "integranteId" TEXT NOT NULL,
    "colegioId"    TEXT NOT NULL,
    "tipo"         TEXT NOT NULL,
    "valor"        TEXT NOT NULL,
    "plataformaId" TEXT,
    "estado"       TEXT NOT NULL DEFAULT 'activo',
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdentificadorIntegranteComite_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "IdentificadorIntegranteComite"
    ADD CONSTRAINT "IdentificadorIntegranteComite_integranteId_fkey"
    FOREIGN KEY ("integranteId") REFERENCES "IntegranteComite"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IdentificadorIntegranteComite"
    ADD CONSTRAINT "IdentificadorIntegranteComite_colegioId_fkey"
    FOREIGN KEY ("colegioId") REFERENCES "Colegio"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IdentificadorIntegranteComite"
    ADD CONSTRAINT "IdentificadorIntegranteComite_plataformaId_fkey"
    FOREIGN KEY ("plataformaId") REFERENCES "Plataforma"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "IdentificadorIntegranteComite_colegioId_estado_idx"
    ON "IdentificadorIntegranteComite" ("colegioId", "estado");
CREATE INDEX "IdentificadorIntegranteComite_integranteId_estado_idx"
    ON "IdentificadorIntegranteComite" ("integranteId", "estado");
CREATE INDEX "IdentificadorIntegranteComite_tipo_valor_idx"
    ON "IdentificadorIntegranteComite" ("tipo", "valor");
CREATE INDEX "IdentificadorIntegranteComite_plataformaId_idx"
    ON "IdentificadorIntegranteComite" ("plataformaId");

-- Único parcial contra I-213: dos integrantes del MISMO colegio NO pueden
-- compartir el mismo identificador activo (tipo, valor, plataformaId).
-- NULLS NOT DISTINCT porque plataformaId puede ser NULL (nick genérico).
CREATE UNIQUE INDEX "IdentificadorIntegranteComite_activo_unique"
    ON "IdentificadorIntegranteComite" ("colegioId", "tipo", "valor", "plataformaId")
    NULLS NOT DISTINCT
    WHERE "estado" = 'activo';

-- 2. Alerta apunta al identificador del integrante (4ª FK, mismo patrón).
ALTER TABLE "AlertaColegio" ADD COLUMN "identificadorIntegranteComiteId" TEXT;

ALTER TABLE "AlertaColegio"
    ADD CONSTRAINT "AlertaColegio_identificadorIntegranteComiteId_fkey"
    FOREIGN KEY ("identificadorIntegranteComiteId") REFERENCES "IdentificadorIntegranteComite"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Unicidad (colegio, reporte, identificador integrante) — evita duplicar.
CREATE UNIQUE INDEX "AlertaColegio_colegioId_reporteId_identificadorIntegranteCo_key"
    ON "AlertaColegio" ("colegioId", "reporteId", "identificadorIntegranteComiteId");

-- Nota: `tipoSujeto` sigue siendo columna TEXT (no enum Prisma); el candado
-- del valor válido ("ESTUDIANTE" | "PROFESOR" | "ACUDIENTE" | "INTEGRANTE_COMITE")
-- vive en TypeScript vía `TipoSujeto` union (candado 22v5 · CEO). Sin backfill:
-- ninguna alerta previa era del integrante.
