-- La verificación que recalcula la base al insertar un cierre (disparador precio_cierre_insercion, migración
-- 20261121231049_precios_integridad) se hace contra la certificación de A&V VIGENTE del día (frente
-- certificacion-corte-real): una certificación retirada (cargada con el corte equivocado, migración
-- 20261122010000_certificacion_retiro) ya no es referencia, como en src/precios/guardar.ts (estadoDe). Sin esto, un
-- VERIFICADO contra la retirada pasaría y un cierre legítimo sin referencia ese día se rechazaría.
-- Solo cambia ese filtro: el resto de la función es idéntico (candado: tests/unit/precios/integridad-migracion.test.ts)
-- y el disparador sigue siendo el mismo. inv_precios ya lee "retiradaEn" (docker/migrador/privilegios.sql).
-- No toca ni revisa filas: los cierres que ya existen quedan igual.
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION "inv_precio_cierre_insercion"() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  hoy date := ((now() AT TIME ZONE 'UTC') - interval '5 hours')::date;
  ref numeric;
  estado public."EstadoPrecio" := 'NO_VERIFICADO';
  fuente_ref text;
  desviacion numeric;
BEGIN
  IF pg_has_role((SELECT c.relowner FROM pg_catalog.pg_class c WHERE c.oid = TG_RELID), 'USAGE') THEN
    RETURN NEW;
  END IF;
  NEW."traidoEn" := now();
  IF NEW."reemplazadoEn" IS NOT NULL THEN
    RAISE EXCEPTION 'precio_cierre: lo que se inserta nace vigente' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW."fuente" IS DISTINCT FROM 'yahoo' THEN
    RAISE EXCEPTION 'precio_cierre: el servicio solo guarda cierres de yahoo' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW."precio" > 10000000 THEN
    RAISE EXCEPTION 'precio_cierre: precio fuera de rango' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW."fecha" > hoy THEN
    RAISE EXCEPTION 'precio_cierre: no hay cierres de días futuros' USING ERRCODE = 'check_violation';
  END IF;
  SELECT p."precioValoracion" INTO ref
    FROM public."certificacion_posicion" p JOIN public."certificacion" c ON c."id" = p."certificacionId"
    WHERE p."instrumentoId" = NEW."instrumentoId" AND c."fechaCorte" = NEW."fecha" AND c."retiradaEn" IS NULL;
  IF FOUND THEN
    fuente_ref := 'certificacion:' || to_char(NEW."fecha", 'YYYY-MM-DD');
    IF ref > 0 THEN
      desviacion := round((abs(NEW."precio" - ref) * 100)::numeric(60, 30) / ref, 6);
      IF desviacion > 999.999999 THEN
        desviacion := NULL;
      ELSIF abs(NEW."precio" - ref) <= 0.01 * ref THEN
        estado := 'VERIFICADO';
      END IF;
    END IF;
  END IF;
  IF NEW."estado" IS DISTINCT FROM estado
     OR NEW."fuenteReferencia" IS DISTINCT FROM fuente_ref
     OR NEW."precioReferencia" IS DISTINCT FROM ref
     OR (NEW."desviacionPct" IS NULL) <> (desviacion IS NULL)
     OR abs(NEW."desviacionPct" - desviacion) > 0.000001 THEN
    RAISE EXCEPTION 'precio_cierre: la verificación no es la que da la certificación de A&V de ese día' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
