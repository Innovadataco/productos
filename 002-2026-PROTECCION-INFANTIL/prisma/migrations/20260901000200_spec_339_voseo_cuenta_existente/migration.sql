-- SPEC-339 (A-67 · D-1) · el aviso "ya tienes una cuenta" pasa a tuteo neutro.
--
-- Por qué hace falta una migración y no basta el seed: `seedEventosEmailMigrados`
-- usa `update: {}` a propósito — nunca pisa una plantilla que el admin pudo haber
-- editado. Eso significa que corregir el texto en el seed SOLO afecta a bases
-- nuevas; en producción la fila ya existe y se quedaría en voseo, en mitad de un
-- camino que el resto de A-67 escribe en tuteo.
--
-- Se actualiza SOLO si el texto sigue siendo el sembrado por SPEC-338, byte a
-- byte. Si un admin lo editó, esta migración no lo toca: su decisión manda.

UPDATE notificacion_plantillas
SET "asunto" = 'Ya tienes una cuenta con este correo',
    "cuerpoMarkdown" = 'Hola,

Alguien intentó crear una cuenta con este correo, pero tú ya tienes una con nosotros.

Para entrar, usa tu correo y tu clave acá:
{{urlLogin}}

¿No recuerdas la clave? La recuperas en un minuto acá:
{{urlRecuperar}}

Si no fuiste tú, no tienes que hacer nada: tu cuenta está segura.'
WHERE "clave" = 'auth.cuenta_existente.email'
  AND "asunto" = 'Ya tenés una cuenta con este correo';
