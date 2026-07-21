import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'tbl_novedades'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('nov_id')
      table.integer('nov_id_despacho')
      table.integer('nov_id_novedad')
      table.text('nov_descripcion')
      table.timestamp('nov_fecha_creacion', { useTz: true })
      table.timestamp('nov_fecha_actualizacion', { useTz: true })
      table.integer('nov_tipo_novedad_id')
      table.time('nov_hora_novedad')
      table.date('nov_fecha_novedad')
      table.string('nov_nit_proveedor', 255)
      table.string('nov_fuente')
      table.string('nov_usuario_id', 20)
      table.text('nov_otros')
      table.boolean('nov_procesado').defaultTo(false)
      table.boolean('nov_estado').defaultTo(true)
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
