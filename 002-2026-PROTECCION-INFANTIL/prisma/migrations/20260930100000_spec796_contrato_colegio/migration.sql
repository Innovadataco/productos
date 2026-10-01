-- SPEC-796 · Registro DURABLE del contrato firmado del colegio (append-only).
-- Capa de datos (Datos / D-121). El MOTOR y el storage cifrado los construye Dev-3 contra este
-- contrato de datos; acá solo vive la tabla, sus FK (SET NULL) y el trigger de inmutabilidad.

-- CreateTable
CREATE TABLE "contrato_colegio" (
    "id" TEXT NOT NULL,
    "colegioId" TEXT,
    "suscripcionId" TEXT,
    "colegioSnapshot" TEXT NOT NULL,
    "archivoId" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "adjuntadoEn" TIMESTAMPTZ(6) NOT NULL,
    "adjuntadoPorSnapshot" TEXT NOT NULL,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contrato_colegio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (consulta caliente «último contrato del colegio»; DESC como en el schema)
CREATE INDEX "contrato_colegio_colegioId_adjuntadoEn_idx" ON "contrato_colegio"("colegioId", "adjuntadoEn" DESC);

-- CreateIndex
CREATE INDEX "contrato_colegio_suscripcionId_idx" ON "contrato_colegio"("suscripcionId");

-- AddForeignKey · SET NULL: el contrato SOBREVIVE al borrado OPERATIVO del colegio
-- (borrar-colegio.ts hace colegio.delete; el FK nulea el enlace en vez de cascadear/bloquear).
ALTER TABLE "contrato_colegio" ADD CONSTRAINT "contrato_colegio_colegioId_fkey" FOREIGN KEY ("colegioId") REFERENCES "Colegio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey · SET NULL: sobrevive a suscripcion.deleteMany (borrar-colegio.ts / borrar-padre.ts).
ALTER TABLE "contrato_colegio" ADD CONSTRAINT "contrato_colegio_suscripcionId_fkey" FOREIGN KEY ("suscripcionId") REFERENCES "Suscripcion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger de INMUTABILIDAD del HECHO (Prisma es ciego al trigger). Append-only:
-- los campos del hecho (archivoId, sha256, adjuntadoEn, adjuntadoPorSnapshot, colegioSnapshot,
-- creadoEn) no cambian — una corrección adjunta una fila NUEVA. La guarda NO incluye
-- `colegioId`/`suscripcionId`: así el ON DELETE SET NULL del borrado operativo del colegio/
-- suscripción puede nulear esos enlaces SIN que el trigger lo bloquee (si los bloqueara, el
-- borrado operativo chocaría y el contrato no podría sobrevivir).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION "contrato_colegio_inmutable"() RETURNS trigger AS $$
BEGIN
    IF (OLD."archivoId" IS DISTINCT FROM NEW."archivoId"
        OR OLD."sha256" IS DISTINCT FROM NEW."sha256"
        OR OLD."adjuntadoEn" IS DISTINCT FROM NEW."adjuntadoEn"
        OR OLD."adjuntadoPorSnapshot" IS DISTINCT FROM NEW."adjuntadoPorSnapshot"
        OR OLD."colegioSnapshot" IS DISTINCT FROM NEW."colegioSnapshot"
        OR OLD."creadoEn" IS DISTINCT FROM NEW."creadoEn") THEN
        RAISE EXCEPTION 'ContratoColegio es append-only: los campos del hecho (archivoId, sha256, adjuntadoEn, adjuntadoPorSnapshot, colegioSnapshot, creadoEn) son inmutables (SPEC-796). Una corrección adjunta una fila nueva.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "contrato_colegio_inmutable_trg"
    BEFORE UPDATE ON "contrato_colegio"
    FOR EACH ROW EXECUTE FUNCTION "contrato_colegio_inmutable"();
