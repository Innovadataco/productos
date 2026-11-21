-- Hito 1 · certificación de A&V (PR-B): trazabilidad de cada cifra a su fila del PDF, NIT del fondo para
-- reconocer su fila, fecha de corte de la conciliación amarrada a la de su certificación, CHECK de valores y
-- solo inserción. Las tablas de certificación y conciliación nacen vacías en todas las bases (no había
-- escritor): los CHECK se crean validados.

-- ───────────── Generado por Prisma (schema.prisma) ─────────────
-- DropForeignKey
ALTER TABLE "conciliacion" DROP CONSTRAINT "conciliacion_certificacionId_fkey";

-- DropIndex
DROP INDEX "conciliacion_certificacionId_idx";

-- AlterTable
ALTER TABLE "certificacion" ADD COLUMN     "referenciaEfectivo" TEXT;

-- AlterTable
ALTER TABLE "certificacion_fondo" ADD COLUMN     "referenciaPdf" TEXT;

-- AlterTable
ALTER TABLE "instrumento" ADD COLUMN     "nitFondo" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "certificacion_id_fechaCorte_key" ON "certificacion"("id", "fechaCorte");

-- CreateIndex
CREATE INDEX "conciliacion_certificacionId_fechaCorte_idx" ON "conciliacion"("certificacionId", "fechaCorte");

-- CreateIndex
CREATE UNIQUE INDEX "instrumento_nitFondo_key" ON "instrumento"("nitFondo");

-- AddForeignKey
ALTER TABLE "conciliacion" ADD CONSTRAINT "conciliacion_certificacionId_fechaCorte_fkey" FOREIGN KEY ("certificacionId", "fechaCorte") REFERENCES "certificacion"("id", "fechaCorte") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ───────────── Escrito a mano ─────────────
-- NIT del fondo: solo en un FIC y con la forma del NIT colombiano con dígito de verificación.
ALTER TABLE "instrumento" ADD CONSTRAINT "instrumento_nit_fondo_chk"
  CHECK ("nitFondo" IS NULL OR ("tipo" = 'FIC' AND "nitFondo" ~ '^[0-9]{6,10}-[0-9]$'));

-- Valores de la certificación (la valoración puede venir en 0; la cantidad, nunca).
ALTER TABLE "certificacion_posicion" ADD CONSTRAINT "certificacion_posicion_valores_chk"
  CHECK ("cantidad" > 0 AND "precioValoracion" >= 0 AND "valorMercado" >= 0);
ALTER TABLE "certificacion_fondo" ADD CONSTRAINT "certificacion_fondo_valores_chk"
  CHECK ("saldo" >= 0 AND ("unidades" IS NULL OR "unidades" > 0));

-- Referencias a filas del PDF: «p<página>:f<fila>» separadas por comas, nunca texto de una celda.
ALTER TABLE "certificacion" ADD CONSTRAINT "certificacion_referencia_efectivo_chk"
  CHECK ("referenciaEfectivo" IS NULL OR "referenciaEfectivo" ~ '^p[0-9]{1,3}:f[0-9]{1,5}$');
ALTER TABLE "certificacion_fondo" ADD CONSTRAINT "certificacion_fondo_referencia_chk"
  CHECK ("referenciaPdf" IS NULL OR "referenciaPdf" ~ '^p[0-9]{1,3}:f[0-9]{1,5}$');
ALTER TABLE "certificacion_posicion" ADD CONSTRAINT "certificacion_posicion_referencia_chk"
  CHECK ("referenciaPdf" IS NULL OR (char_length("referenciaPdf") <= 4000 AND "referenciaPdf" ~ '^p[0-9]{1,3}:f[0-9]{1,5}(,p[0-9]{1,3}:f[0-9]{1,5})*$'));

-- Controles: tolerancia no negativa; todo control que no cuadra dice por qué, con un código corto.
ALTER TABLE "control_conciliacion" ADD CONSTRAINT "control_conciliacion_tolerancia_chk"
  CHECK ("tolerancia" IS NULL OR "tolerancia" >= 0);
ALTER TABLE "control_conciliacion" ADD CONSTRAINT "control_conciliacion_motivo_chk"
  CHECK (("codigoMotivo" IS NULL OR "codigoMotivo" ~ '^[a-z0-9_]{1,40}$') AND ("resultado" = 'CUADRA' OR "codigoMotivo" IS NOT NULL));

-- Solo inserción: lo importado y lo conciliado no se edita ni se borra (recalcular = conciliación nueva;
-- corregir una certificación = revertir su carga, con `SET LOCAL inv.reversion = 'on'`).
-- certificacion_posicion queda sin disparador por ahora: la suite de precios simula una certificación corregida
-- editando una posición (tests/integracion/precios.test.ts); el importador solo inserta.
CREATE TRIGGER "certificacion_solo_insercion" BEFORE UPDATE OR DELETE ON "certificacion" FOR EACH ROW EXECUTE FUNCTION "inv_solo_insercion"();
CREATE TRIGGER "conciliacion_solo_insercion" BEFORE UPDATE OR DELETE ON "conciliacion" FOR EACH ROW EXECUTE FUNCTION "inv_solo_insercion"();
CREATE TRIGGER "control_conciliacion_solo_insercion" BEFORE UPDATE OR DELETE ON "control_conciliacion" FOR EACH ROW EXECUTE FUNCTION "inv_solo_insercion"();

-- certificacion_fondo: solo se puede reescribir `encargo` (re-cifrado con otra clave, #11); nada más cambia.
-- Se compara la fila entera sin `encargo`, así que una columna futura también queda protegida.
CREATE FUNCTION "inv_certificacion_fondo_solo_encargo"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('inv.reversion', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'UPDATE' AND (to_jsonb(NEW) - 'encargo') = (to_jsonb(OLD) - 'encargo') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'La tabla certificacion_fondo es de solo inserción: solo se puede re-cifrar el encargo'
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "certificacion_fondo_solo_encargo" BEFORE UPDATE OR DELETE ON "certificacion_fondo" FOR EACH ROW EXECUTE FUNCTION "inv_certificacion_fondo_solo_encargo"();
