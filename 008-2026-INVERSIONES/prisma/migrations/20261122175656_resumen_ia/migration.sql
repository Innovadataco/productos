-- Fase E (E3): registro de los resúmenes con IA, de SOLO INSERCIÓN. ADITIVA: tres enums nuevos, una tabla, sus CHECK, dos
-- índices, una función y dos disparadores; no toca ninguna tabla que ya exista. Lo escribe inv_ia (el servicio de los
-- resúmenes, docker/migrador/privilegios.sql: INSERT por columna sin "generadoEn") y lo lee inv_app (SELECT, la pantalla).
--
-- Qué guarda (una fila por intento de puerta; la orquestación es de E6):
--  - PUBLICADO: el modelo respondió, el validador lo aprobó y el código lo renderizó: con texto, sin motivos.
--  - RECHAZADO: el modelo respondió y el validador lo rechazó: sin texto, con los códigos del validador.
--  - FALLIDO: no hubo salida del modelo: sin texto ni salida ni tokens, con un motivo de MOTIVOS_FALLO (src/ia/generador.ts)
--    primero y sus detalles. VISTA_NO_CIEGA (la guarda rechazó el pedido: un defecto del código, no se llamó a ningún
--    generador) va con la puerta nula, y es el único caso con la puerta nula.
-- tipo, "fechaNegocio", hechos, "hechosHash" y "hechosVersion" salen del paquete construido (src/ia/registro/fila.ts), y
-- la base exige que cuadren con el JSON guardado (resumen_ia_hechos_chk): nadie registra un texto con la clave de otro
-- paquete. A lo sumo un PUBLICADO por (tipo, día, hechos, prompt, digest del modelo): resumen_ia_publicado_key, parcial,
-- para que los RECHAZADO y los FALLIDO se repitan (reintentos). Lo que la base no puede saber (que el texto pasó el
-- validador, que la salida es la que dio el modelo) lo garantiza el código: la tabla es el registro, no el validador.
--
-- La hora del registro la pone la BASE, como en 20261122152704_instantes_base: DEFAULT clock_timestamp() (Prisma no la
-- manda: `dbgenerated` en el esquema), inv_ia no tiene permiso de nombrarla, y un disparador BEFORE INSERT la fija para
-- todo rol que no tenga los privilegios del dueño de la tabla (aunque alguien le diera el permiso por error). Así no se
-- puede antedatar una corrida para salirse del tope mensual de la nube (gastoDelMes suma por "generadoEn"). El dueño y el
-- superusuario quedan fuera (restauraciones de solo datos). clock_timestamp() y no now(): ver la migración de los
-- instantes. SECURITY INVOKER y sin `SET search_path` (como las de los instantes): todo va calificado con pg_catalog.
--
-- Riesgo residual: con la clave de inv_ia se pueden insertar filas falsas (un PUBLICADO con un texto cualquiera y un
-- paquete armado a mano que cuadre consigo mismo, o tokens de más o de menos); lo que no puede es editarlas, borrarlas
-- ni fecharlas. El guardián del esquema (scripts/verificar-esquema.sql) detiene el siguiente despliegue si falta o cambia
-- un CHECK, el índice, un disparador o la función. Candados: tests/unit/ia/registro/esquema.test.ts,
-- tests/integracion/ia/resumen-ia-reglas.test.ts y tests/integracion/guardian-esquema.test.ts.
SET LOCAL lock_timeout = '5s';

-- ───────────── Generado por Prisma (schema.prisma), revisado a mano ─────────────
-- CreateEnum
CREATE TYPE "TipoResumenIa" AS ENUM ('DIARIO', 'REGLAS', 'ESCENARIOS');

-- CreateEnum
CREATE TYPE "EstadoResumenIa" AS ENUM ('PUBLICADO', 'RECHAZADO', 'FALLIDO');

-- CreateEnum
CREATE TYPE "PuertaIa" AS ENUM ('local', 'nube');

