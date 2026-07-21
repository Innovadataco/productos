import LogsErrores from 'App/Dominio/LogsErrores'

export async function guardarLogError(error: any, usuario?: string, endpoint?: string) {
  await LogsErrores.create({
    mensaje: error.message || 'Error desconocido',
    stack_trace: error.stack || '',
    usuario,
    endpoint
  })
}
