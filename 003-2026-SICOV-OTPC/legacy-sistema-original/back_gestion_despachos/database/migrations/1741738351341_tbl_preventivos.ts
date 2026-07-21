import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'tbl_preventivos'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('tpv_id')
      table.string('tpv_placa', 6)
      table.date('tpv_fecha')
      table.time('tpv_hora')
      table.integer('tpv_nit')
      table.string('tpv_razon_social', 200)
      table.integer('tpv_tipo_identificacion')
      table.string('tpv_numero_identificacion')
      table.string('tpv_nombres_responsable')
      table.integer('tpv_mantenimiento_id')
      table.text('tpv_detalle_actividades')
      table.boolean('tpv_estado').defaultTo(true)
      table.boolean('tpv_procesado').defaultTo(false)
      table.timestamp('tpv_creado', { useTz: true })
      table.timestamp('tpv_actualizado', { useTz: true })
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
