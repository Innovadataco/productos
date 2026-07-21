import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'tbl_llegadas_solicitudes'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('lle_sol_id')
      table.json('lle_sol_payload').notNullable()
      table.string('lle_sol_nit_vigilado', 20).notNullable()
      table.string('lle_sol_usuario_id', 20).notNullable()
      table.string('lle_sol_fuente', 10).notNullable().defaultTo('WEB')
      table.integer('lle_sol_tipo_llegada').notNullable()
      table.integer('lle_sol_id_despacho').nullable()
      table.string('lle_sol_placa', 10).notNullable()
      table.boolean('lle_sol_procesado').notNullable().defaultTo(false)
      table.integer('lle_sol_id_llegada_externo').nullable()
      table.json('lle_sol_respuesta_externa').nullable()
      table.text('lle_sol_error_externo').nullable()
      table.timestamp('lle_sol_fecha_creacion', { useTz: true }).defaultTo(this.now())
      table.timestamp('lle_sol_fecha_actualizacion', { useTz: true }).defaultTo(this.now())
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
