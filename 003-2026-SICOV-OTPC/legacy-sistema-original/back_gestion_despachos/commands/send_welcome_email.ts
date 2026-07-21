import { BaseCommand } from '@adonisjs/core/build/standalone'
import Application from '@ioc:Adonis/Core/Application'
import * as fs from 'fs'
import { EnviadorEmailAdonis } from 'App/Infraestructura/Email/EnviadorEmailAdonis'
import { ConfiguracionEmail } from 'App/Dominio/Email/ConfiguracionEmail'
import { Email } from 'App/Dominio/Email/Email'

/**
 * Comando para enviar un correo de bienvenida con logo inline (CID).
 * Uso:
 *  node ace send:welcome --to="destinatario@correo.com" --nombre="Usuario" --clave="ABC123" --logo="logo.png"
 */
export default class SendWelcomeEmail extends BaseCommand {
  public static commandName = 'send:welcome'
  public static description = 'Enviar correo de bienvenida con logo incrustado (CID)'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public to: string
  public nombre: string
  public clave: string
  public logo: string

  public async run () {
    this.to = this.parsed?.flags.to as string
    this.nombre = (this.parsed?.flags.nombre as string) || 'Usuario'
    this.clave = (this.parsed?.flags.clave as string) || 'Temporal123!'
    this.logo = (this.parsed?.flags.logo as string) || 'logo.png'

    if(!this.to){
      this.logger.error('Debe indicar --to="correo@dominio"')
      return
    }

    const logoPath = Application.makePath('uploads', 'logos', this.logo)
    if(!fs.existsSync(logoPath)){
      this.logger.warning(`Logo no encontrado en ${logoPath}. Se enviará sin imagen inline.`)
    }

    const enviador = new EnviadorEmailAdonis()
    const configuracion: ConfiguracionEmail = {
      destinatarios: this.to,
      asunto: 'Bienvenido',
      adjunto: fs.existsSync(logoPath) ? {
        contenido: fs.readFileSync(logoPath),
        nombre: this.logo,
        tamano: fs.statSync(logoPath).size,
        cid: 'logo_bienvenida',
        contentType: this.logo.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
      } : undefined
    }

    const email: Email<any> = {
      rutaTemplate: 'App/Dominio/Email/Templates/bienvenida',
      modelo: {
        nombre: this.nombre,
        clave: this.clave
        // logoCid se agrega automáticamente si el adjunto tiene cid
      }
    }

    enviador.enviarTemplate(configuracion, email)
    this.logger.info('Correo de bienvenida enviado (revisar logs SMTP / bandeja).')
  }
}
