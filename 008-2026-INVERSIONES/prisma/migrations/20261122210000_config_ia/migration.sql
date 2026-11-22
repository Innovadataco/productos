-- Fase E (E8): la configuración de la IA, versionada y de SOLO INSERCIÓN. ADITIVA: una tabla, su índice único, el de su
-- llave, sus CHECK, una función y dos disparadores; no toca ninguna tabla que ya exista. La escribe el dueño desde
-- /edicion/ia, que corre como inv_app (INSERT por columna sin "creadaEn": docker/migrador/privilegios.sql), y la lee el
-- servicio de los resúmenes como inv_ia (SELECT por columna, sin el motivo ni el autor).
--
-- Cada cambio es una versión nueva (versión única, mayor que cero) con su autor, su motivo y la hora que pone la BASE
-- (DEFAULT clock_timestamp() y un disparador que la fija para todo rol que no tenga los privilegios del dueño: copia de
-- inv_plan_version_instante, migración 20261122152704_instantes_base). La vigente es la de mayor versión; sin ninguna,
-- la IA está apagada. Nada se edita ni se borra (inv_solo_insercion). Nunca guarda la llave de la nube.
--
-- Las CHECK repiten las listas cerradas y los límites de src/ia (una sola fuente de verdad por lista, con una prueba
-- espejo: tests/unit/ia/config/esquema.test.ts): los modos (MODOS_PUERTAS), los modelos de la nube (MODELOS_NUBE), los
-- esfuerzos, las horas, el límite por pedido (10 a 120 s, el de PI), la temperatura de la local (0 a 1) y el tope (USD 1
-- al techo de cordura de 50). Las tareas (TAREAS_IA: hoy los tres tipos de resumen) van en un JSON cerrado, una entrada
-- por tarea con si está activa y su modelo local; una tarea futura (p. ej. OPERAR o ANALISIS) se agrega a la lista y a
-- esta CHECK, sin columnas nuevas. Lo que exige cada modo: con la local, el destino y un modelo en cada tarea activa; con
-- la nube, el tope. La pertenencia de cada modelo a la lista que publica PI la revisa la app al guardar (la lista no
-- está en la base) y la puerta local otra vez en cada corrida.
--
-- El destino del Ollama: la CHECK revisa solo el FORMATO del destino (una IPv4 en forma de la tailnet y un puerto, o
-- ninguno). NO es el control de seguridad: el rango incluye cualquier equipo de la tailnet; el control está en la red
-- (la regla de salida de PI, con la IP y el puerto exactos del Mac, y la ACL de Tailscale). Sin IPv4 escritas: el rango
-- va con números (el cruce de literales de la Fábrica las marca).
--
-- Riesgo residual (lo mismo dice privilegios.sql): con la clave de inv_app se pueden insertar versiones falsas (con un
-- autor que exista), con el número de versión que quiera; lo que no puede es fecharlas, editarlas ni borrarlas. El
-- guardián del esquema (scripts/verificar-esquema.sql) detiene el siguiente despliegue si falta o cambia algo de esto.
-- Candados: tests/unit/ia/config/esquema.test.ts, tests/integracion/ia/config-ia-reglas.test.ts y guardian-esquema.test.ts.
SET LOCAL lock_timeout = '5s';

-- ───────────── Generado por Prisma (schema.prisma), revisado a mano ─────────────
-- CreateTable
CREATE TABLE "config_ia" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "modo" TEXT NOT NULL,
    "ollamaHost" TEXT,
    "ollamaPuerto" INTEGER,
    "temperaturaLocal" DECIMAL(3,2) NOT NULL,
    "tareas" JSONB NOT NULL,
    "modeloNube" TEXT NOT NULL,
    "topeMensualUsd" DECIMAL(6,2),
    "horaResumen" TEXT NOT NULL,
    "limiteSegundos" INTEGER NOT NULL,
    "esfuerzoNube" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "creadaEn" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "config_ia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "config_ia_version_key" ON "config_ia"("version");

