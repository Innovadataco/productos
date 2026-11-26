-- Alertas (motor src/alertas, pantalla /alertas): tres tablas de SOLO INSERCIÓN. ADITIVA: tablas, índices, llaves, CHECK, tres
-- funciones y seis disparadores; no toca ninguna tabla que ya exista.
--
--  umbral_version  los umbrales de cada alerta que edita el dueño en /edicion/alertas (inv_app: INSERT por columna sin "creadaEn").
--                  Versión única (>= 1) con su autor (un disparador exige que sea el dueño), su motivo y la hora de la BASE (copia de inv_config_ia_instante). La vigente
--                  es la de mayor versión; sin ninguna rigen las omisiones de src/alertas/umbrales.ts. Las CHECK repiten
--                  RANGOS_UMBRALES (una sola fuente por lista, con su prueba espejo: tests/unit/alertas/umbrales-esquema.test.ts).
--  alerta          lo que detecta el motor (inv_alertas: INSERT por columna sin "detectadaEn"; la lee inv_app). Sin texto libre y
--                  sin montos del portafolio: solo la evidencia (precio, referencia, variación, umbral, hora y fuente del dato);
--                  el texto lo reescribe textoDeAlerta al mostrarla. "tipo", "sentido" y "base" son TEXT con CHECK (listas
--                  cerradas del código) y alerta_coherencia_chk fija qué ids lleva cada tipo. Para FECHA_EX el decreto va en
--                  "decretoId" (en el motor viaja como reglaId).
--  alerta_vista    el dueño marcó la alerta como vista (inv_app: INSERT por columna sin "vistaEn"). Una por alerta.
--
-- Deduplicación: un índice único de EXPRESIÓN por (día, tipo, especie, regla, sentido), parcial sin FECHA_EX (COALESCE: un NULL
-- no escapa de la clave; la base del precio no entra, así un cruce en el intradía y en el cierre del mismo día cuenta una
-- vez), y uno único por decreto para FECHA_EX (una por decreto). Prisma no modela índices de expresión: se guarda con
-- createMany + skipDuplicates (ON CONFLICT DO NOTHING, sin objetivo, que cubre cualquier índice único).
--
-- Solo inserción: inv_solo_insercion (la función de siempre) rechaza todo UPDATE y DELETE. La inserción de "alerta"
-- (inv_alerta_insercion), para todo rol que NO tenga los privilegios del dueño de la tabla: la hora de detección la pone la
-- base; el día no puede ser futuro ni de hace más de un día (día de Colombia, UTC-5 fijo: no hay horario de verano) ni el dato ni su hora de
-- traída de más de 1 minuto adelante de la hora de la base. Es SECURITY INVOKER a propósito (en una SECURITY DEFINER, current_user sería el dueño y la regla
-- no se aplicaría a nadie) y con search_path fijo, con pg_temp al final. El dueño (inv_dueno) y el superusuario quedan
-- fuera: pueden desactivar un disparador, así que no son la frontera; el guardián del esquema
-- (scripts/verificar-esquema.sql) detiene el siguiente despliegue si algo de esto falta o cambia.
-- La inserción de "alerta_vista" (inv_alerta_vista_insercion): el usuario debe ser el dueño de la cuenta (rol DUENO); la familia
-- no marca nada. La hora la pone la base para todo rol que no sea el dueño de la tabla.
--
-- Riesgo residual (lo mismo dice privilegios.sql): con la clave de inv_alertas se pueden insertar alertas falsas de hoy o de días
-- pasados (la base no puede recalcular el motor); no se pueden fechar, editar ni borrar. Con la de inv_app, versiones de
-- umbrales falsas (con un autor que exista) y marcas de vista del dueño; nunca alertas.
SET LOCAL lock_timeout = '5s';

