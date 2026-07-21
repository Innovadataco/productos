import { RepositorioFichero } from "App/Dominio/Ficheros/RepositorioFichero";
import { RepositorioSoporte } from "App/Dominio/Repositorios/RepositorioSoporte";
import { PeticionCrearSoporte } from "./Dtos/PeticionCrearSoporte";
import { ServicioUsuario } from "./ServicioUsuario";
import { Usuario } from "../Entidades/Usuario";
import { Exception } from "@adonisjs/core/build/standalone";
import { Soporte } from "../Entidades/Soporte";
import { Fichero } from "App/Dominio/Ficheros/Fichero";
import { RUTAS_ARCHIVOS } from "App/Dominio/Ficheros/RutasFicheros";
import { FiltrosSoporte } from "App/Dominio/Dto/Soporte/FiltrosSoporte";
import { PeticionResponderSoporte } from "./Dtos/PeticionResponderSoporte";
import { DateTime } from "luxon";
import { EstadosSoportes } from "App/Dominio/EstadosSoporte";
import { EnviadorEmail } from "App/Dominio/Email/EnviadorEmail";
import { EmailRespuestaSoporte } from "App/Dominio/Email/Emails/EmailRespuestaSoporte";
import { EmailnotificacionCorreo } from "App/Dominio/Email/Emails/EmailNotificacionCorreo";
import Env from '@ioc:Adonis/Core/Env';
import Application from '@ioc:Adonis/Core/Application';
import * as fs from 'fs';
import { ServicioArchivos } from "./ServicioArchivos";

export class ServicioSoporte {
    constructor(
        private repositorio: RepositorioSoporte,
        private repositorioFicheros: RepositorioFichero,
        private servicioUsuarios: ServicioUsuario,
        private servicioArchivos: ServicioArchivos,
        private enviadorEmail: EnviadorEmail
    ) { }

    async responder(peticion: PeticionResponderSoporte) {
        const usuario = await this.servicioUsuarios.obtenerUsuario(peticion.identificacionUsuarioAdmin)
        const soporte = await this.repositorio.obtenerPorId(peticion.soporteId)
        if (!soporte) {
            throw new Exception(`No se encontró el soporte con id: ${peticion.soporteId}`)
        }
        soporte.respuesta = peticion.respuesta
        soporte.fechaRespuesta = DateTime.now()
    // Almacenar responsable de la respuesta (sin apellido si no existe campo)
    soporte.usuarioRespuesta = `${usuario.nombre}`
        if (peticion.adjunto) {
            try{
                const archivo = await this.servicioArchivos.guardarArchivo(peticion.adjunto, 'soportes', usuario.usuario)
                soporte.documentoRespuesta = archivo.nombreOriginalArchivo
                soporte.identificadorDocumentoRespuesta = archivo.nombreAlmacenado
                soporte.ruta = archivo.ruta
            }catch(e){
                this.repositorio.eliminarSoporte(soporte)
                throw new Exception('Falló la carga del archivo, intentalo nuevamente.', 500)
            }
        }
        soporte.idEstado = EstadosSoportes.CERRADO;
        this.enviarEmailRespuesta(soporte, peticion.adjunto);
        return await this.repositorio.actualizarSoporte(soporte)
    }

    private enviarEmailRespuesta(soporte: Soporte, adjunto?: Fichero) {
        const email = new EmailRespuestaSoporte({
          //  descripcion: soporte.descripcion,
            descripcion: `De conformidad a lo solicitado en el radicado No ${soporte.radicado!} nos permitimos informar:`,
            nombre: soporte.razonSocial,
            respuesta: soporte.respuesta!,
            titulo: soporte.radicado!,
            logo: Env.get('LOGO'),
            nit:soporte.nit
        })
        this.enviadorEmail.enviarTemplate({
            asunto: `Respuesta, radicado: ${soporte.radicado!}`,
            destinatarios: [soporte.email],
            adjunto: adjunto ?? this.construirLogoAdjunto()
        }, email)
    }

    private enviarEmailNotificacion(soporte: Soporte) {
        const email = new EmailnotificacionCorreo({
            nombre: soporte.razonSocial,
            mensaje: `Por medio de la presente me permito informarle que su solicitud fue radicada con el No ${soporte.radicado}, en el aplicativo de SISI-POLIZA.` ,
            logo: Env.get('LOGO'),
            nit:soporte.nit
        })
        this.enviadorEmail.enviarTemplate({
            asunto: 'Creación de soporte.',
            destinatarios: soporte.email,
            de: Env.get('SMTP_USERNAME'),
            adjunto: this.construirLogoAdjunto()
        }, email)
    }

