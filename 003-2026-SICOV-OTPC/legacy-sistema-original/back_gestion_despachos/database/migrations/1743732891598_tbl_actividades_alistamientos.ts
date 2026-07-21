import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'tbl_actividades_alistamientos'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('taa_id')
      table.string('taa_nombre', 255)     
      table.boolean('taa_estado').defaultTo(true)
      table.timestamp('taa_creado', { useTz: true })
      table.timestamp('taa_actualizado', { useTz: true })
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
