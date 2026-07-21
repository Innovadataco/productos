import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'tbl_despachos_solicitudes'

  public async up () {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('des_sol_estado', 30).notNullable().defaultTo('pendiente')
      table.integer('des_sol_reintentos').notNullable().defaultTo(0)
      table.integer('des_sol_rol_id').nullable()
      table.timestamp('des_sol_siguiente_intento', { useTz: true }).defaultTo(this.now())
      table.index(['des_sol_estado', 'des_sol_siguiente_intento'], 'des_sol_estado_intento_idx')
    })

    // Las solicitudes ya enviadas no deben volver a procesarse por el worker
    this.defer(async (db) => {
      await db.from(this.tableName)
        .where('des_sol_procesado', true)
        .update({ des_sol_estado: 'procesado' })
    })
  }

  public async down () {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['des_sol_estado', 'des_sol_siguiente_intento'], 'des_sol_estado_intento_idx')
      table.dropColumn('des_sol_estado')
      table.dropColumn('des_sol_reintentos')
      table.dropColumn('des_sol_rol_id')
      table.dropColumn('des_sol_siguiente_intento')
    })
  }
}