-- ───────────── Generado por Prisma (schema.prisma), revisado a mano ─────────────
-- CreateTable
CREATE TABLE "umbral_version" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "alertaCercaPct" DECIMAL(5,2) NOT NULL,
    "alertaCercaActiva" BOOLEAN NOT NULL,
    "alertaNivelCruzadoActiva" BOOLEAN NOT NULL,
    "alertaMovimientoPct" DECIMAL(5,2) NOT NULL,
    "alertaMovimientoActiva" BOOLEAN NOT NULL,
    "alertaCaidaPct" DECIMAL(5,2) NOT NULL,
    "alertaCaidaActiva" BOOLEAN NOT NULL,
    "alertaDatoViejoMin" INTEGER NOT NULL,
    "alertaDatoViejoActiva" BOOLEAN NOT NULL,
    "alertaExDiasHabiles" INTEGER NOT NULL,
    "alertaExActiva" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "creadaEn" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT "umbral_version_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "alerta" (
    "id" TEXT NOT NULL,
    "dia" DATE NOT NULL,
    "tipo" TEXT NOT NULL,
    "instrumentoId" TEXT,
    "reglaId" TEXT,
    "decretoId" TEXT,
    "sentido" TEXT,
    "base" TEXT,
    "precio" DECIMAL(20,6),
    "referencia" DECIMAL(20,6),
    "variacionPct" DECIMAL(9,2),
    "umbral" DECIMAL(9,2),
    "instanteDato" TIMESTAMPTZ(6),
    "traidoEn" TIMESTAMPTZ(6),
    "fuente" TEXT,
    "conRetraso" BOOLEAN,
    "minutosDeEdad" INTEGER,
    "esFechaEx" BOOLEAN,
    "umbralVersionId" TEXT,
    "motorVersion" TEXT NOT NULL,
    "detectadaEn" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT "alerta_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "alerta_vista" (
    "id" TEXT NOT NULL,
    "alertaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "vistaEn" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT "alerta_vista_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "umbral_version_version_key" ON "umbral_version"("version");
-- CreateIndex
CREATE INDEX "umbral_version_autorId_idx" ON "umbral_version"("autorId");
-- CreateIndex
CREATE INDEX "alerta_dia_idx" ON "alerta"("dia");
-- CreateIndex
CREATE INDEX "alerta_instrumentoId_idx" ON "alerta"("instrumentoId");
-- CreateIndex
CREATE INDEX "alerta_reglaId_idx" ON "alerta"("reglaId");
-- CreateIndex
CREATE INDEX "alerta_decretoId_idx" ON "alerta"("decretoId");
-- CreateIndex
CREATE INDEX "alerta_umbralVersionId_idx" ON "alerta"("umbralVersionId");
-- CreateIndex
CREATE UNIQUE INDEX "alerta_vista_alertaId_key" ON "alerta_vista"("alertaId");
-- CreateIndex
CREATE INDEX "alerta_vista_usuarioId_idx" ON "alerta_vista"("usuarioId");
-- AddForeignKey
ALTER TABLE "umbral_version" ADD CONSTRAINT "umbral_version_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
-- AddForeignKey
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "instrumento"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
-- AddForeignKey
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_reglaId_fkey" FOREIGN KEY ("reglaId") REFERENCES "regla_plan"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
-- AddForeignKey
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_decretoId_fkey" FOREIGN KEY ("decretoId") REFERENCES "dividendo_decretado"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
-- AddForeignKey
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_umbralVersionId_fkey" FOREIGN KEY ("umbralVersionId") REFERENCES "umbral_version"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
-- AddForeignKey
ALTER TABLE "alerta_vista" ADD CONSTRAINT "alerta_vista_alertaId_fkey" FOREIGN KEY ("alertaId") REFERENCES "alerta"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
-- AddForeignKey
ALTER TABLE "alerta_vista" ADD CONSTRAINT "alerta_vista_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ───────────── Escrito a mano: Prisma no modela CHECK, índices de expresión ni disparadores ─────────────
ALTER TABLE "umbral_version" ADD CONSTRAINT "umbral_version_version_chk" CHECK ("version" >= 1);
ALTER TABLE "umbral_version" ADD CONSTRAINT "umbral_version_cerca_chk" CHECK ("alertaCercaPct" >= 0.5 AND "alertaCercaPct" <= 10);
ALTER TABLE "umbral_version" ADD CONSTRAINT "umbral_version_movimiento_chk" CHECK ("alertaMovimientoPct" >= 0.5 AND "alertaMovimientoPct" <= 20);
ALTER TABLE "umbral_version" ADD CONSTRAINT "umbral_version_caida_chk" CHECK ("alertaCaidaPct" >= 0.5 AND "alertaCaidaPct" <= 20);
ALTER TABLE "umbral_version" ADD CONSTRAINT "umbral_version_dato_viejo_chk" CHECK ("alertaDatoViejoMin" >= 10 AND "alertaDatoViejoMin" <= 240);
ALTER TABLE "umbral_version" ADD CONSTRAINT "umbral_version_ex_dias_chk" CHECK ("alertaExDiasHabiles" >= 1 AND "alertaExDiasHabiles" <= 10);
ALTER TABLE "umbral_version" ADD CONSTRAINT "umbral_version_motivo_chk" CHECK ("motivo" ~ '[^[:space:]]' AND char_length("motivo") <= 2000);

