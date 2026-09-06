-- SPEC-509: `PermisoModulo.rol` de String libre a enum `RolUsuario`.
-- Cierra la degradación silenciosa (un rol mal escrito creaba un grant muerto).
-- La tabla NO se publica a bi_replica, así que el enum no coordina la réplica.

-- Pre-check (regla del CEO): aborta EN VOZ ALTA si existe una fila con un `rol`
-- fuera de `RolUsuario` (grants legacy/renombrados que los scripts de revocación
-- dejan con activo=false pero no borran). El cast de abajo fallaría si no; el
-- guard lo dice con un mensaje claro para limpiar/mapear primero.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "PermisoModulo"
    WHERE "rol" NOT IN (
      'ADMIN','SCHOOL_ADMIN','PARENT','OPERADOR',
      'COMITE_VALIDACION','COMITE_CONVIVENCIA','PROFESIONAL','VERIFICADOR'
    )
  ) THEN
    RAISE EXCEPTION 'SPEC-509: hay filas PermisoModulo.rol fuera de RolUsuario; limpiar/mapear antes de convertir.';
  END IF;
END $$;

-- El `@@unique([rol, moduloId])` ya indexa el prefijo `rol` → se retira el índice
-- redundante (T-1 de la auditoría del modelo).
DROP INDEX IF EXISTS "PermisoModulo_rol_idx";

-- Conversión de tipo. Todos los valores fueron validados arriba como labels del enum.
ALTER TABLE "PermisoModulo" ALTER COLUMN "rol" TYPE "RolUsuario" USING ("rol"::"RolUsuario");
