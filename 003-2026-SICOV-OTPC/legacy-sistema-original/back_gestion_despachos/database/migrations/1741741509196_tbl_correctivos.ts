import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'tbl_correctivos'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('tcv_id')
      table.string('tcv_placa', 6)
      table.date('tcv_fecha')
      table.time('tcv_hora')
      table.integer('tcv_nit')
      table.string('tcv_razon_social', 200)
      table.integer('tcv_tipo_identificacion')
      table.string('tcv_numero_identificacion')
      table.string('tcv_nombres_responsable', 200)
      table.integer('tcv_mantenimiento_id')
      table.text('tcv_detalle_actividades')
      table.boolean('tcv_estado').defaultTo(true)
      table.boolean('tcv_procesado').defaultTo(false)
      table.timestamp('tcv_creado', { useTz: true })
      table.timestamp('tcv_actualizado', { useTz: true })
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
