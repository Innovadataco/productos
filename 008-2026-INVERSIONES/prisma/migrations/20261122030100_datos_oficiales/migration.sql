-- Datos oficiales (fase C, C1: una sola migración de esquema). Lo que entra:
-- - valor_serie_oficial (nueva): lo que publica la fuente oficial (TRM de la SFC, tasas del Banco de la República, IPC
--   del DANE), sin convertir: una vigencia por fila, versionada (reemplazadoEn) y sin solapes entre vigentes de una
--   misma serie. El catálogo (unidad, escala, rango, adelanto, frescura) vive en el código (P4), no aquí: una serie
--   nueva no necesita migración. Aquí, solo los límites que valen para toda serie.
-- - dividendo_decretado (se reforma): una fila por cuota, tal como la publica la fuente (la fecha ex no se calcula),
--   con su fila cruda (REGISTRO_DECRETOS: el dueño la carga por la vía B, C4a) y su referencia oficial. Un cambio es la
--   versión v+1, que retira a la v; un decreto mal registrado se anula con una versión nueva «anulada» (P10). Solo en
--   pesos (el enum Moneda solo tiene COP) y en dinero (P11). La columna "fuente" pasa a llamarse "referenciaOficial"
--   (RENAME, no DROP: el único lector, src/proyecciones/leer.ts, la omite en su select, así que la reversa
--   --sin-migrar a la imagen anterior sigue leyendo).
-- - dividendo: las columnas viejas (montoBruto, retencion, tasaRetencion, decretadoId) quedan obsoletas y nulas. NO se
--   borran (la reversa --sin-migrar vuelve a una imagen cuyo Prisma las lee): el DROP va en una migración posterior de
--   «contrato». El cruce del decreto con lo recibido se calcula al leer (dividendo es de solo inserción).
-- - inv_solo_retiro: solo inserción y retiro para TODOS los roles. No sirve inv_retiro_vigente (precios-integridad):
--   exime al dueño de la tabla, y la vía B carga como dueño (inv_dueno), así que aquí no protegería nada (P5).
-- La información relevante (P2) queda fuera.
--
-- Falla cerrada: la guardia corre antes de cualquier cambio. Si dividendo_decretado tiene filas (las columnas nuevas
-- son NOT NULL y su forma cambia) o si una columna vieja de dividendo trae valor, aborta sin tocar nada y el migrador
-- queda P3009 (produccion.md §10). La Fábrica verificó en producción, el 2026-11-21, 0 decretos y 0 decretadoId no
-- nulos; los no nulos de montoBruto, retencion y tasaRetencion se cuentan (solo lectura) antes de desplegar.
-- Los LOCK van en el orden en que una carga toma esas tablas (primero fila_fuente, después el hecho:
-- src/importacion/trii/guardar.ts), con lock_timeout: una carga en curso no la cuelga ni la cruza en un deadlock.
SET LOCAL lock_timeout = '5s';
LOCK TABLE "fila_fuente" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "dividendo", "dividendo_decretado" IN ACCESS EXCLUSIVE MODE;

-- La guardia (sin public.: tests/integracion/reglas-datos-oficiales.test.ts la corre tal cual sobre tablas TEMP que
-- tapan a las reales). Los mensajes llevan solo conteos, nunca valores.
-- guardia:inicio
DO $$
DECLARE
  n_decretos bigint;
  n_bruto bigint;
  n_retencion bigint;
  n_tasa bigint;
  n_enlazados bigint;
BEGIN
  SELECT count(*) INTO n_decretos FROM "dividendo_decretado";
  IF n_decretos > 0 THEN
    RAISE EXCEPTION 'datos oficiales: dividendo_decretado debe estar vacía para reformarla y tiene % fila(s); no se cambió nada', n_decretos
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;
  SELECT count(*) FILTER (WHERE "montoBruto" IS NOT NULL), count(*) FILTER (WHERE "retencion" IS NOT NULL),
         count(*) FILTER (WHERE "tasaRetencion" IS NOT NULL), count(*) FILTER (WHERE "decretadoId" IS NOT NULL)
    INTO n_bruto, n_retencion, n_tasa, n_enlazados
    FROM "dividendo";
  IF n_bruto + n_retencion + n_tasa + n_enlazados > 0 THEN
    RAISE EXCEPTION 'datos oficiales: las columnas viejas de dividendo deben estar nulas (montoBruto %, retencion %, tasaRetencion %, decretadoId %); no se cambió nada',
      n_bruto, n_retencion, n_tasa, n_enlazados
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;
END
$$;
-- guardia:fin

-- ───────────── Generado por Prisma (schema.prisma), revisado a mano ─────────────
-- Prisma proponía DROP COLUMN "fuente" + ADD COLUMN "referenciaOficial": se cambió por el RENAME.
ALTER TABLE "dividendo_decretado" RENAME COLUMN "fuente" TO "referenciaOficial";

