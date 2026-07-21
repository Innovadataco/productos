
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm';
import { Soporte } from 'App/Dominio/Datos/Entidades/Soporte';
import { DateTime } from 'luxon';

export class Soportes extends BaseModel {
    static readonly table = "tbl_soporte" 
    @column({ isPrimary: true, columnName: 'id_soporte' }) public id?: number
    @column({ columnName: 'radicado' }) radicado?: string
    @column({ columnName: 'nit' }) nit: string
    @column({ columnName: 'razon_social' }) razonSocial: string
    @column({ columnName: 'email' }) email: string
    @column({ columnName: 'telefono' }) telefono?: string
    @column({ columnName: 'descripcion' }) descripcion: string
    @column({ columnName: 'documento' }) documento?: string // nombre original
    @column({ columnName: 'identificador_documento' }) identificadorDocumento?: string //nombre en sistema de ficheros
    @column({ columnName: 'doc_respuesta' }) documentoRespuesta?: string // nombre original
    @column({ columnName: 'identificador_doc_respuesta' }) identificadorDocumentoRespuesta?: string //nombre en sistema de ficheros
    @column({ columnName: 'ruta' }) ruta: string
    @column({ columnName: 'usuario_respuesta' }) usuarioRespuesta?: string
    @column({ columnName: 'respuesta' }) respuesta?: string
    @column({ columnName: 'id_estado' }) idEstado: number
    @column({ columnName: 'problema_acceso' }) problemaAcceso: boolean
    @column({ columnName: 'error_acceso' }) errorAcceso?: string
    @column({ columnName: 'motivo' }) motivo?: number
    @column.dateTime({ columnName: 'fecha_creacion', autoCreate: true }) fechaCreacion: DateTime
    @column({ columnName: 'fecha_respuesta' }) fechaRespuesta?: DateTime

    obtenerSoporte(): Soporte{
        console.log('obteniendo soporte (respuesta)', this.respuesta)
        return new Soporte({
            descripcion: this.descripcion,
            email: this.email,
            fechaCreacion: this.fechaCreacion,
            idEstado: this.idEstado,
            nit: this.nit,
            razonSocial: this.razonSocial,
            ruta: this.ruta,
            documento: this.documento,
            documentoRespuesta: this.documentoRespuesta,
            fechaRespuesta: this.fechaRespuesta,
            id: this.id,
            identificadorDocumento: this.identificadorDocumento,
            identificadorDocumentoRespuesta: this.identificadorDocumentoRespuesta,
            radicado: this.radicado,
            telefono: this.telefono,
            usuarioRespuesta: this.usuarioRespuesta,
            motivo: this.motivo,
            respuesta: this.respuesta,
            problemaAcceso: this.problemaAcceso,
            errorAcceso: this.errorAcceso
        })
    }

    establecer(soporte: Soporte, persistido: boolean = false){
        this.$isPersisted = persistido
        
        this.id = soporte.id
        this.descripcion = soporte.descripcion
        this.email = soporte.email
        this.fechaCreacion = soporte.fechaCreacion
        this.idEstado = soporte.idEstado
        this.nit = soporte.nit
        this.razonSocial = soporte.razonSocial
        this.ruta = soporte.ruta
        this.documento = soporte.documento
        this.documentoRespuesta = soporte.documentoRespuesta
        this.fechaRespuesta = soporte.fechaRespuesta
        this.identificadorDocumento = soporte.identificadorDocumento
        this.identificadorDocumentoRespuesta = soporte.identificadorDocumentoRespuesta
        this.radicado = soporte.radicado
        this.telefono = soporte.telefono
        this.usuarioRespuesta = soporte.usuarioRespuesta
        this.motivo = soporte.motivo
        this.respuesta = soporte.respuesta
        this.problemaAcceso = soporte.problemaAcceso
        this.errorAcceso = soporte.errorAcceso
    }
}
