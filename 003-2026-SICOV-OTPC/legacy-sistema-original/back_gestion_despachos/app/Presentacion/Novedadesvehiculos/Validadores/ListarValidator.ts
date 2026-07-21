import { schema, rules } from '@ioc:Adonis/Core/Validator'

export default class ListarValidator {
  public schema = schema.create({
    page: schema.number([
    ]),
    numero_items: schema.number([
    ]),
  });

  public messages = {
    'page.required': 'El campo page es obligatorio.',
    'page.number': 'El page debe ser un número.',
    'numero_items.required': 'El campo numero_items es obligatorio.',
    'numero_items.number': 'El numero_items debe ser un número.'
  }
}
