import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'tbl_roles_modulos_funcionalidades'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('rmf_id')
      table.integer('rmf_rol_id').references('rol_id').inTable('tbl_roles')
      table.integer('rmf_modulo_id').references('mod_id').inTable('tbl_modulos')
      table.integer('rmf_funcionalidad_id').references('fun_id').inTable('tbl_funcionalidades')
      table.timestamp('rmf_creado', { useTz: true })
      table.timestamp('rmf_actualizado', { useTz: true })
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
