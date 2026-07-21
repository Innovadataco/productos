import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'tbl_mantenimiento_jobs'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('tmj_id')
      table.enum('tmj_tipo', ['base', 'preventivo', 'correctivo', 'alistamiento', 'autorizacion']).notNullable()
      table.integer('tmj_mantenimiento_local_id').unsigned().nullable()
      table.integer('tmj_detalle_id').unsigned().nullable()
      table.string('tmj_vigilado_id', 30).notNullable()
      table.string('tmj_usuario_documento', 30).notNullable()
      table.integer('tmj_rol_id').notNullable()
      table.string('tmj_estado', 30).notNullable().defaultTo('pendiente')
      table.integer('tmj_reintentos').notNullable().defaultTo(0)
      table.text('tmj_ultimo_error').nullable()
      table.timestamp('tmj_siguiente_intento', { useTz: true }).defaultTo(this.now())
      table.json('tmj_payload').nullable()
      table.timestamp('tmj_creado', { useTz: true }).defaultTo(this.now())
      table.timestamp('tmj_actualizado', { useTz: true }).defaultTo(this.now())

      table.index(['tmj_estado', 'tmj_siguiente_intento'], 'tmj_estado_intento_idx')
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