-- CreateIndex
CREATE INDEX "config_ia_autorId_idx" ON "config_ia"("autorId");

-- AddForeignKey
ALTER TABLE "config_ia" ADD CONSTRAINT "config_ia_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ───────────── Escrito a mano: Prisma no modela CHECK ni disparadores ─────────────
ALTER TABLE "config_ia" ADD CONSTRAINT "config_ia_version_chk" CHECK ("version" >= 1);
ALTER TABLE "config_ia" ADD CONSTRAINT "config_ia_modo_chk" CHECK ("modo" IN ('apagado', 'local', 'nube', 'local-luego-nube'));
ALTER TABLE "config_ia" ADD CONSTRAINT "config_ia_modelo_nube_chk" CHECK ("modeloNube" IN ('claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'));
ALTER TABLE "config_ia" ADD CONSTRAINT "config_ia_esfuerzo_chk" CHECK ("esfuerzoNube" IN ('low', 'medium'));
ALTER TABLE "config_ia" ADD CONSTRAINT "config_ia_hora_chk" CHECK ("horaResumen" IN ('18:00', '19:00', '20:00', '21:00'));
ALTER TABLE "config_ia" ADD CONSTRAINT "config_ia_limite_chk" CHECK ("limiteSegundos" BETWEEN 10 AND 120);
ALTER TABLE "config_ia" ADD CONSTRAINT "config_ia_tope_chk" CHECK ("topeMensualUsd" IS NULL OR ("topeMensualUsd" >= 1.00 AND "topeMensualUsd" <= 50.00));
ALTER TABLE "config_ia" ADD CONSTRAINT "config_ia_temperatura_chk" CHECK ("temperaturaLocal" >= 0 AND "temperaturaLocal" <= 1);
ALTER TABLE "config_ia" ADD CONSTRAINT "config_ia_motivo_chk" CHECK ("motivo" ~ '[^[:space:]]' AND char_length("motivo") <= 2000);

-- Las tareas: un objeto con EXACTAMENTE una entrada por tarea de TAREAS_IA (sin una, la regla de cada modo daría NULL y la
-- fila pasaría; revisión de base, M1), cada una con «activo»
-- (booleano) y, opcional, «modeloLocal» (null o un nombre con la forma de la lista de PI); nada más.
ALTER TABLE "config_ia" ADD CONSTRAINT "config_ia_tareas_chk" CHECK (jsonb_typeof("tareas") = 'object' AND ("tareas" - ARRAY['DIARIO', 'REGLAS', 'ESCENARIOS']) = '{}'::jsonb AND "tareas" ?& ARRAY['DIARIO', 'REGLAS', 'ESCENARIOS'] AND (NOT ("tareas" ? 'DIARIO') OR (jsonb_typeof(("tareas"->'DIARIO')) = 'object' AND (("tareas"->'DIARIO') - ARRAY['activo', 'modeloLocal']) = '{}'::jsonb AND jsonb_typeof(("tareas"->'DIARIO')->'activo') = 'boolean' AND (NOT (("tareas"->'DIARIO') ? 'modeloLocal') OR jsonb_typeof(("tareas"->'DIARIO')->'modeloLocal') = 'null' OR (jsonb_typeof(("tareas"->'DIARIO')->'modeloLocal') = 'string' AND (("tareas"->'DIARIO')->>'modeloLocal') ~ '^[a-z0-9][a-z0-9._-]{0,63}:[a-z0-9][a-z0-9._-]{0,63}$')))) AND (NOT ("tareas" ? 'REGLAS') OR (jsonb_typeof(("tareas"->'REGLAS')) = 'object' AND (("tareas"->'REGLAS') - ARRAY['activo', 'modeloLocal']) = '{}'::jsonb AND jsonb_typeof(("tareas"->'REGLAS')->'activo') = 'boolean' AND (NOT (("tareas"->'REGLAS') ? 'modeloLocal') OR jsonb_typeof(("tareas"->'REGLAS')->'modeloLocal') = 'null' OR (jsonb_typeof(("tareas"->'REGLAS')->'modeloLocal') = 'string' AND (("tareas"->'REGLAS')->>'modeloLocal') ~ '^[a-z0-9][a-z0-9._-]{0,63}:[a-z0-9][a-z0-9._-]{0,63}$')))) AND (NOT ("tareas" ? 'ESCENARIOS') OR (jsonb_typeof(("tareas"->'ESCENARIOS')) = 'object' AND (("tareas"->'ESCENARIOS') - ARRAY['activo', 'modeloLocal']) = '{}'::jsonb AND jsonb_typeof(("tareas"->'ESCENARIOS')->'activo') = 'boolean' AND (NOT (("tareas"->'ESCENARIOS') ? 'modeloLocal') OR jsonb_typeof(("tareas"->'ESCENARIOS')->'modeloLocal') = 'null' OR (jsonb_typeof(("tareas"->'ESCENARIOS')->'modeloLocal') = 'string' AND (("tareas"->'ESCENARIOS')->>'modeloLocal') ~ '^[a-z0-9][a-z0-9._-]{0,63}:[a-z0-9][a-z0-9._-]{0,63}$')))));

