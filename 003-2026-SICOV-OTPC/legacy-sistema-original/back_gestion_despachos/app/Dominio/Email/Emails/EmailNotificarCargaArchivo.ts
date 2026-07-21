import { Email } from "../Email";
import { NotificacionCargaArchivo } from "../Modelos/NotificacionCargaArchivo";

export class EmailNotificarCargaArchivo implements Email<NotificacionCargaArchivo>{
    private readonly _modelo: NotificacionCargaArchivo
    private readonly _rutaTemplate: string = "App/Dominio/Email/Templates/notificacion-entidad-cliente.edge"

    constructor(modelo: NotificacionCargaArchivo) {
        this._modelo = modelo
     }

    get rutaTemplate(): string {
        return this._rutaTemplate
    }

    get modelo(): NotificacionCargaArchivo {
        return this._modelo
    }
}