import { Email } from "../Email";
import { Credenciales } from "../Modelos/Credenciales";

export class EmailRecuperacionContrasena implements Email<Credenciales>{
    private readonly _modelo: Credenciales
    private readonly _rutaTemplate: string = "app/Dominio/Email/Templates/recuperacion-contrasena.edge"

    constructor(modelo: Credenciales) {
        this._modelo = modelo
     }

    get rutaTemplate(): string {
        return this._rutaTemplate
    }

    get modelo(): Credenciales {
        return this._modelo
    }
}