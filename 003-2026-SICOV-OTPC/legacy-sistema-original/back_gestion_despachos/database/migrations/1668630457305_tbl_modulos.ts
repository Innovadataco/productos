import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'tbl_modulos'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('mod_id')
      table.string('mod_nombre', 30)
      table.string('mod_nombre_mostrar', 30)
      table.string('mod_ruta', 100)
      table.integer('mod_orden')
      table.string('mod_icono')
      table.boolean('mod_estado')
      table.timestamp('mod_creado', { useTz: true }).defaultTo(this.now())
      table.timestamp('mod_actualizado', { useTz: true }).defaultTo(this.now())
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
