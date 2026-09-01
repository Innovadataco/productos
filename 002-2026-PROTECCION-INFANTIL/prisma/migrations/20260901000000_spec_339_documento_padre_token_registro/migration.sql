-- SPEC-339 (A-67 · Fase 1) · fundaciones del camino guiado del padre.
-- ADITIVA: solo agrega columnas nullable, una tabla nueva e índices.
-- No toca ninguno de los cinco índices críticos del motor de IA
-- (Ciudad trgm, EmbeddingDataset hnsw, EmbeddingReporte hnsw,
--  AlertaColegio patrón, patrones_institucionales unique).

-- 1. Documento del padre. Nullable: hay cuentas vivas sin él; la obligatoriedad
--    la impone el Paso 2 del camino, no el esquema. NO se declara único: dos
--    padres pueden digitar mal el mismo número y bloquear un registro por eso
--    dejaría a un padre afuera sin salida propia.
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "documentoTipo" TEXT;
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "documentoNumero" TEXT;

CREATE INDEX IF NOT EXISTS "Usuario_documentoTipo_documentoNumero_idx"
    ON "Usuario"("documentoTipo", "documentoNumero");

-- 2. Enlace de registro del padre (un solo uso, 24 h). Se guarda SOLO el hash:
--    el token en claro viaja en el correo y nunca se persiste.
--    Sin relación con "Usuario": al pedir el enlace la cuenta aún no existe.
CREATE TABLE IF NOT EXISTS "TokenRegistro" (
    "id"            TEXT NOT NULL,
    "email"         TEXT NOT NULL,
    "tokenHash"     TEXT NOT NULL,
    "expiraEn"      TIMESTAMP(3) NOT NULL,
    "usado"         BOOLEAN NOT NULL DEFAULT false,
    "creadoEn"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TokenRegistro_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TokenRegistro_email_idx"     ON "TokenRegistro"("email");
CREATE INDEX IF NOT EXISTS "TokenRegistro_tokenHash_idx" ON "TokenRegistro"("tokenHash");
CREATE INDEX IF NOT EXISTS "TokenRegistro_expiraEn_idx"  ON "TokenRegistro"("expiraEn");