-- AlterTable
ALTER TABLE "dividendo_decretado" ADD COLUMN     "anulada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cuota" SMALLINT NOT NULL,
ADD COLUMN     "fechaAnuncio" DATE NOT NULL,
ADD COLUMN     "fechaEx" DATE NOT NULL,
ADD COLUMN     "filaFuenteId" TEXT NOT NULL,
ADD COLUMN     "moneda" "Moneda" NOT NULL DEFAULT 'COP',
ADD COLUMN     "reemplazadoEn" TIMESTAMPTZ(6),
ADD COLUMN     "registradoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "valor_serie_oficial" (
    "id" TEXT NOT NULL,
    "serie" TEXT NOT NULL,
    "desde" DATE NOT NULL,
    "hasta" DATE NOT NULL,
    "valor" DECIMAL(20,8) NOT NULL,
    "fuente" TEXT NOT NULL,
    "traidoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reemplazadoEn" TIMESTAMPTZ(6),

    CONSTRAINT "valor_serie_oficial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dividendo_decretado_filaFuenteId_key" ON "dividendo_decretado"("filaFuenteId");

-- CreateIndex
CREATE INDEX "dividendo_decretado_instrumentoId_fechaEx_idx" ON "dividendo_decretado"("instrumentoId", "fechaEx");

-- CreateIndex
CREATE UNIQUE INDEX "dividendo_decretado_version_key" ON "dividendo_decretado"("instrumentoId", "fechaAnuncio", "tipo", "cuota", "version");

-- AddForeignKey
ALTER TABLE "dividendo_decretado" ADD CONSTRAINT "dividendo_decretado_filaFuenteId_fkey" FOREIGN KEY ("filaFuenteId") REFERENCES "fila_fuente"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ───────────── Escrito a mano · valor_serie_oficial ─────────────
-- La serie, como la nombra el catálogo del código; la vigencia, de 1 día (TPM) a un mes (IPC); el valor, positivo y sin
-- NaN (NaN > 0 es verdadero en PostgreSQL; el infinito no cabe en DECIMAL(20,8)); la fuente, con su dataset.
ALTER TABLE "valor_serie_oficial" ADD CONSTRAINT "valor_serie_oficial_serie_chk" CHECK ("serie" ~ '^[A-Z][A-Z0-9_]{1,39}$');
ALTER TABLE "valor_serie_oficial" ADD CONSTRAINT "valor_serie_oficial_vigencia_chk" CHECK ("hasta" >= "desde" AND "hasta" <= "desde" + 31);
ALTER TABLE "valor_serie_oficial" ADD CONSTRAINT "valor_serie_oficial_valor_chk" CHECK ("valor" > 0 AND "valor" <> 'NaN');
ALTER TABLE "valor_serie_oficial" ADD CONSTRAINT "valor_serie_oficial_fuente_chk" CHECK ("fuente" ~ '^(sfc|banrep|dane):[A-Za-z0-9_.-]{1,80}$');

-- Una sola vigencia vigente por serie y día de inicio (la carrera del mismo día da P2002) y ninguna que se solape con
-- otra vigente de la misma serie (vigencia cerrada en los dos extremos). Las retiradas quedan como historia. El orden
-- en que la base revisa las dos cambia al restaurar un respaldo: el camino de escritura (C2a) maneja las dos.
CREATE UNIQUE INDEX "valor_serie_oficial_vigente_key" ON "valor_serie_oficial" ("serie", "desde") WHERE "reemplazadoEn" IS NULL;
ALTER TABLE "valor_serie_oficial" ADD CONSTRAINT "valor_serie_oficial_sin_solape_excl"
  EXCLUDE USING gist ("serie" WITH =, daterange("desde", "hasta", '[]') WITH &&) WHERE ("reemplazadoEn" IS NULL);

-- ───────────── Escrito a mano · dividendo_decretado (vacía: los CHECK nacen validados) ─────────────
ALTER TABLE "dividendo_decretado" ADD CONSTRAINT "dividendo_decretado_tipo_chk" CHECK ("tipo" <> 'FRACCION_ESCISION');
ALTER TABLE "dividendo_decretado" ADD CONSTRAINT "dividendo_decretado_fechas_chk" CHECK ("fechaAnuncio" <= "fechaEx" AND "fechaEx" <= "fechaPago");
ALTER TABLE "dividendo_decretado" ADD CONSTRAINT "dividendo_decretado_cuota_chk" CHECK ("cuota" BETWEEN 1 AND 12);
ALTER TABLE "dividendo_decretado" ADD CONSTRAINT "dividendo_decretado_version_chk" CHECK ("version" >= 1);
ALTER TABLE "dividendo_decretado" ADD CONSTRAINT "dividendo_decretado_nota_chk"
  CHECK ("nota" IS NULL OR ("nota" ~ '[^[:space:]]' AND char_length("nota") <= 500));
