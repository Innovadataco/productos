import { BaseModel, column } from "@ioc:Adonis/Lucid/Orm";
import { RegistroBloqueo } from "App/Dominio/Datos/Entidades/Usuarios/RegistroBloqueo";
import { DateTime } from "luxon";


export class TblRegistroBloqueo extends BaseModel{

    public static table = 'tbl_bloqueo_usuarios'
    @column({columnName: 'blu_id'})
    id:number;

    @column({columnName: 'blu_identificacion'})
    identificacion:string;

    @column({columnName: 'blu_intentos_fallidos'})
    intentos:number;

    @column({columnName: 'blu_bloqueado'})
    bloqueado:boolean;

    @column.dateTime({columnName: 'blu_ultimo_intento'})
    ultimoIntento:DateTime | null;

    @column.dateTime({columnName: 'blu_creacion'})
    creacion:DateTime;

    @column.dateTime({columnName: 'blu_actualizacion'})
    actualizacion:DateTime;

    public obtenerRegistroBloqueo():RegistroBloqueo{
        const registro = new RegistroBloqueo(
           this.identificacion,
           this.intentos,
           this.bloqueado,
           this.ultimoIntento,
           this.creacion,
           this.actualizacion
        )
        registro.asignarId(this.id)
        return registro
    }

    public establecerRegistroBloqueo(registro:RegistroBloqueo):void{
        this.identificacion = registro.identificacion
        this.intentos = registro.intentos
        this.bloqueado = registro.bloqueado
        this.ultimoIntento = registro.ultimoIntento
        this.creacion = registro.creacion
        this.actualizacion = registro.actualizacion
    }

}
