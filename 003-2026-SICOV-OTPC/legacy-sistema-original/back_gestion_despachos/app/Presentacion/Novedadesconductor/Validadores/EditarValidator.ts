import { schema, rules } from '@ioc:Adonis/Core/Validator'

export default class CrearValidator {
  public schema = schema.create({
    id: schema.number([
    ]),
    idNovedad: schema.number([
      rules.exists({ table: 'tbl_novedades', column: 'nov_id' }) 
    ]),

    tipoIdentificacionConductor: schema.string([
      rules.maxLength(20)
    ]),

    numeroIdentificacion: schema.string([
      rules.maxLength(30)
    ]),

    primerNombreConductor: schema.string([
      rules.maxLength(100)
    ]),

    segundoNombreConductor: schema.string.optional([
      rules.maxLength(100)
    ]),

    primerApellidoConductor: schema.string([
      rules.maxLength(45)
    ]),

    segundoApellidoConductor: schema.string.optional([
      rules.maxLength(45)
    ]),

    idPruebaAlcoholimetria: schema.string.optional([
      rules.maxLength(50)
    ]),

    resultadoPruebaAlcoholimetria: schema.string.optional([
      rules.maxLength(20)
    ]),

    fechaUltimaPruebaAlcoholimetria: schema.string.optional([
      rules.regex(/^\d{4}-\d{2}-\d{2}$/)
    ]),

    licenciaConduccion: schema.string([
      rules.maxLength(50)
    ]),

    idExamenMedico: schema.string.optional([
      rules.maxLength(50)
    ]),

    fechaUltimoExamenMedico: schema.string.optional([
      rules.regex(/^\d{4}-\d{2}-\d{2}$/)
    ]),

    fechaVencimientoLicencia: schema.string([
      rules.regex(/^\d{4}-\d{2}-\d{2}$/)
    ]),

    observaciones: schema.string.optional()
  })

  public messages = {
    'id.required': 'El campo ID es obligatorio.',
    'id.number': 'El ID debe ser un número.',
    
    'idNovedad.required': 'El campo idNovedad es obligatorio.',
    'idNovedad.number': 'El campo idNovedad debe ser un número.',
    'idNovedad.exists': 'El campo idNovedad no existe en el sistema.',

    'tipoIdentificacionConductor.required': 'El campo tipoIdentificacionConductores obligatorio.',
    'tipoIdentificacionConductor.maxLength': 'El campo tipoIdentificacionConductor no debe exceder los 20 caracteres.',

    'numeroIdentificacion.required': 'El campo numeroIdentificacion es obligatorio.',
    'numeroIdentificacion.maxLength': 'El campo numeroIdentificacion no debe exceder los 30 caracteres.',

    'primerNombreConductor.required': 'El campo primerNombreConductor es obligatorio.',
    'primerNombreConductor.maxLength': 'El campo primerNombreConductor no debe exceder los 100 caracteres.',

    'segundoNombreConductor.maxLength': 'El campo segundoNombreConductor no debe exceder los 100 caracteres.',

    'primerApellidoConductor.required': 'El campo primerApellidoConductor del conductor es obligatorio.',
    'primerApellidoConductor.maxLength': 'El campo primerApellidoConductor no debe exceder los 45 caracteres.',

    'segundoApellidoConductor.maxLength': 'El campo segundoApellidoConductor no debe exceder los 45 caracteres.',

    'idPruebaAlcoholimetria.required': 'El campo idPruebaAlcoholimetria es obligatorio.',
    'idPruebaAlcoholimetria.maxLength': 'El campo idPruebaAlcoholimetria no debe exceder los 50 caracteres.',

    'resultadoPruebaAlcoholimetria.required': 'El campo resultadoPruebaAlcoholimetria es obligatorio.',
    'resultadoPruebaAlcoholimetria.maxLength': 'El campo resultadoPruebaAlcoholimetria no debe exceder los 20 caracteres.',

    'fechaUltimaPruebaAlcoholimetria.required': 'El campo fechaUltimaPruebaAlcoholimetria es obligatoria.',
    'fechaUltimaPruebaAlcoholimetria.regex': 'El campo fechaUltimaPruebaAlcoholimetria de la prueba debe ser válida.',

    'licenciaConduccion.required': 'El campo licenciaConduccion es obligatoria.',
    'licenciaConduccion.maxLength': 'El campo licenciaConduccion no debe exceder los 50 caracteres.',

    'idExamenMedico.required': 'El campo idExamenMedico es obligatorio.',
    'idExamenMedico.maxLength': 'El campo idExamenMedico no debe exceder los 50 caracteres.',

    'fechaUltimoExamenMedico.required': 'El campo fechaUltimoExamenMedico es obligatoria.',
    'fechaUltimoExamenMedico.regex': 'El campo fechaUltimoExamenMedico debe ser válida.',

    'fechaVencimientoLicencia.required': 'El campo fechaVencimientoLicencia es obligatoria.',
    'fechaVencimientoLicencia.regex': 'El campo fechaVencimientoLicencia debe ser válida.',

    'observaciones.string': 'El campo observaciones deben ser texto.'
  }
}
