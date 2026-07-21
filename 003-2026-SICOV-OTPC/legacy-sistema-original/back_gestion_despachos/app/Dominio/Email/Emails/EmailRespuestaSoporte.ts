import { Email } from "../Email";
import { RespuestaSoporte } from "../Modelos/RespuestaSoporte";

export class EmailRespuestaSoporte implements Email<RespuestaSoporte>{
    private readonly _modelo: RespuestaSoporte
    private readonly _rutaTemplate: string = "app/Dominio/Email/Templates/respuesta-soporte.edge"

    constructor(modelo: RespuestaSoporte) {
        this._modelo = modelo
     }

    get rutaTemplate(): string {
        return this._rutaTemplate
    }

    get modelo(): RespuestaSoporte {
        return this._modelo
    }
}