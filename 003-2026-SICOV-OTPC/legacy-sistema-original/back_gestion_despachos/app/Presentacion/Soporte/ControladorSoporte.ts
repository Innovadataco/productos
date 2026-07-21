import { extname } from "path";
import { HttpContextContract } from "@ioc:Adonis/Core/HttpContext"
import Drive from "@ioc:Adonis/Core/Drive"
import { ServicioSoporte } from "App/Dominio/Datos/Servicios/ServicioSoporte";
import { ServicioUsuario } from "App/Dominio/Datos/Servicios/ServicioUsuario";
import { RepositorioFicheroLocal } from "App/Infraestructura/Ficheros/RepositorioFicheroLocal";
import { RepositorioSoporteDB } from "App/Infraestructura/Implementacion/Lucid/RepositorioSoporteDB";
import { RepositorioUsuariosDB } from "App/Infraestructura/Implementacion/Lucid/RepositorioUsuariosDB";
import { crearSoporteSchema } from "./Validadores/CrearSoporte";
import { MapeadorFicheroAdonis } from "../Mapeadores/MapeadorFicheroAdonis";
import { FiltrosSoporte } from "App/Dominio/Dto/Soporte/FiltrosSoporte";
import { crearRespuesta } from "./Validadores/CrearRespuesta";
import { RepositorioMotivoSoporte } from "App/Dominio/Repositorios/RepositorioMotivoSoporte";
import { RepositorioMotivoSoporteDB } from "App/Infraestructura/Implementacion/Lucid/RepositorioMotivoSoporteDB";
import { EnviadorEmailAdonis } from "App/Infraestructura/Email/EnviadorEmailAdonis";
import { ServicioArchivos } from "App/Dominio/Datos/Servicios/ServicioArchivos";
import { ClienteHttpAxios } from "App/Infraestructura/ClientesHttp/ClienteHttpAxios";

export default class ControladorSoporte{
    private servicio: ServicioSoporte
    private repositorioMotivos: RepositorioMotivoSoporte
    constructor(){
        this.servicio = new ServicioSoporte( 
            new RepositorioSoporteDB(),
            new RepositorioFicheroLocal(),
            new ServicioUsuario( new RepositorioUsuariosDB() ),
            new ServicioArchivos(new ClienteHttpAxios()),
            new EnviadorEmailAdonis()
        )
        this.repositorioMotivos = new RepositorioMotivoSoporteDB()
    }

    async responder({ request, response }: HttpContextContract ){
        const payload = await request.obtenerPayloadJWT()
        const idSoporte = request.param('idSoporte')
        const { adjunto, respuesta } = await request.validate({ schema: crearRespuesta })
        const soporte = await this.servicio.responder({
            respuesta: respuesta,
            identificacionUsuarioAdmin: payload.documento,
            soporteId: idSoporte,
            adjunto: adjunto ? await MapeadorFicheroAdonis.obtenerFichero(adjunto) : undefined
        })
        response.status(200).send(soporte)
    }

    async guardar({ request, response }: HttpContextContract ){
        const payload = await request.obtenerPayloadJWT()
        const { adjunto, descripcion, motivo } = await request.validate({ schema: crearSoporteSchema })
        const soporte = await this.servicio.guardar({
            adjunto: adjunto ? await MapeadorFicheroAdonis.obtenerFichero(adjunto) : undefined,
            descripcion: descripcion,
            documentoUsuario: payload.documento,
            motivo: motivo
        }, false)
        response.status(201).send(soporte)
    }

    async guardarSinAcceso({ request, response }: HttpContextContract){
        const peticion = await request.validate({ schema: crearSoporteSchema })
        if(!peticion.nit){
            response.status(400).send({
                mensaje: 'El nit es obligatorio para soportes de problemas de acceso.'
            })
            return;
        }
        const soporte = await this.servicio.guardar({
            adjunto: peticion.adjunto ? await MapeadorFicheroAdonis.obtenerFichero(peticion.adjunto) : undefined,
            descripcion: peticion.descripcion,
            documentoUsuario: peticion.nit,
            correo: peticion.correo,
            telefono: peticion.telefono,
            razonSocial: peticion.razonSocial
        }, true)
        response.status(201).send(soporte)
    }

    async listar({ request, response }: HttpContextContract ){
        const querys = request.qs()
        const pagina = querys.pagina ?? 1
        const limite = querys.limite ?? 5
        const filtros = querys as FiltrosSoporte
        const paginable = await this.servicio.listar(pagina, limite, filtros)
        response.status(200).send(paginable)
    }

    async listarVigilado({ request, response }: HttpContextContract ){
        const {nit} = request.all()
        const soportes = await this.servicio.listarVigilado(nit)
        response.status(200).send(soportes)
    }

    async listarMotivos({response}: HttpContextContract){
        const motivos = await this.repositorioMotivos.listar()
        response.status(200).send(motivos)
    }

    async descargarAdjunto({request, response}: HttpContextContract){
        const nombreArchivo = request.param('archivo')
        try {
            const { size } = await Drive.getStats(`soportes/${nombreArchivo}`)
            response.type(extname(`soportes/${nombreArchivo}`))
            response.header('content-length', size)
            const archivo = await Drive.getStream(`soportes/${nombreArchivo}`)
            response.header('content-disposition', `attachment; filename=${nombreArchivo}`)
            return response.stream(archivo)
        } catch (error) {
            response.status(404).send("Archivo no encontrado")
        }
    }

    async descargarAdjuntoRespuesta({request, response}: HttpContextContract){
        const nombreArchivo = request.param('archivo')
        try {
            const { size } = await Drive.getStats(`respuestas_soportes/${nombreArchivo}`)
            response.type(extname(`respuestas_soportes/${nombreArchivo}`))
            response.header('content-length', size)
            const archivo = await Drive.getStream(`respuestas_soportes/${nombreArchivo}`)
            response.header('content-disposition', `attachment; filename=${nombreArchivo}`)
            return response.stream(archivo)
        } catch (error) {
            response.status(404).send("Archivo no encontrado")
        }
    }
}