-- Lo que exige cada modo: con la local (local, local-luego-nube), el destino y un modelo en cada tarea activa; con la
-- nube (nube, local-luego-nube), el tope. Sin tope, la nube no corre.
ALTER TABLE "config_ia" ADD CONSTRAINT "config_ia_usa_chk" CHECK (("modo" NOT IN ('local', 'local-luego-nube') OR ("ollamaHost" IS NOT NULL AND NOT (("tareas"->'DIARIO')->'activo' = 'true'::jsonb AND jsonb_typeof(("tareas"->'DIARIO')->'modeloLocal') IS DISTINCT FROM 'string') AND NOT (("tareas"->'REGLAS')->'activo' = 'true'::jsonb AND jsonb_typeof(("tareas"->'REGLAS')->'modeloLocal') IS DISTINCT FROM 'string') AND NOT (("tareas"->'ESCENARIOS')->'activo' = 'true'::jsonb AND jsonb_typeof(("tareas"->'ESCENARIOS')->'modeloLocal') IS DISTINCT FROM 'string'))) AND ("modo" NOT IN ('nube', 'local-luego-nube') OR "topeMensualUsd" IS NOT NULL));

-- El formato del destino (no es el control de seguridad: ver la cabecera). Host y puerto juntos o ninguno; el puerto, de
-- 1 a 65535; el host, cuatro octetos sin ceros a la izquierda, el primero 100 y el segundo de 64 a 127 (el /10 de la
-- tailnet), por expresión regular (sin conversiones que puedan fallar).
ALTER TABLE "config_ia" ADD CONSTRAINT "config_ia_destino_chk" CHECK (("ollamaHost" IS NULL) = ("ollamaPuerto" IS NULL) AND ("ollamaPuerto" IS NULL OR "ollamaPuerto" BETWEEN 1 AND 65535) AND ("ollamaHost" IS NULL OR "ollamaHost" ~ '^100[.](6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])[.](25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])[.](25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])$'));

-- Solo inserción, con la función de siempre.
CREATE TRIGGER "config_ia_solo_insercion" BEFORE UPDATE OR DELETE ON "config_ia" FOR EACH ROW EXECUTE FUNCTION "inv_solo_insercion"();

-- La hora de la versión, para todo rol que no tenga los privilegios del dueño (copia exacta de inv_plan_version_instante).
CREATE FUNCTION "inv_config_ia_instante"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF pg_catalog.pg_has_role((SELECT c.relowner FROM pg_catalog.pg_class c WHERE c.oid OPERATOR(pg_catalog.=) TG_RELID), 'USAGE') THEN
    RETURN NEW;
  END IF;
  NEW."creadaEn" := pg_catalog.clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TRIGGER "config_ia_instante" BEFORE INSERT ON "config_ia" FOR EACH ROW EXECUTE FUNCTION "inv_config_ia_instante"();
