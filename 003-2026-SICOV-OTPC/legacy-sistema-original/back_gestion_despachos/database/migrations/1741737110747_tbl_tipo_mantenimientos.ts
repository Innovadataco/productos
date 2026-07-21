import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'tbl_tipo_mantenimientos'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('ttm_id')
      table.string('ttm_nombre', 150)
      table.boolean('ttm_estado').defaultTo(true)
      table.timestamp('ttm_creado', { useTz: true })
      table.timestamp('ttm_actualizado', { useTz: true })
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
