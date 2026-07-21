/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/explicit-member-accessibility */
import Mail from '@ioc:Adonis/Addons/Mail'
import Env from '@ioc:Adonis/Core/Env'
import { ConfiguracionEmail } from 'App/Dominio/Email/ConfiguracionEmail';
import { Email } from 'App/Dominio/Email/Email';
import { EnviadorEmail } from 'App/Dominio/Email/EnviadorEmail'

export class EnviadorEmailAdonis implements EnviadorEmail {
  private readonly DEFAULT_EMAIL_ALIAS;
  private readonly DEFAULT_SMTP_USERNAME;

  constructor(){
    this.DEFAULT_SMTP_USERNAME = Env.get('SMTP_USERNAME')
    this.DEFAULT_EMAIL_ALIAS = Env.get('EMAIL_ALIAS')
  }

  enviarTemplate<T>(configuracion: ConfiguracionEmail, email: Email<T>): void {
  const {destinatarios, de, alias, copias, asunto, adjunto, adjuntos} = configuracion
    Mail.send(mensaje => {
      mensaje.subject(asunto).from(de ?? this.DEFAULT_SMTP_USERNAME, alias ?? this.DEFAULT_EMAIL_ALIAS);

      if(typeof destinatarios === 'string') mensaje.to(destinatarios);
      else {
        destinatarios.forEach( destinatario => {
          mensaje.to(destinatario)
        })
      }

      if(copias){
        if(typeof copias === 'string') mensaje.to(copias);
        else{
          copias.forEach( copia => {
            mensaje.to(copia)
          })
        }
      }

      const listaAdjuntos = [] as Array<import('App/Dominio/Ficheros/Fichero').Fichero>
      if(adjunto) listaAdjuntos.push(adjunto)
      if(adjuntos && Array.isArray(adjuntos) && adjuntos.length) listaAdjuntos.push(...adjuntos)

      let cidEncontrado: string | undefined
      if(listaAdjuntos.length){
        listaAdjuntos.forEach(a => {
          const opciones: any = { filename: a.nombre }
          if(a.cid) opciones.cid = a.cid
          if(a.contentType) opciones.contentType = a.contentType
          mensaje.attachData(a.contenido, opciones)
          if(a.cid && !cidEncontrado) cidEncontrado = a.cid
        })
      }

      // Propagar el primer cid encontrado al modelo como logoCid si no existe
      if(cidEncontrado && email && email.modelo && typeof email.modelo === 'object' && !("logoCid" in (email.modelo as any))){
        ;(email.modelo as any).logoCid = cidEncontrado
      }

      mensaje.htmlView(email.rutaTemplate, email.modelo)
    })
  }

  enviarEmail (asunto:string, texto: string, destinatarios: string[], etiquetas?: string[] | undefined): void {
    Mail.send(mensaje => {
      mensaje
        .subject(asunto)
        .from(Env.get('SMTP_USERNAME'), Env.get('EMAIL_ALIAS'))
        .cc(destinatarios.join(';'))
        .text(texto)
    })
  }
}
