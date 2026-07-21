import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'tbl_funcionalidades'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('fun_id')
      table.string('fun_nombre', 30)
      table.boolean('fun_estado')
      table.timestamp('fun_creado', { useTz: true }).defaultTo(this.now())
      table.timestamp('fun_actualizado', { useTz: true }).defaultTo(this.now())
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
