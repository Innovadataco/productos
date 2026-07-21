import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'tbl_autorizaciones'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('tat_id')
      table.date('tat_fecha_viaje')
      table.string('tat_origen')
      table.string('tat_destino')
      table.integer('tat_tipo_identificacion_nna')
      table.string('tat_numero_identificacion_nna')
      table.string('tat_nombres_apellidos_nna', 255)
      table.string('tat_situacion_discapacidad', 2)
      table.integer('tat_tipo_discapacidad')
      table.string('tat_pertenece_comunidad_etnica', 2)
      table.integer('tat_tipo_poblacion_etnica')
      table.integer('tat_tipo_identificacion_otorgante')
      table.string('tat_numero_identificacion_otorgante')
      table.string('tat_nombres_apellidos_otorgante', 255)
      table.bigInteger('tat_numero_telefonico_otorgante')
      table.string('tat_correo_electronico_otorgante', 255)
      table.string('tat_direccion_fisica_otorgante', 255)
      table.integer('tat_sexo_otorgante')
      table.integer('tat_genero_otorgante')
      table.integer('tat_calidad_actua')
      table.integer('tat_tipo_identificacion_autorizado_viajar')
      table.string('tat_numero_identificacion_autorizado_viajar')
      table.string('tat_nombres_apellidos_autorizado_viajar', 255)
      table.bigInteger('tat_numero_telefonico_autorizado_viajar')
      table.string('tat_direccion_fisica_autorizado_viajar', 255)
      table.integer('tat_tipo_identificacion_autorizado_recoger')
      table.string('tat_numero_identificacion_autorizado_recoger')
      table.string('tat_nombres_apellidos_autorizado_recoger', 255)
      table.bigInteger('tat_numero_telefonico_autorizado_recoger')
      table.string('tat_direccion_fisica_autorizado_recoger', 255)
      table.string('tat_copia_autorizacion_viaje_nombre_original', 200)
      table.string('tat_copia_autorizacion_viaje_documento', 200)
      table.string('tat_copia_autorizacion_viaje_ruta', 200)
      table.string('tat_copia_documento_parentesco_nombre_original', 200)
      table.string('tat_copia_documento_parentesco_documento', 200)
      table.string('tat_copia_documento_parentesco_ruta', 200)
      table.string('tat_copia_documento_identidad_autorizado_nombre_original', 200)
      table.string('tat_copia_documento_identidad_autorizado_documento', 200)
      table.string('tat_copia_documento_identidad_autorizado_ruta', 200)
      table.string('tat_copia_constancia_entrega_nombre_original', 200)
      table.string('tat_copia_constancia_entrega_documento', 200)
      table.string('tat_copia_constancia_entrega_ruta', 200)
      table.integer('tat_mantenimiento_id')
      table.boolean('tat_estado').defaultTo(true)
      table.integer('tat_id_externo')
      table.timestamp('tat_creado', { useTz: true })
      table.timestamp('tat_actualizado', { useTz: true })
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
