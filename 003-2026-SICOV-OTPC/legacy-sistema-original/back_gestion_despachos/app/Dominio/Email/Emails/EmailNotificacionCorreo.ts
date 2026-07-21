import { Email } from "../Email";
import { NotificacionCorreo } from "../Modelos/NotificacionCorreo";

export class EmailnotificacionCorreo implements Email<NotificacionCorreo>{
    private readonly _modelo: NotificacionCorreo
    private readonly _rutaTemplate: string = "app/Dominio/Email/Templates/notificacion-correo.edge"

    constructor(modelo: NotificacionCorreo) {
        this._modelo = modelo
     }

    get rutaTemplate(): string {
        return this._rutaTemplate
    }

    get modelo(): NotificacionCorreo {
        return this._modelo
    }
}