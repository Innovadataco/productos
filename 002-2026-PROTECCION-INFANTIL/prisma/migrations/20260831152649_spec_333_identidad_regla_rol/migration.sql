-- SPEC-333 (002-PI-233 · A-63 · I-223): la identidad de NotificacionRegla debe
-- incluir `rol`. Hoy @@unique([evento,canal,plantillaClave]) (dedup SPEC-247)
-- ignora el rol → dos roles del mismo (evento,canal,plantilla) colapsan
-- (last-write-wins) y el 2º rol pierde su preferencia (rector/comité/operador).
--
-- ORDEN (candado 26): el UPDATE del rename corre BAJO el índice viejo
-- [evento,canal,plantillaClave], que garantiza <=1 fila por esa clave → el rename
-- NO puede crear un duplicado que choque con el índice nuevo. Recién después se
-- reemplaza la constraint. El DES-COLAPSO multi-rol (re-crear las filas por rol que
-- se habían perdido) lo completa el RE-SEED idempotente en el deploy: con la
-- identidad nueva, cada (evento,canal,plantillaClave,rol) es una fila distinta.
--
-- Aditiva / idempotente. NO borra datos.

-- (1) Alinear el rol legado del rector al enum RolUsuario (SPEC-330 fue solo padre).
UPDATE "notificacion_reglas" SET rol = 'SCHOOL_ADMIN' WHERE rol = 'RECTOR_COLEGIO';

-- (2) Reemplazar la constraint única: quitar la vieja (sin rol), poner la nueva (con rol).
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'notificacion_reglas_evento_canal_plantillaClave_key'
          AND conrelid = '"notificacion_reglas"'::regclass
    ) THEN
        ALTER TABLE "notificacion_reglas"
            DROP CONSTRAINT "notificacion_reglas_evento_canal_plantillaClave_key";
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'notificacion_reglas_evento_canal_plantillaClave_rol_key'
          AND conrelid = '"notificacion_reglas"'::regclass
    ) THEN
        ALTER TABLE "notificacion_reglas"
            ADD CONSTRAINT "notificacion_reglas_evento_canal_plantillaClave_rol_key"
            UNIQUE (evento, canal, "plantillaClave", rol);
    END IF;
END $$;
