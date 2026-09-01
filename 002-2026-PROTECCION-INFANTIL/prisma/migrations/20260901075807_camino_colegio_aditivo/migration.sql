-- SPEC-344 (A-69 · C1) · migración aditiva del camino guiado del colegio.
-- Cero destructiva: solo agrega 1 columna con default a TokenRegistro
-- (todos los tokens vivos quedan como PARENT — correcto) y 2 columnas
-- nullable a AcudienteEstudiante (todos los acudientes vivos quedan sin
-- documento — correcto, aditivo opcional).

-- TokenRegistro: rol para parametrizar registro por enlace por rol.
ALTER TABLE "TokenRegistro"
  ADD COLUMN "rol" "RolUsuario" NOT NULL DEFAULT 'PARENT';

-- AcudienteEstudiante: documento opcional (D-acud del brief A-69).
ALTER TABLE "AcudienteEstudiante"
  ADD COLUMN "documentoTipo" TEXT,
  ADD COLUMN "documentoNumero" TEXT;
