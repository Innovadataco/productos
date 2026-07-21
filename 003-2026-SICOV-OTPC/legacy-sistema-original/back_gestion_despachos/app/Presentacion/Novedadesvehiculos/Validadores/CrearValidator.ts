import { schema, rules } from '@ioc:Adonis/Core/Validator'

export default class CrearValidator {
  public schema = schema.create({
    idNovedad: schema.number([
      rules.exists({ table: 'tbl_novedades', column: 'nov_id' }) 
    ]),

    placa: schema.string([
      rules.maxLength(10),
    ]),

    soat: schema.string.optional([
      rules.maxLength(50),
    ]),

    fechaVencimientoSoat: schema.string.optional([
      rules.regex(/^\d{4}-\d{2}-\d{2}$/)
    ]),

    revisionTecnicoMecanica: schema.string.optional([
      rules.maxLength(50)
    ]),

    fechaRevisionTecnicoMecanica: schema.string.optional([
      rules.regex(/^\d{4}-\d{2}-\d{2}$/)
    ]),

    vigenciaContractual: schema.date.optional(),
    vigenciaExtracontractual: schema.date.optional(),

    tarjetaOperacion: schema.string.optional([
      rules.maxLength(50),
    ]),

    fechaVencimientoTarjetaOperacion: schema.string.optional([
      rules.regex(/^\d{4}-\d{2}-\d{2}$/)
    ]),

    idMatenimientoPreventivo: schema.string.optional([
      rules.maxLength(50),
    ]),

    fechaMantenimientoPreventivo: schema.string.optional([
      rules.regex(/^\d{4}-\d{2}-\d{2}$/)
    ]),

    idProtocoloAlistamientodiario: schema.string.optional([
      rules.maxLength(50),
    ]),

    fechaProtocoloAlistamientodiario: schema.string.optional([
      rules.regex(/^\d{4}-\d{2}-\d{2}$/)
    ]),

    observaciones: schema.string.optional(),

    clase: schema.number(),

    nivelServicio: schema.number([
      rules.exists({ table: 'tbl_nivel_servicios', column: 'tns_id' }) 
    ]),

    idPolizaContractual: schema.string.optional(),
    idPolizaExtracontractual: schema.string.optional(),
  })

  public messages = {
    'idNovedad.required': 'El campo idNovedad es obligatorio.',
    'idNovedad.number': 'El campo idNovedad debe ser un número.',
    'idNovedad.exists': 'El campo idNovedad no existe en el sistema.',

    'placa.required': 'El campo  placa es obligatoria.',
    'placa.string': 'El campo  placa debe ser una cadena de texto.',
    'placa.maxLength': 'El campo  placa no puede exceder los 10 caracteres.',

    'soat.required': 'El campo  soat es obligatorio.',
    'soat.string': 'El campo  soat debe ser una cadena de texto.',
    'soat.maxLength': 'El campo  soat no puede exceder los 50 caracteres.',

    'fechaVencimientoSoat.regex': 'El campo  fechaVencimientoSoat debe ser válida.',

    'revisionTecnicoMecanica.required': 'El campo  revisionTecnicoMecanica es obligatoria.',
    'revisionTecnicoMecanica.string': 'El campo revisionTecnicoMecanica Debe ser una cadena de texto.',
    'revisionTecnicoMecanica.maxLength': 'El campo revisionTecnicoMecanica No puede exceder los 50 caracteres.',

    'fechaRevisionTecnicoMecanica.regex': 'El campo  fechaRevisionTecnicoMecanica debe ser válida.',

    'vigenciaContractual.date': 'El campo vigenciacontractual debe ser una fecha válida.', 'vigenciacontractual.required': 'El campo vigenciacontractual es obligatoria.',
    'vigenciaExtracontractual.date': 'El campo vigenciaextracontractual debe ser una fecha válida.',

    'tarjetaOperacion.required': 'El campo LatarjetaOperacion es obligatoria.',
    'tarjetaOperacion.string': 'El campo tarjetaOperacion Debe ser una cadena de texto.',
    'tarjetaOperacion.maxLength': 'El campo tarjetaOperacion No puede exceder los 50 caracteres.',

    'fechaVencimientoTarjetaOperacion.regex': 'El campo  fechaVencimientoTarjetaOperacion debe ser válida.',

    'idMatenimientoPreventivo.required': 'El campo  idMatenimientoPreventivo es obligatorio.',
    'idMatenimientoPreventivo.string': 'El campo idMatenimientoPreventivo Debe ser una cadena de texto.',
    'idMatenimientoPreventivo.maxLength': 'El campo idMatenimientoPreventivo No puede exceder los 50 caracteres.',

    'fechaMantenimientoPreventivo.regex': 'El campo  fechaMantenimientoPreventivo debe ser válida.',

    'idProtocoloAlistamientodiario.required': 'El campo  idProtocoloAlistamientodiario es obligatorio.',
    'idProtocoloAlistamientodiario.string': 'El campo idProtocoloAlistamientodiario Debe ser una cadena de texto.',
    'idProtocoloAlistamientodiario.maxLength': 'El campo idProtocoloAlistamientodiario No puede exceder los 50 caracteres.',

    'fechaProtocoloAlistamientodiario.regex': 'El campo  fechaProtocoloAlistamientodiario debe ser válida.',

    'observaciones.required': 'El campo  observaciones son obligatorias.',
    'observaciones.string': 'El campo  observaciones deben ser una cadena de texto.',

    'clase.required': 'El campo clase es obligatorio.',
    'clase.number': 'El campo clase debe ser un número.',

    'nivelServicio.required': 'El campo nivelServicio es obligatorio.',
    'nivelServicio.number': 'El campo nivelServicio Debe ser un número.',
    'nivelServicio.exists': 'El campo nivelServicio no existe en el sistema.',

    'idPolizaContractual.string': 'El campo idPolizaContractual deben ser una cadena de texto.',
    'idPolizaContractual.required': 'El campo idPolizaContractual es obligatorio.',
    'idPolizaExtracontractual.string': 'El campo idPolizaExtracontractual deben ser una cadena de texto.'
  }
}
