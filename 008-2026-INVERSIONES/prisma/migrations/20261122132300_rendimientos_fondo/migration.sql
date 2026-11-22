-- Rendimientos del fondo (frente fondo-rendimientos, T1): el hecho del encargo del FIC (el pago del rendimiento y su
-- retención en la fuente) y su efecto en la caja. ADITIVA: un enum, una tabla vacía con sus CHECK, una función, dos
-- disparadores y un CHECK en ajuste_caja. Nada se borra ni se renombra.
-- - rendimiento_fondo: un hecho por fila del CSV del dueño (su fila cruda va cifrada en fila_fuente) y uno por
--   (fondo, fecha, tipo): la idempotencia de la carga se apoya en ese único. El valor es el del portal, > 0 y sin NaN
--   (NaN > 0 es verdadero en PostgreSQL); la fecha, finita.
-- - El pago llega NETO a la caja (decisión de GATE 1 del frente): solo el RENDIMIENTO se enlaza a su ajuste de caja, un
--   RENDIMIENTO_FIC de la MISMA fecha con monto = valor; la RETENCION es un hecho del fondo sin ajuste (restarla de la
--   caja descontaría dos veces). Lo decide el CHECK de enlace y un disparador (no una FK compuesta: Prisma 5.22 no la
--   maneja con columnas derivadas). Si falta el ajuste, decide la FK; si el valor no es positivo, el CHECK.
-- - El fondo es un FIC (el disparador lo comprueba al insertar: el tipo de un instrumento no cambia).
-- - ajuste_caja: un RENDIMIENTO_FIC siempre entra a la caja (> 0). La tabla ya tiene filas (los aportes): el CHECK nace
--   NOT VALID y se valida aquí mismo; si una base tuviera un RENDIMIENTO_FIC negativo (no puede: el valor nace en la
--   migración anterior), el migrador aborta y se ve.
-- - Solo inserción, como los demás hechos (la salida `inv.reversion` es la de siempre: freno contra errores, no contra
--   un usuario de la base malintencionado). La escribe solo src/fondo/rendimientos/guardar.ts (candado de camino único),
--   como inv_dueno (el migrador): el FOR SHARE del ajuste pide UPDATE sobre ajuste_caja a quien inserta, e inv_app e
--   inv_precios no insertan aquí (docker/migrador/privilegios.sql). inv_app la lee por el GRANT SELECT de cada tabla.
-- - Un ajuste RENDIMIENTO_FIC sin su hecho no lo impide la base (como un APORTE_FIC sin su movimiento): lo cubre el
--   camino único, que crea los dos en la misma transacción.
SET LOCAL lock_timeout = '5s';

-- CreateEnum
CREATE TYPE "TipoRendimientoFondo" AS ENUM ('RENDIMIENTO', 'RETENCION');

-- CreateTable
CREATE TABLE "rendimiento_fondo" (
    "id" TEXT NOT NULL,
    "filaFuenteId" TEXT NOT NULL,
    "fondoId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "tipo" "TipoRendimientoFondo" NOT NULL,
    "valor" DECIMAL(20,4) NOT NULL,
    "ajusteCajaId" TEXT,

    CONSTRAINT "rendimiento_fondo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rendimiento_fondo_filaFuenteId_key" ON "rendimiento_fondo"("filaFuenteId");

-- CreateIndex
CREATE UNIQUE INDEX "rendimiento_fondo_ajusteCajaId_key" ON "rendimiento_fondo"("ajusteCajaId");

-- CreateIndex (también es el índice de la FK de fondoId: empieza por esa columna)
CREATE UNIQUE INDEX "rendimiento_fondo_fondoId_fecha_tipo_key" ON "rendimiento_fondo"("fondoId", "fecha", "tipo");

-- AddForeignKey
ALTER TABLE "rendimiento_fondo" ADD CONSTRAINT "rendimiento_fondo_filaFuenteId_fkey" FOREIGN KEY ("filaFuenteId") REFERENCES "fila_fuente"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "rendimiento_fondo" ADD CONSTRAINT "rendimiento_fondo_fondoId_fkey" FOREIGN KEY ("fondoId") REFERENCES "instrumento"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "rendimiento_fondo" ADD CONSTRAINT "rendimiento_fondo_ajusteCajaId_fkey" FOREIGN KEY ("ajusteCajaId") REFERENCES "ajuste_caja"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ───────────── Escrito a mano ─────────────
-- La tabla nace vacía: los CHECK nacen validados.
ALTER TABLE "rendimiento_fondo" ADD CONSTRAINT "rendimiento_fondo_valor_chk" CHECK ("valor" > 0 AND "valor" <> 'NaN');
ALTER TABLE "rendimiento_fondo" ADD CONSTRAINT "rendimiento_fondo_fecha_chk" CHECK (isfinite("fecha"));
ALTER TABLE "rendimiento_fondo" ADD CONSTRAINT "rendimiento_fondo_enlace_chk" CHECK (("tipo" = 'RENDIMIENTO') = ("ajusteCajaId" IS NOT NULL));

ALTER TABLE "ajuste_caja" ADD CONSTRAINT "ajuste_caja_rendimiento_fic_chk" CHECK ("categoria" <> 'RENDIMIENTO_FIC' OR "monto" > 0) NOT VALID;
ALTER TABLE "ajuste_caja" VALIDATE CONSTRAINT "ajuste_caja_rendimiento_fic_chk";

-- Los mensajes son fijos: nunca llevan valores (son datos del dueño).
CREATE FUNCTION "inv_rendimiento_fondo_coherente"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  f record;
  a record;
BEGIN
  SELECT "tipo" INTO f FROM public."instrumento" WHERE "id" = NEW."fondoId";
  IF FOUND AND f."tipo" <> 'FIC' THEN
    RAISE EXCEPTION 'rendimiento del fondo: el instrumento no es un fondo (FIC)' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW."ajusteCajaId" IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT "categoria", "fecha", "monto" INTO a FROM public."ajuste_caja" WHERE "id" = NEW."ajusteCajaId" FOR SHARE;
  IF NOT FOUND OR NEW."valor" <= 0 THEN
    RETURN NEW;
  END IF;
  IF a."categoria" <> 'RENDIMIENTO_FIC' THEN
    RAISE EXCEPTION 'rendimiento del fondo: el ajuste de caja no es un rendimiento del fondo' USING ERRCODE = 'check_violation';
  END IF;
  IF a."fecha" <> NEW."fecha" THEN
    RAISE EXCEPTION 'rendimiento del fondo: el ajuste de caja es de otra fecha' USING ERRCODE = 'check_violation';
  END IF;
  IF a."monto" <> NEW."valor" THEN
    RAISE EXCEPTION 'rendimiento del fondo: el monto del ajuste de caja no es el valor del rendimiento' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "rendimiento_fondo_coherente" BEFORE INSERT OR UPDATE ON "rendimiento_fondo"
  FOR EACH ROW EXECUTE FUNCTION "inv_rendimiento_fondo_coherente"();

-- Solo inserción, como los demás hechos.
CREATE TRIGGER "rendimiento_fondo_solo_insercion" BEFORE UPDATE OR DELETE ON "rendimiento_fondo" FOR EACH ROW EXECUTE FUNCTION "inv_solo_insercion"();
