-- Corte real de la certificación de A&V (frente certificacion-corte-real): una certificación cargada con el corte
-- equivocado se RETIRA (no se mueve ni se borra) y la reemplaza otra del MISMO archivo con su corte real, en una sola
-- transacción (src/importacion/av/corregir.ts). Lo retirado, su carga (REVERTIDO) y sus conciliaciones quedan como
-- historia. Mover la fecha no se puede: la FK compuesta de conciliacion es ON UPDATE RESTRICT y la clave natural y el
-- crudo cifrado de cada fila llevan la fecha de corte. Las columnas nacen vacías: nada existente cambia.

-- ───────────── Generado por Prisma (schema.prisma) ─────────────
-- AlterTable
ALTER TABLE "certificacion" ADD COLUMN     "reemplazadaPorId" TEXT,
ADD COLUMN     "retiradaEn" TIMESTAMPTZ(6);

-- CreateIndex
CREATE UNIQUE INDEX "certificacion_reemplazadaPorId_key" ON "certificacion"("reemplazadaPorId");

-- AddForeignKey
ALTER TABLE "certificacion" ADD CONSTRAINT "certificacion_reemplazadaPorId_fkey" FOREIGN KEY ("reemplazadaPorId") REFERENCES "certificacion"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ───────────── Escrito a mano ─────────────
-- retiradaEn y reemplazadaPorId van juntos, y una certificación nunca se reemplaza a sí misma.
ALTER TABLE "certificacion" ADD CONSTRAINT "certificacion_retiro_chk"
  CHECK ((("retiradaEn" IS NULL) = ("reemplazadaPorId" IS NULL)) AND ("reemplazadaPorId" IS NULL OR "reemplazadaPorId" <> "id"));

-- La certificación nace vigente y es de solo inserción, salvo el retiro: una sola vez, sin tocar ninguna otra
-- columna (se compara la fila entera, así una columna futura también queda protegida) y solo si el reemplazo existe,
-- está vigente (FOR SHARE: no se retira a la vez), tiene otra fecha de corte y su carga está CARGADO con el mismo
-- tipo y el mismo sha256 que la carga de la retirada (el mismo archivo). La rama `inv.reversion` sigue como en
-- inv_solo_insercion. El mensaje dice «solo inserción», como antes.
CREATE FUNCTION "inv_certificacion_solo_retiro"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  reemplazo record;
BEGIN
  IF current_setting('inv.reversion', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW."retiradaEn" IS NULL AND NEW."reemplazadaPorId" IS NULL THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD."retiradaEn" IS NULL AND NEW."retiradaEn" IS NOT NULL AND NEW."reemplazadaPorId" IS NOT NULL
        AND (to_jsonb(NEW) - 'retiradaEn' - 'reemplazadaPorId') = (to_jsonb(OLD) - 'retiradaEn' - 'reemplazadaPorId') THEN
    SELECT c."fechaCorte", c."retiradaEn", n."estado", n."sha256", n."tipoFuente", v."sha256" AS "shaRetirada", v."tipoFuente" AS "tipoRetirada"
      INTO reemplazo
      FROM "certificacion" c
      JOIN "carga_archivo" n ON n."id" = c."cargaId"
      JOIN "carga_archivo" v ON v."id" = OLD."cargaId"
      WHERE c."id" = NEW."reemplazadaPorId"
      FOR SHARE OF c;
    IF FOUND AND reemplazo."retiradaEn" IS NULL AND reemplazo."fechaCorte" <> OLD."fechaCorte" AND reemplazo."estado" = 'CARGADO'
       AND reemplazo."sha256" = reemplazo."shaRetirada" AND reemplazo."tipoFuente" = reemplazo."tipoRetirada" THEN
      RETURN NEW;
    END IF;
  END IF;
  RAISE EXCEPTION 'La tabla certificacion es de solo inserción: nace vigente y solo se retira una vez, reemplazada por otra vigente del mismo archivo con otro corte'
    USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER "certificacion_solo_insercion" ON "certificacion";
-- El mismo nombre de siempre, con la función nueva y también al insertar (nace vigente).
CREATE TRIGGER "certificacion_solo_insercion" BEFORE INSERT OR UPDATE OR DELETE ON "certificacion" FOR EACH ROW EXECUTE FUNCTION "inv_certificacion_solo_retiro"();

-- Sobre una certificación retirada no se inserta nada: ni conciliaciones (las viejas se quedan como historia), ni
-- posiciones, ni fondos. FOR SHARE: una conciliación en REPEATABLE READ cuya instantánea es anterior al retiro falla
-- al insertar (no puede serializarse) en vez de colgarse de la retirada. Si la certificación no existe, decide la FK.
CREATE FUNCTION "inv_certificacion_vigente"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  retirada timestamptz;
BEGIN
  SELECT c."retiradaEn" INTO retirada FROM "certificacion" c WHERE c."id" = NEW."certificacionId" FOR SHARE;
  IF FOUND AND retirada IS NOT NULL THEN
    RAISE EXCEPTION 'La certificación está retirada (se cargó con otro corte): no admite filas nuevas en %', TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "conciliacion_certificacion_vigente" BEFORE INSERT ON "conciliacion" FOR EACH ROW EXECUTE FUNCTION "inv_certificacion_vigente"();
CREATE TRIGGER "certificacion_posicion_vigente" BEFORE INSERT ON "certificacion_posicion" FOR EACH ROW EXECUTE FUNCTION "inv_certificacion_vigente"();
CREATE TRIGGER "certificacion_fondo_vigente" BEFORE INSERT ON "certificacion_fondo" FOR EACH ROW EXECUTE FUNCTION "inv_certificacion_vigente"();

-- Una carga pasa a REVERTIDO una sola vez: desde CARGADO, con quién (un DUEÑO) y cuándo, sin cambiar ninguna otra
-- columna y solo si ninguna certificación vigente cuelga de ella (la corrección retira primero y revierte después).
-- REVERTIDO es final, y revertidaEn y revertidaPorId solo se escriben con él. Las demás actualizaciones de una carga
-- (VALIDANDO → CARGADO o RECHAZADO, con sus conteos) no pasan por aquí.
CREATE FUNCTION "inv_carga_reversion"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('inv.reversion', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF OLD."estado" = 'CARGADO' AND NEW."estado" = 'REVERTIDO' AND NEW."revertidaEn" IS NOT NULL
     AND EXISTS (SELECT 1 FROM "usuario" u WHERE u."id" = NEW."revertidaPorId" AND u."rol" = 'DUENO')
     AND (to_jsonb(NEW) - 'estado' - 'revertidaEn' - 'revertidaPorId') = (to_jsonb(OLD) - 'estado' - 'revertidaEn' - 'revertidaPorId')
     AND NOT EXISTS (SELECT 1 FROM "certificacion" c WHERE c."cargaId" = NEW."id" AND c."retiradaEn" IS NULL) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Una carga pasa a REVERTIDO una sola vez: desde CARGADO, con quién (un DUEÑO) y cuándo, sin cambiar nada más y sin certificación vigente; REVERTIDO es final'
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "carga_archivo_reversion" BEFORE UPDATE ON "carga_archivo" FOR EACH ROW
  WHEN (OLD."estado" = 'REVERTIDO' OR NEW."estado" = 'REVERTIDO' OR NEW."revertidaEn" IS DISTINCT FROM OLD."revertidaEn" OR NEW."revertidaPorId" IS DISTINCT FROM OLD."revertidaPorId")
  EXECUTE FUNCTION "inv_carga_reversion"();
