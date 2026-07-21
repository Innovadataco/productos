import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'tbl_estados'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('est_id')
      table.string('est_nombre', 150)
      table.boolean('est_estado').defaultTo(true)
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
