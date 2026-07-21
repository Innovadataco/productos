import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'tbl_roles_modulos'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('rom_id')
      table.integer('rom_rol_id').references('rol_id').inTable('tbl_roles')
      table.integer('rom_modulo_id').references('mod_id').inTable('tbl_modulos')
      table.timestamp('rom_creado', { useTz: true }).defaultTo(this.now())
      table.timestamp('rom_actualizado', { useTz: true }).defaultTo(this.now())
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
