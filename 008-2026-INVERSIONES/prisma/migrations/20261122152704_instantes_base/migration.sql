-- Los instantes del plan y del diario los pone la BASE: plan_version."creadaEn", decision."registradaEn" y
-- enlace_decision_orden."creadoEn" («cuándo se registró»). Antes los mandaba Prisma en cada INSERT (`@default(now())`
-- genera la hora en el cliente) y por eso inv_app tenía INSERT de esas columnas: con su clave se podía antedatar una
-- versión, una decisión o un enlace (PR #1062, riesgo residual de privilegios.sql). ADITIVA: el DEFAULT de las tres
-- columnas, tres funciones y tres disparadores; no toca ni revisa filas (las que ya están guardan la hora del cliente).
--
-- Tres piezas, y cada una sola falla cerrada:
--  1. schema.prisma pasa a `@default(dbgenerated("clock_timestamp()"))`: Prisma 5.22 deja de mandar la columna (verificado
--     con su registro de consultas) y la recibe por RETURNING.
--  2. docker/migrador/privilegios.sql deja de dársela a inv_app: nombrarla da 42501 al empezar la sentencia, antes de
--     cualquier disparador. Si alguien vuelve a `@default(now())`, Prisma la manda y la web da 42501 (no se cuela nada).
--  3. Defensa en profundidad: un disparador BEFORE INSERT por tabla la fija con la hora de la base para todo rol que NO
--     tenga los privilegios del dueño de la tabla (pg_has_role … 'USAGE', como en *_precios_integridad), aunque alguien le
--     diera el permiso de columna por error. Lo que mande se ignora.
--
-- Por qué clock_timestamp() y no now(): now() es el inicio de la transacción y statement_timestamp() el de la sentencia.
-- inv_app no tiene statement_timeout ni idle_in_transaction_session_timeout (y podría fijarlos con SET): un BEGIN un día
-- y el INSERT días después fecharía en el pasado, y una sentencia que duerme antes de dar su fila (una CTE con pg_sleep),
-- también. clock_timestamp() es el momento en que se arma la fila. Es además lo más parecido a lo de antes (Prisma ponía
-- una hora por consulta, no una por transacción). Las columnas son timestamptz: el TimeZone de la sesión no las corre.
--
-- El dueño (inv_dueno: el migrador, importar-plan y las demás cargas por la vía B) y el superusuario quedan fuera: una
-- restauración de solo datos (COPY dispara los BEFORE INSERT) o una reparación conservan sus instantes, y si no los
-- mandan (importar-plan, con Prisma) los pone el DEFAULT. Pueden deshabilitar o borrar un disparador, así que no son la
-- frontera: el guardián del esquema (scripts/verificar-esquema.sql) detiene el siguiente despliegue si un disparador
-- falta, cambia o queda deshabilitado, o si una de estas funciones cambia, pasa a SECURITY DEFINER o recibe un SET.
--
-- SECURITY INVOKER a propósito: dentro de una SECURITY DEFINER, current_user sería el dueño y nadie quedaría alcanzado.
-- Sin `SET search_path` (tests/unit/produccion/verificar-esquema.test.ts lo exige así para las funciones que no son de
-- precios ni de datos oficiales): por eso todo lo que se resuelve por nombre va calificado con pg_catalog (la función, la
-- tabla y el operador). Además inv_app no puede crear objetos: ni CREATE en public ni TEMP en la base
-- (scripts/crear-roles-prod.sql; lo prueba roles-base.test.ts), y pg_temp nunca se busca para funciones ni operadores.
--
-- Riesgo residual (lo mismo dice privilegios.sql): con la clave de inv_app se siguen pudiendo insertar versiones,
-- reglas, decisiones y enlaces falsos (con un autor que exista), con el id, el número de versión, la fecha de la
-- decisión y la vigencia que quiera (una versión con un número mayor y una vigencia pasada pasa a ser la vigente de esos
-- días: lo impide la app, VIGENCIA_RETROCEDE, no la base); lo que ya no puede es mentir sobre CUÁNDO se registraron, y
-- ese instante lo delata. Una transacción abierta puede confirmar más tarde (la hora es la del INSERT, no la del COMMIT;
-- PostgreSQL 16 no tiene transaction_timeout). La hora es la del reloj del servidor de la base.
-- Candados: tests/unit/plan/instantes-base.test.ts, tests/integracion/instantes-base.test.ts y roles-base.test.ts (CI).
SET LOCAL lock_timeout = '5s';

-- ───────────── Generado por Prisma (schema.prisma), revisado a mano ─────────────
-- AlterTable
ALTER TABLE "decision" ALTER COLUMN "registradaEn" SET DEFAULT clock_timestamp();

-- AlterTable
ALTER TABLE "enlace_decision_orden" ALTER COLUMN "creadoEn" SET DEFAULT clock_timestamp();

-- AlterTable
ALTER TABLE "plan_version" ALTER COLUMN "creadaEn" SET DEFAULT clock_timestamp();

-- ───────────── Escrito a mano: Prisma no modela disparadores ─────────────
-- Una función por tabla: la asignación directa falla sola si la columna no existe, y cada una fija solo su instante.
CREATE FUNCTION "inv_plan_version_instante"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF pg_catalog.pg_has_role((SELECT c.relowner FROM pg_catalog.pg_class c WHERE c.oid OPERATOR(pg_catalog.=) TG_RELID), 'USAGE') THEN
    RETURN NEW;
  END IF;
  NEW."creadaEn" := pg_catalog.clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE FUNCTION "inv_decision_instante"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF pg_catalog.pg_has_role((SELECT c.relowner FROM pg_catalog.pg_class c WHERE c.oid OPERATOR(pg_catalog.=) TG_RELID), 'USAGE') THEN
    RETURN NEW;
  END IF;
  NEW."registradaEn" := pg_catalog.clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE FUNCTION "inv_enlace_decision_orden_instante"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF pg_catalog.pg_has_role((SELECT c.relowner FROM pg_catalog.pg_class c WHERE c.oid OPERATOR(pg_catalog.=) TG_RELID), 'USAGE') THEN
    RETURN NEW;
  END IF;
  NEW."creadoEn" := pg_catalog.clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TRIGGER "plan_version_instante" BEFORE INSERT ON "plan_version" FOR EACH ROW EXECUTE FUNCTION "inv_plan_version_instante"();
CREATE TRIGGER "decision_instante" BEFORE INSERT ON "decision" FOR EACH ROW EXECUTE FUNCTION "inv_decision_instante"();
CREATE TRIGGER "enlace_decision_orden_instante" BEFORE INSERT ON "enlace_decision_orden" FOR EACH ROW EXECUTE FUNCTION "inv_enlace_decision_orden_instante"();
