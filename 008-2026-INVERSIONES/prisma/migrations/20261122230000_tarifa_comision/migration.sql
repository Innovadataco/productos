-- Fase E (O5): la tarifa de comisión real de cada casa de bolsa, versionada y de SOLO INSERCIÓN. ADITIVA: una tabla, su
-- índice único, el de su llave, sus CHECK, una función y dos disparadores; no toca ninguna tabla que ya exista. La escribe
-- el dueño desde /edicion/tarifas, que corre como inv_app (INSERT por columna sin "creadaEn": docker/migrador/privilegios.sql),
-- y la lee la app (el SELECT general de inv_app). Ni inv_ia ni inv_precios la leen.
--
-- Una fila es la tarifa de un comisionista (TRII o AV) para un lado (COMPRA o VENTA), desde un día. Cada cambio es una
-- versión nueva (número único en toda la tabla, mayor que cero) con su autor, su motivo y la hora que pone la BASE (DEFAULT
-- clock_timestamp() y un disparador que la fija para todo rol que no tenga los privilegios del dueño: copia exacta de
-- inv_plan_version_instante). La vigente de un comisionista y un lado en un día es la de mayor versión con "vigenteDesde"
-- hasta ese día (src/operar/tarifa/vigente.ts). Nada se edita ni se borra (inv_solo_insercion).
--
-- Las CHECK repiten las listas y los límites de src/operar/tarifa/parametros.ts (una prueba espejo:
-- tests/unit/operar/tarifa/esquema.test.ts): porcentaje e IVA de 0 a 100; mínimo y fijo de 0 a menos de cien millones de
-- pesos; hasta 3 otros cargos, cada uno con nombre (1 a 60 caracteres, sin controles), tipo PCT (hasta 100) o FIJO, y valor
-- como texto decimal (hasta 8 enteros y 4 decimales; un PCT, hasta 100: por expresión regular, sin conversiones). Postgres no admite subconsultas en una
-- CHECK: los 3 cargos van desenrollados, posición por posición.
--
-- Riesgo residual (lo mismo dice privilegios.sql): con la clave de inv_app se pueden insertar versiones falsas (con un autor
-- que exista y el número que quiera); lo que no puede es fecharlas, editarlas ni borrarlas. Una tarifa falsa solo cambia la
-- comisión que muestra el simulador (no escribe nada) y la historia la delata. El guardián del esquema
-- (scripts/verificar-esquema.sql) detiene el siguiente despliegue si falta o cambia algo de esto.
SET LOCAL lock_timeout = '5s';

-- ───────────── Generado por Prisma (schema.prisma), revisado a mano ─────────────
-- CreateTable
CREATE TABLE "tarifa_comision" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "comisionista" TEXT NOT NULL,
    "lado" "LadoOrden" NOT NULL,
    "porcentaje" DECIMAL(7,4) NOT NULL,
    "minimoPorOrden" DECIMAL(20,4) NOT NULL,
    "fijoPorOrden" DECIMAL(20,4) NOT NULL,
    "ivaPct" DECIMAL(5,2) NOT NULL,
    "otrosCargos" JSONB NOT NULL,
    "vigenteDesde" DATE NOT NULL,
    "motivo" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "creadaEn" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "tarifa_comision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tarifa_comision_version_key" ON "tarifa_comision"("version");

-- CreateIndex
CREATE INDEX "tarifa_comision_autorId_idx" ON "tarifa_comision"("autorId");

-- AddForeignKey
ALTER TABLE "tarifa_comision" ADD CONSTRAINT "tarifa_comision_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ───────────── Escrito a mano: Prisma no modela CHECK ni disparadores ─────────────
ALTER TABLE "tarifa_comision" ADD CONSTRAINT "tarifa_comision_version_chk" CHECK ("version" >= 1);
ALTER TABLE "tarifa_comision" ADD CONSTRAINT "tarifa_comision_comisionista_chk" CHECK ("comisionista" IN ('TRII', 'AV'));
ALTER TABLE "tarifa_comision" ADD CONSTRAINT "tarifa_comision_porcentaje_chk" CHECK ("porcentaje" >= 0 AND "porcentaje" <= 100);
ALTER TABLE "tarifa_comision" ADD CONSTRAINT "tarifa_comision_iva_chk" CHECK ("ivaPct" >= 0 AND "ivaPct" <= 100);
ALTER TABLE "tarifa_comision" ADD CONSTRAINT "tarifa_comision_montos_chk" CHECK ("minimoPorOrden" >= 0 AND "minimoPorOrden" < 100000000 AND "fijoPorOrden" >= 0 AND "fijoPorOrden" < 100000000);
ALTER TABLE "tarifa_comision" ADD CONSTRAINT "tarifa_comision_motivo_chk" CHECK ("motivo" ~ '[^[:space:]]' AND char_length("motivo") <= 2000);

