import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'tbl_alistamientos'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('tba_id')
      table.string('tba_placa', 6)
      table.integer('tba_tipo_identificacion_responsable')
      table.string('tba_numero_identificacion_responsable')
      table.string('tba_nombres_responsable')
      table.integer('tba_tipo_identificacion_conductor')
      table.string('tba_numero_identificacion_conductor')
      table.string('tba_nombres_conductor')
      table.integer('tba_mantenimiento_id')
      table.text('tba_detalle_actividades')
      table.boolean('tba_estado').defaultTo(true)
      table.boolean('tba_procesado').defaultTo(false)
      table.timestamp('tba_creado', { useTz: true })
      table.timestamp('tba_actualizado', { useTz: true })
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
