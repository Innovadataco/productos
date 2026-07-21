import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'tbl_novedades_conductores'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('non_id')
      table.integer('non_id_novedad')
      table.string('non_tipo_identificacion_conductor', 20)
      table.string('non_numero_identificacion', 30)
      table.string('non_primer_nombre_conductor', 100)
      table.string('non_segundo_nombre_conductor', 100)
      table.string('non_primer_apellido_conductor', 45)
      table.string('non_segundo_apellido_conductor', 45)
      table.string('non_id_prueba_alcoholimetria', 50)
      table.string('non_resultado_prueba_alcoholimetria', 20)
      table.date('non_fecha_ultima_prueba_alcoholimetria')
      table.string('non_licencia_conduccion', 50)
      table.date('non_fecha_vencimiento_licencia')
      table.string('non_id_examen_medico', 50)
      table.date('non_fecha_ultimo_examen_medico')
      table.text('non_observaciones')
      table.timestamp('non_fecha_creacion', { useTz: true })
      table.timestamp('non_fecha_actualizacion', { useTz: true })
      table.boolean('non_procesado').defaultTo(false)
      table.boolean('non_estado').defaultTo(true)
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
