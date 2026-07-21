import { Schema } from '@adonisjs/lucid/build/src/Schema'

export default class LogsErrores extends Schema {
  public async up () {
    this.schema.createTable('tbl_logs_errores', (table) => {
      table.increments('log_id')
      table.string('log_mensaje', 1024).notNullable()
      table.text('log_stack_trace')
      table.string('log_usuario').nullable()
      table.string('log_endpoint').nullable()
      table.timestamp('log_creacion', { useTz: true }).defaultTo(this.now())
    })
  }

  public async down () {
    this.schema.dropTable('tbl_logs_errores')
  }
}
