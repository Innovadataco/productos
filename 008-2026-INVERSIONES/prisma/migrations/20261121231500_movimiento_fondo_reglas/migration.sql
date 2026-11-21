-- Unidades del fondo (frente fondo-movimientos, T1): reglas de movimiento_fondo y de su ajuste de caja. ADITIVA:
-- tres CHECK, un índice único parcial, una función, un disparador de coherencia y la regla de solo inserción en las
-- dos tablas. La Fábrica verificó el 2026-11-21 que en producción las dos tablas tienen 0 filas (no hay escritor en el
-- código): los CHECK nacen NOT VALID y se validan aquí mismo (si una base tuviera filas que no cumplen, el migrador
-- aborta y se ve; no van a `sin_validar`).
-- - Unidades siempre > 0, con el signo por tipo (src/conciliacion/esperado.ts: RETIRO resta y lo demás suma); un AJUSTE,
--   distinto de 0, para que una corrección compensatoria sea posible con la tabla de solo inserción.
-- - Una constitución o un aporte se pagan con la caja (MODELO-DATOS §1 #2 y #6): exigen su ajuste y su monto.
-- - El ajuste enlazado es un APORTE_FIC de la MISMA fecha y su monto es el del movimiento con el signo de salida. Lo
--   decide un disparador (no una FK compuesta: Prisma 5.22 no la maneja con columnas derivadas). Si falta el ajuste,
--   decide la FK; si el monto falta o no es positivo, deciden los CHECK.
-- - El ajuste se lee FOR SHARE: con la tabla de solo inserción no cambia, pero así un cambio por la salida de
--   reversión y una inserción no pasan los dos. La salida `inv.reversion` sigue siendo la de siempre (freno contra
--   errores, no contra un usuario de la base malintencionado); un cambio del movimiento por ella vuelve a pasar por
--   la coherencia.
SET LOCAL lock_timeout = '5s';

ALTER TABLE "movimiento_fondo" ADD CONSTRAINT "movimiento_fondo_unidades_chk"
  CHECK (("tipo" = 'AJUSTE' AND "unidades" <> 0) OR ("tipo" <> 'AJUSTE' AND "unidades" > 0)) NOT VALID;
ALTER TABLE "movimiento_fondo" VALIDATE CONSTRAINT "movimiento_fondo_unidades_chk";
ALTER TABLE "movimiento_fondo" ADD CONSTRAINT "movimiento_fondo_monto_chk"
  CHECK ("monto" IS NULL OR "monto" > 0) NOT VALID;
ALTER TABLE "movimiento_fondo" VALIDATE CONSTRAINT "movimiento_fondo_monto_chk";
ALTER TABLE "movimiento_fondo" ADD CONSTRAINT "movimiento_fondo_aporte_enlace_chk"
  CHECK ("tipo" NOT IN ('CONSTITUCION', 'APORTE') OR ("ajusteCajaId" IS NOT NULL AND "monto" IS NOT NULL)) NOT VALID;
ALTER TABLE "movimiento_fondo" VALIDATE CONSTRAINT "movimiento_fondo_aporte_enlace_chk";

-- A lo sumo una constitución por fondo, de cualquier fecha.
CREATE UNIQUE INDEX "movimiento_fondo_constitucion_key" ON "movimiento_fondo" ("fondoId") WHERE "tipo" = 'CONSTITUCION';

CREATE FUNCTION "inv_movimiento_fondo_coherente"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  a record;
BEGIN
  IF NEW."ajusteCajaId" IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW."tipo" NOT IN ('CONSTITUCION', 'APORTE') THEN
    RAISE EXCEPTION 'movimiento del fondo: solo una constitución o un aporte se enlazan a un ajuste de caja' USING ERRCODE = 'check_violation';
  END IF;
  SELECT "categoria", "fecha", "monto" INTO a FROM public."ajuste_caja" WHERE "id" = NEW."ajusteCajaId" FOR SHARE;
  IF NOT FOUND OR NEW."monto" IS NULL OR NEW."monto" <= 0 THEN
    RETURN NEW;
  END IF;
  IF a."categoria" <> 'APORTE_FIC' THEN
    RAISE EXCEPTION 'movimiento del fondo: el ajuste de caja no es un aporte al fondo' USING ERRCODE = 'check_violation';
  END IF;
  IF a."fecha" <> NEW."fecha" THEN
    RAISE EXCEPTION 'movimiento del fondo: el ajuste de caja es de otra fecha' USING ERRCODE = 'check_violation';
  END IF;
  IF a."monto" <> -NEW."monto" THEN
    RAISE EXCEPTION 'movimiento del fondo: el monto del ajuste de caja no es el del movimiento como salida de caja' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "movimiento_fondo_coherente" BEFORE INSERT OR UPDATE ON "movimiento_fondo"
  FOR EACH ROW EXECUTE FUNCTION "inv_movimiento_fondo_coherente"();

-- Solo inserción, como los demás hechos: corregir = un AJUSTE compensatorio (la reversión, después).
CREATE TRIGGER "ajuste_caja_solo_insercion" BEFORE UPDATE OR DELETE ON "ajuste_caja" FOR EACH ROW EXECUTE FUNCTION "inv_solo_insercion"();
CREATE TRIGGER "movimiento_fondo_solo_insercion" BEFORE UPDATE OR DELETE ON "movimiento_fondo" FOR EACH ROW EXECUTE FUNCTION "inv_solo_insercion"();
