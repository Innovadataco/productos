import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'tbl_proveedores_vigilados'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('tpv_id')
      table.string('tpv_empresa')
      table.string('tpv_vigilado')
      table.uuid('tpv_token')
      table.boolean('tpv_estado').defaultTo(true)
      table.date('tpv_fecha_inicial').comment('fecha inicial del contrato')
      table.date('tpv_fecha_final').comment('fecha final del contrato')
      table.string('tpv_documento')
      table.string('tpv_ruta')
      table.string('tpv_nombre_original')


      table.timestamp('tpv_created_at', { useTz: true }).defaultTo( this.now() )
      table.timestamp('tpv_updated_at', { useTz: true }).defaultTo( this.now() )
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
