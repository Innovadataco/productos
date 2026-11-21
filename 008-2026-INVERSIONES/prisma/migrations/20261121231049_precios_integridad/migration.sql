-- Integridad de los precios frente a inv_precios (riesgo MEDIO de la revisión de seguridad de #1026; requisito antes
-- de desplegar el servicio de precios). Escrita a mano: schema.prisma no cambia (Prisma no modela disparadores).
-- ADITIVA: tres funciones y cuatro disparadores; no toca ni revisa filas (un disparador solo mira lo que se inserta,
-- cambia o borra desde ya: los cierres que ya existen quedan igual).
--
-- A quién se aplica: a todo rol que NO tenga los privilegios del dueño de la tabla (pg_has_role … 'USAGE'): hoy,
-- inv_precios; mañana, cualquier rol nuevo con escritura (falla cerrada). El dueño (inv_dueno: el migrador, la vía B
-- de precios:importar, depurar-precios) y el superusuario quedan fuera: pueden desactivar o borrar un disparador, así
-- que no son la frontera; el guardián del esquema (scripts/verificar-esquema.sql) detiene el siguiente despliegue si
-- un disparador falta, cambia o queda deshabilitado, o si una de estas funciones cambia, pasa a SECURITY DEFINER o
-- pierde su search_path.
-- SECURITY INVOKER a propósito: dentro de una SECURITY DEFINER, current_user sería el dueño y la regla no se aplicaría
-- a nadie. search_path fijo, con pg_temp al final (así un objeto temporal nunca sombrea un tipo o una tabla). Leen
-- como quien escribe (privilegios.sql ya le da a inv_precios esas columnas). Sin salida de escape por GUC: inv_precios
-- podría fijar cualquiera con SET LOCAL.
--
-- Lo que NO cierra (riesgo residual): con la clave de inv_precios, un precio falso dentro del ±1 % de la valoración de
-- A&V entra como VERIFICADO (la base lo recalcula con el precio que recibe); se pueden insertar precios falsos
-- NO_VERIFICADO, también en días con certificación, de cualquier instrumento; retirar vigentes de cualquier fuente,
-- también en masa y sin sucesor (la historia queda, pero la valoración se queda sin cierre), e insertar valores de
-- unidad falsos dentro del rango de la SFC. La base no puede comparar contra Yahoo ni contra la SFC.
SET LOCAL lock_timeout = '5s';

-- Un cierre del servicio: la verificación contra la certificación de A&V del mismo día la recalcula la base con la
-- regla de src/precios/guardar.ts (estadoDe) y se rechaza lo que no coincida (el estado y las referencias exactos; la
-- desviación con un ulp de tolerancia por el redondeo de decimal.js). La fuente, el tope del precio y la fecha son los
-- de guardar.ts, yahoo.ts y csv-cierres.ts (el tope también frena un NaN: NaN > 10000000 es verdadero). traidoEn lo
-- pone la base. Candado: tests/unit/precios/integridad-migracion.test.ts.
CREATE FUNCTION "inv_precio_cierre_insercion"() RETURNS trigger LANGUAGE plpgsql
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
    WHERE p."instrumentoId" = NEW."instrumentoId" AND c."fechaCorte" = NEW."fecha";
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

-- Un valor de unidad del servicio: solo de la SFC (FUENTE_SFC de src/fondo/sfc.ts), con el rango de leerDecimalSfc
-- (> 0 y ≤ VALOR_UNIDAD_MAXIMO_COP; el del fondo, nulo o > 0 y ≤ VALOR_FONDO_MAXIMO_COP: así no entra un NaN, que el
-- CHECK de la tabla deja pasar porque NaN > 0 es verdadero), nace vigente, no es de un día futuro; traidoEn lo pone
-- la base. No hay verificación que recalcular.
CREATE FUNCTION "inv_valor_unidad_fondo_insercion"() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  hoy date := ((now() AT TIME ZONE 'UTC') - interval '5 hours')::date;
BEGIN
  IF pg_has_role((SELECT c.relowner FROM pg_catalog.pg_class c WHERE c.oid = TG_RELID), 'USAGE') THEN
    RETURN NEW;
  END IF;
  NEW."traidoEn" := now();
  IF NEW."reemplazadoEn" IS NOT NULL THEN
    RAISE EXCEPTION 'valor_unidad_fondo: lo que se inserta nace vigente' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW."fuente" IS DISTINCT FROM 'sfc:qhpu-8ixx' THEN
    RAISE EXCEPTION 'valor_unidad_fondo: el servicio solo guarda valores de la SFC' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT (NEW."valorUnidad" > 0 AND NEW."valorUnidad" <= 10000000)
     OR (NEW."valorFondo" IS NOT NULL AND NOT (NEW."valorFondo" > 0 AND NEW."valorFondo" <= 10000000000000000)) THEN
    RAISE EXCEPTION 'valor_unidad_fondo: valor fuera de rango' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW."fechaValor" > hoy THEN
    RAISE EXCEPTION 'valor_unidad_fondo: no hay valores de días futuros' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- El retiro, en las dos tablas: solo un vigente, solo de nulo a la hora de la base (la del cliente se ignora: así el
-- retirado y su sucesor, en la misma transacción, quedan con el mismo instante), solo cambia "reemplazadoEn" y nada se
-- borra. Lo retirado nunca se reabre ni se vuelve a fechar. El retiro sin sucesor sigue permitido (lo hacen
-- retirarVigentes y depurar-precios). Las guardas de guardar.ts y fondo (`reemplazadoEn: null` en el WHERE) hacen que
-- una carrera nunca llegue aquí: la fila ya retirada no se selecciona.
CREATE FUNCTION "inv_retiro_vigente"() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF pg_has_role((SELECT c.relowner FROM pg_catalog.pg_class c WHERE c.oid = TG_RELID), 'USAGE') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION '%: no se borra; se retira con reemplazadoEn', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD."reemplazadoEn" IS NOT NULL THEN
    RAISE EXCEPTION '%: lo retirado no se reabre ni se vuelve a fechar', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW."reemplazadoEn" IS NULL THEN
    RAISE EXCEPTION '%: solo se puede marcar el retiro', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
  END IF;
  NEW."reemplazadoEn" := now();
  IF (to_jsonb(NEW) - 'reemplazadoEn') IS DISTINCT FROM (to_jsonb(OLD) - 'reemplazadoEn') THEN
    RAISE EXCEPTION '%: al retirar solo cambia reemplazadoEn', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "precio_cierre_insercion" BEFORE INSERT ON "precio_cierre" FOR EACH ROW EXECUTE FUNCTION "inv_precio_cierre_insercion"();
CREATE TRIGGER "precio_cierre_retiro" BEFORE UPDATE OR DELETE ON "precio_cierre" FOR EACH ROW EXECUTE FUNCTION "inv_retiro_vigente"();
CREATE TRIGGER "valor_unidad_fondo_insercion" BEFORE INSERT ON "valor_unidad_fondo" FOR EACH ROW EXECUTE FUNCTION "inv_valor_unidad_fondo_insercion"();
CREATE TRIGGER "valor_unidad_fondo_retiro" BEFORE UPDATE OR DELETE ON "valor_unidad_fondo" FOR EACH ROW EXECUTE FUNCTION "inv_retiro_vigente"();
