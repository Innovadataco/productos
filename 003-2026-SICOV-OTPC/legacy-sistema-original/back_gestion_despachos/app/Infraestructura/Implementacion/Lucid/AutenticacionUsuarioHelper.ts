import { Exception } from '@adonisjs/core/build/standalone'
import TblUsuarios from 'App/Infraestructura/Datos/Entidad/Usuario'

export interface DatosAutenticacionUsuario {
  tokenAutorizacion: string
  nitVigilado: string
  usuarioId: number
}

export async function obtenerDatosAutenticacionUsuario(
  identificacionUsuario: string,
  idRol: number
): Promise<DatosAutenticacionUsuario> {
  let tokenAutorizacion = ''
  let nitVigilado = ''
  let usuarioId = 0

  const usuarioDb = await TblUsuarios.query().where('identificacion', identificacionUsuario).first()

  if (!usuarioDb) {
    throw new Exception('Usuario no encontrado', 404)
  }

  if (idRol === 3) {
    const identificacionAdministrador = usuarioDb.administrador
    if (!identificacionAdministrador) {
      throw new Exception('Usuario administrador no encontrado', 404)
    }

    const usuarioAdministrador = await TblUsuarios.query().where('identificacion', identificacionAdministrador).first()
    if (!usuarioAdministrador) {
      throw new Exception('Usuario administrador no encontrado', 404)
    }

    tokenAutorizacion = usuarioAdministrador.tokenAutorizado || ''
    nitVigilado = String(usuarioAdministrador.identificacion ?? identificacionAdministrador)
    usuarioId = usuarioAdministrador.id ?? 0
  } else {
    tokenAutorizacion = usuarioDb.tokenAutorizado || ''
    nitVigilado = String(usuarioDb.identificacion ?? '')
    usuarioId = usuarioDb.id ?? 0
  }

  if (!tokenAutorizacion || tokenAutorizacion.trim() === '') {
    throw new Exception('Token de autorización no encontrado. Por favor, contacte al administrador.', 400)
  }

  if (!nitVigilado || nitVigilado.trim() === '') {
    throw new Exception('No se pudo determinar el identificador del vigilado asociado al usuario', 400)
  }

  return { tokenAutorizacion, nitVigilado, usuarioId }
}
