import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class AlterNitColumnsBigint extends BaseSchema {
  protected tableNames = ['tbl_preventivos', 'tbl_correctivos'] as const

  public async up () {
    await this.schema.alterTable(this.tableNames[0], (table) => {
      table.bigInteger('tpv_nit').alter()
    })

    await this.schema.alterTable(this.tableNames[1], (table) => {
      table.bigInteger('tcv_nit').alter()
    })
  }

  public async down () {
    await this.schema.alterTable(this.tableNames[0], (table) => {
      table.integer('tpv_nit').alter()
    })

    await this.schema.alterTable(this.tableNames[1], (table) => {
      table.integer('tcv_nit').alter()
    })
  }
}
