import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'tbl_novedades_vehiculos'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('noh_id')
      table.integer('noh_id_novedad')
      table.string('noh_placa', 10)
      table.string('noh_soat', 50)
      table.date('noh_fecha_vencimiento_soat')
      table.string('noh_revision_tecnico_mecanica', 50)
      table.date('noh_fecha_revision_tecnico_mecanica')
      table.string('noh_id_polizas', 50)
      table.string('noh_tipo_poliza', 50)
      table.date('noh_vigencia')
      table.string('noh_tarjeta_operacion', 50)
      table.date('noh_fecha_tarjeta_operacion')
      table.string('noh_id_matenimiento', 50)
      table.date('noh_fecha_mantenimiento')
      table.string('noh_id_protocolo_alistamiento_diario', 50)
      table.date('noh_fecha_protocolo_alistamiento_diario')
      table.text('noh_observaciones')
      table.integer('noh_clase')
      table.integer('noh_nivel_servicio')
      table.timestamp('noh_fecha_creacion', { useTz: true })
      table.timestamp('noh_fecha_actualizacion', { useTz: true })
      table.string('noh_id_poliza_contractual', 50)
      table.string('noh_id_poliza_extracontractual', 50)
      table.date('noh_vigenciacontractual')
      table.date('noh_vigenciaextracontractual')
      table.boolean('noh_procesado').defaultTo(false)
      table.boolean('noh_estado').defaultTo(true)
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
