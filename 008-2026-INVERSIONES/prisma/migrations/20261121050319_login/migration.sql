-- CreateEnum
CREATE TYPE "ResultadoIngreso" AS ENUM ('EXITO', 'CLAVE_INCORRECTA', 'USUARIO_INEXISTENTE', 'SIN_CLAVE', 'CUENTA_BLOQUEADA', 'CUENTA_INACTIVA', 'ROL_NO_PERMITIDO', 'CLAVE_DEFINIDA', 'TOKEN_INVALIDO');

-- CreateEnum
CREATE TYPE "PropositoToken" AS ENUM ('INICIAL', 'RECUPERACION');

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "bloqueadoHasta" TIMESTAMPTZ(6),
ADD COLUMN     "claveHash" TEXT,
ADD COLUMN     "sesionVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "intento_ingreso" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "ip" INET,
    "resultado" "ResultadoIngreso" NOT NULL,
    "ocurridoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intento_ingreso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_acceso" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "proposito" "PropositoToken" NOT NULL,
    "venceEn" TIMESTAMPTZ(6) NOT NULL,
    "usadoEn" TIMESTAMPTZ(6),
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_acceso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "intento_ingreso_usuarioId_ocurridoEn_idx" ON "intento_ingreso"("usuarioId", "ocurridoEn");

-- CreateIndex
CREATE UNIQUE INDEX "token_acceso_tokenHash_key" ON "token_acceso"("tokenHash");

-- CreateIndex
CREATE INDEX "token_acceso_usuarioId_creadoEn_idx" ON "token_acceso"("usuarioId", "creadoEn");

-- AddForeignKey
ALTER TABLE "intento_ingreso" ADD CONSTRAINT "intento_ingreso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "token_acceso" ADD CONSTRAINT "token_acceso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ───────────── Reglas escritas a mano (login, D-014) ─────────────
-- La versión de sesión nunca baja de 1 (el JWT la compara con la base).
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_sesion_version_chk" CHECK ("sesionVersion" >= 1);

-- Solo hashes bcrypt de costo 12: un texto plano o un costo menor no entran ni por error.
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_clave_hash_chk"
  CHECK ("claveHash" IS NULL OR "claveHash" ~ '^\$2[aby]\$12\$[./A-Za-z0-9]{53}$');

-- Un intento sin usuario es solo el de un correo que no existe o el de un enlace inválido
-- (el correo tecleado y el token no se guardan). Un correo inexistente nunca tiene usuario.
ALTER TABLE "intento_ingreso" ADD CONSTRAINT "intento_ingreso_usuario_chk"
  CHECK (
    ("resultado" = 'USUARIO_INEXISTENTE' AND "usuarioId" IS NULL)
    OR "resultado" = 'TOKEN_INVALIDO'
    OR ("resultado" NOT IN ('USUARIO_INEXISTENTE', 'TOKEN_INVALIDO') AND "usuarioId" IS NOT NULL)
  );

-- El registro de intentos es de solo inserción (la misma función de la migración inicial).
CREATE TRIGGER "intento_ingreso_solo_insercion" BEFORE UPDATE OR DELETE ON "intento_ingreso" FOR EACH ROW EXECUTE FUNCTION "inv_solo_insercion"();

-- Enlace de un solo uso: solo el sha256 (hexadecimal) y una vida de 30 minutos como máximo.
ALTER TABLE "token_acceso" ADD CONSTRAINT "token_acceso_hash_chk" CHECK ("tokenHash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "token_acceso" ADD CONSTRAINT "token_acceso_vence_chk"
  CHECK ("venceEn" > "creadoEn" AND "venceEn" <= "creadoEn" + interval '30 minutes');

-- El enlace no se borra ni se edita: el único cambio permitido es marcar su uso, una sola vez.
-- (Por eso no es de solo inserción pura: usarlo exige un UPDATE de `usadoEn`, de NULL a una hora.)
CREATE FUNCTION "inv_token_un_solo_uso"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD."usadoEn" IS NULL AND NEW."usadoEn" IS NOT NULL
     AND NEW."id" = OLD."id" AND NEW."usuarioId" = OLD."usuarioId" AND NEW."tokenHash" = OLD."tokenHash"
     AND NEW."proposito" = OLD."proposito" AND NEW."venceEn" = OLD."venceEn" AND NEW."creadoEn" = OLD."creadoEn" THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'La tabla % es de un solo uso: solo se marca el uso, una vez', TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "token_acceso_un_solo_uso" BEFORE UPDATE OR DELETE ON "token_acceso" FOR EACH ROW EXECUTE FUNCTION "inv_token_un_solo_uso"();

-- Índices parciales de los conteos del login (database-reviewer): los fallos por IP en la ventana y el
-- último éxito (o clave definida) de cada cuenta. Prisma no expresa índices parciales.
CREATE INDEX "intento_ingreso_fallos_ip_idx" ON "intento_ingreso" ("ip", "ocurridoEn")
  WHERE "resultado" NOT IN ('EXITO', 'CLAVE_DEFINIDA');
CREATE INDEX "intento_ingreso_ultimo_exito_idx" ON "intento_ingreso" ("usuarioId", "ocurridoEn" DESC)
  WHERE "resultado" IN ('EXITO', 'CLAVE_DEFINIDA');
