import { schema, rules } from '@ioc:Adonis/Core/Validator'

// Función para validar fecha y hora personalizadas
export const validarFechaHora = (data: any) => {
  const errors: any[] = []

  if (data.fechaSalida) {
    const fechaSalida = new Date(data.fechaSalida + 'T00:00:00')
    const fechaActual = new Date()

    // Verificar que la fecha sea válida
    if (isNaN(fechaSalida.getTime())) {
      errors.push({
        field: 'fechaSalida',
        rule: 'invalidDate',
        message: 'La fecha de salida no es válida.'
      })
      return errors
    }

    // Resetear horas para comparar solo fechas
    const fechaActualSinHora = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), fechaActual.getDate())
    const fechaSalidaSinHora = new Date(fechaSalida.getFullYear(), fechaSalida.getMonth(), fechaSalida.getDate())

    // Validar que la fecha no sea futura
    if (fechaSalidaSinHora > fechaActualSinHora) {
      errors.push({
        field: 'fechaSalida',
        rule: 'futureDate',
        message: 'La fecha de salida no puede ser superior a la actual.'
      })
    }

    // Validar hora si la fecha es hoy
    if (data.horaSalida && fechaSalidaSinHora.getTime() === fechaActualSinHora.getTime()) {
      // Verificar formato de hora
      const horaRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/
      if (!horaRegex.test(data.horaSalida)) {
        errors.push({
          field: 'horaSalida',
          rule: 'invalidTime',
          message: 'La hora de salida no tiene un formato válido.'
        })
        return errors
      }

      const [horas, minutos] = data.horaSalida.split(':').map(Number)
      const horaSalidaMinutos = horas * 60 + minutos
      const horaActualMinutos = fechaActual.getHours() * 60 + fechaActual.getMinutes()

      if (horaSalidaMinutos > horaActualMinutos) {
        errors.push({
          field: 'horaSalida',
          rule: 'futureTime',
          message: 'La hora de salida no puede ser superior a la hora actual cuando la fecha es hoy.'
        })
      }
    }
  }

  return errors
}

export const despachoSchema = schema.create({

  nitEmpresaTransporte: schema.string([
    rules.maxLength(9)
  ]),
  razonSocial: schema.string([
    rules.maxLength(200)
  ]),
  numeroPasajero: schema.number([
    rules.unsigned(),
    rules.range(1, 85)
  ]),
  valorTiquete: schema.number.optional([
    rules.unsigned(),
    rules.range(0, 99999999.99)
    // No usar rules.regex aquí
  ]),
  valorTotalTasaUso: schema.number([
    rules.unsigned(),
    rules.range(0, 99999999.99)
    // No usar rules.regex aquí
  ]),
  observaciones: schema.string.optional([
    rules.maxLength(65535) // text en MySQL
  ]),
  fuenteDato: schema.string.optional({ trim: true }, [
    rules.maxLength(65535)
  ]),
  nitProveedor: schema.string.optional([
    rules.maxLength(20)
  ]),
  horaSalida: schema.string([
    rules.regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/) // HH:mm
  ]),

  fechaSalida: schema.string([
    rules.regex(/^\d{4}-\d{2}-\d{2}$/) // YYYY-MM-DD
  ]),
})

