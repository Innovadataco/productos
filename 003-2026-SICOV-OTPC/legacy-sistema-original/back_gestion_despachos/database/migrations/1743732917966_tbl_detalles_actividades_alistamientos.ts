import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'tbl_detalles_actividades_alistamientos'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('tda_id')
      table.integer('tda_alistamiento_id').unsigned().references('tba_id').inTable('tbl_alistamientos').onDelete('cascade').onUpdate('cascade')
      table.integer('tda_actividad_id').unsigned().references('taa_id').inTable('tbl_actividades_alistamientos').onDelete('cascade').onUpdate('cascade')
      table.boolean('tda_estado').defaultTo(true)
      table.timestamp('tda_creado', { useTz: true })
      table.timestamp('tda_actualizado', { useTz: true })

    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
