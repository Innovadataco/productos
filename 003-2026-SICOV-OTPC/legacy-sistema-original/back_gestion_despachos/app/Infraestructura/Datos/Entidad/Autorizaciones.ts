import { BaseModel, beforeCreate, column } from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';
import Env from '@ioc:Adonis/Core/Env';
export default class TblAutorizaciones extends BaseModel {
  @column({ isPrimary: true, columnName: 'tat_id' }) public id?: number;

  @column({ columnName: 'tat_fecha_viaje' }) public fechaViaje: Date;
  @column({ columnName: 'tat_origen' }) public origen: string;
  @column({ columnName: 'tat_destino' }) public destino: string;
  @column({ columnName: 'tat_tipo_identificacion_nna' }) public tipoIdentificacionNna: number;
  @column({ columnName: 'tat_numero_identificacion_nna' }) public numeroIdentificacionNna: string;
  @column({ columnName: 'tat_nombres_apellidos_nna' }) public nombresApellidosNna: string;
  @column({ columnName: 'tat_situacion_discapacidad' }) public situacionDiscapacidad: string;
  @column({ columnName: 'tat_tipo_discapacidad' }) public tipoDiscapacidad: number;
  @column({ columnName: 'tat_pertenece_comunidad_etnica' }) public perteneceComunidadEtnica: string;
  @column({ columnName: 'tat_tipo_poblacion_etnica' }) public tipoPoblacionEtnica: number;
  @column({ columnName: 'tat_tipo_identificacion_otorgante' }) public tipoIdentificacionOtorgante: number;
  @column({ columnName: 'tat_numero_identificacion_otorgante' }) public numeroIdentificacionOtorgante: string;
  @column({ columnName: 'tat_nombres_apellidos_otorgante' }) public nombresApellidosOtorgante: string;
  @column({ columnName: 'tat_numero_telefonico_otorgante' }) public numeroTelefonicoOtorgante: number;
  @column({ columnName: 'tat_correo_electronico_otorgante' }) public correoElectronicoOtorgante: string;
  @column({ columnName: 'tat_direccion_fisica_otorgante' }) public direccionFisicaOtorgante: string;
  @column({ columnName: 'tat_sexo_otorgante' }) public sexoOtorgante: number;
  @column({ columnName: 'tat_genero_otorgante' }) public generoOtorgante: number;
  @column({ columnName: 'tat_calidad_actua' }) public calidadActua: number;
  @column({ columnName: 'tat_tipo_identificacion_autorizado_viajar' }) public tipoIdentificacionAutorizadoViajar: number;
  @column({ columnName: 'tat_numero_identificacion_autorizado_viajar' }) public numeroIdentificacionAutorizadoViajar: string;
  @column({ columnName: 'tat_nombres_apellidos_autorizado_viajar' }) public nombresApellidosAutorizadoViajar: string;
  @column({ columnName: 'tat_numero_telefonico_autorizado_viajar' }) public numeroTelefonicoAutorizadoViajar: number;
  @column({ columnName: 'tat_direccion_fisica_autorizado_viajar' }) public direccionFisicaAutorizadoViajar: string;
  @column({ columnName: 'tat_tipo_identificacion_autorizado_recoger' }) public tipoIdentificacionAutorizadoRecoger: number;
  @column({ columnName: 'tat_numero_identificacion_autorizado_recoger' }) public numeroIdentificacionAutorizadoRecoger: string;
  @column({ columnName: 'tat_nombres_apellidos_autorizado_recoger' }) public nombresApellidosAutorizadoRecoger: string;
  @column({ columnName: 'tat_numero_telefonico_autorizado_recoger' }) public numeroTelefonicoAutorizadoRecoger: number;
  @column({ columnName: 'tat_direccion_fisica_autorizado_recoger' }) public direccionFisicaAutorizadoRecoger: string;
  @column({ columnName: 'tat_copia_autorizacion_viaje_nombre_original' }) public copiaAutorizacionViajeNombreOriginal: string;
  @column({ columnName: 'tat_copia_autorizacion_viaje_documento' }) public copiaAutorizacionViajeDocumento: string;
  @column({ columnName: 'tat_copia_autorizacion_viaje_ruta' }) public copiaAutorizacionViajeRuta: string;
  @column({ columnName: 'tat_copia_documento_parentesco_nombre_original' }) public copiaDocumentoParentescoNombreOriginal: string;
  @column({ columnName: 'tat_copia_documento_parentesco_documento' }) public copiaDocumentoParentescoDocumento: string;
  @column({ columnName: 'tat_copia_documento_parentesco_ruta' }) public copiaDocumentoParentescoRuta: string;
  @column({ columnName: 'tat_copia_documento_identidad_autorizado_nombre_original' }) public copiaDocumentoIdentidadAutorizadoNombreOriginal: string;
  @column({ columnName: 'tat_copia_documento_identidad_autorizado_documento' }) public copiaDocumentoIdentidadAutorizadoDocumento: string;
  @column({ columnName: 'tat_copia_documento_identidad_autorizado_ruta' }) public copiaDocumentoIdentidadAutorizadoRuta: string;
  @column({ columnName: 'tat_copia_constancia_entrega_nombre_original' }) public copiaConstanciaEntregaNombreOriginal: string;
  @column({ columnName: 'tat_copia_constancia_entrega_documento' }) public copiaConstanciaEntregaDocumento: string;
  @column({ columnName: 'tat_copia_constancia_entrega_ruta' }) public copiaConstanciaEntregaRuta: string;
  @column({ columnName: 'tat_mantenimiento_id' }) public mantenimientoId: number;

  @column({ columnName: 'tat_estado' }) public estado?: boolean;
  @column.dateTime({ autoCreate: true, columnName: 'tat_creado' }) public createdAt: DateTime;
  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'tat_actualizado' }) public updatedAt: DateTime;


    @beforeCreate()
  public static ajustarFechaCreacion(autorizacion: TblAutorizaciones) {
    const offset = Number.parseInt(Env.get('TIMEZONE_OFFSET_HOURS', '0'), 10);
    const horas = Number.isNaN(offset) ? 0 : offset;
    autorizacion.createdAt = DateTime.now().minus({ hours: horas });
  }

}
