import { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import { ServicioUsuario } from "App/Dominio/Datos/Servicios/ServicioUsuario";
import { RepositorioUsuariosDB } from "App/Infraestructura/Implementacion/Lucid/RepositorioUsuariosDB";
import { validarActualizarUsuario } from "./Validadores/ActualizarUsuario";

export default class ControladorUsuario {
    private servicio = new ServicioUsuario(new RepositorioUsuariosDB())

    constructor() { }

    async actualizarUsuario({ request, response }: HttpContextContract) {
        const identificacion = request.param('identificacion')
        const payload = await request.validate({ schema: validarActualizarUsuario })
        const usuario = await this.servicio.actualizarInformacionUsuario(payload, identificacion)
        response.status(200).send(usuario)
    }


}