ALTER TABLE "alerta" ADD CONSTRAINT "alerta_tipo_chk" CHECK ("tipo" IN ('NIVEL_CRUZADO', 'NIVEL_CERCA', 'MOVIMIENTO_DIA', 'CAIDA_PORTAFOLIO', 'DATO_VIEJO', 'FECHA_EX'));
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_sentido_chk" CHECK ("sentido" IS NULL OR "sentido" IN ('BAJO', 'SOBRE', 'RUEDA', 'CIERRE_FALTANTE'));
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_base_chk" CHECK ("base" IS NULL OR "base" IN ('INTRADIA', 'CIERRE'));
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_motor_chk" CHECK ("motorVersion" ~ '^alertas-v[1-9][0-9]{0,2}$');
-- El tope del precio es el de precio_cierre y precio_intradia: por encima, el dato se considera corrupto.
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_precio_chk" CHECK ("precio" IS NULL OR ("precio" > 0 AND "precio" <= 10000000));
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_fuente_chk" CHECK ("fuente" IS NULL OR "fuente" ~ '^[a-z][a-z0-9:_.-]{0,39}$');
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_minutos_chk" CHECK ("minutosDeEdad" IS NULL OR "minutosDeEdad" >= 0);
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_referencia_chk" CHECK ("referencia" IS NULL OR "referencia" > 0);
-- Solo la fecha ex y el movimiento del día dicen si el día era fecha ex.
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_esfechaex_chk" CHECK ("esFechaEx" IS NULL OR "tipo" IN ('FECHA_EX', 'MOVIMIENTO_DIA'));
-- Un dato no puede ser posterior a la hora en que se trajo.
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_instante_chk" CHECK ("instanteDato" IS NULL OR "traidoEn" IS NULL OR "instanteDato" <= "traidoEn");
-- Qué ids lleva cada tipo (y qué sentido y base): los de nivel, la regla y la especie; el movimiento, la especie; la caída, nada
-- y siempre BAJO; el dato viejo, la especie y su sentido RUEDA (con la barra intradía) o CIERRE_FALTANTE (con el cierre), para que no compartan clave; la fecha ex, la especie y el decreto (sin sentido ni base).
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_coherencia_chk" CHECK (
  ("tipo" IN ('NIVEL_CRUZADO', 'NIVEL_CERCA') AND "instrumentoId" IS NOT NULL AND "reglaId" IS NOT NULL AND "decretoId" IS NULL AND "sentido" IS NOT NULL AND "sentido" IN ('BAJO', 'SOBRE') AND "base" IS NOT NULL)
  OR ("tipo" = 'MOVIMIENTO_DIA' AND "instrumentoId" IS NOT NULL AND "reglaId" IS NULL AND "decretoId" IS NULL AND "sentido" IS NOT NULL AND "sentido" IN ('BAJO', 'SOBRE') AND "base" IS NOT NULL)
  OR ("tipo" = 'CAIDA_PORTAFOLIO' AND "instrumentoId" IS NULL AND "reglaId" IS NULL AND "decretoId" IS NULL AND "sentido" = 'BAJO' AND "base" IS NOT NULL)
  OR ("tipo" = 'DATO_VIEJO' AND "instrumentoId" IS NOT NULL AND "reglaId" IS NULL AND "decretoId" IS NULL AND "sentido" IS NOT NULL AND "base" IS NOT NULL AND (("sentido" = 'RUEDA' AND "base" = 'INTRADIA') OR ("sentido" = 'CIERRE_FALTANTE' AND "base" = 'CIERRE')))
  OR ("tipo" = 'FECHA_EX' AND "instrumentoId" IS NOT NULL AND "reglaId" IS NULL AND "decretoId" IS NOT NULL AND "sentido" IS NULL AND "base" IS NULL)
);

