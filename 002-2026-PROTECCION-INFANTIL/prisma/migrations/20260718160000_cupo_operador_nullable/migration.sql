-- Hacer cupoMaximo nullable para permitir override explícito sobre el default configurable.
ALTER TABLE "PerfilOperador" ALTER COLUMN "cupoMaximo" DROP NOT NULL;
ALTER TABLE "PerfilOperador" ALTER COLUMN "cupoMaximo" DROP DEFAULT;