export const despachoMessages = {

  'nitEmpresaTransporte.required': 'El campo nitEmpresaTransporte es obligatorio.',
  'nitEmpresaTransporte.string': 'El campo nitEmpresaTransporte debe ser una cadena de texto.',
  'nitEmpresaTransporte.maxLength': 'El campo nitEmpresaTransporte excede el máximo de 9 caracteres.',

  'razonSocial.required': 'El campo razonSocial es obligatoria.',
  'razonSocial.string': 'El campo razonSocial debe ser una cadena de texto.',
  'razonSocial.maxLength': 'El campo razonSocial excede el máximo de 200 caracteres.',

  'numeroPasajero.required': 'El campo numeroPasajero es obligatorio.',
  'numeroPasajero.number': 'El campo numeroPasajero debe ser un número.',
  'numeroPasajero.range': 'El campo numeroPasajero debe ser entre 1 y 85.',
  'numeroPasajero.unsigned': 'El campo numeroPasajero debe ser un número positivo.',

  'valorTiquete.number': 'El campo valorTiquete debe ser un número.',
  'valorTiquete.range': 'El campo valorTiquete está fuera de rango.',
  'valorTiquete.unsigned': 'El campo valorTiquete debe ser un número positivo.',

  'valorTotalTasaUso.required': 'El campo valorTotalTasaUso es obligatorio.',
  'valorTotalTasaUso.number': 'El campo valorTotalTasaUso debe ser un número.',
  'valorTotalTasaUso.range': 'El campo valorTotalTasaUso está fuera de rango.',
  'valorTotalTasaUso.unsigned': 'El campo valorTotalTasaUso debe ser un número positivo.',

  'valorPruebaAlcoholimetria.number': 'El campo valorPruebaAlcoholimetria debe ser un número.',
  'valorPruebaAlcoholimetria.range': 'El campo valorPruebaAlcoholimetria está fuera de rango.',
  'valorPruebaAlcoholimetria.unsigned': 'El campo valorPruebaAlcoholimetria debe ser un número positivo.',

  'tipoDespacho.number': 'El campo tipoDespacho debe ser un número.',
  'tipoDespacho.range': 'El campo tipoDespacho está fuera de rango.',

  'observaciones.string': 'El campo observaciones debe ser una cadena de texto.',
  'observaciones.maxLength': 'El campo observaciones excede el máximo permitido.',

  'fuenteDato.string': 'El campo fuenteDato debe ser una cadena de texto.',
  'fuenteDato.maxLength': 'El campo fuenteDato excede el máximo permitido.',

  'nitProveedor.string': 'El campo nitProveedor debe ser una cadena de texto.',
  'nitProveedor.maxLength': 'El campo nitProveedor excede el máximo de 20 caracteres.',

  'horaSalida.required': 'El campo horaSalida es obligatorio.',
  'horaSalida.string': 'El campo horaSalida debe ser una cadena de texto.',
  'horaSalida.regex': 'El campo horaSalida debe tener el formato HH:mm.',
  'horaSalida.futureTime': 'La hora de salida no puede ser superior a la hora actual cuando la fecha es hoy.',
  'horaSalida.invalidTime': 'La hora de salida no tiene un formato válido.',

  'fechaSalida.required': 'El campo fechaSalida es obligatorio.',
  'fechaSalida.string': 'El campo fechaSalida debe ser una cadena de texto.',
  'fechaSalida.regex': 'El campo fechaSalida debe tener el formato YYYY-MM-DD.',
  'fechaSalida.futureDate': 'La fecha de salida no puede ser superior a la actual.',
  'fechaSalida.invalidDate': 'La fecha de salida no es válida.',

}

/**
 * Función para validar fecha y hora personalizadas para DespachoValidator
 */
export const validarFechaHoraDespacho = (data: any) => {
  const errors: any[] = []

  // Acceder a los campos dentro del objeto obj_despacho
  const objDespacho = data.obj_despacho || data

  if (objDespacho.fechaSalida) {
    // 💡 FECHA MÍNIMA REQUERIDA: 06/09/2025 (YYYY-MM-DD)
    const MIN_DATE = new Date('2025-09-06T00:00:00')
    
    // Convertir la fecha de salida a un objeto Date
    const fechaSalida = new Date(objDespacho.fechaSalida + 'T00:00:00')
    const fechaActual = new Date()
    fechaActual.setHours(0, 0, 0, 0) // Normalizar la fecha actual a medianoche

    // 1. Validar que la fecha NO sea anterior al 06/09/2025
    if (fechaSalida < MIN_DATE) {
      errors.push({
        field: 'obj_despacho.fechaSalida',
        rule: 'minDate',
        message: 'La fecha de salida no puede ser anterior al 06/09/2025.'
      })
    }

    // 2. Validar que la fecha no sea futura (respecto a HOY)
    if (fechaSalida > fechaActual) {
      errors.push({
        field: 'obj_despacho.fechaSalida',
        rule: 'futureDate',
        message: 'La fecha de salida no puede ser futura.'
      })
    }

    // 3. Validar hora si la fecha es hoy
    if (objDespacho.horaSalida && fechaSalida.toDateString() === (new Date()).toDateString()) {
      const [horas, minutos] = objDespacho.horaSalida.split(':').map(Number)
      const horaSalidaMinutos = horas * 60 + minutos
      const horaActualMinutos = (new Date()).getHours() * 60 + (new Date()).getMinutes()

      if (horaSalidaMinutos > horaActualMinutos) {
        errors.push({
          field: 'obj_despacho.horaSalida',
          rule: 'futureTime',
          message: 'La hora de salida no puede ser superior a la hora actual cuando la fecha es hoy.'
        })
      }
    }
  }

  return errors
}