-- Los otros cargos: un arreglo de hasta 3, cada uno con EXACTAMENTE nombre, tipo y valor (sin subconsultas: desenrollado).
ALTER TABLE "tarifa_comision" ADD CONSTRAINT "tarifa_comision_cargos_chk" CHECK (jsonb_typeof("otrosCargos") = 'array' AND jsonb_array_length("otrosCargos") <= 3 AND (jsonb_array_length("otrosCargos") <= 0 OR (jsonb_typeof(("otrosCargos"->0)) = 'object' AND (("otrosCargos"->0) - ARRAY['nombre', 'tipo', 'valor']) = '{}'::jsonb AND ("otrosCargos"->0) ?& ARRAY['nombre', 'tipo', 'valor'] AND jsonb_typeof(("otrosCargos"->0)->'nombre') = 'string' AND char_length(("otrosCargos"->0)->>'nombre') BETWEEN 1 AND 60 AND (("otrosCargos"->0)->>'nombre') ~ '[^[:space:]]' AND (("otrosCargos"->0)->>'nombre') !~ '[[:cntrl:]]' AND (("otrosCargos"->0)->>'tipo') IN ('PCT', 'FIJO') AND jsonb_typeof(("otrosCargos"->0)->'valor') = 'string' AND (("otrosCargos"->0)->>'valor') ~ '^[0-9]{1,8}([.][0-9]{1,4})?$' AND ((("otrosCargos"->0)->>'tipo') <> 'PCT' OR (("otrosCargos"->0)->>'valor') ~ '^(100([.]0{1,4})?|[0-9]{1,2}([.][0-9]{1,4})?)$'))) AND (jsonb_array_length("otrosCargos") <= 1 OR (jsonb_typeof(("otrosCargos"->1)) = 'object' AND (("otrosCargos"->1) - ARRAY['nombre', 'tipo', 'valor']) = '{}'::jsonb AND ("otrosCargos"->1) ?& ARRAY['nombre', 'tipo', 'valor'] AND jsonb_typeof(("otrosCargos"->1)->'nombre') = 'string' AND char_length(("otrosCargos"->1)->>'nombre') BETWEEN 1 AND 60 AND (("otrosCargos"->1)->>'nombre') ~ '[^[:space:]]' AND (("otrosCargos"->1)->>'nombre') !~ '[[:cntrl:]]' AND (("otrosCargos"->1)->>'tipo') IN ('PCT', 'FIJO') AND jsonb_typeof(("otrosCargos"->1)->'valor') = 'string' AND (("otrosCargos"->1)->>'valor') ~ '^[0-9]{1,8}([.][0-9]{1,4})?$' AND ((("otrosCargos"->1)->>'tipo') <> 'PCT' OR (("otrosCargos"->1)->>'valor') ~ '^(100([.]0{1,4})?|[0-9]{1,2}([.][0-9]{1,4})?)$'))) AND (jsonb_array_length("otrosCargos") <= 2 OR (jsonb_typeof(("otrosCargos"->2)) = 'object' AND (("otrosCargos"->2) - ARRAY['nombre', 'tipo', 'valor']) = '{}'::jsonb AND ("otrosCargos"->2) ?& ARRAY['nombre', 'tipo', 'valor'] AND jsonb_typeof(("otrosCargos"->2)->'nombre') = 'string' AND char_length(("otrosCargos"->2)->>'nombre') BETWEEN 1 AND 60 AND (("otrosCargos"->2)->>'nombre') ~ '[^[:space:]]' AND (("otrosCargos"->2)->>'nombre') !~ '[[:cntrl:]]' AND (("otrosCargos"->2)->>'tipo') IN ('PCT', 'FIJO') AND jsonb_typeof(("otrosCargos"->2)->'valor') = 'string' AND (("otrosCargos"->2)->>'valor') ~ '^[0-9]{1,8}([.][0-9]{1,4})?$' AND ((("otrosCargos"->2)->>'tipo') <> 'PCT' OR (("otrosCargos"->2)->>'valor') ~ '^(100([.]0{1,4})?|[0-9]{1,2}([.][0-9]{1,4})?)$'))));

-- Solo inserción, con la función de siempre.
CREATE TRIGGER "tarifa_comision_solo_insercion" BEFORE UPDATE OR DELETE ON "tarifa_comision" FOR EACH ROW EXECUTE FUNCTION "inv_solo_insercion"();

-- La hora de la versión, para todo rol que no tenga los privilegios del dueño (copia exacta de inv_plan_version_instante).
CREATE FUNCTION "inv_tarifa_comision_instante"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF pg_catalog.pg_has_role((SELECT c.relowner FROM pg_catalog.pg_class c WHERE c.oid OPERATOR(pg_catalog.=) TG_RELID), 'USAGE') THEN
    RETURN NEW;
  END IF;
  NEW."creadaEn" := pg_catalog.clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TRIGGER "tarifa_comision_instante" BEFORE INSERT ON "tarifa_comision" FOR EACH ROW EXECUTE FUNCTION "inv_tarifa_comision_instante"();
