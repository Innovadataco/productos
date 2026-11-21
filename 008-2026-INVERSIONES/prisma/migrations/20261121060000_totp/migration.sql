-- TOTP del dueño con códigos de recuperación. Migración ADITIVA: no borra, no renombra ni altera
-- columnas existentes. Los valores nuevos del enum NO se usan en esta migración: PostgreSQL no deja usar
-- un valor de enum en la misma transacción que lo agrega («unsafe use of new value»).

-- AlterEnum
ALTER TYPE "ResultadoIngreso" ADD VALUE 'TOTP_EXITO';
ALTER TYPE "ResultadoIngreso" ADD VALUE 'TOTP_INCORRECTO';
ALTER TYPE "ResultadoIngreso" ADD VALUE 'TOTP_REPETIDO';
ALTER TYPE "ResultadoIngreso" ADD VALUE 'RECUPERACION_USADA';
ALTER TYPE "ResultadoIngreso" ADD VALUE 'RECUPERACION_INVALIDA';
ALTER TYPE "ResultadoIngreso" ADD VALUE 'TOTP_ENROLADO';
ALTER TYPE "ResultadoIngreso" ADD VALUE 'TOTP_REINICIADO';
ALTER TYPE "ResultadoIngreso" ADD VALUE 'CODIGOS_REGENERADOS';
ALTER TYPE "ResultadoIngreso" ADD VALUE 'BLOQUEO_SEGUNDO_PASO';
ALTER TYPE "ResultadoIngreso" ADD VALUE 'TOTP_PENDIENTE';

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "presesionHash" CHAR(64),
ADD COLUMN     "totpActivadoEn" TIMESTAMPTZ(6),
ADD COLUMN     "totpSecreto" JSONB,
ADD COLUMN     "totpUltimoPaso" INTEGER;

-- CreateTable
CREATE TABLE "codigo_recuperacion" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "codigoHash" CHAR(64) NOT NULL,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usadoEn" TIMESTAMPTZ(6),
    "anuladoEn" TIMESTAMPTZ(6),

    CONSTRAINT "codigo_recuperacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "codigo_recuperacion_codigoHash_key" ON "codigo_recuperacion"("codigoHash");

-- CreateIndex
CREATE INDEX "codigo_recuperacion_usuarioId_idx" ON "codigo_recuperacion"("usuarioId");

-- AddForeignKey
ALTER TABLE "codigo_recuperacion" ADD CONSTRAINT "codigo_recuperacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ───────────── Reglas escritas a mano (TOTP) ─────────────
-- El secreto solo se guarda cifrado: un sobre de src/cifrado/sobre.ts con exactamente sus 5 llaves.
-- (Un JSON `null` no es NULL de SQL: también se rechaza; borrar el secreto es poner NULL.)
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_totp_secreto_chk"
  CHECK ("totpSecreto" IS NULL OR (
    jsonb_typeof("totpSecreto") = 'object'
    AND "totpSecreto" ?& ARRAY['ct', 'iv', 'kid', 'tag', 'v']
    AND ("totpSecreto" - ARRAY['ct', 'iv', 'kid', 'tag', 'v']) = '{}'::jsonb));

-- Activado y último paso van juntos; activado exige secreto (sin activar, el secreto es el pendiente).
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_totp_chk"
  CHECK (
    ("totpActivadoEn" IS NULL AND "totpUltimoPaso" IS NULL)
    OR ("totpActivadoEn" IS NOT NULL AND "totpUltimoPaso" IS NOT NULL AND "totpSecreto" IS NOT NULL)
  );
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_totp_paso_chk" CHECK ("totpUltimoPaso" IS NULL OR "totpUltimoPaso" >= 0);

-- De la pre-sesión solo se guarda el sha256 (hexadecimal) de su jti.
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_presesion_hash_chk" CHECK ("presesionHash" IS NULL OR "presesionHash" ~ '^[0-9a-f]{64}$');

-- De cada código de recuperación, solo su sha256. A lo sumo una marca, y nunca antes de crearse.
ALTER TABLE "codigo_recuperacion" ADD CONSTRAINT "codigo_recuperacion_hash_chk" CHECK ("codigoHash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "codigo_recuperacion" ADD CONSTRAINT "codigo_recuperacion_marca_chk" CHECK ("usadoEn" IS NULL OR "anuladoEn" IS NULL);
ALTER TABLE "codigo_recuperacion" ADD CONSTRAINT "codigo_recuperacion_fechas_chk"
  CHECK (("usadoEn" IS NULL OR "usadoEn" >= "creadoEn") AND ("anuladoEn" IS NULL OR "anuladoEn" >= "creadoEn"));

-- Un código no se borra ni se edita: el único cambio permitido es UNA marca, de NULL a una hora
-- (`usadoEn` al gastarse, o `anuladoEn` al regenerarse o reiniciarse el TOTP). Sin salida de reversión.
CREATE FUNCTION "inv_codigo_un_solo_uso"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD."usadoEn" IS NULL AND OLD."anuladoEn" IS NULL
     AND ((NEW."usadoEn" IS NOT NULL AND NEW."anuladoEn" IS NULL) OR (NEW."usadoEn" IS NULL AND NEW."anuladoEn" IS NOT NULL))
     AND NEW."id" = OLD."id" AND NEW."usuarioId" = OLD."usuarioId" AND NEW."codigoHash" = OLD."codigoHash"
     AND NEW."creadoEn" = OLD."creadoEn" THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'La tabla % es de un solo uso: solo se marca el uso o la anulación, una vez', TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "codigo_recuperacion_un_solo_uso" BEFORE UPDATE OR DELETE ON "codigo_recuperacion" FOR EACH ROW EXECUTE FUNCTION "inv_codigo_un_solo_uso"();

-- Los vigentes de cada usuario (anular al regenerar o reiniciar). Prisma no expresa índices parciales.
CREATE INDEX "codigo_recuperacion_vigentes_idx" ON "codigo_recuperacion" ("usuarioId")
  WHERE "usadoEn" IS NULL AND "anuladoEn" IS NULL;
