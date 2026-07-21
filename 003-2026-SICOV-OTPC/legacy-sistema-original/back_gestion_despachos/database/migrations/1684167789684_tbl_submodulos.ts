import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'tbl_submodulos'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('smod_id')
      table.string('smod_nombre', 30)
      table.string('smod_nombre_mostrar', 30)
      table.string('smod_ruta', 100)
      table.integer('smod_modulo', 5).references('mod_id').inTable('tbl_modulos')
      table.string('smod_icono')
      table.boolean('smod_estado').defaultTo(true)
      table.timestamp('smod_creado', { useTz: true }).defaultTo(this.now())
      table.timestamp('smod_actualizado', { useTz: true }).defaultTo(this.now())
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
