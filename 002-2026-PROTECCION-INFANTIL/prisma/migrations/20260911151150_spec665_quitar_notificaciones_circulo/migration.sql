-- SPEC-665: el aviso del círculo se controla SOLO desde el perfil (regla del motor
-- `padre.circulo_confianza.reporte_enriquecido`, que el motor consulta por usuario y
-- canal). Se elimina la bandera DUPLICADA `notificacionesCirculo`.
--
-- Medido en producción ANTES de borrar: la cohorte en desacuerdo (bandera OFF +
-- preferencia de perfil ON) = 0 → nadie empieza a recibir un correo que había apagado.
-- El cero es cierto porque hoy hay 3 padres, no porque el diseño sea seguro: con miles,
-- esa cohorte existiría y habría que migrar estado. La ventana para hacerlo sin migrar
-- estado es AHORA.
ALTER TABLE "Usuario" DROP COLUMN "notificacionesCirculo";
