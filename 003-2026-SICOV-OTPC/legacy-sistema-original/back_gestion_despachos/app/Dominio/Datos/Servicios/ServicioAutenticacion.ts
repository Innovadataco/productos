/* eslint-disable max-len */
import { GeneradorContrasena } from 'App/Dominio/GenerarContrasena/GenerarContrasena'
import { ServicioUsuarios } from './ServicioUsuarios'
import { ServicioAutenticacionJWT } from 'App/Dominio/Datos/Servicios/ServicioJWT'
import { Exception } from '@adonisjs/core/build/standalone'
import { RespuestaInicioSesion } from 'App/Dominio/Dto/RespuestaInicioSesion'
import { Usuario } from '../Entidades/Usuario'
import { Encriptador } from 'App/Dominio/Encriptacion/Encriptador'
import { RepositorioBloqueoUsuario } from 'App/Dominio/Repositorios/RepositorioBloqueoUsuario'
import { RegistroBloqueo } from '../Entidades/Usuarios/RegistroBloqueo'
import { RepositorioAutorizacion } from 'App/Dominio/Repositorios/RepositorioAutorizacion'
import { RepositorioUsuario } from 'App/Dominio/Repositorios/RepositorioUsuario'
import { EnviadorEmail } from 'App/Dominio/Email/EnviadorEmail'
import { RolDto } from 'App/Presentacion/Autenticacion/Dtos/RolDto'
import { ServicioAutenticacionExterna } from 'App/Dominio/Datos/Servicios/ServicioAutenticacionExterna'
import Logger from '@ioc:Adonis/Core/Logger'
import { TokenExterno } from 'App/Dominio/Utilidades/TokenExterno'
import { RepositorioUsuarioModuloDB } from 'App/Infraestructura/Implementacion/Lucid/RepositorioUsuarioModuloDB'
import Env from '@ioc:Adonis/Core/Env'

export class ServicioAutenticacion {
  private servicioUsuario: ServicioUsuarios

  constructor(
    private encriptador: Encriptador,
    private enviadorEmail: EnviadorEmail,
    private repositorioBloqueo: RepositorioBloqueoUsuario,
    private repositorioAutorizacion: RepositorioAutorizacion,
    private repositorioUsuario: RepositorioUsuario,
  ) {
    this.servicioUsuario = new ServicioUsuarios(
      this.repositorioUsuario,
      new GeneradorContrasena(),
      this.encriptador,
      this.enviadorEmail
    )
  }

  public async cambiarClave(identificacion: string, clave: string, nuevaClave: string) {
    const usuario = await this.verificarUsuario(identificacion)
    if (usuario instanceof Usuario) {
      if (!(await this.encriptador.comparar(clave, usuario.clave))) {
        throw new Exception('Credenciales no corresponden', 400)
      }
      usuario.clave = nuevaClave
      usuario.claveTemporal = false;
      this.servicioUsuario.actualizarUsuario(usuario.id, usuario)
      return;
    }
    throw new Exception('Credenciales no corresponden', 400)
  }

  public async iniciarSesion(usuario: string, contrasena: string): Promise<RespuestaInicioSesion> {
    Logger.info(`Inicio de sesión solicitado para ${usuario}`)
    const usuarioVerificado = await this.verificarUsuario(usuario)
    Logger.info(`Usuario ${usuarioVerificado.identificacion} encontrado con rol ${usuarioVerificado.idRol}`)

    if (!usuarioVerificado.estado) {
      Logger.warn(`Usuario ${usuarioVerificado.identificacion} intenta iniciar sesión estando inactivo`)
      throw new Exception('Usuario inactivo, contacte al administrador.', 403)
    }

    const bloqueoCredencialesActivo = Env.get('BLOQUEO_CREDENCIALES', false)
    let registroDeBloqueo: RegistroBloqueo | null = null

    if (bloqueoCredencialesActivo) {
      registroDeBloqueo = await this.repositorioBloqueo.obtenerRegistroPorUsuario(usuarioVerificado.identificacion)
      if (!registroDeBloqueo) {
        registroDeBloqueo = await this.crearRegistroDeBloqueo(usuarioVerificado.identificacion)
      }
      if (registroDeBloqueo.elUsuarioEstaBloqueado()) {
        throw new Exception('El usuario se encuentra bloqueado por exceder el número de intentos de inicio de sesión', 423)
      }
    }

    if (!(await this.encriptador.comparar(contrasena, usuarioVerificado.clave))) {
      if (bloqueoCredencialesActivo && registroDeBloqueo) {
        await this.manejarIntentoFallido(registroDeBloqueo)
      }
      throw new Exception('Credenciales no corresponden', 400)
    }

    // 1. Autenticación externa obligatoria usando credenciales de entorno
    let tokenExterno: string
    try {
      const servicioExterno = new ServicioAutenticacionExterna()
      tokenExterno = await servicioExterno.iniciarSesionConEnv()
      // Guardar token globalmente para usos posteriores
      TokenExterno.set(tokenExterno)
      Logger.info(`Autenticación externa exitosa para ${usuarioVerificado.identificacion}`)
    } catch (error) {
      Logger.error(`Falla autenticando externamente al usuario ${usuarioVerificado.identificacion}: ${error instanceof Error ? error.message : 'error desconocido'}`)
      // Si falla, no permitir acceso a la plataforma
      throw new Exception('Fallo el inicio de sesión contra el aplicativo externo. Acceso denegado.', 502)
    }

    const rolUsuario = await this.repositorioAutorizacion.obtenerRolConModulosYPermisos(usuarioVerificado.idRol)
    const token = ServicioAutenticacionJWT.generarToken({
      documento: usuarioVerificado.identificacion,
      idRol: usuarioVerificado.idRol,
      id: usuarioVerificado.id
    })

    // Obtener módulos del usuario (personalizados o del rol)
    const repositorioModulos = new RepositorioUsuarioModuloDB()
    const modulos = await repositorioModulos.obtenerModulosDeUsuario(usuarioVerificado.id)

    const tokenParametrica = Env.get('TOKEN_PARAMETRICA', '')

    Logger.info(`Inicio de sesión completado para ${usuarioVerificado.identificacion}`)
    return new RespuestaInicioSesion(
      {
        id: usuarioVerificado.id,
        usuario: usuarioVerificado.identificacion,
        nombre: usuarioVerificado.nombre,
        telefono: usuarioVerificado.telefono,
        correo: usuarioVerificado.correo,
        nit: usuarioVerificado.administrador ?? usuarioVerificado.identificacion,
      },
      token,
      tokenExterno,
      tokenParametrica,
      new RolDto(rolUsuario),
      usuarioVerificado.claveTemporal,
      modulos)
  }

  public async verificarUsuario(usuario: string): Promise<Usuario> {
    const usuarioDB = await this.servicioUsuario.obtenerUsuarioPorUsuario(usuario)
    if (!usuarioDB) {
      throw new Exception('Credenciales no corresponden', 400)
    }
    return usuarioDB
  }

  private async crearRegistroDeBloqueo(identificacion: string): Promise<RegistroBloqueo> {
    const registro = new RegistroBloqueo(identificacion, 0, false)
    return await this.repositorioBloqueo.crearRegistro(registro)
  }

  private async manejarIntentoFallido(registro: RegistroBloqueo): Promise<RegistroBloqueo> {
    registro.agregarIntentoFallido()
    return await this.repositorioBloqueo.actualizarRegistro(registro)
  }


}
