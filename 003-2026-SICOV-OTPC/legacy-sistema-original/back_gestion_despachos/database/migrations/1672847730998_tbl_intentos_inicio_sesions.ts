import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'tbl_bloqueo_usuarios'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('blu_id')
      table.string('blu_identificacion').unique()
      table.integer('blu_intentos_fallidos', 1).defaultTo(0)
      table.boolean('blu_bloqueado').defaultTo(false)
      table.timestamp('blu_ultimo_intento', {useTz: true })
      table.timestamp('blu_actualizacion', { useTz: true }).defaultTo(this.now())
      table.timestamp('blu_creacion', { useTz: true }).defaultTo(this.now())
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
