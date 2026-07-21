import { schema, rules } from '@ioc:Adonis/Core/Validator'

export default class IdValidator {
  public schema = schema.create({
    id: schema.number([
    ])
  });

  public messages = {
    'id.required': 'El campo ID es obligatorio.',
    'id.number': 'El ID debe ser un número.'
  };
}