-- CreateTable
CREATE TABLE "resumen_ia" (
    "id" TEXT NOT NULL,
    "tipo" "TipoResumenIa" NOT NULL,
    "fechaNegocio" DATE NOT NULL,
    "estado" "EstadoResumenIa" NOT NULL,
    "puerta" "PuertaIa",
    "texto" TEXT,
    "salidaModelo" TEXT,
    "hechos" JSONB NOT NULL,
    "hechosHash" TEXT NOT NULL,
    "hechosVersion" TEXT NOT NULL,
    "modelo" TEXT,
    "modeloDigest" TEXT,
    "opciones" JSONB NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "promptHash" TEXT NOT NULL,
    "validadorVersion" TEXT NOT NULL,
    "motivos" TEXT[],
    "latenciaMs" INTEGER,
    "tokensEntrada" INTEGER,
    "tokensSalida" INTEGER,
    "generadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "resumen_ia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resumen_ia_gasto_idx" ON "resumen_ia"("puerta", "generadoEn");

-- ───────────── Escrito a mano: Prisma no modela CHECK, índices parciales ni disparadores ─────────────
-- El estado manda qué columnas van: texto solo en un PUBLICADO; salida, modelo y digest en todo lo que no es FALLIDO; un
-- FALLIDO no trae tokens (no hubo respuesta que los cuente).
ALTER TABLE "resumen_ia" ADD CONSTRAINT "resumen_ia_estado_chk" CHECK (
  (("estado" = 'PUBLICADO') = ("texto" IS NOT NULL))
  AND (("estado" = 'FALLIDO') = ("salidaModelo" IS NULL))
  AND ("estado" = 'FALLIDO' OR ("modelo" IS NOT NULL AND "modeloDigest" IS NOT NULL))
  AND ("estado" <> 'FALLIDO' OR ("tokensEntrada" IS NULL AND "tokensSalida" IS NULL))
);

-- Los motivos son códigos (mayúsculas y guion bajo, sin dígitos: nunca datos), sin nulos y con tope. Un PUBLICADO no
-- trae; un RECHAZADO trae los del validador y ninguno de fallo; un FALLIDO empieza por uno de MOTIVOS_FALLO. Cada
-- elemento es un código entero: ni vacío ni con coma (las comas del texto unido son exactamente las que separan), así
-- un «LONGITUD,TIEMPO_AGOTADO» no esconde un motivo de fallo dentro de un solo elemento.
ALTER TABLE "resumen_ia" ADD CONSTRAINT "resumen_ia_motivos_chk" CHECK (
  "motivos" IS NOT NULL
  AND array_position("motivos", NULL) IS NULL
  AND cardinality("motivos") <= 32
  AND (cardinality("motivos") = 0 OR array_ndims("motivos") = 1)
  AND char_length(array_to_string("motivos", ',')) <= 2079
  AND array_to_string("motivos", ',') ~ '^([A-Z]+(_[A-Z]+)*(,[A-Z]+(_[A-Z]+)*)*)?$'
  AND NOT ('' = ANY ("motivos"))
  AND char_length(array_to_string("motivos", ',')) - char_length(replace(array_to_string("motivos", ','), ',', '')) = GREATEST(cardinality("motivos") - 1, 0)
  AND (("estado" = 'PUBLICADO') = (cardinality("motivos") = 0))
  AND ("estado" <> 'FALLIDO' OR "motivos"[1] = ANY (ARRAY['MODELO_NO_DISPONIBLE', 'TIEMPO_AGOTADO', 'TOPE_MENSUAL', 'PUERTA_APAGADA', 'ERROR_PROVEEDOR', 'VISTA_NO_CIEGA']))
  AND ("estado" <> 'RECHAZADO' OR NOT ("motivos" && ARRAY['MODELO_NO_DISPONIBLE', 'TIEMPO_AGOTADO', 'TOPE_MENSUAL', 'PUERTA_APAGADA', 'ERROR_PROVEEDOR', 'VISTA_NO_CIEGA']))
);

-- Sin puerta si y solo si VISTA_NO_CIEGA, y entonces es un FALLIDO que empieza por ese motivo.
ALTER TABLE "resumen_ia" ADD CONSTRAINT "resumen_ia_puerta_chk" CHECK (
  (("puerta" IS NULL) = ('VISTA_NO_CIEGA' = ANY ("motivos")))
  AND ("puerta" IS NOT NULL OR ("estado" = 'FALLIDO' AND "motivos"[1] = 'VISTA_NO_CIEGA'))
);

-- Las columnas de la clave son las del paquete guardado: el hash, la versión, el tipo y el día (`hoy`). El día se compara
-- como texto con to_char sobre un timestamp SIN zona (ni el locale ni el TimeZone de la sesión lo cambian), así un `hoy` mal formado no
-- rompe la sentencia con un error de conversión: solo no cuadra. IS NOT DISTINCT FROM y no `=`: una clave que falta (o es
-- null) en el JSON da NULL, y un CHECK que da NULL deja pasar la fila; las columnas son NOT NULL, así que falta = no cuadra.
ALTER TABLE "resumen_ia" ADD CONSTRAINT "resumen_ia_hechos_chk" CHECK (
  jsonb_typeof("hechos") = 'object'
  AND ("hechos" ->> 'hash') IS NOT DISTINCT FROM "hechosHash"
  AND ("hechos" ->> 'version') IS NOT DISTINCT FROM "hechosVersion"
  AND ("hechos" ->> 'tipo') IS NOT DISTINCT FROM ("tipo")::text
  AND ("hechos" ->> 'hoy') IS NOT DISTINCT FROM to_char("fechaNegocio"::timestamp, 'YYYY-MM-DD')
);

-- Las formas de src/ia: el sha256 de PATRON_HASH, las versiones de PATRON_VERSION_PROMPT, el modelo y el digest de
-- PATRON_MODELO (ASCII visible), las opciones como objeto acotado y un día finito.
ALTER TABLE "resumen_ia" ADD CONSTRAINT "resumen_ia_formas_chk" CHECK (
  "hechosHash" ~ '^[0-9a-f]{64}$'
  AND "promptHash" ~ '^[0-9a-f]{64}$'
  AND "hechosVersion" ~ '^hechos-v[1-9][0-9]*$'
  AND "promptVersion" ~ '^[a-z]+(-[a-z]+)*-v[1-9][0-9]*$'
  AND "validadorVersion" ~ '^[a-z]+(-[a-z]+)*-v[1-9][0-9]*$'
  AND ("modelo" IS NULL OR "modelo" ~ '^[!-~]{1,128}$')
  AND ("modeloDigest" IS NULL OR "modeloDigest" ~ '^[!-~]{1,128}$')
  AND jsonb_typeof("opciones") = 'object'
  AND octet_length("opciones"::text) <= 4096
  AND isfinite("fechaNegocio")
);

-- El texto con algo más que espacios y con tope; la salida cruda con el tope de MAX_SALIDA_CRUDA.
ALTER TABLE "resumen_ia" ADD CONSTRAINT "resumen_ia_textos_chk" CHECK (
  ("texto" IS NULL OR (char_length("texto") <= 16384 AND "texto" ~ '[^[:space:]]'))
  AND ("salidaModelo" IS NULL OR char_length("salidaModelo") <= 65536)
);

ALTER TABLE "resumen_ia" ADD CONSTRAINT "resumen_ia_conteos_chk" CHECK (
  ("latenciaMs" IS NULL OR "latenciaMs" >= 0)
  AND ("tokensEntrada" IS NULL OR "tokensEntrada" >= 0)
  AND ("tokensSalida" IS NULL OR "tokensSalida" >= 0)
);

-- A lo sumo un PUBLICADO por clave (yaPublicado; también sirve a ultimoPublicado por su prefijo).
CREATE UNIQUE INDEX "resumen_ia_publicado_key" ON "resumen_ia" ("tipo", "fechaNegocio", "hechosHash", "promptHash", "modeloDigest") WHERE "estado" = 'PUBLICADO';

-- Solo inserción, con la función de siempre.
CREATE TRIGGER "resumen_ia_solo_insercion" BEFORE UPDATE OR DELETE ON "resumen_ia" FOR EACH ROW EXECUTE FUNCTION "inv_solo_insercion"();

-- La hora del registro, para todo rol que no tenga los privilegios del dueño (copia del patrón de los instantes).
CREATE FUNCTION "inv_resumen_ia_instante"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF pg_catalog.pg_has_role((SELECT c.relowner FROM pg_catalog.pg_class c WHERE c.oid OPERATOR(pg_catalog.=) TG_RELID), 'USAGE') THEN
    RETURN NEW;
  END IF;
  NEW."generadoEn" := pg_catalog.clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TRIGGER "resumen_ia_instante" BEFORE INSERT ON "resumen_ia" FOR EACH ROW EXECUTE FUNCTION "inv_resumen_ia_instante"();
