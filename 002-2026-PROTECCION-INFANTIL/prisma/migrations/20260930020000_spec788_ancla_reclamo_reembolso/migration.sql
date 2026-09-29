-- SPEC-788 · Ancla LEGAL del reclamo de reversión del pago (Decreto 1074/2015), en Pago — NO en la PQR
-- de 752, que cuelga de usuarioId en Cascade y se borra con la cuenta. El registro comercial tiene su
-- propia retención, que sobrevive al borrado: si el padre borra su cuenta, seguimos debiendo la reversión
-- y probando cuándo la pidió. Aditivo y no destructivo. Las filas existentes quedan con ambos campos NULL.

-- AlterTable
ALTER TABLE "Pago" ADD COLUMN     "reembolsoSolicitadoEn" TIMESTAMPTZ(6),
ADD COLUMN     "reembolsoVenceEn" TIMESTAMPTZ(6);

-- CHECK · coherencia del par (ancla + vencimiento). VALIDADO (nunca NOT VALID): las filas existentes
-- tienen ambos NULL, así que satisfacen la primera rama y la validación pasa. Prisma es ciego a este
-- CHECK; el candado lo prueba por inserción real en las dos direcciones.
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_reembolso_reclamo_coherente_check" CHECK (
    ("reembolsoSolicitadoEn" IS NULL AND "reembolsoVenceEn" IS NULL)
    OR ("reembolsoSolicitadoEn" IS NOT NULL AND "reembolsoVenceEn" IS NOT NULL AND "reembolsoVenceEn" > "reembolsoSolicitadoEn")
);

-- INMUTABILIDAD de reembolsoSolicitadoEn (es una transición, no un estado → TRIGGER, no CHECK). Es el
-- ancla y la PRUEBA del término legal: si la fecha de inicio se puede mover, la prueba no vale nada.
-- NULL→valor (primer registro) se PERMITE; valor→otro o valor→NULL LANZA. El WHEN dispara el trigger
-- SOLO cuando se toca un ancla ya fijada, así el flujo normal (fijarla una vez, tocar otras columnas)
-- no paga nada.
CREATE OR REPLACE FUNCTION "pago_reembolsoSolicitadoEn_inmutable"()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Pago.reembolsoSolicitadoEn es inmutable (SPEC-788): es el ancla y la prueba del término legal de reversión (Dto 1074); una vez fijado no se cambia ni se anula';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "pago_reembolsoSolicitadoEn_inmutable_trg"
    BEFORE UPDATE ON "Pago"
    FOR EACH ROW
    WHEN (OLD."reembolsoSolicitadoEn" IS NOT NULL AND OLD."reembolsoSolicitadoEn" IS DISTINCT FROM NEW."reembolsoSolicitadoEn")
    EXECUTE FUNCTION "pago_reembolsoSolicitadoEn_inmutable"();
