import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'tbl_mantenimientos'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('tmt_id')
      table.string('tmt_placa', 6)
      table.timestamp('tmt_fecha_diligenciamiento',{ useTz: true })
      table.integer('tmt_tipo_id')
      table.integer('tmt_usuario_id')
      table.boolean('tmt_estado').defaultTo(true)
      table.boolean('tmt_procesado').defaultTo(false)
      table.integer('tmt_mantenimiento_id')
      table.timestamp('tmt_creado', { useTz: true })
      table.timestamp('tmt_actualizado', { useTz: true })
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