    async listar(pagina: number, limite: number, filtros: FiltrosSoporte) {
        return this.repositorio.obtenerSoportes(pagina, limite, filtros)
    }

    async listarVigilado(nit:string) {
        return this.repositorio.obtenerSoportesVigilado(nit)
    }

    async guardar(peticion: PeticionCrearSoporte, problemaAcceso: boolean) {
        if (problemaAcceso) {
            return await this.guardarSoporteProblemasAcceso(peticion)
        } else {
            return await this.guardarSoporteGenerico(peticion)
        }
    }

    private async obtenerUsuario(documento: string): Promise<Usuario> {
        try {
            return this.servicioUsuarios.obtenerUsuario(documento)
        } catch {
            throw new Exception(`Error al buscar el usuario con identificación: ${documento}`, 500)
        }
    }

    private async guardarSoporteGenerico(peticion: PeticionCrearSoporte) {
        const usuario = await this.obtenerUsuario(peticion.documentoUsuario)
        let soporte = Soporte.crear({
            descripcion: peticion.descripcion,
            email: usuario.correo,
            nit: usuario.identificacion,
            razonSocial: usuario.nombre,
            ruta: 'RUTA PENDIENTE',
            documento: peticion.adjunto ? peticion.adjunto.nombre : undefined,
            telefono: usuario.telefono ?? '',
            problemaAcceso: false,
            motivo: peticion.motivo
        })
        soporte = await this.repositorio.guardar(soporte)
        if (peticion.adjunto) {
            try{
                const archivo = await this.servicioArchivos.guardarArchivo(peticion.adjunto, 'soportes', usuario.usuario)
                soporte.documento = archivo.nombreOriginalArchivo
                soporte.identificadorDocumento = archivo.nombreAlmacenado
                soporte.ruta = archivo.ruta
            }catch(e){
                this.repositorio.eliminarSoporte(soporte)
                throw new Exception('Falló la carga del archivo, intentalo nuevamente.', 500)
            }
        }
        soporte.generarRadicado()
        this.enviarEmailNotificacion(soporte);
        return await this.repositorio.actualizarSoporte(soporte)
    }

    private async guardarSoporteProblemasAcceso(peticion: PeticionCrearSoporte) {
        if (!peticion.correo) {
            throw new Exception('El correo es necesario para los soportes de problemas de acceso.', 400)
        }
        if (!peticion.razonSocial) {
            throw new Exception('La razón social es necesaria para los soportes de problemas de acceso.', 400)
        }
        let soporte = Soporte.crear({
            descripcion: peticion.descripcion,
            email: peticion.correo,
            nit: peticion.documentoUsuario,
            razonSocial: peticion.razonSocial,
            ruta: 'RUTA PENDIENTE',
            documento: peticion.adjunto ? peticion.adjunto.nombre : undefined,
            telefono: peticion.telefono ?? '',
            problemaAcceso: true,
            errorAcesso: peticion.errorAcceso
        })

        soporte = await this.repositorio.guardar(soporte)
        if (peticion.adjunto) {
            try{
                const archivo = await this.servicioArchivos.guardarArchivo(peticion.adjunto, 'soportes', soporte.nit)
                soporte.documento = archivo.nombreOriginalArchivo
                soporte.identificadorDocumento = archivo.nombreAlmacenado
                soporte.ruta = archivo.ruta
            }catch(e){
                this.repositorio.eliminarSoporte(soporte)
                throw new Exception('Falló la carga del archivo, intentalo nuevamente.', 500)
            }
        }
        soporte.generarRadicado()
        this.enviarEmailNotificacion(soporte);
        return await this.repositorio.actualizarSoporte(soporte)
    }
    private construirLogoAdjunto(){
        const nombreLogo = Env.get('LOGO', 'logo.png');
        const rutaUploads = Application.makePath('uploads', 'logos', nombreLogo);
        const rutaPublic = Application.publicPath('logos', nombreLogo);
        let ruta: string | undefined;
        if (fs.existsSync(rutaUploads)) ruta = rutaUploads; else if (fs.existsSync(rutaPublic)) ruta = rutaPublic; else return undefined;
        const buffer = fs.readFileSync(ruta);
        const stats = fs.statSync(ruta);
        const contentType = nombreLogo.toLowerCase().endsWith('.png') ? 'image/png' : nombreLogo.toLowerCase().endsWith('.gif') ? 'image/gif' : 'image/jpeg';
        return { contenido: buffer, nombre: nombreLogo, tamano: stats.size, cid: 'logo_bienvenida', contentType };
    }
}
