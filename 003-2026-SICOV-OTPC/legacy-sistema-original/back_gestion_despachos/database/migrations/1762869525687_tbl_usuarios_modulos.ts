import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'tbl_usuarios_modulos'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('usm_id')
      table.integer('usm_usuario_id').unsigned().references('usn_id').inTable('tbl_usuarios').onDelete('CASCADE')
      table.integer('usm_modulo_id').unsigned().references('mod_id').inTable('tbl_modulos').onDelete('CASCADE')
      table.boolean('usm_estado').defaultTo(true)
      table.timestamp('usm_creado', { useTz: true }).defaultTo(this.now())
      table.timestamp('usm_actualizado', { useTz: true }).defaultTo(this.now())

      // Índice único para evitar duplicados
      table.unique(['usm_usuario_id', 'usm_modulo_id'])
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
