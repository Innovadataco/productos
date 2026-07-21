export class Resultado<T>{
    exitoso: boolean
    estado: number
    datos?: T
    mensaje?: string

    public constructor({
        exitoso,
        estado,
        datos,
        mensaje
    }:{
        exitoso: boolean,
        estado: number,
        datos?: T,
        mensaje?: string
    }){
        this.exitoso = exitoso
        this.estado = estado
        this.datos = datos
        this.mensaje = mensaje
    }
}