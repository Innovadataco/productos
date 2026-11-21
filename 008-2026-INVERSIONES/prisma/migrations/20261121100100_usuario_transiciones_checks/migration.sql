-- Endurecimiento de la base (database-reviewer): transiciones de usuario (D2) y CHECK de defensa en
-- profundidad (bajos). Migración ADITIVA y segura sobre datos existentes: no toca ni revisa filas.
SET LOCAL lock_timeout = '5s';

-- ───────────── CHECK nuevos, NOT VALID ─────────────
-- NOT VALID: protegen cada fila nueva o modificada desde ya, sin revisar las que existen (que nadie puede ver
-- aquí). Lo que ya está se mide con scripts/contar-sin-validar.sql (solo lectura, devuelve solo conteos);
-- si todo da 0, el VALIDATE CONSTRAINT entra en una migración posterior, nunca a mano. Hasta entonces el
-- guardián los acepta sin validar (lista `sin_validar` de scripts/verificar-esquema.sql).
-- Un evento corporativo va de una especie a OTRA (src/eventos/escision.ts ya lo valida por nemotécnico).
ALTER TABLE "evento_corporativo" ADD CONSTRAINT "evento_corporativo_origen_destino_chk" CHECK ("origenId" <> "destinoId") NOT VALID;
-- La razón de la escisión, si la hay, es positiva (escision.ts: DEBE_SER_POSITIVO).
ALTER TABLE "evento_corporativo" ADD CONSTRAINT "evento_corporativo_razon_chk" CHECK ("razon" IS NULL OR "razon" > 0) NOT VALID;
-- La retención no es negativa (dividendo_bruto_chk solo exige bruto − retención = neto).
ALTER TABLE "dividendo" ADD CONSTRAINT "dividendo_retencion_chk" CHECK ("retencion" IS NULL OR "retencion" >= 0) NOT VALID;
-- La tasa es una fracción (MODELO-DATOS-FASE-1: «p. ej. 0.350000»), entre 0 y 1.
ALTER TABLE "dividendo" ADD CONSTRAINT "dividendo_tasa_retencion_chk" CHECK ("tasaRetencion" IS NULL OR ("tasaRetencion" >= 0 AND "tasaRetencion" <= 1)) NOT VALID;
-- Una orden no se liquida antes de operarse (el importador usa T+2 hábiles: src/importacion/trii/guardar.ts).
ALTER TABLE "orden" ADD CONSTRAINT "orden_fechas_chk" CHECK ("fechaLiquidacion" >= "fechaOperacion") NOT VALID;

-- ───────────── Transiciones de usuario (D2) ─────────────
-- inv_app tiene UPDATE por columna en usuario (docker/migrador/privilegios.sql). Sin esto, una app
-- comprometida (o un error) podía bajar sesionVersion y revivir JWT revocados. Reglas, verificadas contra
-- src/auth (acceso.ts, reinicio-totp.ts, enrolamiento.ts, cuenta-totp.ts, segundo-paso.ts, regenerar.ts):
--   R1 sesionVersion nunca baja, y sube de a uno (todo src/auth hace `increment: 1`): un salto al máximo del
--      entero dejaría la cuenta sin poder cambiar la clave ni reiniciar el TOTP, para siempre;
--   R2 si había clave y cambia (a otra o a NULL), sesionVersion sube en el mismo UPDATE (la primera clave,
--      de NULL a un hash, queda libre: sin clave no hay sesión válida, src/auth/sesion.ts);
--   R3 con el TOTP activo (último paso no nulo antes y después), el último paso nunca baja (antireplay);
--   R4 apagar el TOTP (totpActivadoEn de un valor a NULL, el reinicio) exige subir sesionVersion.
-- Alcance: impide revivir sesiones cerradas y obliga a cerrarlas al cambiar la clave o reiniciar el TOTP.
-- NO impide que quien controle inv_app (o escriba SQL con su conexión) tome la cuenta: puede fijar otra clave
-- subiendo la versión, o reiniciar el TOTP (subiéndola) y volver a activarlo con el último paso que quiera;
-- tampoco limita bloqueadoHasta (puede levantar el bloqueo por fallos), presesionHash ni la activación del
-- TOTP (de NULL a una hora). Apagar el último paso con el TOTP activo ya lo frena usuario_totp_chk.
-- Sin salida de escape: inv_app podría usar cualquier GUC (SET LOCAL), así que no hay ninguna.
CREATE FUNCTION "inv_usuario_transiciones"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."sesionVersion" < OLD."sesionVersion" THEN
    RAISE EXCEPTION 'usuario: la versión de sesión no baja' USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW."sesionVersion" > OLD."sesionVersion" + 1 THEN
    RAISE EXCEPTION 'usuario: la versión de sesión sube de a uno' USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD."claveHash" IS NOT NULL AND NEW."claveHash" IS DISTINCT FROM OLD."claveHash"
     AND NEW."sesionVersion" <= OLD."sesionVersion" THEN
    RAISE EXCEPTION 'usuario: cambiar o quitar la clave exige subir la versión de sesión' USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD."totpUltimoPaso" IS NOT NULL AND NEW."totpUltimoPaso" IS NOT NULL
     AND NEW."totpUltimoPaso" < OLD."totpUltimoPaso" THEN
    RAISE EXCEPTION 'usuario: el último paso del TOTP no baja' USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD."totpActivadoEn" IS NOT NULL AND NEW."totpActivadoEn" IS NULL
     AND NEW."sesionVersion" <= OLD."sesionVersion" THEN
    RAISE EXCEPTION 'usuario: apagar el TOTP exige subir la versión de sesión' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "usuario_transiciones" BEFORE UPDATE ON "usuario" FOR EACH ROW EXECUTE FUNCTION "inv_usuario_transiciones"();
