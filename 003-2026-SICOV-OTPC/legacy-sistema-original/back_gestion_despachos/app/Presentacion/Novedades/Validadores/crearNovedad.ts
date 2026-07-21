import { schema, rules } from '@ioc:Adonis/Core/Validator'

export default class CrearNovedadValidator {
  public schema = schema.create({
    idDespacho: schema.number([
    ]),

    idTipoNovedad: schema.number([
      rules.exists({ table: 'tbl_tipo_novedad', column: 'tnov_id' })
    ]),

    descripcion: schema.string([
      rules.maxLength(255)
    ]),

    otros: schema.string.optional([
      rules.maxLength(255)
    ]),

    horaNovedad: schema.string([
      rules.regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/) // HH:mm
    ]),

    fechaNovedad: schema.string([
      rules.regex(/^\d{4}-\d{2}-\d{2}$/) // YYYY-MM-DD
    ]),
    fuenteDato: schema.string.optional({ trim: true }, [
    rules.maxLength(65535)
  ]),

     nitProveedor: schema.string.optional([
    ])
  });

  public messages = {
    'idDespacho.required': 'El campo idDespacho es obligatorio.',
    'idDespacho.number': 'El campo idDespacho debe ser un número.',

    'idTipoNovedad.required': 'El campo idTipoNovedad es obligatorio.',
    'idTipoNovedad.number': 'El  campo idTipoNovedad debe ser un número.',
    'idTipoNovedad.exists': 'El campo idTipoNovedad no existe en el sistema.',

    'descripcion.required': 'El campo descripcion es obligatoria.',
    'descripcion.string': 'El campo descripcion debe ser una cadena de texto.',
    'descripcion.maxLength': 'El campo descripcion no puede exceder los 255 caracteres.',

    'otros.string': 'El campo "otros" debe ser una cadena de texto.',
    'otros.maxLength': 'El campo "otros" no puede exceder los 255 caracteres.',

     'horaNovedad.required': 'El campo horaNovedad es obligatoria.',
    'horaNovedad.regex': 'El campo horaNovedad debe tener el formato HH:mm (ejemplo: 13:45).',

    'fechaNovedad.required': 'El campo fechaNovedad es obligatoria.',
    'fechaNovedad.regex': 'El campo fechaNovedad debe tener el formato YYYY-MM-DD (ejemplo: 2025-06-13).'
  }
}
