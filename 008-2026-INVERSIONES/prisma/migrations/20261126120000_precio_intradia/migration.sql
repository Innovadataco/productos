-- Precios cada minuto durante la rueda: la tabla precio_intradia. ADITIVA: una tabla, su índice único, su llave, dos CHECK,
-- dos funciones y dos disparadores; no toca ninguna tabla que ya exista (precio_cierre sigue igual).
--
-- Una fila es la barra de 1 minuto de Yahoo `<NEMO>.CL` de una especie: la hora de la barra (`instante`), su precio sin
-- ajustar, la fuente, si la respuesta la marcó con retraso (`conRetraso`) y la hora en que se trajo (`traidoEn`). La
-- escribe el servicio de precios (inv_precios: INSERT por columna sin "traidoEn"), la lee la app (el SELECT general de
-- inv_app) y la IA (SELECT por columna de inv_ia); docker/migrador/privilegios.sql.
--
-- Sin duplicados: una fila por (especie, instante, fuente); el servicio inserta con ON CONFLICT DO NOTHING, así que traer la
-- misma barra otra vez no escribe nada. Ese mismo índice único sirve a las consultas por especie y por instante.
--
-- Solo inserción, con la salida de la retención: inv_precio_intradia_retiro rechaza todo UPDATE y todo DELETE salvo el de
-- una fila de más de 60 días. La retención (el job de depuración del servicio de precios) borra con DELETE de tabla, que
-- inv_precios recibe por esa razón (no existe DELETE por columna): lo único que puede borrar es lo viejo, y nada se edita.
-- 60 días corridos son siempre al menos 30 días hábiles de la BVC (con a lo sumo 5 festivos en ese lapso quedan 38), que es
-- lo que se quiere conservar; un piso en días corridos no necesita leer el calendario dentro del disparador.
--
-- La inserción (inv_precio_intradia_insercion), para todo rol que NO tenga los privilegios del dueño de la tabla (pg_has_role
-- … 'USAGE'; hoy inv_precios, mañana cualquier rol nuevo con escritura: falla cerrada): la hora de traída la pone la base,
-- la fuente solo puede ser yahoo y la barra no puede ser del futuro. Es SECURITY INVOKER a propósito (dentro de una SECURITY
-- DEFINER, current_user sería el dueño y la regla no se aplicaría a nadie) y con search_path fijo, con pg_temp al final. El
-- dueño (inv_dueno) y el superusuario quedan fuera: pueden desactivar un disparador, así que no son la frontera; el guardián
-- del esquema (scripts/verificar-esquema.sql) detiene el siguiente despliegue si algo de esto falta o cambia, o si una de las
-- dos funciones pasa a SECURITY DEFINER o pierde su search_path.
--
-- Riesgo residual (lo mismo dice privilegios.sql): con la clave de inv_precios se pueden insertar barras falsas de cualquier
-- especie dentro del tope (la base no puede comparar contra Yahoo) y borrar lo de más de 60 días; no puede fechar la
-- traída, editar nada ni borrar lo reciente.
SET LOCAL lock_timeout = '5s';

-- ───────────── Generado por Prisma (schema.prisma), revisado a mano ─────────────
-- CreateTable
CREATE TABLE "precio_intradia" (
    "id" TEXT NOT NULL,
    "instrumentoId" TEXT NOT NULL,
    "instante" TIMESTAMPTZ(6) NOT NULL,
    "precio" DECIMAL(20,6) NOT NULL,
    "fuente" TEXT NOT NULL,
    "conRetraso" BOOLEAN NOT NULL,
    "traidoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "precio_intradia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "precio_intradia_instrumentoId_instante_fuente_key" ON "precio_intradia"("instrumentoId", "instante", "fuente");

-- AddForeignKey
ALTER TABLE "precio_intradia" ADD CONSTRAINT "precio_intradia_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "instrumento"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ───────────── Escrito a mano: Prisma no modela CHECK ni disparadores ─────────────
-- El tope del precio es el de precio_cierre y de yahoo.ts (PRECIO_MAXIMO_COP): por encima, el dato se considera corrupto.
ALTER TABLE "precio_intradia" ADD CONSTRAINT "precio_intradia_precio_chk" CHECK ("precio" > 0 AND "precio" <= 10000000);
ALTER TABLE "precio_intradia" ADD CONSTRAINT "precio_intradia_fuente_chk" CHECK ("fuente" ~ '^[a-z][a-z0-9:_.-]{0,39}$');

-- La retención: UPDATE nunca; DELETE solo de lo de más de 60 días. Para todo rol (el mismo mensaje de «solo inserción»).
CREATE FUNCTION "inv_precio_intradia_retiro"() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD."instante" < now() - interval '60 days' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'La tabla precio_intradia es de solo inserción: no se edita y solo se borra lo de más de 60 días (la retención)'
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "precio_intradia_retiro" BEFORE UPDATE OR DELETE ON "precio_intradia" FOR EACH ROW EXECUTE FUNCTION "inv_precio_intradia_retiro"();

-- Una barra del servicio: la hora de traída la pone la base, la fuente es yahoo y la barra no es del futuro.
CREATE FUNCTION "inv_precio_intradia_insercion"() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF pg_has_role((SELECT c.relowner FROM pg_catalog.pg_class c WHERE c.oid = TG_RELID), 'USAGE') THEN
    RETURN NEW;
  END IF;
  NEW."traidoEn" := clock_timestamp();
  IF NEW."fuente" IS DISTINCT FROM 'yahoo' THEN
    RAISE EXCEPTION 'precio_intradia: el servicio solo guarda precios de yahoo' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW."instante" > now() THEN
    RAISE EXCEPTION 'precio_intradia: no hay precios del futuro' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "precio_intradia_insercion" BEFORE INSERT ON "precio_intradia" FOR EACH ROW EXECUTE FUNCTION "inv_precio_intradia_insercion"();