-- Anular es una versión nueva (nunca la primera) y dice por qué.
ALTER TABLE "dividendo_decretado" ADD CONSTRAINT "dividendo_decretado_anulada_chk"
  CHECK (NOT "anulada" OR ("version" >= 2 AND "nota" IS NOT NULL AND "nota" ~ '[^[:space:]]'));
-- La referencia oficial: una página de la SFC o de la BVC (https, el host exacto seguido de «/» y una ruta de
-- caracteres seguros: sin espacios, comillas, «<», «>» ni barra invertida) o el radicado de la SFC. El formato exacto
-- del radicado y los hosts de las páginas oficiales están por verificar (si hace falta otro, otra migración amplía).
ALTER TABLE "dividendo_decretado" ADD CONSTRAINT "dividendo_decretado_referencia_chk"
  CHECK (char_length("referenciaOficial") <= 500 AND (
    "referenciaOficial" ~ '^https://www\.superfinanciera\.gov\.co/[A-Za-z0-9._~/?=&%#:+-]+$'
    OR "referenciaOficial" ~ '^https://www\.bvc\.com\.co/[A-Za-z0-9._~/?=&%#:+-]+$'
    OR "referenciaOficial" ~ '^sfc:[A-Za-z0-9._-]{1,60}$'));
-- El valor por acción, también sin NaN (el CHECK de la migración inicial lo dejaba pasar).
ALTER TABLE "dividendo_decretado" DROP CONSTRAINT "dividendo_decretado_valor_chk";
ALTER TABLE "dividendo_decretado" ADD CONSTRAINT "dividendo_decretado_valor_chk" CHECK ("valorPorAccion" > 0 AND "valorPorAccion" <> 'NaN');

-- Una sola versión vigente por especie, asamblea (fecha de anuncio), tipo y cuota: una misma asamblea puede decretar un
-- ordinario y un extraordinario, cada uno con su cuota 1. La clave de versión (Prisma, arriba) no deja repetir una.
CREATE UNIQUE INDEX "dividendo_decretado_vigente_key" ON "dividendo_decretado" ("instrumentoId", "fechaAnuncio", "tipo", "cuota") WHERE "reemplazadoEn" IS NULL;

-- ───────────── Escrito a mano · dividendo ─────────────
-- Las columnas viejas, nulas. NOT VALID + VALIDATE en la misma migración (la guardia ya contó 0). El nombre ordena
-- después de dividendo_bruto_chk, dividendo_retencion_chk y dividendo_tasa_retencion_chk (PostgreSQL evalúa los CHECK
-- por nombre): lo que incumple esos sigue dando su propio error.
ALTER TABLE "dividendo" ADD CONSTRAINT "dividendo_viejas_nulas_chk"
  CHECK ("montoBruto" IS NULL AND "retencion" IS NULL AND "tasaRetencion" IS NULL AND "decretadoId" IS NULL) NOT VALID;
ALTER TABLE "dividendo" VALIDATE CONSTRAINT "dividendo_viejas_nulas_chk";

-- ───────────── Escrito a mano · solo inserción y retiro ─────────────
-- Para TODOS los roles, también el dueño y el superusuario: lo que se inserta nace vigente, nada se borra, y lo único
-- que cambia es el retiro, una vez, de nulo a la hora de la base (la del cliente se ignora: el retirado y su sucesor,
-- en la misma transacción, quedan con el mismo instante), sin tocar ninguna otra columna (se compara la fila entera: una
-- columna futura también queda protegida). Lo retirado no se reabre ni se vuelve a fechar.
-- Sin salida por inv.reversion: con P10 la anulación es una inserción, ningún camino la necesita, y es un ajuste que
-- cualquier sesión fija con SET LOCAL (sería un hueco el día que otro rol escriba estas tablas). SECURITY INVOKER y sin
-- SET, como inv_solo_insercion: no lee tablas, y hoy solo escriben el dueño y el superusuario (inv_app solo lee,
-- docker/migrador/privilegios.sql). El dueño puede deshabilitar el disparador: el guardián lo frena en el siguiente
-- despliegue. Quien dé escritura en estas tablas a otro rol (C7: la TRM por inv_precios) revisa el SET.
CREATE FUNCTION "inv_solo_retiro"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."reemplazadoEn" IS NOT NULL THEN
      RAISE EXCEPTION '%: lo que se inserta nace vigente', TG_TABLE_NAME USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
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

CREATE TRIGGER "valor_serie_oficial_retiro" BEFORE INSERT OR UPDATE OR DELETE ON "valor_serie_oficial" FOR EACH ROW EXECUTE FUNCTION "inv_solo_retiro"();
CREATE TRIGGER "dividendo_decretado_retiro" BEFORE INSERT OR UPDATE OR DELETE ON "dividendo_decretado" FOR EACH ROW EXECUTE FUNCTION "inv_solo_retiro"();
