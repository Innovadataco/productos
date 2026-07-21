import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'tbl_archivo_programas'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('tap_id')
      table.string('tap_nombre_original', 200)
      table.string('tap_documento', 200)
      table.string('tap_ruta', 200)
      table.integer('tap_tipo_id').unsigned().references('ttm_id').inTable('tbl_tipo_mantenimientos').onDelete('cascade').onUpdate('cascade')
      table.integer('tap_usuario_id').nullable()
      table.boolean('tap_estado').defaultTo(true)
      table.timestamp('tap_creado', { useTz: true })
      table.timestamp('tap_actualizado', { useTz: true })
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
