-- Asignaciones de venta coherentes con su lote y su venta (D4, D6 del frente lotes-asignaciones). Migración
-- ADITIVA: dos funciones y dos disparadores; no toca ni revisa las filas que ya existen (un disparador solo
-- mira lo que se inserta o se cambia desde ya, como un CHECK NOT VALID). Las bloqueadas inválidas que ya estén
-- guardadas las rechaza la app por especie (src/lotes/coherencia.ts) y se cuentan con scripts/contar-bloqueadas.sql.
-- Por fila, la base exige: la orden es una VENTA APROBADA, el lote es de su misma especie y no se compró después
-- de ella, y la cantidad de la fila no pasa ni la de la venta ni la del lote. Las SUMAS (lo asignado a un lote
-- o a una venta) las valida la app bajo el advisory lock de la construcción: en la base exigirían bloquear el
-- lote y la venta en cada inserción y que el dueño borrara las FIFO antes de fijar una bloqueada.
-- El lote se lee FOR SHARE: la FK solo toma FOR KEY SHARE, que no frena un UPDATE concurrente del lote, y así
-- una inserción y un cambio del lote no pueden pasar los dos. Lo inserta solo inv_dueno (dueño de las tablas);
-- inv_app solo lee asignacion_venta y lote (docker/migrador/privilegios.sql).
-- La orden ya no cambia (orden_solo_insercion); el lote sí podría, así que lote_fijo impide cambiarle la
-- especie, la fecha de compra, la cantidad o el costo mientras tenga asignaciones. Ningún código hace UPDATE
-- de lote. Si falta la orden o el lote, el disparador no decide: lo rechaza la FK.
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION "inv_asignacion_coherente"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  o record;
  l record;
BEGIN
  SELECT "lado", "estado", "instrumentoId", "fechaOperacion", "cantidadCompletada" INTO o
    FROM public."orden" WHERE "id" = NEW."ordenVentaId";
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  SELECT "instrumentoId", "fechaCompra", "cantidad" INTO l
    FROM public."lote" WHERE "id" = NEW."loteId" FOR SHARE;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  IF o."lado" <> 'VENTA' OR o."estado" <> 'APROBADO' THEN
    RAISE EXCEPTION 'asignación: la orden no es una venta aprobada' USING ERRCODE = 'check_violation';
  END IF;
  IF l."instrumentoId" <> o."instrumentoId" THEN
    RAISE EXCEPTION 'asignación: el lote es de otra especie que la venta' USING ERRCODE = 'check_violation';
  END IF;
  IF l."fechaCompra" > o."fechaOperacion" THEN
    RAISE EXCEPTION 'asignación: el lote se compró después de la venta' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW."cantidad" > o."cantidadCompletada" THEN
    RAISE EXCEPTION 'asignación: la cantidad pasa la de la venta' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW."cantidad" > l."cantidad" THEN
    RAISE EXCEPTION 'asignación: la cantidad pasa la del lote' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "asignacion_venta_coherente" BEFORE INSERT OR UPDATE OF "ordenVentaId", "loteId", "cantidad" ON "asignacion_venta"
  FOR EACH ROW EXECUTE FUNCTION "inv_asignacion_coherente"();

CREATE FUNCTION "inv_lote_fijo"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW."instrumentoId", NEW."fechaCompra", NEW."cantidad", NEW."costoTotal")
       IS DISTINCT FROM (OLD."instrumentoId", OLD."fechaCompra", OLD."cantidad", OLD."costoTotal")
     AND EXISTS (SELECT 1 FROM public."asignacion_venta" WHERE "loteId" = OLD."id") THEN
    RAISE EXCEPTION 'lote: con asignaciones no cambia de especie, fecha de compra, cantidad ni costo' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "lote_fijo" BEFORE UPDATE OF "instrumentoId", "fechaCompra", "cantidad", "costoTotal" ON "lote"
  FOR EACH ROW EXECUTE FUNCTION "inv_lote_fijo"();
