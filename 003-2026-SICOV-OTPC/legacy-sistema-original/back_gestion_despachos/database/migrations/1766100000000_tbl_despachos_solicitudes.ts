import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'tbl_despachos_solicitudes'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('des_sol_id')
      table.json('des_sol_payload').notNullable()
      table.string('des_sol_nit_vigilado', 20).notNullable()
      table.string('des_sol_usuario_id', 20).notNullable()
      table.string('des_sol_fuente', 10).notNullable().defaultTo('WEB')
      table.boolean('des_sol_procesado').notNullable().defaultTo(false)
      table.integer('des_sol_id_despacho_externo').nullable()
      table.json('des_sol_respuesta_externa').nullable()
      table.text('des_sol_error_externo').nullable()
      table.timestamp('des_sol_fecha_creacion', { useTz: true }).defaultTo(this.now())
      table.timestamp('des_sol_fecha_actualizacion', { useTz: true }).defaultTo(this.now())
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
