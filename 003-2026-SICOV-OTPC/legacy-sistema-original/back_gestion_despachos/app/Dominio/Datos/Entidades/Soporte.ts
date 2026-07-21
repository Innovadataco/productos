import { DateTime } from "luxon"
import { ParametrosInstanciaSoporte } from "./Dtos/ParametrosInstanciaSoporte"
import { ParametrosCrearSoporte } from "./Dtos/ParametrosCrearSoporte"
import { Exception } from "@adonisjs/core/build/standalone"

export class Soporte{
    // 1 abierto, 2 en revisión, 3 cerrado
    private static readonly ESTADO_POR_DEFECTO: number = 1

    id?: number
    radicado?: string
    nit: string
    razonSocial: string
    email: string
    telefono?: string
    descripcion: string
    documento?: string // nombre original
    identificadorDocumento?: string //nombre en sistema de ficheros
    documentoRespuesta?: string // nombre original
    identificadorDocumentoRespuesta?: string //nombre en sistema de ficheros
    ruta: string
    usuarioRespuesta?: string
    motivo?: number
    errorAcceso?: string
    idEstado: number 
    fechaCreacion: DateTime
    fechaRespuesta?: DateTime
    respuesta?: string
    problemaAcceso: boolean

    constructor(parametros: ParametrosInstanciaSoporte){
        this.id = parametros.id
        this.radicado = parametros.radicado 
        this.nit = parametros.nit
        this.razonSocial = parametros.razonSocial
        this.email = parametros.email
        this.telefono = parametros.telefono
        this.descripcion = parametros.descripcion
        this.documento = parametros.documento
        this.identificadorDocumento = parametros.identificadorDocumento
        this.documentoRespuesta = parametros.documentoRespuesta
        this.identificadorDocumentoRespuesta = parametros.identificadorDocumentoRespuesta
        this.ruta = parametros.ruta
        this.respuesta = parametros.respuesta
        this.usuarioRespuesta = parametros.usuarioRespuesta
        this.idEstado = parametros.idEstado
        this.fechaCreacion = parametros.fechaCreacion
        this.fechaRespuesta = parametros.fechaRespuesta
        this.problemaAcceso = parametros.problemaAcceso
        this.motivo = parametros.motivo
        this.errorAcceso = parametros.errorAcceso
    }

    public static crear(parametros: ParametrosCrearSoporte){
        return new Soporte({
            descripcion: parametros.descripcion,
            documento: parametros.documento,
            email: parametros.email,
            fechaCreacion: DateTime.now(),
            idEstado: this.ESTADO_POR_DEFECTO,
            nit: parametros.nit,
            razonSocial: parametros.razonSocial,
            ruta: parametros.ruta,
            telefono: parametros.telefono,
            problemaAcceso: parametros.problemaAcceso,
            motivo: parametros.motivo,
            errorAcceso: parametros.errorAcesso
        })
    }

    public generarRadicado(): string{
        if(!this.id){
            throw new Exception('Este radicado no tiene un id asignado aún', 500)
        }
        const anio = DateTime.now().year
        //logica para generar radicado
        const consecutivo = String(this.id).padStart(6, '0')
        this.radicado = `POLIZA${anio}${consecutivo}`
        return this.radicado
    }
}