-- Deduplicación (ver la cabecera).
CREATE UNIQUE INDEX "alerta_clave_key" ON "alerta"("dia", "tipo", COALESCE("instrumentoId", '-'), COALESCE("reglaId", '-'), COALESCE("sentido", '-')) WHERE "tipo" <> 'FECHA_EX';
CREATE UNIQUE INDEX "alerta_decreto_key" ON "alerta"("decretoId") WHERE "tipo" = 'FECHA_EX';

-- Solo inserción, con la función de siempre.
CREATE TRIGGER "umbral_version_solo_insercion" BEFORE UPDATE OR DELETE ON "umbral_version" FOR EACH ROW EXECUTE FUNCTION "inv_solo_insercion"();
CREATE TRIGGER "alerta_solo_insercion" BEFORE UPDATE OR DELETE ON "alerta" FOR EACH ROW EXECUTE FUNCTION "inv_solo_insercion"();
CREATE TRIGGER "alerta_vista_solo_insercion" BEFORE UPDATE OR DELETE ON "alerta_vista" FOR EACH ROW EXECUTE FUNCTION "inv_solo_insercion"();

-- La hora de la versión de umbrales, para todo rol que no tenga los privilegios del dueño (copia exacta de inv_config_ia_instante).
CREATE FUNCTION "inv_umbral_version_instante"() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF pg_catalog.pg_has_role((SELECT c.relowner FROM pg_catalog.pg_class c WHERE c.oid OPERATOR(pg_catalog.=) TG_RELID), 'USAGE') THEN
    RETURN NEW;
  END IF;
  NEW."creadaEn" := pg_catalog.clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TRIGGER "umbral_version_instante" BEFORE INSERT ON "umbral_version" FOR EACH ROW EXECUTE FUNCTION "inv_umbral_version_instante"();

-- El autor de una versión de umbrales es el dueño de la cuenta (rol DUENO): la familia no firma cambios (SECURITY INVOKER: inv_app lee usuario).
CREATE FUNCTION "inv_umbral_version_autor"() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public."usuario" u WHERE u."id" = NEW."autorId" AND u."rol" = 'DUENO') THEN
    RAISE EXCEPTION 'umbral_version: solo el dueño firma una versión de umbrales' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "umbral_version_autor" BEFORE INSERT ON "umbral_version" FOR EACH ROW EXECUTE FUNCTION "inv_umbral_version_autor"();

-- Una alerta del motor: la hora de detección la pone la base, y ni el día ni el dato son del futuro.
CREATE FUNCTION "inv_alerta_insercion"() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF pg_has_role((SELECT c.relowner FROM pg_catalog.pg_class c WHERE c.oid = TG_RELID), 'USAGE') THEN
    RETURN NEW;
  END IF;
  NEW."detectadaEn" := clock_timestamp();
  IF NEW."dia" > ((now() AT TIME ZONE 'UTC') - interval '5 hours')::date THEN
    RAISE EXCEPTION 'alerta: el día no puede ser futuro' USING ERRCODE = 'check_violation';
  END IF;
  -- El servicio evalúa el día de hoy: ni siquiera pasada la medianoche se guardan alertas de más de un día atrás.
  IF NEW."dia" < ((now() AT TIME ZONE 'UTC') - interval '5 hours')::date - 1 THEN
    RAISE EXCEPTION 'alerta: el día es de hace más de un día' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW."instanteDato" > now() + interval '1 minute' OR NEW."traidoEn" > now() + interval '1 minute' THEN
    RAISE EXCEPTION 'alerta: el dato no puede ser del futuro' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "alerta_insercion" BEFORE INSERT ON "alerta" FOR EACH ROW EXECUTE FUNCTION "inv_alerta_insercion"();

-- Una marca de vista: solo del dueño de la cuenta (rol DUENO) y con la hora de la base (para todo rol que no sea el dueño de la tabla).
CREATE FUNCTION "inv_alerta_vista_insercion"() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public."usuario" u WHERE u."id" = NEW."usuarioId" AND u."rol" = 'DUENO') THEN
    RAISE EXCEPTION 'alerta_vista: solo el dueño marca las alertas como vistas' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT pg_has_role((SELECT c.relowner FROM pg_catalog.pg_class c WHERE c.oid = TG_RELID), 'USAGE') THEN
    NEW."vistaEn" := clock_timestamp();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "alerta_vista_insercion" BEFORE INSERT ON "alerta_vista" FOR EACH ROW EXECUTE FUNCTION "inv_alerta_vista_insercion"();
